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

const SEARCH_QUERIES = [
  'Porto events this week',
  'Porto concerts this week',
  'Porto art exhibitions this week',
  'Porto food markets weekend',
  'Porto family events this week',
  'Porto nightlife this week',
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

  const prompt = `Editorial travel magazine cover photograph of Porto, Portugal, for the week of ${weekRange}.
Scene: ${location}.
Style: warm cinematic tones, soft natural light, rich detail, Nat Geo Travel / Condé Nast Traveler aesthetic.
Professional photography, shallow depth of field, no text or watermarks, no people's faces identifiable.
Wide 16:9 composition suitable as a magazine cover image.`;

  console.log(`[cron/newsletter] Generating hero image: ${location.slice(0, 60)}...`);
  const { base64 } = await generateImage(prompt, '16:9');
  const url = await uploadImageToImgur(base64);
  console.log(`[cron/newsletter] Hero image uploaded: ${url}`);
  return url;
}

async function generateNewsletter(researchData: string, heroImageUrl: string, weekRange: string): Promise<string> {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

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

1. HERO (full-width image with overlay)
   - <img src="${HERO_PLACEHOLDER}" alt="Porto ${weekRange}" width="640" height="420" style="width:100%;height:420px;object-fit:cover;display:block;" />
   - Below it (or overlaid via table position), a dark-to-transparent gradient band with:
     - Gold eyebrow: "YOUR WEEKLY PORTO GUIDE" (11px, letter-spacing 4px, uppercase, color #c9a96e)
     - Georgia serif h1 title (write a 2-4 word creative title riffing on the week's events/theme, NOT just "Oporto Weekly", ~40px white)
     - Week date line in gold #c9a96e (MUST be this color for readability on both dark and light themes): "${weekRange}" (14px, letter-spacing 1px, color:#c9a96e)

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
    // 0. Determine week range for everything downstream.
    //    Publish day is Thursday; the range covers Thursday + 6 days.
    //    e.g. "April 16-22, 2026" → slug "april-16-22-2026"
    const now = new Date();
    const weekRange = formatWeekRange(now);
    const slug = generateSlug(weekRange);

    // 1. Run Gemini searches (sequential). Individual failures are tolerated —
    //    if one query fails the cron continues with whatever succeeded.
    const searchResults: string[] = [];
    const searchFailures: string[] = [];
    for (const query of SEARCH_QUERIES) {
      try {
        const result = await geminiSearch(query);
        searchResults.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron/newsletter] Search failed for "${query}": ${msg}`);
        searchFailures.push(query);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (searchResults.length === 0) {
      throw new Error('All 6 Gemini searches failed — aborting.');
    }
    if (searchFailures.length > 0) {
      console.warn(`[cron/newsletter] Continuing with ${searchResults.length}/${SEARCH_QUERIES.length} successful searches. Failed: ${searchFailures.join(', ')}`);
    }
    const researchData = searchResults.join('\n\n');

    // 2. Generate hero image in parallel with... actually do it first so the prompt has the URL
    const heroImageUrl = await generateHeroImage(weekRange);

    // 3. Generate newsletter HTML (embedded hero URL)
    const html = await generateNewsletter(researchData, heroImageUrl, weekRange);

    // 4. Subject line
    const weekDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const subject = `Oporto Weekly — ${weekDate}`;

    // 5. Send EN edition to EN subscribers. Tag each send so the Resend
    //    dashboard can slice open/click rates by edition, language, and type.
    const enSubscribers = await getActiveSubscribers('en');
    const enEmails = enSubscribers.map(s => s.email);
    const sentEN = await sendBatch(enEmails, subject, html, [
      { name: 'type', value: 'newsletter' },
      { name: 'lang', value: 'en' },
      { name: 'edition', value: slug },
    ]);
    console.log(`[cron/newsletter] Sent EN to ${sentEN} subscribers`);

    // 6. Archive EN edition via GitHub API (commits to repo → triggers Vercel redeploy)
    try {
      await archiveViaGitHub({
        slug,
        title: `Oporto Weekly — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        description: subject,
        sentAt: now.toISOString(),
        weekRange,
      }, html, 'newsletters.json');
      console.log(`[cron/newsletter] Archived EN as ${slug}`);

      notifySearchEngines(slug).catch(e =>
        console.error('[cron/newsletter] Search engine notification failed:', e)
      );
    } catch (archiveErr) {
      console.error('[cron/newsletter] EN archive failed:', archiveErr);
    }

    return NextResponse.json({
      success: true,
      slug,
      heroImageUrl,
      sent: { en: sentEN },
    });
  } catch (err: unknown) {
    console.error('[cron/newsletter]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
