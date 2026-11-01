/**
 * Monthly fact-check ledger for the city guides (owner 2026-11-01). After the
 * consolidation every guide in data/blog-posts.json has an entry in
 * data/guide-checks.json: the day its places, hours and prices were last
 * checked against official sources, and a note on what goes stale first.
 * A re-check job takes guidesDue() oldest first, re-checks the guide (EN + PT),
 * updates the visible "Checked <Month YYYY>" line and bumps lastChecked here;
 * the sitemap uses lastChecked as the guide's lastmod.
 *
 * Pure module apart from the JSON import, so tests and crons can share it.
 */

import checks from '../data/guide-checks.json';

export interface GuideCheck {
  /** YYYY-MM-DD */
  lastChecked: string;
  notes: string;
}

export const GUIDE_CHECKS: Record<string, GuideCheck> = checks;

/** Re-check a guide once its last check is this many days old. */
export const RECHECK_AFTER_DAYS = 30;

export function guideLastChecked(slug: string): string | undefined {
  return GUIDE_CHECKS[slug]?.lastChecked;
}

/** Slugs due for a re-check on `today` (YYYY-MM-DD), oldest check first. */
export function guidesDue(today: string, afterDays = RECHECK_AFTER_DAYS): string[] {
  const now = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  return Object.entries(GUIDE_CHECKS)
    .filter(([, c]) => now - Date.parse(`${c.lastChecked}T00:00:00Z`) >= afterDays * 86_400_000)
    .sort((a, b) => a[1].lastChecked.localeCompare(b[1].lastChecked) || a[0].localeCompare(b[0]))
    .map(([slug]) => slug);
}
