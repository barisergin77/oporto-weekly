/**
 * Daily 10:30 UTC — scheduler-reliability watchdog.
 *
 * GitHub Actions' scheduled workflows are known-unreliable: schedules
 * can fire up to ~60 min late, or not at all. We've hit this twice
 * recently (blog cron Tuesday 2026-04-21, PT newsletter Thursday
 * 2026-04-23 — both needed manual workflow_dispatch).
 *
 * This watchdog runs once a day at 10:30 UTC (after every other
 * scheduled cron has had its window + generous slack), checks each
 * watched workflow against GitHub's run history, and dispatches any
 * that should have fired but didn't. Emails the editor when it
 * rescues a run so we know the scheduler is acting up.
 *
 * Bearer-auth'd (CRON_SECRET) like every other cron. Never dispatches
 * itself.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';

const REPO_OWNER = 'barisergin77';
const REPO_NAME = 'oporto-weekly';
const EDITOR_EMAIL = 'barisergin@gmail.com';

// Schedule grace: how late a workflow can legitimately fire before we
// consider the window missed. GitHub's own delay can reach ~60 min, and
// we observed 79 min once — 90 gives ~10 min headroom without being so
// permissive that the watchdog refuses to check late-morning crons.
const GRACE_MIN = 90;

// Watched workflows + their scheduled cron expressions. Keep in sync
// with the `on.schedule` entries in each .github/workflows/*.yml file.
//
// Cron format: 'min hour * * dayOfWeek'
//   dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, '*'=daily
interface Watched {
  file: string; // workflow filename
  label: string; // friendly name in the email alert
  schedule: string; // cron expression
}

const WATCHED: Watched[] = [
  { file: 'cron-newsletter.yml',          label: 'Newsletter (EN)',     schedule: '0 8 * * 4' },
  { file: 'cron-newsletter-pt.yml',       label: 'Newsletter (PT)',     schedule: '15 8 * * 4' },
  { file: 'cron-health.yml',              label: 'Health Check',        schedule: '30 8 * * 4' },
  { file: 'cron-instagram.yml',           label: 'Instagram (weekly)',  schedule: '45 8 * * 4' },
  { file: 'cron-reddit-draft.yml',        label: 'Reddit Draft',        schedule: '50 8 * * 4' },
  { file: 'cron-event-images.yml',        label: 'Event Images',        schedule: '15 9 * * 4' },
  { file: 'cron-event-descriptions.yml',  label: 'Event Descriptions',  schedule: '30 9 * * 4' },
  { file: 'cron-blog.yml',                label: 'Blog Article',        schedule: '0 9 * * 2' },
  { file: 'cron-instagram-blog.yml',      label: 'Instagram (blog)',    schedule: '30 9 * * 2' },
  { file: 'search-engines-ping.yml',      label: 'Search Engines Ping', schedule: '0 6 * * *' },
];

// ---------------------------------------------------------------------------
// Schedule math — when was the last time this cron should have fired?
// ---------------------------------------------------------------------------

function lastExpectedFire(schedule: string, now: Date): Date | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minS, hourS, , , dowS] = parts;
  const minute = parseInt(minS, 10);
  const hour = parseInt(hourS, 10);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null;

  if (dowS === '*') {
    // Daily — last occurrence today or yesterday
    const t = new Date(now);
    t.setUTCHours(hour, minute, 0, 0);
    if (t.getTime() > now.getTime()) t.setUTCDate(t.getUTCDate() - 1);
    return t;
  }

  const targetDow = parseInt(dowS, 10);
  if (Number.isNaN(targetDow) || targetDow < 0 || targetDow > 6) return null;

  // Walk back to the most recent matching weekday at HH:MM in the past.
  const t = new Date(now);
  t.setUTCHours(hour, minute, 0, 0);
  let daysBack = (t.getUTCDay() - targetDow + 7) % 7;
  if (daysBack === 0 && t.getTime() > now.getTime()) daysBack = 7;
  t.setUTCDate(t.getUTCDate() - daysBack);
  return t;
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  return fetch(`https://api.github.com${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'oporto-weekly-scheduler-watchdog',
      ...init.headers,
    },
  });
}

/**
 * Did the workflow run within [expected - GRACE, expected + GRACE]? We count
 * ANY trigger type (schedule OR workflow_dispatch OR push), not just
 * `event=schedule`. Reason: if the user (or an earlier watchdog rescue)
 * already manually dispatched the workflow within the grace window, the
 * work got done — re-dispatching now would produce a duplicate (a real
 * failure mode we hit: duplicate PT newsletter email). The only thing
 * that matters is "did the workflow execute once in its window."
 */
