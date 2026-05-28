/**
 * Thursday 09:15 UTC (after newsletter + PT + health + Instagram + reddit-draft).
 *
 * Reads events that don't yet have press photos, tries to acquire one per
 * event, commits the updated JSONs in a single atomic GitHub commit.
 *
 * Why a separate cron from the main newsletter cron:
 *   - Imgur uploads + og:image scraping are slow and variable (~15s/event
 *     on average, up to 60s for stubborn pages). 20 events could eat our
 *     5-minute Vercel budget and delay the email send.
 *   - Image acquisition is retryable and non-critical. If it fails entirely,
 *     the event pages still render with category placeholders. The newsletter
 *     still ships on time.
 *   - Running separately lets us re-invoke this cron on demand (workflow_dispatch)
 *     to backfill images for existing events without re-sending emails.
 *
 * Iterates events that have no `image` field yet, with a per-run cap to keep
 * us inside Vercel's 300s budget.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isRealEventUrl, type EventRecord } from '@/lib/events';
import { acquireEventImage } from '@/lib/events-pipeline';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

// Per-run cap. Each new event's image acquisition can take:
//   - scrape successful: ~5-15s (page fetch + og scrape + Imgur upload)
//   - fallback to Gemini 3 Pro Image generation: ~30-40s (page-fetch try
//     that fails first, then Gemini imagen, then Imgur upload)
//   - worst case on a slow Imgur/Gemini day: ~60-70s
//
// 2026-04-30: 10 cap blew 300s after 5 events → tightened to 5.
// 2026-05-28: 5 cap blew 300s on a single slow event with un-timed-out
//   fetches in findEventUrlViaGemini and uploadToImgur (since fixed).
//   Dropping to 3 + adding the missing timeouts = 3 × ~70s worst = 210s,
//   leaves 90s margin to commit. Two weekly passes + workflow_dispatch
//   on demand still drain the backlog.
const MAX_PER_RUN = 3;

async function listEventsFromGithub(): Promise<EventRecord[]> {
  // List the events directory via the contents API.
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

  // Read each file content. Parallel but capped to keep things sane.
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
    console.log('[cron/event-images] Starting');

    const allEvents = await listEventsFromGithub();
    const candidates = allEvents
      .filter((e) => !e.image)
      // Prefer events that are still in the future — the images on those pages
      // matter more to visitors than past-event images.
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_PER_RUN);

    console.log(`[cron/event-images] ${allEvents.length} total · ${candidates.length} to process`);

    const counts: Record<string, number> = {};
    const updatedFiles: Array<{ path: string; content: string }> = [];

    for (const ev of candidates) {
      try {
        const result = await acquireEventImage(ev);
        counts[result.status] = (counts[result.status] ?? 0) + 1;

        if (result.status === 'imaged') {
          const updated: EventRecord = {
            ...ev,
            image: result.image,
            externalLink: isRealEventUrl(ev.externalLink) ? ev.externalLink : result.resolvedUrl,
          };
          updatedFiles.push({
            path: `data/events/${ev.slug}.json`,
            content: JSON.stringify(updated, null, 2),
          });
          console.log(`[cron/event-images] ✓ scraped ${ev.slug} → ${result.image.url}`);
        } else if (result.status === 'generated') {
          const updated: EventRecord = { ...ev, image: result.image };
          updatedFiles.push({
            path: `data/events/${ev.slug}.json`,
            content: JSON.stringify(updated, null, 2),
          });
          console.log(`[cron/event-images] ✓ generated ${ev.slug} → ${result.image.url}`);
        } else {
          console.log(`[cron/event-images] ⚠ ${ev.slug}: ${result.status}`);
        }
      } catch (err) {
        counts.error = (counts.error ?? 0) + 1;
        console.error(`[cron/event-images] ❌ ${ev.slug}:`, err instanceof Error ? err.message : err);
      }

      // Budget check — bail at 200s so we have 100s margin to commit
      // any accumulated updates before Vercel's 300s ceiling. The single
      // commit at the end can take 5-15s (multi-file Git Data API tree),
      // and we want headroom for one more event's max duration in case
      // the loop is already mid-iteration past this check.
      if (Date.now() - startedAt > 200_000) {
        console.warn('[cron/event-images] Time budget exhausted, stopping early');
        break;
      }
    }

    if (updatedFiles.length > 0) {
      await commitFiles(
        updatedFiles,
        `chore: add press photos for ${updatedFiles.length} event${updatedFiles.length === 1 ? '' : 's'}`
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
    console.error('[cron/event-images]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
