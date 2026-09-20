/**
 * Weekly subscriber report — Thursday evening.
 *
 * Snapshots the current EN/PT subscriber counts to
 * data/subscriber-history.json (committed like the run-ledger), diffs
 * against last week's snapshot, and emails the editor a summary with
 * week-over-week growth ("+12 this week").
 *
 * Idempotent: if a snapshot for this week's Thursday already exists, it
 * skips (append + email happen once per week regardless of re-dispatch).
 * Deliberately NOT in the run-ledger/watchdog — a missed weekly stat email
 * is low-stakes, and the history-file check already makes re-runs no-ops.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getSubscriberStats, type SubscriberStats } from '@/lib/audiences';
import { getFileContent, commitFiles } from '@/lib/github';
import { sendEmail } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';
import { thursdayWeekStart } from '@/lib/archive';
import { getInstagramStats } from '@/lib/instagram';
import { getSearchTraffic, type SearchTraffic } from '@/lib/search-engines';

const EDITOR_EMAIL = 'barisergin@gmail.com';
const HISTORY_PATH = 'data/subscriber-history.json';

interface Snapshot extends SubscriberStats {
  week: string; // Thursday date, YYYY-MM-DD
  takenAt: string; // ISO timestamp
  // Both optional: older snapshots predate them, and either source can be
  // unconfigured/unavailable. Deltas are only shown when last week has one.
  instagramFollowers?: number;
  search?: { clicks: number; impressions: number };
}

/**
 * GSC reports with a ~2-3 day lag, so "this week" is the 7 complete days
 * ending 3 days ago, and the comparison window is the 7 days before that.
 */
function trafficWindows(now: Date) {
  const day = (offset: number) => new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10);
  return { curStart: day(9), curEnd: day(3), prevStart: day(16), prevEnd: day(10) };
}

