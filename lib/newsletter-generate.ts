/**
 * Thursday edition generation, shared by app/api/cron/newsletter/route.ts and
 * scripts/compose-edition-dry-run.ts (route files may only export handlers).
 * Moved out of the route unchanged on 2026-10-25, plus the `compose` option:
 * the edition is written from the verified events in data/events (see
 * lib/edition-compose.ts) instead of raw search results.
 */

import { generateImage } from './imagen';
import { uploadImageToImgur } from './imgur';
import { composeRules, composeDecision, selectEditionEvents, type EditionSelection, type PresetPick } from './edition-compose';
import type { EventRecord } from './events';
import { HUMANIZER_RULES, humanizeHtml } from './humanizer';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function geminiPost(url: string, body: object, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Fall back from Pro to Flash on rate-limit or overload
  if ((res.status === 429 || res.status === 503) && url === GEMINI_URL) {
    console.log(`[geminiPost] ${res.status} on gemini-2.5-pro, falling back to gemini-2.5-flash`);
    return geminiPost(GEMINI_URL_FALLBACK, body, attempt);
  }

  // If flash is also overloaded, retry once after a short wait
  if (res.status === 503 && url === GEMINI_URL_FALLBACK && attempt < 2) {
    const wait = 3000 * (attempt + 1);
    console.log(`[geminiPost] 503 on gemini-2.5-flash, retrying in ${wait}ms (attempt ${attempt + 1}/2)`);
    await new Promise(r => setTimeout(r, wait));
    return geminiPost(url, body, attempt + 1);
  }

  console.log(`[geminiPost] Used model: ${url.includes('2.5-pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash'} (status ${res.status})`);
  return res;
}

// Source-aware queries. 2026-04-30 retrospective: we missed the Monumental
// Serenata that opened Queima das Fitas — a tentpole U.Porto event that
// doesn't surface from generic "Porto events" queries because the canonical
// information lives on federacaoacademicaporto.pt + queimadasfitasporto.com,
// not on ticketing aggregators. Adding site:-targeted queries pulls those
// authoritative sources into the search results, plus broader local-press
// queries to catch civic + traditional events the aggregators miss.
export const SEARCH_QUERIES = [
  'Porto events this week',
  'Porto concerts this week',
  'Porto art exhibitions this week',
  'Porto food markets weekend',
  'Porto family events this week',
  'Porto nightlife this week',
  // Authoritative civic + tourism sources
  'site:visitporto.travel events Porto this week',
  'site:cm-porto.pt agenda eventos Porto esta semana',
  'site:portoalive.pt eventos Porto esta semana',
  // Curated cultural agenda — Porto-specific concerts, theatre, exhibitions,
  // and traditional events. Visitor flagged this as an important source.
  'site:agenda-porto.pt eventos Porto esta semana',
  // Local press — catches traditional / festival / civic events
  'site:jn.pt OR site:publico.pt Porto agenda fim de semana',
  'site:timeout.pt Porto this week',
  // Porto Expats' Friday "Porto Weekly Guide" (Mon–Sun) overlaps our Thu–Wed
  // week; owner flagged it 2026-10-23 after it listed 7 Halloween-week events
  // we had none of. Leads only — the edition prompt and pick-date check still
  // need dates/venues from the research data, and we never copy their text.
  'site:portoexpats.substack.com Porto Weekly Guide events',
  // Porto Secreto (Fever's Secret Media guide): weekend + monthly "o que fazer"
  // round-ups. Owner flagged 2026-10-25. Leads only — never cite or link them;
  // find each event on the organiser/venue page. Skews toward Fever-ticketed shows.
  'site:portosecreto.co o que fazer no Porto este fim de semana',
  // University + traditional festivals (Queima das Fitas, São João, Festa de São Bartolomeu)
  'Queima das Fitas Porto 2026 schedule serenata',
  'site:federacaoacademicaporto.pt OR site:queimadasfitasporto.com Porto',
  'Porto traditional festival this week santo populares',
];