async function ranNearExpected(file: string, expected: Date): Promise<boolean> {
  const since = new Date(expected.getTime() - GRACE_MIN * 60_000);
  const until = new Date(expected.getTime() + GRACE_MIN * 60_000);
  const createdFilter = `>=${since.toISOString()}`;
  const url =
    `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${file}/runs` +
    `?per_page=10&created=${encodeURIComponent(createdFilter)}`;
  const res = await githubFetch(url);
  if (!res.ok) return false;
  const body = (await res.json()) as {
    workflow_runs?: Array<{ run_started_at?: string; created_at?: string; conclusion?: string | null }>;
  };
  for (const r of body.workflow_runs ?? []) {
    // A cancelled run doesn't count — it didn't do the work.
    if (r.conclusion === 'cancelled') continue;
    const ts = r.run_started_at ?? r.created_at;
    if (!ts) continue;
    const t = new Date(ts);
    if (t >= since && t <= until) return true;
  }
  return false;
}

async function dispatch(file: string): Promise<boolean> {
  const res = await githubFetch(
    `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${file}/dispatches`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  return res.ok; // 204 No Content on success
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

interface Check {
  label: string;
  file: string;
  expected: string; // ISO
  ranOnTime: boolean;
  dispatched?: boolean;
  dispatchError?: string;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const now = new Date();
  const checks: Check[] = [];

  for (const w of WATCHED) {
    const expected = lastExpectedFire(w.schedule, now);
    if (!expected) {
      checks.push({
        label: w.label,
        file: w.file,
        expected: 'invalid schedule',
        ranOnTime: false,
      });
      continue;
    }

    // If the expected fire time is still in the future + GRACE window, skip —
    // not yet missed. (Possible for daily 06:00 when watchdog runs 10:30,
    // never — but defensive for any future schedule we add.)
    if (now.getTime() < expected.getTime() + GRACE_MIN * 60_000) {
      checks.push({
        label: w.label,
        file: w.file,
        expected: expected.toISOString(),
        ranOnTime: true, // still in grace window
      });
      continue;
    }

    const onTime = await ranNearExpected(w.file, expected);
    if (onTime) {
      checks.push({ label: w.label, file: w.file, expected: expected.toISOString(), ranOnTime: true });
      continue;
    }

    // MISSED — try to dispatch now.
    try {
      const ok = await dispatch(w.file);
      checks.push({
        label: w.label,
        file: w.file,
        expected: expected.toISOString(),
        ranOnTime: false,
        dispatched: ok,
        dispatchError: ok ? undefined : 'dispatch POST returned non-2xx',
      });
    } catch (err) {
      checks.push({
        label: w.label,
        file: w.file,
        expected: expected.toISOString(),
        ranOnTime: false,
        dispatched: false,
        dispatchError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rescued = checks.filter((c) => c.dispatched === true);
  const failed = checks.filter((c) => c.dispatched === false && c.dispatchError);

  // Email only when action happened — no noise on clean days.
  if (rescued.length > 0 || failed.length > 0) {
    const rows = [...rescued, ...failed]
      .map(
        (c) =>
          `<tr>
            <td style="padding:6px 14px 6px 0;">${c.label}</td>
            <td style="padding:6px 14px 6px 0;color:#5a5a5a;">expected: ${c.expected}</td>
            <td style="padding:6px 0;font-weight:600;color:${c.dispatched ? '#0b7a3b' : '#b3261e'};">
              ${c.dispatched ? '✓ rescued' : `✗ dispatch failed — ${c.dispatchError ?? ''}`}
            </td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:640px;margin:20px auto;padding:0 16px;color:#1a1a2e;">
  <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">Scheduler watchdog — ${rescued.length} rescue${rescued.length === 1 ? '' : 's'}${failed.length > 0 ? `, ${failed.length} failure${failed.length === 1 ? '' : 's'}` : ''}</h1>
  <p style="color:#5a5a5a;margin:0 0 20px;font-size:14px;">GitHub Actions' scheduler didn't fire the workflow(s) below within the grace window. The watchdog dispatched them manually.</p>
  <table style="font-size:13px;border-collapse:collapse;">${rows}</table>
  <p style="color:#8a8170;font-size:11px;margin-top:24px;">
    Automated from /api/cron/scheduler-watchdog · runs daily at 10:30 UTC
  </p>
</body>
</html>`;

    try {
      await sendEmail(
        EDITOR_EMAIL,
        `⚠ Scheduler watchdog — ${rescued.length} rescued, ${failed.length} failed`,
        html,
        [{ name: 'type', value: 'scheduler-alert' }]
      );
    } catch (emailErr) {
      console.error('[scheduler-watchdog] alert email failed:', emailErr);
    }
  }

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    checks,
    rescued: rescued.length,
    failed: failed.length,
  });
}
