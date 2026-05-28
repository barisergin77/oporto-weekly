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
  findExistingEventByIdentity,
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
  editorPickRank?: number;
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
    "externalLink": "https://..." (ONLY if the newsletter embeds an actual ticketing / venue / press page link — see rules below),
    "editorPickRank": 1 (ONLY for events that appear under the "Editor's Picks" / "Top Five" section; the number is the 1-based position in that section — Pick 1 → 1, Pick 2 → 2, …, Pick 5 → 5. OMIT for every other event)
  }
]

RULES:
- Year is ${year}. If a date in the HTML says "April 17" or "Fri 17", output "${year}-04-17".
- SKIP: the editor's note, tip-of-the-week, hero section, footer, any promotional or editorial commentary.
- INCLUDE: everything under Editor's Picks (the numbered top 5) + every event inside the 5 category sections (🎵🎨🍷👨‍👩‍👧🌙).
- If the same event appears in both Editor's Picks and a category section, include it ONCE (prefer the category section's data since it's usually more detailed) — BUT set editorPickRank on it matching its position in the Editor's Picks section.
- The Editor's Picks section is identified by: an "Editor's Picks" heading, "THE TOP FIVE" eyebrow, numbered gold-outlined circles (1–5), and/or <!-- Pick N --> HTML comments. Events in that section get editorPickRank matching their number (1–5). The FIRST event there gets editorPickRank: 1, the second gets 2, etc. Events anywhere else get editorPickRank OMITTED.
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

  // De-dupe in two passes:
  //   (1) Within this run — Gemini occasionally returns the same event
  //       twice (e.g. once in Editor's Picks, once in a category section).
  //       We collapse on composed slug.
  //   (2) Across runs — long-running exhibitions ("It's a Pink Area" runs
  //       Apr 11 → Oct 4) get re-surfaced by future weeks' research and
  //       would otherwise produce a fresh duplicate slug each week. We
  //       look up the canonical record by (name, venue) identity and
  //       reuse its slug. Newsletter HTML links then point to the existing
  //       page; the JSON file is updated in-place rather than orphaned.
  //
  //   Existing-record fields are preserved on top of the new extraction —
  //   that protects accumulated enrichment (longDescription, image,
  //   externalLink, real dates for long-running events). What DOES get
  //   updated is sourceEdition (so this week is recorded as the latest
  //   surface) and editorPickRank (this week's pick position).
  const seen = new Set<string>();
  const records: EventRecord[] = [];
  for (const r of rawEvents) {
    if (!r.name || !r.date || !r.venue) continue;

    // Dedup pass (2): is this event already canonical somewhere?
    const existing = findExistingEventByIdentity(r.name, r.venue);
    const slug = existing?.slug ?? composeEventSlug(r.name, r.venue, r.date);
    if (seen.has(slug)) continue;
    seen.add(slug);

    const editorPickRank =
      typeof r.editorPickRank === 'number' && r.editorPickRank >= 1 && r.editorPickRank <= 5
        ? Math.round(r.editorPickRank)
        : undefined;

    if (existing) {
      // Merge: preserve enrichment, override only what THIS run owns.
      records.push({
        ...existing,
        sourceEdition,
        editorPickRank, // explicit — clears prior weeks' pick if this week didn't surface
        // Keep existing externalLink if it's already real; otherwise take
        // a real one from this run if Gemini found one.
        externalLink: isRealEventUrl(existing.externalLink)
          ? existing.externalLink
          : (isRealEventUrl(r.externalLink) ? r.externalLink : existing.externalLink),
      });
      continue;
    }

    // Fresh event — first time we've seen it.
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
      externalLink: isRealEventUrl(r.externalLink) ? r.externalLink : undefined,
      editorPickRank,
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
    // 25s ceiling: Gemini Flash with grounded search is usually 3-8s but
    // can hang on slow days. Without this, a single slow event eats the
    // whole 300s Vercel budget and the cron times out before committing
    // anything (observed 2026-05-28 — workflow failed at 5m3s with no
    // commit, partial work lost).
    const res = await fetch(geminiUrl('gemini-2.5-flash'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(25000),
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

/**
 * Extract a hero image URL from an event page. Tries several sources in
 * order — og:image is the nicest but many SSR-light pages don't emit it,
 * so we fall through to JSON-LD, legacy link tags, and finally to heuristic
 * <img> selection.
 */
function extractOgImage(html: string, pageUrl: string): string | null {
  const resolve = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    try {
      const url = new URL(trimmed, pageUrl).toString();
      // Skip obvious placeholder / tracking pixels
      if (/\/pixel\.|\/spacer\.|\/blank\.|1x1\.(png|gif)/.test(url)) return null;
      return url;
    } catch {
      return null;
    }
  };

  // 1) Open Graph meta (+ Twitter)
  const metaPatterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metaPatterns) {
    const m = html.match(re);
    const url = resolve(m?.[1]);
    if (url) return url;
  }

  // 2) JSON-LD — many venue CMSes emit schema.org Event with an image
  // field even when they skip og:image. Parse each LD block, look for an
  // image field (can be string, array, or { url } object).
  const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatches) {
    for (const ld of ldMatches) {
      const body = ld.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = JSON.parse(body) as any;
        // Flatten @graph if present
        const candidates: unknown[] = Array.isArray(parsed)
          ? parsed
          : parsed?.['@graph']
            ? [parsed, ...parsed['@graph']]
            : [parsed];
        for (const c of candidates) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj = c as any;
          if (!obj?.image) continue;
          const img = obj.image;
          let candidateUrl: string | null = null;
          if (typeof img === 'string') candidateUrl = img;
          else if (Array.isArray(img))
            candidateUrl = typeof img[0] === 'string' ? img[0] : img[0]?.url ?? null;
          else if (typeof img === 'object' && img?.url) candidateUrl = img.url;

          const resolved = resolve(candidateUrl);
          if (resolved) return resolved;
        }
      } catch {
        /* malformed JSON-LD — ignore, try next block */
      }
    }
  }

  // 3) Legacy <link rel="image_src">
  const linkMatch = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
  const linkUrl = resolve(linkMatch?.[1]);
  if (linkUrl) return linkUrl;

  // 4) Heuristic: first <img> with a real src. Skip obvious logos and tiny
  // icons. Prefer tags with explicit width ≥ 400 or class/alt containing
  // the event-y keywords. This catches pages that just plonk a hero image
  // at the top of the <main> area.
  const imgTags = html.match(/<img[^>]+>/gi) ?? [];
  const SKIP = /logo|icon|avatar|badge|sprite|favicon|menu-toggle/i;
  for (const tag of imgTags) {
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    const src = resolve(srcMatch?.[1]);
    if (!src) continue;
    if (SKIP.test(tag)) continue;
    // Skip tiny images where we can tell from the attributes
    const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1], 10) < 300) continue;
    return src;
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
    // 30s ceiling. Imgur uploads usually finish in 2-5s but the base64
    // payload can be 5MB+ for high-res scrapes; on a slow Imgur day the
    // request can stall indefinitely.
    const res = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `image=${encodeURIComponent(base64)}&type=base64`,
      signal: AbortSignal.timeout(30000),
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

