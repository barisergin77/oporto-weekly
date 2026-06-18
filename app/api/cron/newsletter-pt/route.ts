export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange, formatWeekRangePT, thursdayWeekStart, assertValidNewsletterHtml } from '@/lib/archive';
import { archiveViaGitHub, getFileContent } from '@/lib/github';
import { getActiveSubscribers } from '@/lib/audiences';
import { sendBatch } from '@/lib/resend-client';
import { notifySearchEngines } from '@/lib/search-engines';
import { checkCronAuth } from '@/lib/cron-auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && url === GEMINI_URL) {
    console.log('[cron/newsletter-pt] 429 on gemini-2.5-pro, retrying with gemini-2.5-flash');
    return geminiPost(GEMINI_URL_FALLBACK, body);
  }

  return res;
}

/**
 * Translates the EN newsletter HTML to European Portuguese (pt-PT).
 * Preserves all HTML structure, CSS, and links — only translates visible text.
 */
async function translateNewsletter(enHtml: string): Promise<string> {
  const prompt = `Translate the following HTML email newsletter from English to European Portuguese (pt-PT).

RULES:
- Translate ALL visible text to European Portuguese (pt-PT, not Brazilian).
- Keep ONLY THESE as-is — they are real proper nouns:
  * Specific event/show titles ("Tame Impala", "Black Sea Dahu", "Fatboy Slim", "Fi Tango")
  * Venue names ("Casa da Música", "Alfândega Congress Center", "WOW")
  * Place names ("Porto", "Vila Nova de Gaia", "Avenida dos Aliados")
- DO translate the editorial newsletter title in <h1> at the top of the hero
  (e.g. "Porto In Bloom" → "Porto em Flor", "Porto's Vibrant Palette" →
  "A Paleta Vibrante do Porto"). It's an editorial headline, not a proper noun.
- Translate day abbreviations: Mon→Seg, Tue→Ter, Wed→Qua, Thu→Qui, Fri→Sex, Sat→Sáb, Sun→Dom.
- Translate common phrases: "Free"→"Gratuito", "More info"→"Mais info", "Get tickets"→"Comprar bilhetes", "Book"→"Reservar", "Unsubscribe"→"Cancelar subscrição", "Visit website"→"Visitar site".
- Use 24h time format (9 PM → 21h00).
- Change <html lang="en"> to <html lang="pt">.
- Keep ALL HTML structure, CSS classes, inline styles, links (href), and image URLs EXACTLY the same.
- Output ONLY the complete translated HTML. No markdown fences, no commentary.

HTML TO TRANSLATE:
${enHtml}`;

  const res = await geminiPost(GEMINI_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 65536 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini translation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  let html: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? '';

  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    // 1. Day-of-week guard + slug computation. See EN cron for full
    //    rationale — short version: snap to most-recent Thursday so the
    //    slug matches the EN edition regardless of which day this fires.
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 4=Thu
    const force = new URL(req.url).searchParams.get('force') === 'true';
    if (dayOfWeek !== 4 && !force) {
      console.log(`[cron/newsletter-pt] Today is dayOfWeek=${dayOfWeek} (not Thursday) — skipping. Pass ?force=true to override.`);
      return NextResponse.json({
        skipped: true,
        reason: 'not-thursday',
        dayOfWeek,
      });
    }

    const weekStart = thursdayWeekStart(now);
    const weekRange = formatWeekRange(weekStart);
    const slug = generateSlug(weekRange);
    const ptSlug = `${slug}-pt`;
    console.log(`[cron/newsletter-pt] now=${now.toISOString()} dayOfWeek=${dayOfWeek} thursday=${weekStart.toISOString().slice(0,10)} slug=${slug}`);

    // 1.5. Idempotency + recovery model (rewritten 2026-06-18 to match EN).
    //   - pt-email already marked → fully done, skip.
    //   - Translate + archive is guarded by pt-web / archive existence, so
    //     an infra-kill mid-translate just re-runs cleanly (no stuck claim).
    //   - The atomic pt-email claim is taken RIGHT BEFORE sendBatch, not at
    //     the top — holding it across the 60-120s translate could strand it
    //     on an infra-kill and deadlock recovery (the EN lesson).
    const { tryClaimStep, isStepComplete, markStepComplete, getWeekEntry } = await import('@/lib/run-ledger');
    if (await isStepComplete(slug, 'pt-email')) {
      const entry = await getWeekEntry(slug);
      console.log(`[cron/newsletter-pt] pt-email already complete for ${slug} — skipping`);
      return NextResponse.json({ skipped: true, reason: 'pt-email-already-complete', slug: ptSlug, ledger: entry });
    }

    const ptWeekDate = formatWeekRangePT(weekStart);
    const ptSubject = `Oporto Weekly — ${ptWeekDate}`;

    // 2. Obtain the PT HTML: reuse the archived translation if a prior run
    //    already produced it (recoverable), else translate the EN edition.
    let ptHtml = await getFileContent(`public/newsletters/${ptSlug}.html`);
    if (ptHtml) {
      console.log(`[cron/newsletter-pt] Reusing already-archived PT HTML for ${ptSlug}`);
    } else {
      const enHtml = await getFileContent(`public/newsletters/${slug}.html`);
      if (!enHtml) {
        throw new Error(`EN newsletter not found for slug ${slug} — did the EN cron run successfully?`);
      }
      console.log(`[cron/newsletter-pt] Loaded EN newsletter: ${slug} (${enHtml.length} bytes)`);

      ptHtml = await translateNewsletter(enHtml);
      console.log(`[cron/newsletter-pt] Translated to PT (${ptHtml.length} bytes)`);
      assertValidNewsletterHtml(ptHtml, { lang: 'pt' });

      // 3. Archive the PT edition. Marks pt-web after the commit lands.
      await archiveViaGitHub({
        slug: ptSlug,
        title: `Oporto Weekly — ${ptWeekDate}`,
        description: `Eventos no Porto: ${ptWeekDate}`,
        sentAt: now.toISOString(),
        weekRange: ptWeekDate,
      }, ptHtml, 'newsletters-pt.json');
      console.log(`[cron/newsletter-pt] Archived PT as ${ptSlug}`);
      await markStepComplete(slug, 'pt-web');
      notifySearchEngines(`pt/arquivo/${ptSlug}`).catch(e =>
        console.error('[cron/newsletter-pt] Search engine notification failed:', e)
      );
    }

    // 4. Atomic claim immediately before send (CAS) — only one concurrent
    //    run wins; the loser skips. Window between claim and send is ~ms.
    const claimed = await tryClaimStep(slug, 'pt-email');
    if (!claimed) {
      const entry = await getWeekEntry(slug);
      console.log(`[cron/newsletter-pt] pt-email claimed by a concurrent run — skipping`);
      return NextResponse.json({ skipped: true, reason: 'pt-email-already-claimed', slug: ptSlug, ledger: entry });
    }

    // 5. Send.
    const ptSubscribers = await getActiveSubscribers('pt');
    const ptEmails = ptSubscribers.map(s => s.email);
    let sentPT = 0;
    if (ptEmails.length > 0) {
      try {
        sentPT = await sendBatch(ptEmails, ptSubject, ptHtml, [
          { name: 'type', value: 'newsletter' },
          { name: 'lang', value: 'pt' },
          { name: 'edition', value: ptSlug },
        ]);
        console.log(`[cron/newsletter-pt] Sent PT to ${sentPT} subscribers`);
      } catch (sendErr) {
        // Keep the claim on partial send (retry would double-send delivered
        // chunks); release it otherwise so the watchdog can retry cleanly.
        const { PartialSendError } = await import('@/lib/resend-client');
        const { unmarkStep } = await import('@/lib/run-ledger');
        if (sendErr instanceof PartialSendError) {
          console.error(`[cron/newsletter-pt] PARTIAL SEND (${sendErr.sentCount}/${sendErr.totalCount}) — keeping claim:`, sendErr);
        } else {
          console.error('[cron/newsletter-pt] send failed, unmarking pt-email:', sendErr);
          await unmarkStep(slug, 'pt-email');
        }
        throw sendErr;
      }
    } else {
      console.log('[cron/newsletter-pt] No PT subscribers — skipping send');
    }

    return NextResponse.json({ success: true, slug: ptSlug, sent: { pt: sentPT } });
  } catch (err: unknown) {
    // pt-email is marked only by the pre-send claim; a failure before that
    // leaves no stuck mark and is fully recoverable by the watchdog.
    console.error('[cron/newsletter-pt]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
