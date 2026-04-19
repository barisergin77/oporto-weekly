/**
 * Fetches a press photo for each event and re-hosts it on Imgur.
 *
 * Pipeline per event:
 *   1. Pick a source URL: use externalLink if it's a real event page (not a
 *      google.com search). Otherwise Gemini-search the web for the best page.
 *   2. Fetch the source page, extract `<meta property="og:image">` (fall back
 *      to twitter:image).
 *   3. Download the image bytes, upload to Imgur → public URL.
 *   4. Write `image: { url, credit, sourceUrl }` back into the event's JSON.
 *
 * Idempotent — events that already have an image are skipped. Events that
 * can't be matched keep the placeholder (no image field).
 *
 * Usage:
 *   npm run fetch-event-images                    # all events
 *   npm run fetch-event-images -- --slug=XYZ      # one specific event
 *   npm run fetch-event-images -- --force         # refetch even if image present
 *   npm run fetch-event-images -- --dry-run       # log only, no writes
 */

import fs from 'fs';
import path from 'path';
import { isRealEventUrl, type EventRecord, type EventImage } from '../lib/events';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Source URL resolution
// ---------------------------------------------------------------------------

async function findEventUrlViaGemini(ev: EventRecord): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const query = `Find the official event page for "${ev.name}" at ${ev.venue} in Porto on ${ev.date}. Return ONLY the single best URL — a ticketing page, venue event page, or official press release — and nothing else. No explanation, no markdown, just the raw URL. If you can't find an authoritative page, return the word NONE.`;

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

  // Extract first URL from the text
  const match = text.match(/https?:\/\/[^\s<>"'\]]+/);
  if (!match) return null;
  const candidate = match[0].replace(/[.,;)]+$/, ''); // trim trailing punct
  return isRealEventUrl(candidate) ? candidate : null;
}

// ---------------------------------------------------------------------------
// Page fetching + og:image extraction
// ---------------------------------------------------------------------------

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

/** Extract og:image (or twitter:image fallback) from HTML. */
function extractOgImage(html: string, pageUrl: string): string | null {
  // property="og:image" OR name="og:image" — both are in the wild.
  // Also handle attribute order variation (content before property).
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
      // Resolve relative URLs against the page URL
      return new URL(raw, pageUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Imgur upload
// ---------------------------------------------------------------------------

async function downloadImage(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': UA, Referer: imageUrl },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Imgur free tier: 10 MB limit. Skip oversize.
    if (buf.byteLength > 9 * 1024 * 1024) return null;
    if (buf.byteLength < 1024) return null; // obvious placeholder / error image
    return buf.toString('base64');
  } catch {
    return null;
  }
}

async function uploadToImgur(base64: string): Promise<string | null> {
  if (!IMGUR_CLIENT_ID) return null;
  try {
    const res = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
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

// ---------------------------------------------------------------------------
// Credit formatting
// ---------------------------------------------------------------------------

/** Turn a hostname into a human-friendly credit. */
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
  };
  if (known[h]) return `Photo: ${known[h]}`;
  // Fallback: capitalize the bare domain ("exponor.pt" → "Photo: Exponor")
  const bare = h.replace(/\.[a-z]{2,}$/, '');
  return `Photo: ${bare.charAt(0).toUpperCase() + bare.slice(1)}`;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function processEvent(
  ev: EventRecord,
  opts: { dryRun: boolean; force: boolean }
): Promise<'already' | 'imaged' | 'no-url' | 'no-og' | 'no-download' | 'no-upload'> {
  if (ev.image && !opts.force) return 'already';

  // 1. Pick source URL. If the stored externalLink isn't a real event URL
  //    (e.g. it's a google.com search link left over from an early run),
  //    we'll use Gemini to find a real one — and later persist it so the
  //    "Get tickets" CTA never points at a google search.
  let sourceUrl: string | null = null;
  let foundViaGemini = false;
  if (isRealEventUrl(ev.externalLink)) {
    sourceUrl = ev.externalLink;
  } else {
    const found = await findEventUrlViaGemini(ev);
    if (found) {
      sourceUrl = found;
      foundViaGemini = true;
    }
  }
  if (!sourceUrl) return 'no-url';

  // 2. Fetch page + extract og:image
  const html = await fetchPage(sourceUrl);
  if (!html) return 'no-og';
  const ogImage = extractOgImage(html, sourceUrl);
  if (!ogImage) return 'no-og';

  if (opts.dryRun) {
    console.log(`    [dry-run] source=${sourceUrl}${foundViaGemini ? ' (via gemini, would replace stale link)' : ''}`);
    console.log(`              og=${ogImage}`);
    return 'imaged';
  }

  // 3. Download + upload to Imgur
  const base64 = await downloadImage(ogImage);
  if (!base64) return 'no-download';
  const imgurUrl = await uploadToImgur(base64);
  if (!imgurUrl) return 'no-upload';

  // 4. Write back. We persist the DISCOVERED sourceUrl into externalLink so
  //    the "Get tickets" CTA points at the real page, not a stale google.com
  //    search URL.
  const credit = creditFromHost(new URL(sourceUrl).hostname);
  const image: EventImage = {
    url: imgurUrl,
    credit,
    sourceUrl,
  };
  const updated: EventRecord = {
    ...ev,
    externalLink: isRealEventUrl(ev.externalLink) ? ev.externalLink : sourceUrl,
    image,
  };
  const file = path.join(process.cwd(), 'data', 'events', `${ev.slug}.json`);
  fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf-8');
  console.log(`    → ${imgurUrl} (${credit})${foundViaGemini ? ' · replaced stale link' : ''}`);
  return 'imaged';
}

async function main() {
  if (!IMGUR_CLIENT_ID) throw new Error('IMGUR_CLIENT_ID not set');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const slugFilter = args.find((a) => a.startsWith('--slug='))?.split('=')[1];

  const dir = path.join(process.cwd(), 'data', 'events');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  let events: EventRecord[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as EventRecord
  );
  if (slugFilter) events = events.filter((e) => e.slug === slugFilter);

  console.log(`Processing ${events.length} event${events.length === 1 ? '' : 's'}${dryRun ? ' [dry-run]' : ''}${force ? ' [force]' : ''}`);

  const counts: Record<string, number> = {};
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    console.log(`\n[${i + 1}/${events.length}] ${ev.name} @ ${ev.venue}`);
    try {
      const result = await processEvent(ev, { dryRun, force });
      counts[result] = (counts[result] ?? 0) + 1;
      if (result !== 'imaged' && result !== 'already') {
        console.log(`    ⚠ ${result}`);
      }
    } catch (err) {
      counts.error = (counts.error ?? 0) + 1;
      console.error(`    ❌`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n--- Summary ---');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