// ---------------------------------------------------------------------------
// Newsletter HTML post-processing — wrap event headings in <a href="/event/...">
// ---------------------------------------------------------------------------

const SITE = 'https://oportoweekly.com';

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTML-encode &, <, > inside an event name so the regex matches both raw
 * ("Queen & ABBA") and entity-encoded ("Queen &amp; ABBA") versions.
 * We keep the original as a variant too since Gemini's extraction sometimes
 * preserves entities and sometimes doesn't.
 */
function nameVariants(name: string): string[] {
  const trimmed = name.trim();
  const encoded = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return trimmed === encoded ? [trimmed] : [encoded, trimmed];
}

/**
 * Inject <a href="/event/<slug>"> anchors around event titles inside
 * newsletter-generation HTML.
 *
 * The template uses TWO patterns for event headings:
 *
 *   1) Semantic headings <h2>/<h3>/<h4> — substring match (titles can have
 *      surrounding text like a category emoji).
 *
 *   2) Styled paragraphs <p style="...font-family:Georgia,serif...">Event
 *      Name</p> — this is the travel-magazine template's main pattern for
 *      event names. We EXACT-match the trimmed inner text to avoid wrapping
 *      descriptive <p> paragraphs whose text happens to mention an event.
 *
 * Each event is matched globally so both the Editor's Picks and category
 * section occurrences get linked.
 *
 * - Uses absolute URLs (emails break on relative hrefs).
 * - color:inherit + text-decoration:none to preserve heading styling.
 * - Skips elements that already contain an <a> (idempotent).
 */
