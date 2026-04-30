export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange, formatWeekRangePT } from '@/lib/archive';
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
    // 1. Determine current week's slug (MUST match EN cron exactly so we can
    //    fetch today's EN HTML file to translate).
    const now = new Date();
    const weekRange = formatWeekRange(now);
    const slug = generateSlug(weekRange);
    const ptSlug = `${slug}-pt`;

    // 1.5. IDEMPOTENCY GUARD — never translate/send the same week twice.
    //
    // Background: 2026-04-30 the PT cron fired three times (schedule +
    // two dispatches), re-translating and re-sending each time.
    // Subscribers got duplicate emails with drifting wording.
    //
    // Check via GitHub API whether this week's PT HTML is already
    // archived. If yes, bail with 200 + skipped:true. Mirrors the EN
    // cron's guard.
    {
      const existingPt = await getFileContent(`public/newsletters/${ptSlug}.html`);
      if (existingPt) {
        console.log(`[cron/newsletter-pt] ${ptSlug} already archived — skipping (idempotency guard)`);
        return NextResponse.json({
          skipped: true,
          reason: 'already-archived',
          slug: ptSlug,
        });
      }
    }

    // 2. Fetch EN newsletter HTML from GitHub (EN cron committed it 15 min earlier)
    const enHtml = await getFileContent(`public/newsletters/${slug}.html`);
    if (!enHtml) {
      throw new Error(`EN newsletter not found for slug ${slug} — did the EN cron run successfully?`);
    }
    console.log(`[cron/newsletter-pt] Loaded EN newsletter: ${slug} (${enHtml.length} bytes)`);

    // 3. Translate to Portuguese
    const ptHtml = await translateNewsletter(enHtml);
    console.log(`[cron/newsletter-pt] Translated to PT (${ptHtml.length} bytes)`);

    // 4. Send PT edition to PT subscribers
    const ptWeekDate = formatWeekRangePT(now);
    const ptSubject = `Oporto Weekly — ${ptWeekDate}`;

    const ptSubscribers = await getActiveSubscribers('pt');
    const ptEmails = ptSubscribers.map(s => s.email);
    let sentPT = 0;
    if (ptEmails.length > 0) {
      // Tagged identically to EN so dashboard filters treat EN+PT as sibling
      // dimensions of the same edition. `edition` uses ptSlug (e.g.
      // "april-16-22-2026-pt") to differentiate from EN in per-edition views.
      sentPT = await sendBatch(ptEmails, ptSubject, ptHtml, [
        { name: 'type', value: 'newsletter' },
        { name: 'lang', value: 'pt' },
        { name: 'edition', value: ptSlug },
      ]);
      console.log(`[cron/newsletter-pt] Sent PT to ${sentPT} subscribers`);
    } else {
      console.log('[cron/newsletter-pt] No PT subscribers — skipping send');
    }

    // 5. Archive PT edition via GitHub API
    try {
      await archiveViaGitHub({
        slug: ptSlug,
        title: `Oporto Weekly — ${ptWeekDate}`,
        description: `Eventos no Porto: ${ptWeekDate}`,
        sentAt: now.toISOString(),
        weekRange: ptWeekDate,
      }, ptHtml, 'newsletters-pt.json');
      console.log(`[cron/newsletter-pt] Archived PT as ${ptSlug}`);

      // Notify search engines (best-effort)
      notifySearchEngines(`pt/arquivo/${ptSlug}`).catch(e =>
        console.error('[cron/newsletter-pt] Search engine notification failed:', e)
      );
    } catch (archiveErr) {
      console.error('[cron/newsletter-pt] PT archive failed:', archiveErr);
    }

    return NextResponse.json({ success: true, slug: ptSlug, sent: { pt: sentPT } });
  } catch (err: unknown) {
    console.error('[cron/newsletter-pt]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
