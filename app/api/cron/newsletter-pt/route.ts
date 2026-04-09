export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { archiveViaGitHub, getFileContent, NewsletterMeta } from '@/lib/github';
import { getActiveSubscribers } from '@/lib/beehiiv';
import { sendBatch } from '@/lib/resend-client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && url === GEMINI_URL) {
    console.log('[geminiPost] 429 on gemini-2.5-flash, retrying with gemini-2.0-flash');
    return geminiPost(GEMINI_URL_FALLBACK, body);
  }

  console.log(`[geminiPost] Used model: ${url.includes('2.5-flash') ? 'gemini-2.5-flash' : 'gemini-2.0-flash'}`);
  return res;
}

async function translateNewsletter(enHtml: string): Promise<string> {
  const prompt = `Translate the following HTML newsletter from English to European Portuguese (pt-PT).

RULES:
- Translate ALL text content to Portuguese, including section headers, descriptions, tips, footer text
- Keep event names and venue names as-is (they are proper nouns)
- Translate day abbreviations: Mon→Seg, Tue→Ter, Wed→Qua, Thu→Qui, Fri→Sex, Sat→Sáb, Sun→Dom
- Translate "Free"→"Gratuito", "More info"→"Mais info", "Get tickets"→"Comprar bilhetes", "Book"→"Reservar"
- Use 24h time format (9 PM → 21h)
- Change <html lang="en"> to <html lang="pt">
- Keep ALL HTML structure, CSS, classes, links, and styling exactly the same
- Keep all URLs unchanged
- Output ONLY the complete translated HTML. No markdown, no explanation.

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

export async function GET() {
  try {
    // 1. Read the latest EN newsletter index from GitHub
    const indexContent = await getFileContent('data/newsletters.json');
    if (!indexContent) {
      return NextResponse.json({ error: 'No EN newsletters found' }, { status: 404 });
    }

    const newsletters: NewsletterMeta[] = JSON.parse(indexContent);
    if (newsletters.length === 0) {
      return NextResponse.json({ error: 'No EN newsletters found' }, { status: 404 });
    }

    const latestEN = newsletters[0];
    console.log(`[cron/newsletter-pt] Found latest EN edition: ${latestEN.slug}`);

    // 2. Read the EN HTML content
    const enHtml = await getFileContent(`public/newsletters/${latestEN.slug}.html`);
    if (!enHtml) {
      return NextResponse.json({ error: `EN HTML not found: ${latestEN.slug}` }, { status: 404 });
    }

    // 3. Translate to Portuguese
    console.log(`[cron/newsletter-pt] Translating ${latestEN.slug}...`);
    const ptHtml = await translateNewsletter(enHtml);

    // 4. Send to PT subscribers
    const now = new Date();
    const ptWeekDate = now.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
    const ptSubject = `Oporto Weekly — ${ptWeekDate}`;

    const ptSubscribers = await getActiveSubscribers('pt');
    const ptEmails = ptSubscribers.map(s => s.email);
    let sentPT = 0;
    if (ptEmails.length > 0) {
      sentPT = await sendBatch(ptEmails, ptSubject, ptHtml);
      console.log(`[cron/newsletter-pt] Sent PT to ${sentPT} subscribers`);
    }

    // 5. Archive PT edition
    const ptSlug = latestEN.slug + '-pt';
    try {
      await archiveViaGitHub({
        slug: ptSlug,
        title: `Oporto Weekly — ${ptWeekDate}`,
        description: `Eventos no Porto: ${ptWeekDate}`,
        sentAt: now.toISOString(),
        weekRange: ptWeekDate,
      }, ptHtml, 'newsletters-pt.json');
      console.log(`[cron/newsletter-pt] Archived PT as ${ptSlug}`);
    } catch (archiveErr) {
      console.error('[cron/newsletter-pt] PT archive failed:', archiveErr);
    }

    return NextResponse.json({ success: true, sent: { pt: sentPT }, source: latestEN.slug });
  } catch (err: unknown) {
    console.error('[cron/newsletter-pt]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
