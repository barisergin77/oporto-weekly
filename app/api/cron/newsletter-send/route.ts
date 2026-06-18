/**
 * Thursday, second workflow step (after /api/cron/newsletter archives).
 *
 * Sends the EN edition — but ONLY after verifying the Vercel deploy
 * triggered by the archive commit is actually serving the new edition.
 *
 * Why this exists (2026-06-11 incident): the old single-handler flow
 * archived and sent back to back. The archive commit *starts* a 1-3 min
 * Vercel build, but emails went out immediately — subscribers who opened
 * promptly clicked event links into a half-deployed site: 404s on the
 * new event pages and a homepage still showing last week's edition.
 *
 * This endpoint polls the live site for the archived HTML (a static
 * file that only exists once the new deploy is serving) and sends only
 * after it's confirmed live, with its own 300s Vercel budget — the main
 * generation pipeline runs ~280s and had no room for a deploy wait.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange, thursdayWeekStart } from '@/lib/archive';
import { getFileContent } from '@/lib/github';
import { getActiveSubscribers } from '@/lib/audiences';
import { sendBatch } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';

const SITE = 'https://oportoweekly.com';
// Total budget for the deploy to go live. Vercel builds run 45-120s
// typically; 240s leaves 60s of the 300s function budget for the send.
const DEPLOY_WAIT_MS = 240_000;
const POLL_INTERVAL_MS = 10_000;

/** Poll the live static file until the new edition is served. */
async function waitForDeploy(slug: string): Promise<boolean> {
  const deadline = Date.now() + DEPLOY_WAIT_MS;
  const url = `${SITE}/newsletters/${slug}.html`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return true;
    } catch {
      /* network blip — keep polling */
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    // Same Thursday-snap slug computation as the generation endpoint.
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const force = new URL(req.url).searchParams.get('force') === 'true';
    if (dayOfWeek !== 4 && !force) {
      return NextResponse.json({ skipped: true, reason: 'not-thursday', dayOfWeek });
    }
    const weekStart = thursdayWeekStart(now);
    const weekRange = formatWeekRange(weekStart);
    const slug = generateSlug(weekRange);

    const { tryClaimStep, unmarkStep, isStepComplete, getWeekEntry } = await import('@/lib/run-ledger');

    // The edition must be archived before we can send it.
    if (!(await isStepComplete(slug, 'en-web'))) {
      return NextResponse.json(
        { error: `en-web not complete for ${slug} — did the generation cron succeed?` },
        { status: 409 }
      );
    }
    // Cheap early skip if already sent (avoids the 240s poll on no-op runs).
    if (await isStepComplete(slug, 'en-email')) {
      const entry = await getWeekEntry(slug);
      console.log(`[cron/newsletter-send] en-email already complete for ${slug} — skipping`);
      return NextResponse.json({ skipped: true, reason: 'en-email-already-complete', slug, ledger: entry });
    }

    try {
      // 1. Wait for the deploy to serve the new edition. The claim is NOT
      //    held during this poll — claiming up front and then getting
      //    infra-killed during the (up to 240s) poll would strand the
      //    en-email mark and deadlock recovery (the 2026-06-18 lesson).
      //    We claim atomically right before sendBatch instead.
      console.log(`[cron/newsletter-send] Waiting for deploy of ${slug}…`);
      const live = await waitForDeploy(slug);
      if (!live) {
        throw new Error(
          `Deploy not live after ${DEPLOY_WAIT_MS / 1000}s — ` +
          `${SITE}/newsletters/${slug}.html still 404s. Not sending emails ` +
          `that would point at broken links. Re-dispatch once the deploy lands.`
        );
      }
      console.log(`[cron/newsletter-send] Deploy verified live`);

      // 2. Fetch the archived HTML (the exact same linked HTML that the
      //    generation cron built — single source of truth).
      const html = await getFileContent(`public/newsletters/${slug}.html`);
      if (!html) throw new Error(`Archived HTML missing for ${slug}`);

      // 3. Atomic claim immediately before send — the deadlock window is
      //    now the few ms between claim and sendBatch, not the whole poll.
      //    Two concurrent sends both reach here; only one wins the CAS.
      const claimed = await tryClaimStep(slug, 'en-email');
      if (!claimed) {
        const entry = await getWeekEntry(slug);
        console.log(`[cron/newsletter-send] en-email claimed by a concurrent run — skipping`);
        return NextResponse.json({ skipped: true, reason: 'en-email-already-claimed', slug, ledger: entry });
      }

      // 4. Send.
      const weekDate = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const subject = `Oporto Weekly — ${weekDate}`;
      const enSubscribers = await getActiveSubscribers('en');
      const enEmails = enSubscribers.map(s => s.email);
      const sentEN = await sendBatch(enEmails, subject, html, [
        { name: 'type', value: 'newsletter' },
        { name: 'lang', value: 'en' },
        { name: 'edition', value: slug },
      ]);
      console.log(`[cron/newsletter-send] Sent EN to ${sentEN} subscribers`);

      return NextResponse.json({ success: true, slug, sent: { en: sentEN } });
    } catch (workErr) {
      // Failure before/during send. Distinguish two cases:
      //   - PartialSendError: some chunks already delivered. KEEP the
      //     claim — an unmark-and-retry would re-send to those people.
      //     Loud 500, manual recovery (send remaining manually via
      //     Resend dashboard or a targeted script).
      //   - Anything else: nothing was delivered. Safe to unmark so the
      //     watchdog retries a clean run.
      const { PartialSendError } = await import('@/lib/resend-client');
      if (workErr instanceof PartialSendError) {
        console.error(`[cron/newsletter-send] PARTIAL SEND (${workErr.sentCount}/${workErr.totalCount}) — keeping claim:`, workErr);
      } else {
        console.error('[cron/newsletter-send] failed after claim, unmarking:', workErr);
        await unmarkStep(slug, 'en-email');
      }
      throw workErr;
    }
  } catch (err: unknown) {
    console.error('[cron/newsletter-send]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