async function geminiSearch(query: string): Promise<string> {
  const res = await geminiPost(GEMINI_URL, {
    contents: [{ parts: [{ text: query }] }],
    tools: [{ google_search: {} }],
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

// Rotate through iconic Porto locations so each week's hero feels fresh.
const HERO_LOCATIONS = [
  'Ribeira riverfront at golden sunset, colourful azulejo-tiled buildings along the Douro',
  'Dom Luís I Bridge arching over the Douro at blue hour, reflections in the water',
  'Livraria Lello interior with ornate red spiral staircase and stained glass ceiling',
  'Vila Nova de Gaia rabelo boats on the Douro with Porto skyline behind at dusk',
  'Clérigos Tower rising over terracotta rooftops in morning mist',
  'Foz do Douro ocean waves against tiled lighthouse walls at sunset',
  'Palácio da Bolsa grand hall with Moorish details and warm golden light',
  'São Bento station hall with blue azulejo murals glowing in afternoon sun',
  'Rua Santa Catarina at dusk, café terraces and warm shop lights',
  'Porto historic centre rooftops with red tiles stretching to the Douro',
];

// Known-good static hero used when live generation fails or is too slow.
// A failed hero must NEVER abort the edition or eat the 300s budget on
// retries — better a generic-but-real Porto photo than no newsletter.
export const FALLBACK_HERO_URL = 'https://i.imgur.com/TPAvrte.jpeg';

export async function generateHeroImage(weekRange: string): Promise<string> {
  // Pick a location based on the week of the year — deterministic per week
  const weekOfYear = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % HERO_LOCATIONS.length;
  const location = HERO_LOCATIONS[weekOfYear];

  // IMPORTANT: the prompt must NOT frame this as a "magazine cover" or
  // reference real magazine brands. Gemini 3 Pro Image has a strong bias
  // toward adding title/masthead text when it sees "cover" + a brand name,
  // and has produced outputs with fake mastheads like "PORTO TRAVELER"
  // despite "no text or watermarks" being in the prompt. Frame it as a
  // single-scene editorial photograph instead, and triple-emphasize text-free.
  const prompt = `A clean editorial photograph of Porto, Portugal — a single documentary-style scene.
Scene: ${location}.
Style: warm cinematic tones, soft natural light, rich textural detail, shallow depth of field, atmospheric travel-photography look. 16:9 wide composition.
CRITICAL RULES — the generated image must be ENTIRELY TEXT-FREE:
- NO title, NO headline, NO masthead, NO brand name of any kind.
- NO watermarks, NO logos, NO captions, NO date stamps.
- NO overlay text of any kind, anywhere in the frame.
- NO magazine-cover styling. This is a photograph only, not a cover layout.
- NO people's faces in close-up identifiable detail.
- NO graphic elements, borders, or decorative frames.
Output: a pure photograph. Just the scene.`;

  console.log(`[cron/newsletter] Generating hero image: ${location.slice(0, 60)}...`);
  try {
    const { base64 } = await generateImage(prompt, '16:9');
    const url = await uploadImageToImgur(base64);
    console.log(`[cron/newsletter] Hero image uploaded: ${url}`);
    return url;
  } catch (err) {
    // Non-fatal: hero generation/upload failed (timeout, Gemini overload,
    // Imgur hiccup). Use the static fallback so the edition still ships on
    // time rather than burning the budget and aborting.
    console.error('[cron/newsletter] Hero image failed, using fallback:', err instanceof Error ? err.message : err);
    return FALLBACK_HERO_URL;
  }
}

/**
 * Returns the names of events that were Editor's Picks in any of the last
 * `lookbackEditions` editions. Used to tell Gemini "don't reuse these" so
 * we don't end up with the same evergreen exhibition (Monet, Klimt, Bolhão
 * market) showing up week after week.
 *
 * Reads from the deployed bundle's data/events/*.json. On Vercel that's the
 * snapshot from the last successful build, which is fine — picks for the
 * current week haven't been written yet at this point in the pipeline.
 */
export async function recentPickNames(lookbackEditions = 4): Promise<string[]> {
  try {
    const { listEvents } = await import('./events');
    const all = listEvents();
    // Group picks by edition, sort editions desc by any pick's addedAt.
    const editionsWithPicks = new Map<string, { addedAt: string; names: string[] }>();
    for (const e of all) {
      if (typeof e.editorPickRank !== 'number') continue;
      const cur = editionsWithPicks.get(e.sourceEdition);
      if (cur) {
        cur.names.push(e.name);
        if (e.addedAt > cur.addedAt) cur.addedAt = e.addedAt;
      } else {
        editionsWithPicks.set(e.sourceEdition, { addedAt: e.addedAt, names: [e.name] });
      }
    }
    const recent = Array.from(editionsWithPicks.entries())
      .sort((a, b) => b[1].addedAt.localeCompare(a[1].addedAt))
      .slice(0, lookbackEditions)
      .flatMap(([, v]) => v.names);
    return Array.from(new Set(recent));
  } catch (err) {
    console.warn('[cron/newsletter] recentPickNames failed (non-fatal):', err);
    return [];
  }
}

export async function generateNewsletter(
  researchData: string,
  heroImageUrl: string,
  weekRange: string,
  corrections: string[] = [],
  opts: { compose?: boolean; picks?: PresetPick[] } = {},
): Promise<string> {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Pull recent picks so Gemini knows what NOT to repick. Without this the
  // same evergreen exhibitions keep winning Editor's Picks slots — Monet was
  // a pick two weeks running before we caught it.
  const excluded = await recentPickNames(4);
  const exclusionBlock = excluded.length > 0
    ? `\n\nDO NOT include these as Editor's Picks — they were picks in the last 4 editions. Any of them can still be MENTIONED in a category section if relevant, but they MUST NOT take a Pick #1–5 slot:\n${excluded.map(n => `  - ${n}`).join('\n')}`
    : '';

  // Set only on a regeneration after verifyPickDates caught a wrong date.
  const correctionBlock = corrections.length > 0
    ? `\n\nFACT-CHECK CORRECTIONS — a previous draft got these wrong. These events do NOT happen during ${weekRange}. Do NOT include them anywhere in this edition (not as a pick, not in a category, not in the tip):\n${corrections.map(c => `  - ${c}`).join('\n')}`
    : '';

  // Use a placeholder so Gemini doesn't hallucinate/truncate the real URL.
  // We substitute after generation.
  const HERO_PLACEHOLDER = '__HERO_IMAGE_URL_PLACEHOLDER__';

  const prompt = `You are the editor of "Oporto Weekly", a curated travel-magazine newsletter about events in Porto, Portugal.

Today is ${today}. Based on the ${opts.compose ? 'verified events' : 'research'} below, generate a COMPLETE HTML email newsletter in the LIGHT TRAVEL-MAGAZINE style described below.

RESEARCH DATA:
${researchData}

HERO IMAGE URL: Use the EXACT literal string ${HERO_PLACEHOLDER} as the src attribute in the hero <img> tag. Do not substitute anything — copy the placeholder verbatim including the underscores. We will replace it after generation.

WEEK RANGE: ${weekRange}

OUTPUT FORMAT:
Full HTML document, inline styles only, table-based layout for email client compatibility.
Max width: 640px, centered on page.
Font stack: "'Inter', Arial, sans-serif" for body; "Georgia, 'Playfair Display', serif" for headings.
Start with <!DOCTYPE html><html lang="en">. End with </html>.

PALETTE (use these exact colors):
- Page bg outside wrapper: #efe8da
- Newsletter wrapper bg: #faf7f0 (warm cream)
- Alt section bg: #fffdf7
- Card/white bg: #ffffff
- Heading color: #1a1a2e (dark navy)
- Body text: #3a3a3a
- Secondary text: #6b6b6b
- Gold accent: #c9a96e
- Soft divider: #e5dfd3
- Tip-of-week callout bg: #f4ede0 with 4px left border in #c9a96e

STRUCTURE (in this exact order):

1. HERO (image stacked above a dark text band — NEVER use position: absolute)
   CRITICAL EMAIL-SAFETY RULE: do NOT use \`position: absolute\` or any
   overlay technique to put text on top of the image. Email clients
   (Gmail, Outlook, Apple Mail) strip absolute positioning, which makes
   the title spill into the page flow and the gradient render as a giant
   gray block above the image. Instead, use the email-bulletproof
   STACKED pattern: image on top, dark navy <td> with the title BELOW it.

   EXACT MARKUP (use this structure verbatim, do not invent your own):

   <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
     <tr>
       <td style="padding:0;">
         <img src="${HERO_PLACEHOLDER}" alt="Porto ${weekRange}" width="640" height="420" style="width:100%;height:420px;object-fit:cover;display:block;border:0;" />
       </td>
     </tr>
     <tr>
       <td bgcolor="#1a1a2e" style="background:#1a1a2e;text-align:center;padding:28px 28px 24px;">
         <p style="font-family:'Inter', Arial, sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c9a96e;margin:0 0 8px 0;">YOUR WEEKLY PORTO GUIDE</p>
         <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:40px;color:#ffffff;margin:0 0 10px 0;font-weight:700;line-height:1.2;">[2-4 word creative title riffing on this week's theme — NOT just "Oporto Weekly"]</h1>
         <p style="font-family:'Inter', Arial, sans-serif;font-size:14px;letter-spacing:1px;color:#c9a96e;margin:0;">${weekRange}</p>
       </td>
     </tr>
   </table>

   The dark navy band's white title + gold subtitle stays readable in
   every email client AND on the website's light page. No fragility.

2. EDITOR'S NOTE (~40px top padding, italic serif)
   - Small gold eyebrow "FROM THE EDITOR" (10px uppercase, letter-spacing 3px, gold)
   - 2-3 sentence editor's note, italic Georgia serif 18px, charcoal text, framing the week's highlights

3. EDITOR'S PICKS — top 5 must-see events
   - Section heading: small ✦ icon + Georgia serif "Editor's Picks" (28px) + right-aligned "THE TOP FIVE" eyebrow
   - Each pick is a row with:
     - Gold-outlined circle (48x48px, border 2px solid #c9a96e) with Georgia serif number 1-5 in gold
     - Right column: event name (Georgia serif 19px, dark navy), meta line (Date · Venue · Price with gold dots), 2-sentence description, and "MORE INFO" uppercase link (dark navy text with 1.5px gold underline, letter-spacing 1px)
   - Picks separated by 1px #e5dfd3 borders

4. FIVE SECTIONS in this order, alternating backgrounds (first #fffdf7, then #faf7f0, etc.):
   🎵 Music & Concerts
   🎨 Art & Exhibitions
   🍷 Food & Wine
   👨‍👩‍👧 Family
   🌙 Nightlife

   For each section:
   - Section heading: emoji icon (22px) + Georgia serif title (28px) + right eyebrow "N EVENTS" / "N OPENINGS" / "N TABLES" / "N PICKS"
   - 2-4 events as cards with:
     - Left: date stamp (Georgia serif day number 28px dark navy + 3-letter day abbrev 10px uppercase gold)
     - Right: event name (Georgia serif 17px), meta (Time · Venue · Price), 1-2 sentence description, "More info →" link in gold

5. TIP OF THE WEEK callout
   - Background #f4ede0, left border 4px solid #c9a96e, 32px padding
   - Gold eyebrow "TIP OF THE WEEK"
   - Serif title (22px dark navy)
   - 1 paragraph of practical insider advice (14px, line-height 1.7)

6. FOOTER — must contain EXACTLY this HTML verbatim (do not alter URLs):
   <div style="background:#efe8da;padding:36px 28px;text-align:center;border-top:1px solid #e5dfd3;">
     <div style="font-family:Georgia,serif;font-size:20px;color:#1a1a2e;">Oporto Weekly</div>
     <div style="width:40px;height:2px;background:#c9a96e;margin:12px auto 16px;"></div>
     <p style="font-size:13px;color:#5a5a5a;margin:0 0 10px;">Curated every Thursday · Porto, Portugal</p>
     <p style="font-size:12px;color:#5a5a5a;">
       <a href="https://oportoweekly.com/api/unsubscribe?email=SUBSCRIBER_EMAIL" style="color:#1a1a2e;border-bottom:1px solid #c9a96e;text-decoration:none;">Unsubscribe</a>
       &nbsp;·&nbsp;
       <a href="https://oportoweekly.com" style="color:#1a1a2e;border-bottom:1px solid #c9a96e;text-decoration:none;">Visit website</a>
     </p>
     <p style="font-size:11px;color:#8a8170;margin:16px 0 0;">Some ticket links are affiliate links; we may earn a small commission at no extra cost to you.</p>
     <p style="font-size:11px;color:#8a8170;margin-top:16px;">&copy; Oporto Weekly · Made with ♡ in Porto</p>
   </div>

CONTENT RULES:
- Prefer events with concrete details (dates, venues, prices) from the research data.
- Use real URLs from research for "More info" links; fall back to Google search URLs if none found.
- Prices: translate to euros (€). Use "Free" when appropriate.
- Translate day abbreviations to English 3-letter: Mon, Tue, Wed, Thu, Fri, Sat, Sun.
- Descriptions: punchy, warm, editorial — like a travel magazine, not a listing.
- All <img> tags must have descriptive alt text.
- Use tables for layout (email client compatibility), not flexbox.

EDITOR'S PICKS QUALITY BAR (this is what readers come for — be selective):
- Each Pick #1–5 must be SPECIFIC and TIME-SENSITIVE: a concert on a date, a
  festival opening, a one-off premiere, a traditional event tied to this
  particular weekend. Single-day or single-week shows are ideal.
- DO NOT pick evergreen exhibitions, weekly markets, or year-round museum
  visits as Editor's Picks. They can be MENTIONED in the relevant category
  section ("Art" or "Food"), but they should not take a Pick slot — Pick
  slots are for "this week is special because of X".
- If the research surfaces a tentpole student / civic / religious event
  this week (Queima das Fitas, São João, Festa de São Bartolomeu, FITUR,
  Fantasporto, etc.), it gets a Pick slot. These are unmissable cultural
  moments and the whole reason readers subscribe.
- DATES MUST COME FROM THE RESEARCH. Only pick an event if the research data
  explicitly states its date and that date falls within ${weekRange}. Never
  infer or guess a date — especially for annual events (races, festivals)
  whose coverage may refer to a different week. If unsure, leave it out.
  The same applies to the Tip of the Week.${exclusionBlock}${correctionBlock}
${opts.compose ? composeRules(weekRange, opts.picks) : ''}

${HUMANIZER_RULES}

CRITICAL OUTPUT:
Return ONLY the complete HTML. No markdown fences, no commentary, no code blocks.`;

  const res = await geminiPost(GEMINI_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 65536 },
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
  // Humanizer post-pass (owner 2026-10-31): em dashes and curly quotes out of the visible text.
  html = humanizeHtml(html);

  // Replace hero image placeholder with the real URL.
  // LLMs often truncate/hallucinate long URLs, so we never let them write the real one.
  const placeholderCount = (html.match(new RegExp(HERO_PLACEHOLDER, 'g')) ?? []).length;
  if (placeholderCount === 0) {
    console.warn(`[cron/newsletter] Hero placeholder missing from generated HTML — Gemini dropped it. Injecting before <table>.`);
    // Fallback: inject the hero image at the top if Gemini dropped the placeholder
    html = html.replace(/<body[^>]*>/i, (match) =>
      `${match}<img src="${heroImageUrl}" alt="Porto this week" style="width:100%;max-width:640px;height:auto;display:block;margin:0 auto;" />`
    );
  } else {
    html = html.split(HERO_PLACEHOLDER).join(heroImageUrl);
    console.log(`[cron/newsletter] Replaced ${placeholderCount} hero URL placeholder(s)`);
  }

  return html;
}

/**
 * Run all SEARCH_QUERIES in batches of 4 (parallel within batch, sequential
 * batches to stay polite to Gemini quotas). Individual failures are tolerated;
 * throws only if EVERY query fails. Returns the concatenated research text.
 */
export async function runResearch(): Promise<string> {
  const searchResults: string[] = [];
  const searchFailures: string[] = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < SEARCH_QUERIES.length; i += BATCH_SIZE) {
    const batch = SEARCH_QUERIES.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(q => geminiSearch(q)));
    settled.forEach((s, idx) => {
      if (s.status === 'fulfilled') {
        searchResults.push(s.value);
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        console.error(`[cron/newsletter] Search failed for "${batch[idx]}": ${msg}`);
        searchFailures.push(batch[idx]);
      }
    });
    if (i + BATCH_SIZE < SEARCH_QUERIES.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  if (searchResults.length === 0) {
    throw new Error(`All ${SEARCH_QUERIES.length} Gemini searches failed — aborting.`);
  }
  if (searchFailures.length > 0) {
    console.warn(`[cron/newsletter] Continuing with ${searchResults.length}/${SEARCH_QUERIES.length} successful searches. Failed: ${searchFailures.join(', ')}`);
  }
  return searchResults.join('\n\n');
}


// ---------------------------------------------------------------------------
// Path choice: compose from data/events, or the legacy research path
// ---------------------------------------------------------------------------

export type EditionPath = 'compose' | 'legacy';

export interface EditionPlan {
  path: EditionPath;
  reason: string;
  selection: EditionSelection | null;
  corpus: EventRecord[] | null;
}

/**
 * Decide how this edition is made. `mode` is the route's ?mode= override
 * ('legacy' forces research; 'compose' composes even below the thresholds as
 * long as the window has five pick-eligible events). NEWSLETTER_COMPOSE=off
 * turns composition off entirely; NEWSLETTER_COMPOSE_MIN_TOTAL /
 * NEWSLETTER_COMPOSE_MIN_SHORT tune the fallback thresholds. Any error while
 * loading events falls back to legacy — composition must never cost an edition.
 */
export async function planEdition(args: {
  weekStartISO: string;
  weekEndISO: string;
  blocked: string[];
  mode?: string | null;
  loadCorpus: () => Promise<{ events: EventRecord[]; source: string }>;
}): Promise<EditionPlan> {
  if (args.mode === 'legacy') return { path: 'legacy', reason: 'forced by ?mode=legacy', selection: null, corpus: null };
  if (process.env.NEWSLETTER_COMPOSE === 'off') return { path: 'legacy', reason: 'NEWSLETTER_COMPOSE=off', selection: null, corpus: null };
  try {
    const { events, source } = await args.loadCorpus();
    const recent = await recentPickNames(4);
    const selection = selectEditionEvents(events, args.weekStartISO, args.weekEndISO, { blocked: args.blocked, recentPicks: recent });
    const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    const decision = composeDecision(selection, {
      total: num(process.env.NEWSLETTER_COMPOSE_MIN_TOTAL),
      short: num(process.env.NEWSLETTER_COMPOSE_MIN_SHORT),
    });
    const forced = args.mode === 'compose' && selection.pickPool.length >= 5;
    const path: EditionPath = decision.compose || forced ? 'compose' : 'legacy';
    const reason = `${decision.reason}${forced && !decision.compose ? ' — composing anyway (?mode=compose)' : ''} [${events.length} events from ${source}]`;
    return { path, reason, selection, corpus: events };
  } catch (err) {
    return { path: 'legacy', reason: `compose setup failed: ${err instanceof Error ? err.message : err}`, selection: null, corpus: null };
  }
}
