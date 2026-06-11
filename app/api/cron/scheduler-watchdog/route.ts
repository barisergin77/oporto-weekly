/**
 * Scheduler watchdog — LEDGER-DRIVEN since 2026-06-11.
 *
 * The previous design checked GitHub's workflow-run history: "did the
 * workflow fire since its expected time?" That signal is wrong in both
 * directions:
 *   - A run that 500'd or skipped (ledger already claimed for an OLD
 *     edition) still counts as "ran" → missing work never rescued.
 *     Concrete case: GitHub fires the IG cron hours late, before the EN
 *     edition exists. IG promotes nothing, returns 200-skip, and the
 *     old watchdog is satisfied — no IG post that week, silently.
 *   - Conversely the old ±90min window false-alarmed on GitHub's routine
 *     multi-hour scheduling delays and re-dispatched everything
 *     (2026-05-02: 10 bogus rescues + duplicate reddit email).
 *
 * The run-ledger (data/run-ledger.json) is the single source of truth
 * for "did the work actually happen." So the watchdog now asks exactly
 * that: for each step of the current week, is the mark present once
 * we're past its expected time + grace? If not → dispatch the workflow
 * that owns the step. Every workflow is ledger-claim-guarded, so even a
 * redundant dispatch is a harmless no-op.
 *
 * Runs daily at 11:30 UTC + extra Thursday passes (13:00/15:00/17:00)
 * for same-day recovery — GitHub's scheduler routinely fires the 08:00
 * cascade at noon, so a single late-morning check can't rescue anything
 * the same day.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';
import { currentWeekSlug } from '@/lib/archive';
import { getWeekEntry, blogWeekKey, type Step } from '@/lib/run-ledger';

const REPO_OWNER = 'barisergin77';
const REPO_NAME = 'oporto-weekly';
const EDITOR_EMAIL = 'barisergin@gmail.com';

// How long past the expected fire time a step may legitimately still be
// missing before we dispatch. Generous: GitHub schedules drift hours, and
// the Thursday cascade takes ~1h to complete end-to-end once it starts.
// 5h after the 08:00 schedule = 13:00 UTC — the first Thursday-afternoon
// watchdog pass picks up anything still missing.
const GRACE_HOURS = 5;

interface WatchedStep {
  step: Step;
  /** Workflow that produces this step (dispatched if the mark is missing). */
  workflow: string;
  label: string;
  /** Expected fire spec: day of week (0=Sun..6=Sat) + UTC hour. */
  dow: number;
  hour: number;
  /** Which ledger key class the step lives under. */
  keyKind: 'week' | 'blog';
}

// One entry per ledger step. The newsletter workflow covers research +
// en-web + en-email (single workflow, three marks) — we watch en-email
// as the terminal mark; if generation died midway the en-email mark is
// missing and the dispatched workflow re-enters cleanly (en-web unmark
// on pre-archive failure guarantees that).
const WATCHED: WatchedStep[] = [
  { step: 'en-email',       workflow: 'cron-newsletter.yml',    label: 'Newsletter EN (generate+send)', dow: 4, hour: 8,  keyKind: 'week' },
  { step: 'pt-email',       workflow: 'cron-newsletter-pt.yml', label: 'Newsletter PT',                 dow: 4, hour: 8,  keyKind: 'week' },
  { step: 'instagram',      workflow: 'cron-instagram.yml',     label: 'Instagram (weekly)',            dow: 4, hour: 8,  keyKind: 'week' },
  { step: 'reddit-draft',   workflow: 'cron-reddit-draft.yml',  label: 'Reddit draft',                  dow: 4, hour: 8,  keyKind: 'week' },
  { step: 'blog-post',      workflow: 'cron-blog.yml',          label: 'Blog article',                  dow: 2, hour: 9,  keyKind: 'blog' },
  { step: 'blog-instagram', workflow: 'cron-instagram-blog.yml',label: 'Instagram (blog promo)',        dow: 2, hour: 9,  keyKind: 'blog' },
];

