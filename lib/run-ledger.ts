/**
 * Per-week run ledger — the calendar-fact source of truth for which steps
 * of the weekly publishing pipeline have completed.
 *
 * One JSON file at `data/run-ledger.json`, keyed by week slug, tracking
 * six steps as ISO timestamps:
 *
 *   {
 *     "april-30-may-6-2026": {
 *       "research":  "2026-04-30T08:01:42.000Z",
 *       "en-web":    "2026-04-30T08:04:30.000Z",
 *       "en-email":  "2026-04-30T08:05:01.000Z",
 *       "pt-web":    "2026-04-30T08:18:22.000Z",
 *       "pt-email":  "2026-04-30T08:19:00.000Z",
 *       "instagram": "2026-04-30T08:48:50.000Z"
 *     }
 *   }
 *
 * Every cron step checks `isStepComplete(slug, step)` before doing work.
 * If true, the cron bails. After successful execution, the step calls
 * `markStepComplete(slug, step)`. The ledger is the only thing that
 * decides whether a step runs — never the timestamp comparison, never
 * the existence of an archive file, never inferred state.
 *
 * Why this exists: 2026-05-01 (Friday) the EN cron was workflow_dispatched
 * and re-sent the april-30 edition under a phantom may-1-7 slug because
 * the slug was inferred from `now()` and the idempotency guard checked a
 * different file than the one it should have. The ledger fixes this by
 * making "did step X complete for week Y?" a direct lookup, not an
 * inference.
 */

import { getFileContent, commitFiles } from './github';

export type Step =
  | 'research'
  | 'en-web'
  | 'en-email'
  | 'pt-web'
  | 'pt-email'
  | 'instagram'
  | 'reddit-draft'
  | 'blog-post'
  | 'blog-instagram';

export const STEPS: readonly Step[] = [
  'research',
  'en-web',
  'en-email',
  'pt-web',
  'pt-email',
  'instagram',
  'reddit-draft',
  'blog-post',
  'blog-instagram',
];

/**
 * Week-key for the Tuesday-cadence blog crons. Snaps to the most-recent
 * Tuesday at UTC midnight so any day in that week produces the same key.
 *
 * Example: today=Sat 2 May 2026 → most-recent Tuesday is 28 Apr → key
 * "blog-tue-apr-28-2026". A blog cron rescue on Saturday for that
 * Tuesday's slot computes the same key as the Tuesday run did, so the
 * ledger guard hits.
 */
export function blogWeekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const dow = d.getUTCDay(); // 0=Sun, 2=Tue
  const daysBack = (dow - 2 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  const m = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `blog-tue-${m}-${day}-${y}`;
}

const LEDGER_PATH = 'data/run-ledger.json';

type WeekEntry = Partial<Record<Step, string>>;
type Ledger = Record<string, WeekEntry>;

async function readLedger(): Promise<Ledger> {
  const raw = await getFileContent(LEDGER_PATH);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Ledger;
  } catch {
    // If the ledger is malformed we fail closed — better to skip than
    // double-send. The next Thursday's manual fix is a single PR.
    throw new Error(`run-ledger.json is malformed; refusing to operate`);
  }
}

/**
 * Returns true if the named step has already completed for this week slug.
 * Reads from GitHub — the deployed bundle's snapshot is stale and unsafe
 * for this purpose (it was committed before this run started).
 */
export async function isStepComplete(weekSlug: string, step: Step): Promise<boolean> {
  const ledger = await readLedger();
  return Boolean(ledger[weekSlug]?.[step]);
}

/**
 * Returns the full ledger entry for a week (useful for diagnostics or for
 * "what's the latest step that finished?" reporting).
 */
export async function getWeekEntry(weekSlug: string): Promise<WeekEntry> {
  const ledger = await readLedger();
  return ledger[weekSlug] ?? {};
}

/**
 * Marks a step complete with the current timestamp. Commits a tiny one-file
 * change to GitHub. Idempotent: marking the same step twice is fine — the
 * second mark overwrites the timestamp, but no harm.
 *
 * Concurrency: there's a TOCTOU window between readLedger() and the commit.
 * In practice GitHub Actions cron concurrency groups + the per-step bail-
 * before-work pattern make this near-impossible to hit, but if two
 * simultaneous runs both mark the same step, the second commit may race-
 * fail with a 422 from GitHub. Caller can retry; we don't here because the
 * step itself has already completed and the next attempt's `isStepComplete`
 * check will see the first run's mark and bail before reaching this code.
 */
export async function markStepComplete(weekSlug: string, step: Step): Promise<void> {
  const ledger = await readLedger();
  ledger[weekSlug] = { ...(ledger[weekSlug] ?? {}), [step]: new Date().toISOString() };

  // Sort keys for stable diffs: weeks chronologically, steps in pipeline order.
  const sortedWeeks = Object.keys(ledger).sort();
  const ordered: Ledger = {};
  for (const slug of sortedWeeks) {
    const entry = ledger[slug];
    const orderedEntry: WeekEntry = {};
    for (const s of STEPS) {
      if (entry[s]) orderedEntry[s] = entry[s];
    }
    ordered[slug] = orderedEntry;
  }

  await commitFiles(
    [{ path: LEDGER_PATH, content: JSON.stringify(ordered, null, 2) + '\n' }],
    `chore(ledger): mark ${step} complete for ${weekSlug}`
  );
}
