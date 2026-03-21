export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { generateSlug } from '@/lib/archive';
import { archiveViaGitHub } from '@/lib/github';
import { getActiveSubscribers } from '@/lib/beehiiv';
import { sendBatch } from '@/lib/resend-client';
import { notifySearchEngines } from '@/lib/search-engines';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SEARCH_QUERIES = [
  'Porto events this week',
  'Porto concerts this week',
  'Porto art exhibitions this week',
  'Porto food markets weekend',
  'Porto family events this week',
  'Porto nightlife this week',
];

async function geminiSearch(query: string): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini search failed for "${query}": ${res.status} ${err}`);
  }

  const data = await res.json();
  // Extract text from candidates
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('\n') ?? '';
  return `=== ${query} ===\n${text}`;
}

async function generateNewsletter(researchData: string): Promise<string> {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const prompt = `You are the editor of "Oporto Weekly", a curated newsletter about events in Porto, Portugal.

Today is ${today}. Based on the research below, generate a COMPLETE HTML email newsletter.

RESEARCH DATA:
${researchData}

NEWSLETTER STRUCTURE (follow exactly):
1. Dark header: background #1a1a2e, white title "Oporto Weekly", gold (#c9a96e) accents and week date
2. Editor's Picks — top 5 must-see events this week
3. Music & Concerts
4. Art & Exhibitions
5. Food Markets & Wine
6. Family
7. Nightlife
8. Tip of the Week — one practical Porto insider tip

For EACH event include:
- Event name (bold)
- Date & time
- Venue name
- Price (or "Free")
- 1-2 sentence description
- "More info →" link (use real URL from research if available, otherwise link to google search)

DESIGN REQUIREMENTS:
- Full HTML document with inline styles only (email-safe)
- Background: #1a1a2e (dark navy)
- Header bg: #1a1a2e with gold (#c9a96e) divider line
- Card bg: #16213e
- Body text: #ccd6f6
- Accent/headings: #c9a96e (gold)
- Section headers: white text on #0f3460 background
- Max width: 600px, centered
- Mobile-friendly, table-based layout for email clients
- Footer: unsubscribe note, "© Oporto Weekly · Porto, Portugal"
- All <img> tags must have descriptive alt attributes (e.g., alt="Jazz concert at Casa da Música Porto")

Output ONLY the complete HTML. No markdown, no explanation.`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 65536 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini newsletter generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  let html: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? '';

  // Strip markdown code fences if model wraps output
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();

  return html;
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

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 65536 },
    }),
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
    // 1. Run Gemini searches sequentially to respect rate limits
    const searchResults: string[] = [];
    for (const query of SEARCH_QUERIES) {
      const result = await geminiSearch(query);
      searchResults.push(result);
      await new Promise(r => setTimeout(r, 2000)); // 2s delay between calls
    }
    const researchData = searchResults.join('\n\n');

    // 2. Generate newsletter HTML
    const html = await generateNewsletter(researchData);

    // 3. Determine subject line
    const weekDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `Oporto Weekly — ${weekDate}`;

    // 4. Send EN edition to EN subscribers
    const enSubscribers = await getActiveSubscribers('en');
    const enEmails = enSubscribers.map(s => s.email);
    const sentEN = await sendBatch(enEmails, subject, html);
    console.log(`[cron/newsletter] Sent EN to ${sentEN} subscribers`);

    // 5. Archive EN edition via GitHub API (commits to repo → triggers Vercel redeploy)
    const now = new Date();
    const weekRange = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const slug = generateSlug(weekRange);
    try {
      await archiveViaGitHub({
        slug,
        title: `Oporto Weekly — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        description: subject,
        sentAt: now.toISOString(),
        weekRange,
      }, html, 'newsletters.json');
      console.log(`[cron/newsletter] Archived EN as ${slug}`);

      // Notify search engines about the new edition (best-effort)
      notifySearchEngines(slug).catch(e =>
        console.error('[cron/newsletter] Search engine notification failed:', e)
      );
    } catch (archiveErr) {
      console.error('[cron/newsletter] EN archive failed:', archiveErr);
    }

    // 6. Generate Portuguese translation, send to PT subscribers, archive
    let sentPT = 0;
    try {
      const ptHtml = await translateNewsletter(html);
      const ptWeekDate = now.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
      const ptSubject = `Oporto Weekly — ${ptWeekDate}`;

      // Send PT edition to PT subscribers
      const ptSubscribers = await getActiveSubscribers('pt');
      const ptEmails = ptSubscribers.map(s => s.email);
      if (ptEmails.length > 0) {
        sentPT = await sendBatch(ptEmails, ptSubject, ptHtml);
        console.log(`[cron/newsletter] Sent PT to ${sentPT} subscribers`);
      }

      // Archive PT edition
      const ptSlug = slug + '-pt';
      await archiveViaGitHub({
        slug: ptSlug,
        title: `Oporto Weekly — ${ptWeekDate}`,
        description: `Eventos no Porto: ${ptWeekDate}`,
        sentAt: now.toISOString(),
        weekRange: ptWeekDate,
      }, ptHtml, 'newsletters-pt.json');
      console.log(`[cron/newsletter] Archived PT as ${ptSlug}`);
    } catch (ptErr) {
      console.error('[cron/newsletter] PT translation/send/archive failed:', ptErr);
    }

    return NextResponse.json({ success: true, sent: { en: sentEN, pt: sentPT } });
  } catch (err: unknown) {
    console.error('[cron/newsletter]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
