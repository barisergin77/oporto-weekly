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

const EDITOR_EMAIL = 'barisergin@gmail.com';
const HISTORY_PATH = 'data/subscriber-history.json';

interface Snapshot extends SubscriberStats {
  week: string; // Thursday date, YYYY-MM-DD
  takenAt: string; // ISO timestamp
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

    // Load history (oldest→newest).
    const raw = await getFileContent(HISTORY_PATH);
    const history: Snapshot[] = raw ? (JSON.parse(raw) as Snapshot[]) : [];

    // Idempotency — already snapshotted this week? Skip.
    if (history.some((h) => h.week === week)) {
      return NextResponse.json({ skipped: true, reason: 'already-snapshotted', week });
    }

    const stats = await getSubscriberStats();
    const snapshot: Snapshot = { week, takenAt: now.toISOString(), ...stats };

    // Previous snapshot for deltas (may be absent on the first-ever run).
    const prev = history.length > 0 ? history[history.length - 1] : null;
    const d = (cur: number, was: number | undefined) => cur - (was ?? cur);
    const dTotal = d(stats.activeUniqueTotal, prev?.activeUniqueTotal);
    const dEn = d(stats.en.active, prev?.en.active);
    const dPt = d(stats.pt.active, prev?.pt.active);
    const newUnsubEn = d(stats.en.unsubscribed, prev?.en.unsubscribed);
    const newUnsubPt = d(stats.pt.unsubscribed, prev?.pt.unsubscribed);

    // Persist the new snapshot (append, keep sorted, cap to last 104 weeks / 2y).
    const updated = [...history, snapshot]
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-104);
    await commitFiles(
      [{ path: HISTORY_PATH, content: JSON.stringify(updated, null, 2) + '\n' }],
      `chore(subscribers): weekly snapshot ${week} — ${stats.activeUniqueTotal} active`
    );

    // Email the editor.
    const deltaSuffix = prev ? ` (${dTotal >= 0 ? '+' : ''}${dTotal} this week)` : '';
    const subject = `Oporto Weekly — ${stats.activeUniqueTotal} subscribers${deltaSuffix}`;
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
  <p style="color:#8a8170;font-size:11px;margin-top:24px;">
    Unique total dedupes people subscribed to both languages. Live anytime at
    /api/subscribers. Automated Thursdays · /api/cron/subscriber-report
  </p>
</body>
</html>`;

    await sendEmail(EDITOR_EMAIL, subject, html, [{ name: 'type', value: 'subscriber-report' }]);

    return NextResponse.json({ ok: true, week, stats, deltas: { total: dTotal, en: dEn, pt: dPt }, firstReport: !prev });
  } catch (err) {
    console.error('[cron/subscriber-report]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
