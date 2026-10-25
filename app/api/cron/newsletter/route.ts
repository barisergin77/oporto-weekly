export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange, thursdayWeekStart, assertValidNewsletterHtml } from '@/lib/archive';
import { archiveViaGitHub } from '@/lib/github';
import { notifySearchEngines } from '@/lib/search-engines';
import { checkCronAuth } from '@/lib/cron-auth';
import {
  generateHeroImage, generateNewsletter, runResearch, planEdition, type EditionPath,
} from '@/lib/newsletter-generate';
import {
  selectEditionEvents, eventDigest, insertAlsoOn, renderAlsoOn, longRunsNotFeatured, mergeEventFiles,
} from '@/lib/edition-compose';

/** Top-up search budget inside the 300s function (runs alongside the hero image). */
const TOPUP_BUDGET_MS = 90_000;

const REGEN_BUDGET_S = 170; // regeneration ≈ 60-90s + re-extract + re-verify; must finish under 300s

type EventRecordT = import('@/lib/events').EventRecord;

/**
 * Validate generated HTML, extract event records, inject event links and
 * enforce the one-pick-per-rank invariant. Factored out so the date
 * fact-check can rebuild an edition after a corrected regeneration.
 */
async function buildEdition(rawHtml: string, slug: string, corpus?: EventRecordT[]): Promise<{
  html: string;
  events: EventRecordT[];
  eventFiles: Array<{ path: string; content: string }>;
  extractedCount: number;
  linkedCount: number;
}> {
  // Validation gate — a truncated Gemini output must never reach the
  // archive or subscribers. Throws → outer catch → watchdog retries.
  assertValidNewsletterHtml(rawHtml, { lang: 'en' });
  let events: EventRecordT[] = [];
  // 4. Extract structured event records + inject click-through anchors into
  //    the HTML. Both extraction and injection happen BEFORE send so the
  //    email that goes out has live event links, and so extraction failures
  //    can't block-but-also-can't-block-send (we have the unlinked rawHtml
  //    as a fallback).
  //
  //    Doing this pre-send costs ~5-10s of Gemini Flash time — well within
  //    the 300s Vercel budget — but gives email readers one-click access to
  //    the richer event pages. Big UX + retention win.
  let eventFiles: Array<{ path: string; content: string }> = [];
  let extractedCount = 0;
  let linkedCount = 0;
  let html = rawHtml;
  try {
    const { extractEventsFromHtml, injectEventLinks } = await import('@/lib/events-pipeline');
    events = await extractEventsFromHtml(rawHtml, slug, corpus);
    extractedCount = events.length;
    eventFiles = events.map((e) => ({
      path: `data/events/${e.slug}.json`,
      content: JSON.stringify(e, null, 2),
    }));

    const injected = injectEventLinks(rawHtml, events);
    html = injected.html;
    linkedCount = injected.linked;
    console.log(
      `[cron/newsletter] Extracted ${extractedCount} events · ` +
      `wrapped ${linkedCount} title link(s) · rewrote ${injected.moreInfoRewritten} MORE INFO href(s)`
    );

  } catch (extractErr) {
    // Non-fatal: fall back to unlinked HTML so the newsletter still ships.
    console.error('[cron/newsletter] Event extraction/linking failed (non-fatal):', extractErr);
  }

  // 4.5. Rank consistency check — must have exactly one event per rank 1–5.
  // Outside the extraction try/catch on purpose: extraction failure is
  // non-fatal (we ship without anchors), but a malformed pick set IS fatal —
  // it would silently pollute the Instagram cron's Top Five and create
  // EN-vs-PT-vs-IG drift exactly like the 2026-04-30 incident. Better to
  // surface a 500 and have a human look than to ship a bad edition.
  if (eventFiles.length > 0) {
    const rankEvents = eventFiles.map((f) => JSON.parse(f.content) as { editorPickRank?: number; name: string });
    const ranks = rankEvents.filter((e) => typeof e.editorPickRank === 'number').map((e) => e.editorPickRank!);
    const seen = new Set<number>();
    const dupes: number[] = [];
    for (const r of ranks) {
      if (seen.has(r)) dupes.push(r);
      else seen.add(r);
    }
    const missing = [1, 2, 3, 4, 5].filter((r) => !seen.has(r));
    if (dupes.length > 0 || missing.length > 0) {
      throw new Error(
        `Editor's Pick rank validation failed before send: dupes=[${dupes.join(',')}] missing=[${missing.join(',')}]. ` +
        `Extracted ranks were [${[...ranks].sort().join(',')}]. ` +
        `Aborting so a malformed Top Five doesn't ship.`
      );
    }
  }

  return { html, events, eventFiles, extractedCount, linkedCount };
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    // 0. Day-of-week guard — only publish on Thursdays.
    //
    // Background: 2026-05-01 (Friday) the cron was workflow_dispatched
    // and ran the FULL pipeline because formatWeekRange() used `now` as
    // the week START. That produced slug `may-1-7-2026` instead of
    // `april-30-may-6-2026`, the idempotency guard saw no archive at
    // that new slug, and it generated a fresh edition + re-sent the
    // whole subscriber list. Two layers of defence:
    //
    //   (1) bail on non-Thursday runs unless ?force=true is passed;
    //   (2) snap `now` to the most recent Thursday so even a Thursday
    //       afternoon dispatch produces the morning's slug.
    const startedAt = Date.now();
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 4=Thu
    const force = new URL(req.url).searchParams.get('force') === 'true';
    if (dayOfWeek !== 4 && !force) {
      console.log(`[cron/newsletter] Today is dayOfWeek=${dayOfWeek} (not Thursday) — skipping. Pass ?force=true to override.`);
      return NextResponse.json({
        skipped: true,
        reason: 'not-thursday',
        dayOfWeek,
      });
    }

    // Snap to most-recent Thursday so ANY day's run computes the same
    // slug as that Thursday's run. Shared helper — see lib/archive.ts.
    const weekStart = thursdayWeekStart(now);
    const weekRange = formatWeekRange(weekStart);
    const slug = generateSlug(weekRange);
    console.log(`[cron/newsletter] now=${now.toISOString()} dayOfWeek=${dayOfWeek} thursday=${weekStart.toISOString().slice(0,10)} slug=${slug}`);

    // 0.5. IDEMPOTENCY via the archived artifact — NOT a ledger claim.
    //
    // This endpoint generates + archives (it does NOT send; that's
    // /api/cron/newsletter-send, which waits for the deploy to go live).
    //
    // Why archive-existence, not tryClaimStep (changed 2026-06-18):
    // claiming `en-web` at the top deadlocked recovery. If Vercel
    // infra-killed the function mid-generation (it exceeded 300s — see
    // the timing fixes below), the JS catch never ran, so the en-web
    // claim stayed marked forever. The watchdog then re-dispatched, but
    // generation saw the stuck claim and skipped — so the edition could
    // NEVER regenerate. Meanwhile send saw en-web "done" and looped on a
    // 404. Checking the actual archived HTML instead is naturally
    // recoverable: an infra-kill leaves no archive, so the next run just
    // regenerates. Concurrency is handled by the GH Actions concurrency
    // group + POST endpoints; double-SEND is independently prevented by
    // the send endpoint's atomic en-email claim, so at worst a duplicate
    // generation wastes Gemini calls and produces the same archive.
    const { markStepComplete, getWeekEntry } = await import('@/lib/run-ledger');
    {
      const { getFileContent } = await import('@/lib/github');
      const existing = await getFileContent(`public/newsletters/${slug}.html`);
      if (existing) {
        const entry = await getWeekEntry(slug);
        console.log(`[cron/newsletter] ${slug}.html already archived — skipping generation`);
        return NextResponse.json({
          skipped: true,
          reason: 'already-archived',
          slug,
          weekRange,
          ledger: entry,
        });
      }
    }

    const weekStartISO = weekStart.toISOString().slice(0, 10);
    const weekEndISO = new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);

    // Events a previous run PROVED are not in this week are excluded upfront,
    // so the model can't re-pick them and we don't pay for a regeneration to
    // find out again (2026-10-01: Fantasporto blocked the edition entirely).
    const { readPickBlocklist, addToPickBlocklist, blocklistCorrections } = await import('@/lib/pick-blocklist');
    const blocklist = await readPickBlocklist();
    if (blocklist.length > 0) {
      console.log(`[cron/newsletter] excluding ${blocklist.length} known wrong-week pick(s): ${blocklist.map(b => b.name).join(', ')}`);
    }

    // 1. Path choice (2026-10-25, "daily research + weekly composition").
    //    COMPOSE: the daily scan has already researched + verified this
    //    window's events into data/events — write the edition from those
    //    (read from GitHub: the scan's commits are deferred, not deployed),
    //    plus a small top-up search for the last ~24h. LEGACY: the original
    //    18-query research, used when the window is too thin to compose,
    //    when loading events fails, or when forced (?mode=legacy /
    //    NEWSLETTER_COMPOSE=off). Everything after generation is shared.
    const plan = await planEdition({
      weekStartISO, weekEndISO,
      blocked: blocklist.map((b) => b.name),
      mode: new URL(req.url).searchParams.get('mode'),
      loadCorpus: async () => {
        const { loadEventsFresh } = await import('@/lib/event-store');
        return loadEventsFresh();
      },
    });
    const path: EditionPath = plan.path === 'compose' && plan.corpus && plan.selection ? 'compose' : 'legacy';
    console.log(`[cron/newsletter] path=${path} — ${plan.reason}`);

    // Research (or top-up) + hero image run CONCURRENTLY — they're
    // independent and each is a big time sink (~60-90s research, ~30-65s
    // hero). Sequential, they pushed the function past Vercel's 300s
    // ceiling → infra-kill (2026-06-18 incident). Hero never throws (it
    // falls back to a static image), and neither does the top-up.
    let researchData: string;
    let heroImageUrl: string;
    let corpus: EventRecordT[] | undefined;
    let topupEvents: EventRecordT[] = [];
    let topupInfo: Record<string, unknown> | null = null;
    let recentPicks: string[] = [];
    if (path === 'compose' && plan.corpus) {
      const { runTopUp } = await import('@/lib/forward-scan');
      const [topup, hero] = await Promise.all([
        runTopUp(plan.corpus, weekStart, TOPUP_BUDGET_MS),
        generateHeroImage(weekRange),
      ]);
      heroImageUrl = hero;
      topupEvents = topup.events;
      topupInfo = {
        added: topup.events.map((e) => e.slug),
        discovered: topup.result?.discovered ?? 0,
        duplicates: topup.result?.duplicates ?? 0,
        rejected: topup.result?.rejected.length ?? 0,
        geminiCalls: topup.result?.usage.geminiCalls ?? 0,
        error: topup.error,
      };
      console.log(`[cron/newsletter] top-up: ${JSON.stringify(topupInfo)}`);
      corpus = [...plan.corpus, ...topupEvents];
      const { recentPickNames } = await import('@/lib/newsletter-generate');
      recentPicks = await recentPickNames(4);
    } else {
      [researchData, heroImageUrl] = await Promise.all([
        runResearch(),
        generateHeroImage(weekRange),
      ]);
    }
    // Compose mode: the "research" is the verified events of this window.
    const digestFor = (blocked: string[]) => {
      const sel = selectEditionEvents(corpus!, weekStartISO, weekEndISO, { blocked, recentPicks });
      return { sel, digest: eventDigest(sel) };
    };
    let composed = path === 'compose' ? digestFor(blocklist.map((b) => b.name)) : null;
    if (composed) {
      researchData = composed.digest;
      console.log(`[cron/newsletter] composing from ${composed.sel.short.length} short + ${composed.sel.longRuns.length} long-run events (${composed.sel.pickPool.length} pick-eligible, ${topupEvents.length} from top-up)`);
    }
    await markStepComplete(slug, 'research');

    // 3. Generate newsletter HTML (embedded hero URL)
    let built = await buildEdition(
      await generateNewsletter(researchData!, heroImageUrl, weekRange, blocklistCorrections(blocklist), { compose: path === 'compose' }),
      slug, corpus,
    );

    // 4.6. Fact-check Editor's Pick dates (added 2026-09-17 after the Porto
    //      Half Marathon went out as a Sep 20 pick — it was Sep 13). Each
    //      pick gets an independent grounded date lookup. On a confident
    //      contradiction we regenerate ONCE with explicit corrections. If
    //      there isn't budget left for that, throw: nothing is archived, so
    //      the watchdog re-runs from scratch with a full 300s budget. A
    //      known-wrong edition must never be archived or sent.
    let dateCheck = { checked: 0, unverified: [] as string[], corrected: [] as string[] };
    if (built.events.length > 0) {
      const { verifyPickDates } = await import('@/lib/events-pipeline');
      const first = await verifyPickDates(built.events, weekStartISO, weekEndISO);
      dateCheck = {
        checked: built.events.filter((e) => e.editorPickRank != null).length,
        unverified: first.unverified,
        corrected: [],
      };
      if (first.unverified.length) {
        console.warn(`[cron/newsletter] Pick dates unverified (non-blocking): ${first.unverified.join(' | ')}`);
      }
      if (first.mismatches.length > 0) {
        const corrections = first.mismatches.map((m) =>
          `"${m.name}" — actually ${m.actualDate}${m.actualEndDate ? ` to ${m.actualEndDate}` : ''} (source: ${m.source}), not ${m.claimedDate}`
        );
        console.warn(`[cron/newsletter] Pick date mismatches: ${corrections.join(' | ')}`);

        // Record BEFORE regenerating or aborting. Even if this run dies, the
        // next one starts knowing — that is what stops the retry loop.
        await addToPickBlocklist(first.mismatches.map((m) => ({
          name: m.name,
          actualDate: m.actualDate,
          actualEndDate: m.actualEndDate,
          source: m.source,
          detectedAt: new Date().toISOString(),
        })));

        const elapsedS = (Date.now() - startedAt) / 1000;
        if (elapsedS > REGEN_BUDGET_S) {
          throw new Error(
            `Pick date check failed at ${Math.round(elapsedS)}s — no budget to regenerate. ` +
            `Aborting before archive; the offending pick(s) are now blocklisted so the ` +
            `watchdog's retry excludes them from the start. ${corrections.join(' | ')}`
          );
        }
        if (composed) {
          // Drop the wrong-week events from the list itself, not just the prompt.
          composed = digestFor([...blocklist.map((b) => b.name), ...first.mismatches.map((m) => m.name)]);
          researchData = composed.digest;
        }
        built = await buildEdition(
          await generateNewsletter(
            researchData!, heroImageUrl, weekRange,
            [...blocklistCorrections(blocklist), ...corrections],
            { compose: path === 'compose' },
          ), slug, corpus,
        );
        const second = await verifyPickDates(built.events, weekStartISO, weekEndISO);
        if (second.mismatches.length > 0) {
          throw new Error(
            `Pick dates still wrong after regeneration: ` +
            second.mismatches.map((m) => `${m.name} (${m.claimedDate} vs ${m.actualDate})`).join(', ')
          );
        }
        dateCheck.corrected = first.mismatches.map((m) => m.name);
      }
    }
    const { extractedCount, linkedCount } = built;
    let { html, eventFiles } = built;
    let alsoOnCount = 0;
    if (composed) {
      // "Also on": long runs the edition didn't feature, as a deterministic
      // block with exact /event/ links (placeholder from the prompt, else
      // before the footer). Then commit the top-up's verified finds too.
      const alsoOn = longRunsNotFeatured(composed.sel.longRuns, built.events);
      alsoOnCount = Math.min(alsoOn.length, 8);
      html = insertAlsoOn(html, renderAlsoOn(alsoOn));
      eventFiles = mergeEventFiles(built.events, topupEvents).map((e) => ({
        path: `data/events/${e.slug}.json`,
        content: JSON.stringify(e, null, 2),
      }));
    }
    // Which path made this edition — read by /api/cron/newsletter-test for the owner's copy.
    html = html.replace(/<body([^>]*)>/i, (m) => `${m}\n<!-- oporto-weekly:path=${path} -->`);

    // 5. Subject line
    // Display dates derive from Thursday (weekStart), not now() — so a
    // forced Friday re-send still labels the edition with Thursday's date.
    const weekDate = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `Oporto Weekly — ${weekDate}`;

    // 6. Archive. This is this endpoint's terminal action — the commit
    //    triggers a Vercel deploy, and the SEND happens in the next
    //    workflow step (/api/cron/newsletter-send) only after that
    //    deploy is verified live. No more emails pointing at 404s.
    await archiveViaGitHub(
      {
        slug,
        title: `Oporto Weekly — ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        description: subject,
        sentAt: now.toISOString(),
        weekRange,
      },
      html,
      'newsletters.json',
      eventFiles
    );
    console.log(`[cron/newsletter] Archived EN as ${slug}${eventFiles.length ? ` with ${eventFiles.length} events` : ''}`);
    // Mark en-web ONLY after the archive commit lands. The send endpoint
    // gates on this mark; the watchdog re-dispatches if it's missing. A
    // failure (or infra-kill) before this point leaves no mark and no
    // archive → the next run cleanly regenerates. This ordering is the
    // fix for the 2026-06-18 deadlock (claim-at-top could never recover).
    await markStepComplete(slug, 'en-web');

    notifySearchEngines(slug).catch(e =>
      console.error('[cron/newsletter] Search engine notification failed:', e)
    );

    return NextResponse.json({
      success: true,
      slug,
      heroImageUrl,
      extractedEvents: extractedCount,
      linkedAnchors: linkedCount,
      pickDateCheck: dateCheck,
      path,
      pathReason: plan.reason,
      compose: composed ? {
        short: composed.sel.short.length,
        longRuns: composed.sel.longRuns.length,
        pickEligible: composed.sel.pickPool.length,
        alsoOn: alsoOnCount,
        topup: topupInfo,
      } : null,
      archived: true,
      send: 'deferred to /api/cron/newsletter-send',
    });
  } catch (err: unknown) {
    // No ledger cleanup needed: en-web is marked only after archive, so a
    // failure here leaves no partial mark. The watchdog will see en-email
    // missing and re-dispatch; generation will find no archive and re-run.
    console.error('[cron/newsletter]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
