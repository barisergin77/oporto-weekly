/**
 * Daily — forward event scan (backlog #20). See lib/forward-scan.ts.
 *
 * Finds notable Porto events from tomorrow to 10 weeks ahead, accepts only those whose
 * official page we fetched confirms name, date and venue, enriches them
 * fully (long description, PT, image) and commits them in one atomic commit.
 * data/events/*.json only → deferred, published by deploy-flush (21:00 UTC).
 *
 * Daily research for the Thursday composition (2026-10-25): also covers the
 * coming edition week thoroughly, and re-found events update their record
 * (same slug) instead of being skipped or duplicated.
 *
 * Refuses to run in the newsletter freeze (Wed 18:00 → Thu 23:59 UTC) since
 * GitHub's scheduler can fire hours late — except Thursday before 07:30,
 * the early run that feeds that morning's composition.
 *
 * Leads (data/forward-leads.json, lib/forward-leads.ts): read from GitHub main,
 * the due ones verified first through the same path, and their outcomes
 * (done / attempts / rejected / dropped) committed with the events — applied
 * to a fresh re-read of the file so leads added meanwhile are kept. If the
 * file can't be read from GitHub the run skips leads (never the bundle copy,
 * which may be stale and would overwrite newer outcomes).
 *
 * ?dryRun=1 runs discovery, dedupe and verification only: no PT translation,
 * no image (no Imgur upload / image generation), no commit.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { inFreezeWindow, runForwardScan } from '@/lib/forward-scan';
import { commitFiles, getFileContent } from '@/lib/github';
import { LEADS_PATH, applyLeadOutcomes, leadsChanged, parseLeadsFile, serializeLeadsFile } from '@/lib/forward-leads';
import { loadEventsFresh } from '@/lib/event-store';
import { checkCronAuth } from '@/lib/cron-auth';

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
    const { events: existing, source, fetched } = await loadEventsFresh();
    console.log(`[cron/forward-scan] ${existing.length} existing events (${source}, ${fetched} fetched)`);

    const leadsFile = parseLeadsFile(await getFileContent(LEADS_PATH));
    if (!leadsFile) console.warn(`[cron/forward-scan] ${LEADS_PATH} not readable from GitHub — skipping leads this run`);

    const result = await runForwardScan(existing, new Date(), startedAt + 250_000, { enrich: !dryRun, leads: leadsFile?.leads });
    const slugs = new Set(existing.map((e) => e.slug));
    const toFile = (e: { slug: string }) => ({ path: `data/events/${e.slug}.json`, content: JSON.stringify(e, null, 2) });
    const added = result.accepted.filter((e) => !slugs.has(e.slug)).map(toFile);
    const updated = result.updated.filter((e) => slugs.has(e.slug)).map(toFile);
    const files: Array<{ path: string; content: string }> = [...added, ...updated];

    // Only outcomes whose events are actually in this commit count as done.
    const committedSlugs = new Set([...existing.map((e) => e.slug), ...result.accepted.map((e) => e.slug), ...result.updated.map((e) => e.slug)]);
    const outcomes = result.leads.outcomes.filter((o) => o.kind !== 'done' || committedSlugs.has(o.slug));
    let leadsNote = '';
    if (leadsFile && outcomes.length > 0 && !dryRun) {
      const latest = parseLeadsFile(await getFileContent(LEADS_PATH)) ?? leadsFile;
      const next = applyLeadOutcomes(latest, outcomes);
      if (leadsChanged(latest, next)) {
        files.push({ path: LEADS_PATH, content: serializeLeadsFile(next) });
        leadsNote = `, ${outcomes.length} lead${outcomes.length === 1 ? '' : 's'} resolved`;
      }
    }
    for (const o of result.leads.outcomes) console.log(`[cron/forward-scan] lead ${o.kind} ${o.key}${'reason' in o && o.reason ? `: ${o.reason}` : ''}`);

    console.log(`[cron/forward-scan] sources: ${JSON.stringify(result.sources)}`);
    for (const r of result.rejected) console.log(`[cron/forward-scan] ✗ ${r.name}: ${r.reason}`);
    for (const f of added) console.log(`[cron/forward-scan] ✓ ${f.path}`);
    for (const f of updated) console.log(`[cron/forward-scan] ↻ ${f.path}`);

    if (files.length > 0 && !dryRun) {
      await commitFiles(
        files,
        `chore: forward scan — ${added.length} upcoming event${added.length === 1 ? '' : 's'}` +
        (updated.length ? `, ${updated.length} updated` : '') + leadsNote
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
      searches: result.searches,
      leads: { read: !!leadsFile, checked: result.leads.checked, outcomes: result.leads.outcomes },
      committed: dryRun ? 0 : added.length,
      updatedCount: dryRun ? 0 : updated.length,
      updated: result.updated.map((e) => ({ slug: e.slug, source: e.externalLink })),
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