function pct(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? 'new' : '—';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? '+' : ''}${p}%`;
}

function fmtDelta(n: number): string {
  if (n > 0) return `<span style="color:#0b7a3b;font-weight:600;">+${n}</span>`;
  if (n < 0) return `<span style="color:#b3261e;font-weight:600;">${n}</span>`;
  return `<span style="color:#8a8170;">±0</span>`;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const now = new Date();
    const week = thursdayWeekStart(now).toISOString().slice(0, 10);
    // ?preview=true — render + email the current numbers without writing a
    // snapshot or honouring the once-per-week guard. For checking format
    // changes off-cycle; deltas still compare against the last real snapshot.
    const preview = new URL(req.url).searchParams.get('preview') === 'true';

    // Load history (oldest→newest).
    const raw = await getFileContent(HISTORY_PATH);
    const history: Snapshot[] = raw ? (JSON.parse(raw) as Snapshot[]) : [];

    // Idempotency — already snapshotted this week? Skip.
    if (!preview && history.some((h) => h.week === week)) {
      return NextResponse.json({ skipped: true, reason: 'already-snapshotted', week });
    }

    const stats = await getSubscriberStats();

    // Instagram + search traffic are nice-to-have: a failure in either must
    // not cost us the subscriber snapshot (the only irreplaceable part —
    // it's the week's only record of the count).
    const w = trafficWindows(now);
    const [igRes, curRes, prevRes] = await Promise.allSettled([
      getInstagramStats(),
      getSearchTraffic(w.curStart, w.curEnd),
      getSearchTraffic(w.prevStart, w.prevEnd),
    ]);
    const ig = igRes.status === 'fulfilled' ? igRes.value : null;
    const curTraffic = curRes.status === 'fulfilled' ? curRes.value : null;
    const prevTraffic = prevRes.status === 'fulfilled' ? prevRes.value : null;
    const problems = [igRes, curRes, prevRes]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    problems.forEach((m) => console.error('[cron/subscriber-report] extra metric failed:', m));

    const snapshot: Snapshot = {
      week,
      takenAt: now.toISOString(),
      ...stats,
      ...(ig ? { instagramFollowers: ig.followers } : {}),
      ...(curTraffic ? { search: { clicks: curTraffic.clicks, impressions: curTraffic.impressions } } : {}),
    };

    // Previous snapshot for deltas (may be absent on the first-ever run).
    // In preview mode the newest snapshot may be this week's own row, so step
    // back one to compare against a different week rather than against itself.
    const candidates = preview ? history.filter((h) => h.week !== week) : history;
    const prev = candidates.length > 0 ? candidates[candidates.length - 1] : null;
    const d = (cur: number, was: number | undefined) => cur - (was ?? cur);
    const dTotal = d(stats.activeUniqueTotal, prev?.activeUniqueTotal);
    const dEn = d(stats.en.active, prev?.en.active);
    const dPt = d(stats.pt.active, prev?.pt.active);
    const newUnsubEn = d(stats.en.unsubscribed, prev?.en.unsubscribed);
    const newUnsubPt = d(stats.pt.unsubscribed, prev?.pt.unsubscribed);
    const dIg = ig && prev?.instagramFollowers != null ? ig.followers - prev.instagramFollowers : null;

    // Persist the new snapshot (append, keep sorted, cap to last 104 weeks / 2y).
    if (!preview) {
      const updated = [...history, snapshot]
        .sort((a, b) => a.week.localeCompare(b.week))
        .slice(-104);
      await commitFiles(
        [{ path: HISTORY_PATH, content: JSON.stringify(updated, null, 2) + '\n' }],
        `chore(subscribers): weekly snapshot ${week} — ${stats.activeUniqueTotal} active`
      );
    }

    // Email the editor.
    const deltaSuffix = prev ? ` (${dTotal >= 0 ? '+' : ''}${dTotal} this week)` : '';
    const igSuffix = ig ? ` · ${ig.followers} IG${dIg != null ? ` (${dIg >= 0 ? '+' : ''}${dIg})` : ''}` : '';
    const subject = `${preview ? '[preview] ' : ''}Oporto Weekly — ${stats.activeUniqueTotal} subscribers${deltaSuffix}${igSuffix}`;
    const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:520px;margin:24px auto;padding:0 16px;color:#1a1a2e;">
  <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 4px;">${stats.activeUniqueTotal} active subscribers</h1>
  <p style="color:#5a5a5a;margin:0 0 24px;font-size:14px;">Week of ${week}${prev ? ` · ${fmtDelta(dTotal)} vs last week` : ' · first report'}</p>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">
    <tr style="border-bottom:2px solid #1a1a2e;">
      <th style="text-align:left;padding:8px 0;">Audience</th>
      <th style="text-align:right;padding:8px 0;">Active</th>
      <th style="text-align:right;padding:8px 0;">Δ week</th>
      <th style="text-align:right;padding:8px 0;">Unsub'd</th>
    </tr>
    <tr style="border-bottom:1px solid #e5dfd3;">
      <td style="padding:8px 0;">🇬🇧 English</td>
      <td style="text-align:right;">${stats.en.active}</td>
      <td style="text-align:right;">${prev ? fmtDelta(dEn) : '—'}</td>
      <td style="text-align:right;color:#8a8170;">${stats.en.unsubscribed}${prev && newUnsubEn > 0 ? ` (+${newUnsubEn})` : ''}</td>
    </tr>
    <tr style="border-bottom:1px solid #e5dfd3;">
      <td style="padding:8px 0;">🇵🇹 Português</td>
      <td style="text-align:right;">${stats.pt.active}</td>
      <td style="text-align:right;">${prev ? fmtDelta(dPt) : '—'}</td>
      <td style="text-align:right;color:#8a8170;">${stats.pt.unsubscribed}${prev && newUnsubPt > 0 ? ` (+${newUnsubPt})` : ''}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-weight:600;">Unique total</td>
      <td style="text-align:right;font-weight:600;">${stats.activeUniqueTotal}</td>
      <td style="text-align:right;">${prev ? fmtDelta(dTotal) : '—'}</td>
      <td style="text-align:right;"></td>
    </tr>
  </table>
  ${ig ? `
  <h2 style="font-family:Georgia,serif;font-size:17px;margin:28px 0 8px;">📸 Instagram</h2>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">
    <tr style="border-bottom:1px solid #e5dfd3;">
      <td style="padding:8px 0;">@${ig.username} followers</td>
      <td style="text-align:right;font-weight:600;">${ig.followers}</td>
      <td style="text-align:right;width:90px;">${dIg != null ? fmtDelta(dIg) : '—'}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#5a5a5a;">Posts</td>
      <td style="text-align:right;color:#5a5a5a;">${ig.posts}</td>
      <td></td>
    </tr>
  </table>` : `
  <p style="color:#8a8170;font-size:12px;margin:28px 0 0;">📸 Instagram followers not shown — IG_GRAPH_TOKEN / IG_USER_ID not configured.</p>`}

  ${curTraffic ? `
  <h2 style="font-family:Georgia,serif;font-size:17px;margin:28px 0 4px;">🔍 Google search traffic</h2>
  <p style="color:#5a5a5a;margin:0 0 8px;font-size:12px;">${curTraffic.startDate} → ${curTraffic.endDate}${prevTraffic ? ` vs ${prevTraffic.startDate} → ${prevTraffic.endDate}` : ''}</p>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">
    <tr style="border-bottom:2px solid #1a1a2e;">
      <th style="text-align:left;padding:8px 0;">Metric</th>
      <th style="text-align:right;padding:8px 0;">This week</th>
      <th style="text-align:right;padding:8px 0;">Last week</th>
      <th style="text-align:right;padding:8px 0;">Δ</th>
    </tr>
    <tr style="border-bottom:1px solid #e5dfd3;">
      <td style="padding:8px 0;">Clicks</td>
      <td style="text-align:right;font-weight:600;">${curTraffic.clicks}</td>
      <td style="text-align:right;color:#8a8170;">${prevTraffic ? prevTraffic.clicks : '—'}</td>
      <td style="text-align:right;">${prevTraffic ? fmtDelta(curTraffic.clicks - prevTraffic.clicks) + ` <span style="color:#8a8170;font-size:12px;">${pct(curTraffic.clicks, prevTraffic.clicks)}</span>` : '—'}</td>
    </tr>
    <tr style="border-bottom:1px solid #e5dfd3;">
      <td style="padding:8px 0;">Impressions</td>
      <td style="text-align:right;">${curTraffic.impressions}</td>
      <td style="text-align:right;color:#8a8170;">${prevTraffic ? prevTraffic.impressions : '—'}</td>
      <td style="text-align:right;">${prevTraffic ? fmtDelta(curTraffic.impressions - prevTraffic.impressions) + ` <span style="color:#8a8170;font-size:12px;">${pct(curTraffic.impressions, prevTraffic.impressions)}</span>` : '—'}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#5a5a5a;">Avg. position</td>
      <td style="text-align:right;color:#5a5a5a;">${curTraffic.position.toFixed(1)}</td>
      <td style="text-align:right;color:#8a8170;">${prevTraffic ? prevTraffic.position.toFixed(1) : '—'}</td>
      <td style="text-align:right;color:#8a8170;font-size:12px;">${prevTraffic ? (curTraffic.position <= prevTraffic.position ? 'better' : 'worse') : '—'}</td>
    </tr>
  </table>` : ''}

  ${problems.length ? `<p style="color:#b3261e;font-size:12px;margin-top:16px;">⚠️ ${problems.length} metric source failed: ${problems.map(p => p.replace(/</g, '&lt;')).join('; ')}</p>` : ''}

  <p style="color:#8a8170;font-size:11px;margin-top:24px;">
    Unique total dedupes people subscribed to both languages. Search traffic is
    Google organic clicks from Search Console (the site has no analytics script),
    reported with GSC's ~3-day lag. Live anytime at /api/subscribers.
    Automated Thursdays · /api/cron/subscriber-report
  </p>
</body>
</html>`;

    await sendEmail(EDITOR_EMAIL, subject, html, [{ name: 'type', value: 'subscriber-report' }]);

    return NextResponse.json({
      ok: true,
      week,
      stats,
      deltas: { total: dTotal, en: dEn, pt: dPt, instagram: dIg },
      instagram: ig,
      traffic: { current: curTraffic, previous: prevTraffic },
      problems,
      preview,
      firstReport: !prev,
    });
  } catch (err) {
    console.error('[cron/subscriber-report]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
