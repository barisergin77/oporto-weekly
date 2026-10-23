/**
 * Daily — forward event scan (backlog #20). See lib/forward-scan.ts.
 *
 * Finds notable Porto events from tomorrow to 10 weeks ahead, accepts only those whose
 * official page we fetched confirms name, date and venue, enriches them
 * fully (long description, PT, image) and commits them in one atomic commit.
 * data/events/*.json only → deferred, published by deploy-flush (21:00 UTC).
 *
 * Outside the Thursday pipeline: refuses to run in the newsletter freeze
 * (Wed 18:00 → Thu 23:59 UTC), since GitHub's scheduler can fire hours late.
 *
 * ?dryRun=1 runs discovery, dedupe and verification only: no PT translation,
 * no image (no Imgur upload / image generation), no commit.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import type { EventRecord } from '@/lib/events';
import { inFreezeWindow, runForwardScan } from '@/lib/forward-scan';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

async function listEventsFromGithub(): Promise<EventRecord[]> {
  const res = await fetch(
    'https://api.github.com/repos/barisergin77/oporto-weekly/contents/data/events?ref=main',
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub list events failed: ${res.status} ${await res.text()}`);
  }
  const entries = (await res.json()) as Array<{ name: string; type: string }>;
  const jsonFiles = entries.filter((e) => e.type === 'file' && e.name.endsWith('.json'));

  const events: EventRecord[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < jsonFiles.length; i += CONCURRENCY) {
    const chunk = jsonFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (f) => {
        const body = await getFileContent(`data/events/${f.name}`);
        if (!body) return null;
        try {
          return JSON.parse(body) as EventRecord;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) if (r) events.push(r);
  }
  return events;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  if (inFreezeWindow()) {
    console.log('[cron/forward-scan] Newsletter freeze window — skipping');
    return NextResponse.json({ ok: true, skipped: 'freeze window' });
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const startedAt = Date.now();
    const existing = await listEventsFromGithub();
    console.log(`[cron/forward-scan] ${existing.length} existing events`);

    const result = await runForwardScan(existing, new Date(), startedAt + 250_000, { enrich: !dryRun });
    const slugs = new Set(existing.map((e) => e.slug));
    const files = result.accepted
      .filter((e) => !slugs.has(e.slug))
      .map((e) => ({ path: `data/events/${e.slug}.json`, content: JSON.stringify(e, null, 2) }));

    console.log(`[cron/forward-scan] sources: ${JSON.stringify(result.sources)}`);
    for (const r of result.rejected) console.log(`[cron/forward-scan] ✗ ${r.name}: ${r.reason}`);
    for (const f of files) console.log(`[cron/forward-scan] ✓ ${f.path}`);

    if (files.length > 0 && !dryRun) {
      await commitFiles(
        files,
        `chore: forward scan — ${files.length} upcoming event${files.length === 1 ? '' : 's'}`
      );
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      window: result.window,
      sources: result.sources,
      discovered: result.discovered,
      duplicates: result.duplicates,
      verified: result.verified,
      committed: dryRun ? 0 : files.length,
      events: result.accepted.map((e) => ({
        slug: e.slug, date: e.date, endDate: e.endDate, venue: e.venue, price: e.price,
        source: e.externalLink, description: e.description, image: e.image?.credit,
      })),
      rejected: result.rejected,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[cron/forward-scan]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST alias, as in the other cron routes. Workflows call POST.
export { GET as POST };
