/**
 * Event extraction + image acquisition pipeline.
 *
 * Used by:
 *   - app/api/cron/newsletter/route.ts  (after HTML gen, before archive commit)
 *   - app/api/cron/event-images/route.ts (background image catch-up)
 *   - scripts/extract-events-from-newsletter.ts
 *   - scripts/fetch-event-images.ts
 *
 * Kept separate from lib/events.ts to preserve the latter as a pure
 * data-layer module (no external API calls).
 */

import {
  type EventRecord,
  type EventCategory,
  type EventImage,
  isRealEventUrl,
  composeEventSlug,
  venueToSlug,
} from './events';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

// ---------------------------------------------------------------------------
// Extraction — HTML → structured event list
// ---------------------------------------------------------------------------

interface RawEvent {
  name: string;
  date: string;
  endDate?: string;
  venue: string;
  price?: string;
  priceFrom?: number;
  currency?: string;
  category: EventCategory;
  description: string;
  externalLink?: string;
}

/**
 * Ask Gemini Flash to turn a newsletter's HTML into a structured event array.
 * Returns already-validated EventRecord[] (slug + venueSlug computed, bad
 * externalLinks stripped).
 */
export async function extractEventsFromHtml(
  html: string,
  sourceEdition: string
): Promise<EventRecord[]> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const yearMatch = sourceEdition.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const prompt = `Extract all real events from the Oporto Weekly newsletter HTML below into a structured JSON array.

Output ONLY a JSON array with this exact shape (no markdown, no prose, no wrapping object):

[
  {
    "name": "Event Name",
    "date": "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" if time is known,
    "endDate": "YYYY-MM-DD" (optional; only if the event runs multiple days with a clear end date),
    "venue": "Venue Name",
    "price": "€20-€40" or "Free" or "From €15" (display-as-is; omit if unknown),
    "priceFrom": 20 (numeric starting price; omit if unknown or free),
    "currency": "EUR" (only if priceFrom is set),
    "category": "music" | "art" | "food" | "family" | "nightlife" | "sports" | "other",
    "description": "1-2 factual sentences describing the event. No editorial adjectives.",
    "externalLink": "https://..." (ONLY if the newsletter embeds an actual ticketing / venue / press page link — see rules below)
  }
]

RULES:
- Year is ${year}. If a date in the HTML says "April 17" or "Fri 17", output "${year}-04-17".
- SKIP: the editor's note, tip-of-the-week, hero section, footer, any promotional or editorial commentary.
- INCLUDE: everything under Editor's Picks (the numbered top 5) + every event inside the 5 category sections (🎵🎨🍷👨‍👩‍👧🌙).
- If the same event appears in both Editor's Picks and a category section, include it ONCE (prefer the category section's data since it's usually more detailed).
- Categorize based on which section the event appears in, NOT by guessing. Editor's Picks events: use the section topic from the surrounding context.
- Description should be FACTUAL. No "unmissable", "stunning", "vibrant". Just what it is.
- If a field isn't in the HTML, OMIT the field rather than inventing. Never write "TBA" or "check website".

- **externalLink rules (IMPORTANT — strict):**
  * ONLY use a URL that is actually present as an <a href="..."> in the HTML.
  * The URL must point to an official ticketing page (casadamusica.com, feverup.com, ticketline.pt, bol.pt, seticketstoday.com), a venue's own event page (cpf.pt, mercadobolhao.pt, worldofdiscoveries.pt, etc.), or an official press release.
  * NEVER return a google.com / google.pt URL, NEVER return a Google Search URL, NEVER fabricate a "likely" URL. If no real link is embedded in the HTML, OMIT the externalLink field entirely.
  * Do not guess or construct URLs — only copy what's literally there.

- Do not wrap the array in any object or markdown fence. First character of your output must be "[".

Newsletter HTML:
${html}`;

  const res = await fetch(geminiUrl('gemini-2.5-flash'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16000,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini extraction failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('Gemini returned empty extraction');

  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error(`No JSON array in Gemini output: ${text.slice(0, 300)}`);
  }
  const rawEvents = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as RawEvent[];

  // De-dupe by composed slug in case Gemini returns the same event twice.
  const seen = new Set<string>();
  const records: EventRecord[] = [];
  for (const r of rawEvents) {
    if (!r.name || !r.date || !r.venue) continue; // skip incomplete rows
    const slug = composeEventSlug(r.name, r.venue, r.date);
    if (seen.has(slug)) continue;
    seen.add(slug);
    records.push({
      slug,
      name: r.name,
      date: r.date,
      endDate: r.endDate,
      venue: r.venue,
      venueSlug: venueToSlug(r.venue),
      price: r.price,
      priceFrom: r.priceFrom,
      currency: r.currency ?? (r.priceFrom != null ? 'EUR' : undefined),
      category: r.category,
      description: r.description,
      sourceEdition,
      // Final guard: never persist a google/search URL even if the prompt slipped.
      externalLink: isRealEventUrl(r.externalLink) ? r.externalLink : undefined,
      addedAt: new Date().toISOString(),
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Image acquisition — event → press photo on Imgur
// ---------------------------------------------------------------------------

async function findEventUrlViaGemini(ev: EventRecord): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const query = `Find the official event page for "${ev.name}" at ${ev.venue} in Porto on ${ev.date}. Return ONLY the single best URL — a ticketing page, venue event page, or official press release — and nothing else. No explanation, no markdown, just the raw URL. If you can't find an authoritative page, return the word NONE.`;

  try {
    const res = await fetch(geminiUrl('gemini-2.5-flash'), {
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

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('text/html') && !ctype.includes('application/xhtml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractOgImage(html: string, pageUrl: string): string | null {
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw || raw.startsWith('data:')) continue;
    try {
      return new URL(raw, pageUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function downloadImageBase64(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': UA, Referer: imageUrl },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 9 * 1024 * 1024) return null; // Imgur 10MB cap
    if (buf.byteLength < 1024) return null; // obvious error blob
    return buf.toString('base64');
  } catch {
    return null;
  }
}

async function uploadToImgur(base64: string): Promise<string | null> {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) return null;
  try {
    const res = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `image=${encodeURIComponent(base64)}&type=base64`,
    });
    const data = await res.json();
    if (data?.success && data?.data?.link) return data.data.link as string;
  } catch {
    /* fall through */
  }
  return null;
}

function creditFromHost(host: string): string {
  const h = host.replace(/^www\./, '');
  const known: Record<string, string> = {
    'casadamusica.com': 'Casa da Música',
    'feverup.com': 'FEVER',
    'ticketline.pt': 'Ticketline',
    'bol.pt': 'BOL',
    'mercadobeirario.pt': 'Mercado Beira-Rio',
    'mercadobolhao.pt': 'Mercado do Bolhão',
    'mercadobomsucesso.pt': 'Mercado do Bom Sucesso',
    'cpf.pt': 'Centro Português de Fotografia',
    'worldofdiscoveries.pt': 'World of Discoveries',
    'seticketstoday.com': 'SeeTickets',
    'festivalddd.com': 'Festival DDD',
  };
  if (known[h]) return `Photo: ${known[h]}`;
  const bare = h.replace(/\.[a-z]{2,}$/, '');
  return `Photo: ${bare.charAt(0).toUpperCase() + bare.slice(1)}`;
}

export type ImageAcquireResult =
  | { status: 'imaged'; image: EventImage; resolvedUrl: string }
  | { status: 'already' }
  | { status: 'no-url' | 'no-og' | 'no-download' | 'no-upload' };

/**
 * For a single event, try to find + re-host a press photo. Idempotent —
 * returns 'already' if the event is already imaged (unless `force` is true).
 *
 * The returned image is always re-hosted on Imgur. The discovered URL is
 * returned too (separately from the image) so the caller can persist it
 * back into the event's `externalLink` — handy when the existing link was
 * missing or stale.
 */
export async function acquireEventImage(
  ev: EventRecord,
  opts: { force?: boolean } = {}
): Promise<ImageAcquireResult> {
  if (ev.image && !opts.force) return { status: 'already' };

  // 1. Pick a source URL
  let sourceUrl: string | null = null;
  if (isRealEventUrl(ev.externalLink)) {
    sourceUrl = ev.externalLink;
  } else {
    sourceUrl = await findEventUrlViaGemini(ev);
  }
  if (!sourceUrl) return { status: 'no-url' };

  // 2. Fetch page + og:image
  const html = await fetchPage(sourceUrl);
  if (!html) return { status: 'no-og' };
  const ogImage = extractOgImage(html, sourceUrl);
  if (!ogImage) return { status: 'no-og' };

  // 3. Download + upload to Imgur
  const base64 = await downloadImageBase64(ogImage);
  if (!base64) return { status: 'no-download' };
  const imgurUrl = await uploadToImgur(base64);
  if (!imgurUrl) return { status: 'no-upload' };

  return {
    status: 'imaged',
    image: {
      url: imgurUrl,
      credit: creditFromHost(new URL(sourceUrl).hostname),
      sourceUrl,
    },
    resolvedUrl: sourceUrl,
  };
}
