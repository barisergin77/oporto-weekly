export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange } from '@/lib/archive';
import { archiveViaGitHub } from '@/lib/github';
import { getActiveSubscribers } from '@/lib/audiences';
import { sendBatch } from '@/lib/resend-client';
import { notifySearchEngines } from '@/lib/search-engines';
import { generateImage } from '@/lib/imagen';
import { uploadImageToImgur } from '@/lib/imgur';
import { checkCronAuth } from '@/lib/cron-auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object, attempt = 0): Promise<Response> {
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
const SEARCH_QUERIES = [
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

async function generateHeroImage(weekRange: string): Promise<string> {
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
  const { base64 } = await generateImage(prompt, '16:9');
  const url = await uploadImageToImgur(base64);
  console.log(`[cron/newsletter] Hero image uploaded: ${url}`);
  return url;
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
async function recentPickNames(lookbackEditions = 4): Promise<string[]> {
  try {
    const { listEvents } = await import('@/lib/events');
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

async function generateNewsletter(researchData: string, heroImageUrl: string, weekRange: string): Promise<string> {
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

  // Use a placeholder so Gemini doesn't hallucinate/truncate the real URL.
  // We substitute after generation.
  const HERO_PLACEHOLDER = '__HERO_IMAGE_URL_PLACEHOLDER__';

  const prompt = `You are the editor of "Oporto Weekly", a curated travel-magazine newsletter about events in Porto, Portugal.

Today is ${today}. Based on the research below, generate a COMPLETE HTML email newsletter in the LIGHT TRAVEL-MAGAZINE style described below.

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
  moments and the whole reason readers subscribe.${exclusionBlock}

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
    // slug as that Thursday's run. Critical for idempotency: a Friday
    // ?force=true run still yields Thursday's slug → guard hits → no
    // duplicate send.
    const weekStart = new Date(now);
    const daysSinceThursday = (dayOfWeek - 4 + 7) % 7; // Thu=0, Fri=1, ..., Wed=6
    weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceThursday);

    const weekRange = formatWeekRange(weekStart);
    const slug = generateSlug(weekRange);
    console.log(`[cron/newsletter] now=${now.toISOString()} dayOfWeek=${dayOfWeek} thursday=${weekStart.toISOString().slice(0,10)} slug=${slug}`);

    // 0.5. RUN-LEDGER GUARD — the calendar-fact source of truth.
    //
    // We check data/run-ledger.json for "is en-email done for this week?"
    // before doing anything. If yes, bail. Each substep also marks itself
    // complete in the ledger as it finishes, so a partial-run recovery
    // (e.g. archive succeeded but send failed) can re-enter and only
    // re-do the missing steps.
    //
    // Background: previous guards inferred "did we publish?" from file
    // existence + slug computation. The slug bug on 2026-05-01 broke
    // that inference. The ledger doesn't infer — it's the recorded fact
    // of which step finished when.
    const { isStepComplete, markStepComplete, getWeekEntry } = await import('@/lib/run-ledger');
    if (await isStepComplete(slug, 'en-email')) {
      const entry = await getWeekEntry(slug);
      console.log(`[cron/newsletter] en-email already complete for ${slug} — skipping`);
      return NextResponse.json({
        skipped: true,
        reason: 'en-email-already-complete',
        slug,
        weekRange,
        ledger: entry,
      });
    }

    // 1. Run Gemini searches in batches of 4 (sequential batches, parallel within).
    //    Individual failures are tolerated — one bad query doesn't abort the run.
    //    Batched (not full parallel) to stay polite to Gemini quotas: 14 simultaneous
    //    grounded-search calls would burst past the per-minute limits.
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
      // Brief pause between batches to spread out quota usage
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
    const researchData = searchResults.join('\n\n');
    await markStepComplete(slug, 'research');

    // 2. Generate hero image in parallel with... actually do it first so the prompt has the URL
    const heroImageUrl = await generateHeroImage(weekRange);

    // 3. Generate newsletter HTML (embedded hero URL)
    const rawHtml = await generateNewsletter(researchData, heroImageUrl, weekRange);

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
      const events = await extractEventsFromHtml(rawHtml, slug);
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
      const events = eventFiles.map((f) => JSON.parse(f.content) as { editorPickRank?: number; name: string });
      const ranks = events.filter((e) => typeof e.editorPickRank === 'number').map((e) => e.editorPickRank!);
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

    // 5. Subject line
    // Display dates derive from Thursday (weekStart), not now() — so a
    // forced Friday re-send still labels the edition with Thursday's date.
    const weekDate = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `Oporto Weekly — ${weekDate}`;

    // 6. Archive FIRST, then send. Order is deliberate: the idempotency
    //    guard at step 0.5 checks `public/newsletters/<slug>.html` on
    //    GitHub. If we sent first and archived after, two crons firing
    //    within a minute could both pass the guard and both send. By
    //    archiving first, the second run sees the archive and bails before
    //    touching Resend. Trade-off: if archive succeeds but send fails,
    //    the next run skips and a human must re-send manually — but that's
    //    a much better failure mode than silently double-sending.
    try {
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
      await markStepComplete(slug, 'en-web');

      notifySearchEngines(slug).catch(e =>
        console.error('[cron/newsletter] Search engine notification failed:', e)
      );
    } catch (archiveErr) {
      // Archive failure is fatal — without the marker, the next run would
      // re-send. Surface a 500 so we know something went wrong.
      console.error('[cron/newsletter] EN archive failed — aborting before send:', archiveErr);
      throw archiveErr;
    }

    // 7. Now send. The archive commit is locked in; the guard will block
    //    any further runs.
    const enSubscribers = await getActiveSubscribers('en');
    const enEmails = enSubscribers.map(s => s.email);
    const sentEN = await sendBatch(enEmails, subject, html, [
      { name: 'type', value: 'newsletter' },
      { name: 'lang', value: 'en' },
      { name: 'edition', value: slug },
    ]);
    console.log(`[cron/newsletter] Sent EN to ${sentEN} subscribers`);
    await markStepComplete(slug, 'en-email');

    return NextResponse.json({
      success: true,
      slug,
      heroImageUrl,
      extractedEvents: extractedCount,
      linkedAnchors: linkedCount,
      sent: { en: sentEN },
    });
  } catch (err: unknown) {
    console.error('[cron/newsletter]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