/** Most recent occurrence of `dow` at `hour`:00 UTC, at or before now. */
function lastExpectedFire(dow: number, hour: number, now: Date): Date {
  const t = new Date(now);
  t.setUTCHours(hour, 0, 0, 0);
  let daysBack = (t.getUTCDay() - dow + 7) % 7;
  if (daysBack === 0 && t.getTime() > now.getTime()) daysBack = 7;
  t.setUTCDate(t.getUTCDate() - daysBack);
  return t;
}

async function dispatch(file: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set');
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${file}/dispatches`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'oporto-weekly-scheduler-watchdog',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  return res.ok; // 204 on success
}

interface Check {
  label: string;
  step: Step;
  ledgerKey: string;
  expected: string;
  done: boolean;
  withinGrace?: boolean;
  dispatched?: boolean;
  dispatchError?: string;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const now = new Date();
  const weekSlug = currentWeekSlug(now);
  const blogKey = blogWeekKey(now);

  // One ledger read per key class (not per step) — keep GitHub API calls low.
  const weekEntry = await getWeekEntry(weekSlug);
  const blogEntry = await getWeekEntry(blogKey);

  const checks: Check[] = [];

  for (const w of WATCHED) {
    const ledgerKey = w.keyKind === 'week' ? weekSlug : blogKey;
    const entry = w.keyKind === 'week' ? weekEntry : blogEntry;
    const expected = lastExpectedFire(w.dow, w.hour, now);
    const done = Boolean(entry[w.step]);

    if (done) {
      checks.push({ label: w.label, step: w.step, ledgerKey, expected: expected.toISOString(), done: true });
      continue;
    }

    // Not done — but are we still within the grace window? GitHub can be
    // hours late; don't panic before GRACE_HOURS have passed.
    const graceDeadline = expected.getTime() + GRACE_HOURS * 3600_000;
    if (now.getTime() < graceDeadline) {
      checks.push({
        label: w.label, step: w.step, ledgerKey,
        expected: expected.toISOString(), done: false, withinGrace: true,
      });
      continue;
    }

    // Past grace and the ledger has no mark → the work genuinely didn't
    // happen. Dispatch the owning workflow. The ledger claim inside the
    // workflow makes this safe even if the original run is somehow still
    // in flight.
    try {
      const ok = await dispatch(w.workflow);
      checks.push({
        label: w.label, step: w.step, ledgerKey,
        expected: expected.toISOString(), done: false,
        dispatched: ok,
        dispatchError: ok ? undefined : 'dispatch POST returned non-2xx',
      });
    } catch (err) {
      checks.push({
        label: w.label, step: w.step, ledgerKey,
        expected: expected.toISOString(), done: false,
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
            <td style="padding:6px 14px 6px 0;color:#5a5a5a;">ledger: ${c.ledgerKey} / ${c.step} missing</td>
            <td style="padding:6px 0;font-weight:600;color:${c.dispatched ? '#0b7a3b' : '#b3261e'};">
              ${c.dispatched ? '✓ dispatched' : `✗ dispatch failed — ${c.dispatchError ?? ''}`}
            </td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:640px;margin:20px auto;padding:0 16px;color:#1a1a2e;">
  <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">Watchdog — ${rescued.length} step${rescued.length === 1 ? '' : 's'} missing, dispatched</h1>
  <p style="color:#5a5a5a;margin:0 0 20px;font-size:14px;">The run-ledger shows these steps incomplete past their grace window. The owning workflows were dispatched; each is ledger-guarded so this is safe.</p>
  <table style="font-size:13px;border-collapse:collapse;">${rows}</table>
  <p style="color:#8a8170;font-size:11px;margin-top:24px;">
    Ledger-driven · /api/cron/scheduler-watchdog · daily 11:30 UTC + Thu 13/15/17 UTC
  </p>
</body>
</html>`;

    try {
      await sendEmail(
        EDITOR_EMAIL,
        `⚠ Watchdog — ${rescued.length} missing step${rescued.length === 1 ? '' : 's'} dispatched`,
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
    weekSlug,
    blogKey,
    checks,
    rescued: rescued.length,
    failed: failed.length,
  });
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
