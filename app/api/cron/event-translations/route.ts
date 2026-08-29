/**
 * Thursday 09:45 UTC — after event-descriptions (09:30) so most events
 * already have their EN longDescription when we translate.
 *
 * Translates event display text (name when editorial, description, and
 * longDescription) to European Portuguese for the /pt/event/<slug> pages,
 * committing updated JSONs in one atomic GitHub commit.
 *
 * Candidate = any event missing descriptionPt, OR one that has an EN
 * longDescription but no longDescriptionPt yet (so an event translated
 * before its long description existed gets re-picked once it does).
 * Caps at 25/run (~5s each) to fit the 300s budget; leftovers roll to the
 * next run / a workflow_dispatch backfill.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import type { EventRecord } from '@/lib/events';
import { translateEventFields } from '@/lib/events-pipeline';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

const MAX_PER_RUN = 25;

function needsTranslation(e: EventRecord): boolean {
  if (!e.descriptionPt) return true;
  if (e.longDescription && !e.longDescriptionPt) return true;
  return false;
}

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
  if (!res.ok) throw new Error(`GitHub list events failed: ${res.status} ${await res.text()}`);
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
        try { return JSON.parse(body) as EventRecord; } catch { return null; }
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
    console.log('[cron/event-translations] Starting');

    const allEvents = await listEventsFromGithub();
    const candidates = allEvents
      .filter(needsTranslation)
      // Prefer future events — their PT pages get more traffic.
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_PER_RUN);

    console.log(`[cron/event-translations] ${allEvents.length} total · ${candidates.length} to translate`);

    const updatedFiles: Array<{ path: string; content: string }> = [];
    const counts = { ok: 0, error: 0 };

    for (const ev of candidates) {
      try {
        const t = await translateEventFields(ev);
        const updated: EventRecord = {
          ...ev,
          descriptionPt: t.descriptionPt,
          ...(t.namePt ? { namePt: t.namePt } : {}),
          ...(t.longDescriptionPt ? { longDescriptionPt: t.longDescriptionPt } : {}),
        };
        updatedFiles.push({ path: `data/events/${ev.slug}.json`, content: JSON.stringify(updated, null, 2) });
        counts.ok++;
        console.log(`[cron/event-translations] ✓ ${ev.slug}${t.namePt ? ' (name translated)' : ''}`);
      } catch (err) {
        counts.error++;
        console.error(`[cron/event-translations] ❌ ${ev.slug}:`, err instanceof Error ? err.message : err);
      }

      if (Date.now() - startedAt > 260_000) {
        console.warn('[cron/event-translations] Time budget exhausted, stopping early');
        break;
      }
    }

    if (updatedFiles.length > 0) {
      await commitFiles(
        updatedFiles,
        `chore: PT translations for ${updatedFiles.length} event${updatedFiles.length === 1 ? '' : 's'}`
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
    console.error('[cron/event-translations]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
