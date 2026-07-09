/**
 * Thursday 10:30 UTC — runs ~1 hour after all the Thursday pipeline crons
 * complete (newsletter 08:00, PT 08:15, health 08:30, instagram 08:45,
 * reddit-draft 08:50, event-images 09:15, event-descriptions 09:30).
 *
 * Walks every event's externalLink and HEAD-checks it. Dead links are
 * either replaced via Gemini Search or cleared outright — the event
 * detail page's "Get tickets" CTA is gated by isRealEventUrl() so a
 * cleared link simply hides the button, no misleading 404 clicks.
 *
 * Why weekly: event pages' source URLs degrade over time as venues
 * refactor their sites, take pages down after events conclude, or
 * change slug patterns. Weekly pass keeps the CTA graph clean
 * without any manual intervention.
 *
 * Caps at 50 events per run (each check is one HEAD + maybe one Gemini
 * Search + one HEAD = ~3s worst case; 50 × 3s = 150s, comfortably
 * inside the 300s Vercel budget).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isRealEventUrl, type EventRecord } from '@/lib/events';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

const MAX_PER_RUN = 50;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// HTTP helpers — duplicated from scripts/validate-event-links.ts because the
// Vercel function environment can't import scripts directly. If this grows a
// third user we should move these to a shared lib module.
// ---------------------------------------------------------------------------

async function headCheck(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function findReplacementUrl(ev: EventRecord): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const query = `Find the official event page for "${ev.name}" at ${ev.venue} in Porto on ${ev.date}. Return ONLY the single best URL — a ticketing page, venue event page, or official press release — and nothing else. No explanation, no markdown, just the raw URL. If you can't find an authoritative page, return the word NONE.`;
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('\n') ?? ''
    ).trim();
    if (!text || text.toUpperCase().includes('NONE')) return null;
    const match = text.match(/https?:\/\/[^\s<>"'\]]+/);
    if (!match) return null;
    const candidate = match[0].replace(/[.,;)]+$/, '');
    return isRealEventUrl(candidate) ? candidate : null;
  } catch {
    return null;
  }
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
  if (!res.ok) {
    throw new Error(`GitHub list events failed: ${res.status}`);
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

// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const startedAt = Date.now();
    const events = await listEventsFromGithub();
    // Only validate events that HAVE a link and whose end date is still
    // relevant (past events' links rotting is less urgent than upcoming ones).
    const today = new Date().toISOString().slice(0, 10);
    const candidates = events
      .filter((e) => e.externalLink)
      .sort((a, b) => {
        const aPast = (a.endDate ?? a.date) < today;
        const bPast = (b.endDate ?? b.date) < today;
        // Upcoming first (false sorts before true)
        if (aPast !== bPast) return aPast ? 1 : -1;
        return b.date.localeCompare(a.date);
      })
      .slice(0, MAX_PER_RUN);

    console.log(
      `[cron/validate-links] ${events.length} total · ${candidates.length} to check`
    );

    const counts = { ok: 0, replaced: 0, cleared: 0, error: 0 };
    const updatedFiles: Array<{ path: string; content: string }> = [];

    // PHASE 1 — HEAD-check every candidate IN PARALLEL (batches of 12).
    // These are independent 10s-bounded I/O; running them concurrently
    // makes the common case (most links live) finish in ~20-40s regardless
    // of count. The old fully-sequential loop could start a ~70s dead-link
    // iteration near the budget edge and overshoot Vercel's 300s ceiling →
    // infra-kill → no commit → the workflow's curl --retry re-ran the whole
    // thing (2026-07-09: 15m59s failure).
    const dead: EventRecord[] = [];
    const HEAD_BATCH = 12;
    for (let i = 0; i < candidates.length; i += HEAD_BATCH) {
      const batch = candidates.slice(i, i + HEAD_BATCH);
      const results = await Promise.all(
        batch.map(async (ev) => {
          try {
            const check = await headCheck(ev.externalLink!);
            return { ev, ok: check.ok, status: check.status };
          } catch {
            return { ev, ok: false, status: 0 };
          }
        })
      );
      for (const r of results) {
        if (r.ok) counts.ok++;
        else {
          console.log(`[cron/validate-links] ✗ ${r.ev.slug}: HTTP ${r.status}`);
          dead.push(r.ev);
        }
      }
    }
    console.log(`[cron/validate-links] ${counts.ok} live · ${dead.length} dead — resolving replacements`);

    // PHASE 2 — for the (usually few) dead links only, try a Gemini
    // replacement, then verify it. This is the slow path (~30-50s each), so
    // it's sequential with a STRICT budget checked BEFORE each iteration:
    // we reserve 60s for a single dead-link's worst case + the final commit,
    // bailing at 220s so we never approach the 300s wall mid-iteration.
    for (const ev of dead) {
      if (Date.now() - startedAt > 220_000) {
        console.warn(`[cron/validate-links] Budget reserve reached — deferring ${dead.length - counts.replaced - counts.cleared} dead link(s) to next run`);
        break;
      }
      try {
        const replacement = await findReplacementUrl(ev);
        if (replacement) {
          const replaceCheck = await headCheck(replacement);
          if (replaceCheck.ok) {
            counts.replaced++;
            updatedFiles.push({
              path: `data/events/${ev.slug}.json`,
              content: JSON.stringify({ ...ev, externalLink: replacement }, null, 2),
            });
            console.log(`[cron/validate-links] → ${ev.slug} replaced with ${replacement}`);
            continue;
          }
        }
        // Gave up. Clear the field.
        counts.cleared++;
        const updated: EventRecord = { ...ev };
        delete updated.externalLink;
        updatedFiles.push({
          path: `data/events/${ev.slug}.json`,
          content: JSON.stringify(updated, null, 2),
        });
        console.log(`[cron/validate-links] → ${ev.slug} cleared`);
      } catch (err) {
        counts.error++;
        console.error(`[cron/validate-links] ❌ ${ev.slug}:`, err instanceof Error ? err.message : err);
      }
    }

    if (updatedFiles.length > 0) {
      await commitFiles(
        updatedFiles,
        `chore: weekly link validation — ${counts.replaced} replaced, ${counts.cleared} cleared`
      );
    }

    return NextResponse.json({
      ok: true,
      totalEvents: events.length,
      processed: candidates.length,
      results: counts,
      committed: updatedFiles.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[cron/validate-links]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
