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
  const weekSlugs = Object.keys(ledger).sort().reverse().slice(0, 8);

  const weeks = weekSlugs.map((slug) => {
    const entry = ledger[slug];
    return {
      slug,
      checklist: STEPS.map((step) => ({
        step,
        completedAt: entry[step] ?? null,
        done: Boolean(entry[step]),
      })),
      complete: STEPS.every((s) => entry[s]),
    };
  });

  return NextResponse.json({ weeks });
}
