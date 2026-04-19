/**
 * Thursday 09:30 UTC — after event-images has run.
 *
 * For events that don't yet have a long-form `longDescription`, runs Gemini
 * Flash to generate 3 paragraphs of detail-page copy, then commits all
 * updated JSONs in one atomic GitHub commit.
 *
 * Separate from the event-images cron on purpose — each enrichment pass has
 * its own time cost (images ~15s/event, descriptions ~5s/event). Keeping
 * them apart gives each pass a clean ~5 min budget and makes retry/debug
 * easier when one enrichment type is healthier than the other.
 *
 * Iterates events missing longDescription, caps at 25 per run (5s each
 * × 25 = ~125s, well under the 300s Vercel budget even with GitHub commit
 * overhead).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import type { EventRecord } from '@/lib/events';
import { generateLongDescription } from '@/lib/events-pipeline';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

const MAX_PER_RUN = 25;

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

  try {
    const startedAt = Date.now();
    console.log('[cron/event-descriptions] Starting');

    const allEvents = await listEventsFromGithub();
    const candidates = allEvents
      .filter((e) => !e.longDescription)
      // Prefer future events — their pages get more traffic.
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_PER_RUN);

    console.log(
      `[cron/event-descriptions] ${allEvents.length} total · ${candidates.length} to enrich`
    );

    const updatedFiles: Array<{ path: string; content: string }> = [];
    const counts = { ok: 0, error: 0 };

    for (const ev of candidates) {
      try {
        const longDescription = await generateLongDescription(ev);
        const updated: EventRecord = { ...ev, longDescription };
        updatedFiles.push({
          path: `data/events/${ev.slug}.json`,
          content: JSON.stringify(updated, null, 2),
        });
        counts.ok++;
        console.log(`[cron/event-descriptions] ✓ ${ev.slug} (${longDescription.length} chars)`);
      } catch (err) {
        counts.error++;
        console.error(
          `[cron/event-descriptions] ❌ ${ev.slug}:`,
          err instanceof Error ? err.message : err
        );
      }

      // Time budget — stop early if we're creeping toward the 300s limit.
      if (Date.now() - startedAt > 260_000) {
        console.warn('[cron/event-descriptions] Time budget exhausted, stopping early');
        break;
      }
    }

    if (updatedFiles.length > 0) {
      await commitFiles(
        updatedFiles,
        `chore: add long descriptions for ${updatedFiles.length} event${updatedFiles.length === 1 ? '' : 's'}`
      );
    }

    return NextResponse.json({
      ok: true,
      totalEvents: allEvents.length,
      processed: candidates.length,
      results: counts,
      committed: updatedFiles.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[cron/event-descriptions]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