export function injectEventLinks(
  html: string,
  events: EventRecord[]
): { html: string; linked: number; moreInfoRewritten: number } {
  let out = html;
  let linked = 0;

  // --- Pass 1: wrap event titles in <a href="/event/<slug>"> ---

  // Longer names first — prevents "Tito Paris" accidentally wrapping inside
  // a hypothetical "Tito Paris and Friends" heading before that one is seen.
  const sorted = [...events].sort((a, b) => b.name.length - a.name.length);

  for (const ev of sorted) {
    if (!ev.slug || !ev.name) continue;
    const href = `${SITE}/event/${ev.slug}`;
    const variants = nameVariants(ev.name);

    // --- Pattern A: any semantic heading h1–h6 whose trimmed inner text
    // EXACTLY equals the event name. Exact match (not substring) because
    // substring + backref + lazy quantifier can greedy-span multiple
    // adjacent headings when a short name only appears in a later block —
    // the regex engine finds the name several headings down and wraps
    // everything in between, then subsequent names get disqualified by the
    // idempotency check on that oversized span. Exact match has no such
    // failure mode: one heading, one event. ---
    for (const variant of variants) {
      const hPattern = new RegExp(
        `(<(h[1-6])([^>]*)>)\\s*(${escapeRegex(variant)})\\s*(<\\/\\2>)`,
        'gi'
      );
      out = out.replace(hPattern, (match, openTag, _tag, _attrs, innerName, closeTag) => {
        if (/<a\b/i.test(openTag)) return match; // already linked
        linked++;
        return `${openTag}<a href="${href}" style="color:inherit;text-decoration:none;">${innerName}</a>${closeTag}`;
      });
    }

    // --- Pattern B: serif <p> whose trimmed inner text EXACTLY equals the
    // event name. Kept for compatibility with the earlier travel-magazine
    // template (Apr 2026 editions) that marked titles with Georgia serif
    // <p> at 17px/19px. Newer editions use <h4> (caught by Pattern A). ---
    for (const variant of variants) {
      const pPattern = new RegExp(
        `(<p\\b[^>]*font-family:\\s*Georgia[^>]*>)\\s*(${escapeRegex(variant)})\\s*(<\\/p>)`,
        'gi'
      );
      out = out.replace(pPattern, (match, openTag, innerName, closeTag) => {
        if (/<a\b/i.test(openTag)) return match;
        linked++;
        return `${openTag}<a href="${href}" style="color:inherit;text-decoration:none;">${innerName}</a>${closeTag}`;
      });
    }
  }

  // --- Pass 2: rewrite "MORE INFO" anchors to the event detail page.
  // The newsletter template emits a "MORE INFO" link under each event card
  // pointing at whatever URL Gemini found during generation — often a
  // google.com/search fallback (useless) or a hallucinated ticketing URL
  // that 404s. The canonical "more info" destination is OUR event detail
  // page, which in turn has a verified "Get tickets" CTA if we have a
  // real ticketing link.
  //
  // Association rule: for each "MORE INFO" anchor, the event it belongs to
  // is the nearest event-title anchor PRECEDING it in document order. This
  // matches the template's rendering — each event card is:
  //   <p><a href="/event/…">Title</a></p>
  //   <p>meta line</p>
  //   <p>description</p>
  //   <p><a …>MORE INFO</a></p>
  const moreInfoRewritten = (() => {
    const eventAnchorRe = new RegExp(`<a\\s+href="${escapeRegex(SITE)}/event/([^"]+)"`, 'g');
    const eventAnchors: Array<{ pos: number; slug: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = eventAnchorRe.exec(out)) !== null) {
      eventAnchors.push({ pos: m.index, slug: m[1] });
    }
    if (eventAnchors.length === 0) return 0;

    // Match "more info" anchors regardless of case / trailing glyph.
    // The template uses TWO variants:
    //   <a>MORE INFO</a>       — Editor's Picks (uppercase, no arrow)
    //   <a>More info →</a>     — category sections (mixed case, arrow)
    // Both need to be redirected to /event/<slug>. We capture the attrs
    // (preserving inline styling) and the inner text (preserving whatever
    // casing + arrow the template used).
    const miRe = /<a\s+href="[^"]+"([^>]*)>\s*(more\s+info[^<]*?)\s*<\/a>/gi;
    const moreInfos: Array<{
      pos: number;
      length: number;
      attrs: string;
      innerText: string;
    }> = [];
    while ((m = miRe.exec(out)) !== null) {
      moreInfos.push({
        pos: m.index,
        length: m[0].length,
        attrs: m[1],
        innerText: m[2],
      });
    }

    // Rewrite in REVERSE order so earlier replacements don't shift later
    // positions.
    let rewritten = 0;
    for (const mi of [...moreInfos].reverse()) {
      const preceding = eventAnchors.filter((ea) => ea.pos < mi.pos).pop();
      if (!preceding) continue;
      const newHref = `${SITE}/event/${preceding.slug}`;
      // Strip target="_blank" and rel="noopener/noreferrer" from the preserved
      // attrs: the href is now internal (our own /event/ page), so there's no
      // reason to spawn a new tab. Keeps the click-through behavior consistent
      // with the event-title link above it, which opens in the same window.
      const internalAttrs = mi.attrs
        .replace(/\s+target\s*=\s*(["'])[^"']*\1/gi, '')
        .replace(/\s+rel\s*=\s*(["'])[^"']*\1/gi, '');
      // Preserve the original inner text ("MORE INFO" vs "More info →") so
      // each section keeps its visual identity.
      const newAnchor = `<a href="${newHref}"${internalAttrs}>${mi.innerText}</a>`;
      out = out.slice(0, mi.pos) + newAnchor + out.slice(mi.pos + mi.length);
      rewritten++;
    }
    return rewritten;
  })();

  return { html: out, linked, moreInfoRewritten };
}

// ---------------------------------------------------------------------------
// Long-form description — 3-paragraph detail-page copy
// ---------------------------------------------------------------------------

/**
 * Generate a 3-paragraph long-form description for an event's detail page.
 *
 * Distinct from the 1-2 sentence `description` field that gets emitted in the
 * newsletter / listings / cards / OG image. The long form lives only on
 * /event/<slug> and gives a visitor enough context to decide whether to go.
 *
 * Source: Gemini Flash with thinking disabled + general knowledge (no search
 * grounding yet — ~5s/event, keeps the cron cheap). For events Gemini doesn't
 * know the specifics of, it produces a shorter, safer description rather than
 * hallucinating. Fresh research grounding can be added later if the output
 * quality matters more than speed/cost.
 */
export async function generateLongDescription(event: EventRecord): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const dateStr = event.endDate
    ? `${event.date} to ${event.endDate}`
    : event.date;

  const prompt = `Write a detail-page description for this Porto event.

Event: ${event.name}
Venue: ${event.venue}
Date: ${dateStr}
Category: ${event.category}
Short description (do not repeat verbatim): ${event.description}
${event.price ? `Price: ${event.price}` : ''}

Output THREE paragraphs, separated by blank lines, matching this structure:

Paragraph 1 — What it is. The format, who's behind it, why it exists. For concerts: who the artist is and their background. For exhibitions: the subject matter and curatorial angle. For markets/festivals: the scale, regularity, and character.

Paragraph 2 — What visitors experience. The vibe, length, language (if relevant), audience type. Character of the venue if notable (intimate / grand / outdoor / historic building).

Paragraph 3 — Practical notes. Ticketing situation (sold out fast? walk-in welcome?), how to get there (metro / tram / bus / walking distance from where), accessibility if you know it, family-friendliness if relevant. Keep it concrete — "Trindade metro, 5 min walk" is better than "easily reached by public transport".

STRICT RULES:
- Neutral, factual, observational voice. No press-release adjectives like "unmissable", "vibrant", "breathtaking", "stunning", "rich tapestry". No "you won't want to miss", "a must-see", "experience the magic".
- If you don't know a detail, OMIT it. A shorter paragraph is better than a fabricated one. It's fine if paragraph 3 is two short sentences.
- Do NOT repeat phrases from the short description above. Expand, don't rephrase.
- Use "Porto" (not "Oporto"). European Portuguese context.
- Output: plain prose only. No headings, no "Paragraph 1:" prefixes, no markdown, no bullet lists. Separate paragraphs with a blank line.
- Total length target: 180–280 words across all three paragraphs. Quality over length.`;

  const res = await fetch(geminiUrl('gemini-2.5-flash'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini long description failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  if (!text) throw new Error('Gemini returned empty long description');
  return text;
}

// ---------------------------------------------------------------------------
// Category-specific prompts for generated fallback images
// ---------------------------------------------------------------------------
const CATEGORY_PROMPT: Record<EventRecord['category'], string> = {
  music: 'intimate concert setting, warm amber stage lighting, audience silhouettes, atmospheric',
  art: 'gallery interior, soft museum lighting, contemporary artwork, minimal',
  food: 'Portuguese market scene, fresh produce on wooden counters, natural daylight',
  family: 'welcoming community gathering, daytime, relaxed atmosphere',
  nightlife: 'Porto nightscape, riverside lights, moody evening atmosphere',
  sports: 'dynamic sports moment, action frozen, dramatic light',
  other: 'atmospheric Porto scene, cultural event setting, editorial style',
};

async function generateFallbackImage(
  ev: EventRecord
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const { generateImage } = await import('./imagen');
    const modifier = CATEGORY_PROMPT[ev.category] ?? CATEGORY_PROMPT.other;
    const prompt =
      `Editorial press photograph evoking the event "${ev.name}" at ${ev.venue} in Porto, Portugal. ` +
      `${modifier}. No text overlays, no logos, no people's faces in close-up. ` +
      `Cinematic, warm colour palette matching a travel-magazine aesthetic.`;
    return await generateImage(prompt, '16:9');
  } catch (err) {
    console.error('[events-pipeline] Fallback image generation failed:', err);
    return null;
  }
}

export type ImageAcquireResult =
  | { status: 'imaged'; image: EventImage; resolvedUrl: string }
  | { status: 'generated'; image: EventImage }
  | { status: 'already' }
  | { status: 'no-url' | 'no-og' | 'no-download' | 'no-upload' | 'no-generation' };

/**
 * For a single event, try to find + re-host a press photo. If no press photo
 * is available, generates one via Gemini 3 Pro Image so every event ends up
 * with SOMETHING visual rather than a category placeholder.
 *
 * Pipeline order:
 *   1. Known-good externalLink / Gemini-found URL → scrape og:image, JSON-LD,
 *      link[rel=image_src], or first <img>. Reuse on Imgur with press credit.
 *   2. If all scraping fails: Gemini 3 Pro Image generates a category-
 *      appropriate editorial photo, uploaded to Imgur with an AI credit.
 *
 * Idempotent — returns 'already' if the event is already imaged (unless
 * `force` is true).
 */
export async function acquireEventImage(
  ev: EventRecord,
  opts: { force?: boolean; allowGenerated?: boolean } = {}
): Promise<ImageAcquireResult> {
  const allowGenerated = opts.allowGenerated ?? true;
  if (ev.image && !opts.force) return { status: 'already' };

  // 1. Try to scrape a press photo from a real event/venue page.
  let sourceUrl: string | null = null;
  if (isRealEventUrl(ev.externalLink)) {
    sourceUrl = ev.externalLink;
  } else {
    sourceUrl = await findEventUrlViaGemini(ev);
  }

  if (sourceUrl) {
    const html = await fetchPage(sourceUrl);
    if (html) {
      const ogImage = extractOgImage(html, sourceUrl);
      if (ogImage) {
        const base64 = await downloadImageBase64(ogImage);
        if (base64) {
          const imgurUrl = await uploadToImgur(base64);
          if (imgurUrl) {
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
        }
      }
    }
  }

  // 2. No press photo — generate one via Gemini 3 Pro Image.
  if (!allowGenerated) {
    return { status: sourceUrl ? 'no-og' : 'no-url' };
  }
  const generated = await generateFallbackImage(ev);
  if (!generated) return { status: 'no-generation' };
  const imgurUrl = await uploadToImgur(generated.base64);
  if (!imgurUrl) return { status: 'no-upload' };

  return {
    status: 'generated',
    image: {
      url: imgurUrl,
      credit: 'AI illustration · Oporto Weekly',
      // No sourceUrl — generated, not scraped.
    },
  };
}
