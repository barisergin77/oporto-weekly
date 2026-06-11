/**
 * Read-only status endpoint for the weekly run ledger.
 *
 * Hit `/api/cron/status` to see the last 4 weeks' checkpoint state — which
 * steps completed and when. Useful for a Thursday-morning "did everything
 * run?" check, and for the verification agent scheduled for May 7.
 *
 * Public read (no auth) — the ledger contains only timestamps and step
 * names, no sensitive data.
 */

import { NextResponse } from 'next/server';
import { getFileContent } from '@/lib/github';
import { STEPS, type Step } from '@/lib/run-ledger';

export const dynamic = 'force-dynamic';

type WeekEntry = Partial<Record<Step, string>>;

export async function GET() {
  const raw = await getFileContent('data/run-ledger.json');
  if (!raw) {
    return NextResponse.json({ ledger: {}, weeks: [] });
  }
  const ledger = JSON.parse(raw) as Record<string, WeekEntry>;
  // Sort by recency of actual activity (latest mark in each entry), not
  // alphabetically — "may-7-13-2026" sorting above "june-11-17-2026" was
  // confusing everyone.
  const latestMark = (e: WeekEntry) =>
    Object.values(e).reduce((max, ts) => (ts && ts > max ? ts : max), '');
  const weekSlugs = Object.keys(ledger)
    .sort((a, b) => latestMark(ledger[b]).localeCompare(latestMark(ledger[a])))
    .slice(0, 8);

  // Blog keys only carry the two blog steps; weekly keys carry the other
  // seven. Only list the steps that belong to the key so blog rows don't
  // show seven permanently-"missing" newsletter steps (and vice versa).
  const stepsForKey = (slug: string): readonly Step[] =>
    slug.startsWith('blog-')
      ? (['blog-post', 'blog-instagram'] as const)
      : STEPS.filter((s) => s !== 'blog-post' && s !== 'blog-instagram');

  const weeks = weekSlugs.map((slug) => {
    const entry = ledger[slug];
    const steps = stepsForKey(slug);
    return {
      slug,
      checklist: steps.map((step) => ({
        step,
        completedAt: entry[step] ?? null,
        done: Boolean(entry[step]),
      })),
      complete: steps.every((s) => entry[s]),
    };
  });

  return NextResponse.json({ weeks });
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
