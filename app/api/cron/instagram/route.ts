export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { listNewsletters, getNewsletterHtml } from '@/lib/archive';
import { generateImage } from '@/lib/imagen';
import { uploadImageToImgur } from '@/lib/imgur';
import { checkCronAuth } from '@/lib/cron-auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const BUFFER_API_KEY = process.env.BUFFER_API_KEY!;
const BUFFER_CHANNEL_ID = process.env.BUFFER_CHANNEL_ID!;

interface Pick {
  name: string;
  venue: string;
  price: string;
}

// --- Parse top 5 picks from the latest newsletter HTML ---
// Supports both the new travel-magazine format (Apr 2026+) and the older dark-navy format.
function parseTopPicks(html: string): Pick[] {
  const picks: Pick[] = [];

  // Pattern NEW (travel-magazine, Apr 2026+):
  //   <p Georgia,serif color:#1a1a2e>NAME</p> <p color:#6b6b6b>DATE · VENUE · PRICE</p>
  const patternNew = /<p[^>]*Georgia,serif[^>]*color:#1a1a2e[^>]*>([^<]+)<\/p>\s*<p[^>]*color:#6b6b6b[^>]*>([\s\S]*?)<\/p>/gi;

  // Pattern OLD-A: <h3 color:#c9a96e>name</h3>…<strong>Venue:</strong>…<strong>Price:</strong>
  const patternOldA = /<h3[^>]*color:\s*#c9a96e[^>]*>([^<]+)<\/h3>[\s\S]*?<strong[^>]*>\s*Venue:\s*<\/strong>\s*([^<]+)<br[^>]*>[\s\S]*?<strong[^>]*>\s*Price:\s*<\/strong>\s*([^<]+)<\/p>/gi;

  // Pattern OLD-B: generic h3 + Venue:/Price: strongs
  const patternOldB = /<h3[^>]*>([^<]{3,120})<\/h3>[\s\S]*?Venue:\s*<\/strong>\s*([^<]+)[\s\S]*?Price:\s*<\/strong>\s*([^<]+)/gi;

  const cleanText = (s: string) =>
    s.replace(/<[^>]+>/g, '')
     .replace(/&bull;/g, '•')
     .replace(/&nbsp;/g, ' ')
     .replace(/&amp;/g, '&')
     .replace(/\s+/g, ' ')
     .trim();

  // Try NEW pattern first
  let match: RegExpExecArray | null;
  while ((match = patternNew.exec(html)) !== null && picks.length < 5) {
    const name = cleanText(match[1]);
    // Meta line: "Date · Venue · Price" separated by bullets (possibly inside spans)
    const metaText = cleanText(match[2]);
    const parts = metaText.split(/\s*•\s*/).map(s => s.trim()).filter(Boolean);
    if (name && parts.length >= 2) {
      const date = parts[0] ?? '';
      const venue = parts[1] ?? '';
      const price = parts[2] ?? '';
      // We store venue + date in the venue slot so the IG image prompt has context
      if (!picks.some(p => p.name === name)) {
        picks.push({ name, venue: venue || date, price });
      }
    }
  }

  // Fall back to OLD patterns if NEW didn't match
  if (picks.length < 3) {
    for (const pattern of [patternOldA, patternOldB]) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(html)) !== null && picks.length < 5) {
        const name = cleanText(m[1]);
        const venue = cleanText(m[2]);
        const price = cleanText(m[3]);
        if (name && !picks.some(p => p.name === name)) {
          picks.push({ name, venue, price });
        }
      }
      if (picks.length >= 3) break;
    }
  }

  return picks;
}

// --- Map event type to a visual thumbnail description for the Instagram image ---
function getThumbnailDescription(name: string, venue: string): string {
  const n = name.toLowerCase();
  const v = venue.toLowerCase();
  if (n.includes('trap') || n.includes('rap') || n.includes('hip hop')) return 'packed festival crowd with stage lights and smoke';
  if (n.includes('concert') || n.includes('arena') || v.includes('arena') || v.includes('coliseu')) return 'sold-out concert hall with dramatic stage lighting and crowd';
  if (n.includes('techno') || n.includes('electronic') || n.includes('dj') || v.includes('gare') || v.includes('club')) return 'dark club interior with colorful DJ booth lights and dancing crowd';
  if (n.includes('film') || n.includes('cinema')) return 'vintage cinema marquee with golden lights';
  if (n.includes('candlelight') || n.includes('classical') || n.includes('orchestra')) return 'intimate candlelit concert hall with warm amber glow and musicians';
  if (n.includes('cross') || n.includes('procession') || n.includes('easter')) return 'atmospheric night procession with candles through old stone streets';
  if (n.includes('football') || n.includes('fc porto') || n.includes('futebol')) return 'football stadium at night with floodlights and roaring crowd';
  if (n.includes('jazz')) return 'intimate jazz bar with warm lighting and musicians on stage';
  if (n.includes('fado')) return 'fado singer in traditional setting with warm amber lighting';
  if (n.includes('market') || n.includes('mercado')) return 'colourful outdoor market with fresh produce and vendors';
  if (n.includes('art') || n.includes('exhibition') || n.includes('gallery') || n.includes('museu')) return 'modern art gallery with dramatic spotlit artwork';
  if (n.includes('wine') || n.includes('vinho') || n.includes('food') || n.includes('gastro')) return 'elegant wine tasting with Porto cityscape at golden hour';
  if (n.includes('family') || n.includes('kids') || n.includes('children')) return 'joyful outdoor family event in sunny Porto square';
  if (n.includes('festival')) return 'outdoor music festival crowd in Porto with stage and colourful lights';
  return 'vibrant Porto street scene at night with warm golden lights';
}

// --- Build the Imagen prompt for the Instagram post image ---
function buildImagePrompt(picks: Pick[], weekRange: string): string {
  const picksBlock = picks.slice(0, 5).map((p, i) => {
    const thumb = getThumbnailDescription(p.name, p.venue);
    const label = p.price && !/check/i.test(p.price) ? ` (${p.price})` : '';
    return `${i + 1}. ${p.name} — ${p.venue}${label}\n   thumbnail: ${thumb}`;
  }).join('\n');

  return `Design a polished Instagram post (square 1:1) for "Oporto Weekly" — a weekly Porto events newsletter.

STYLE (match exactly):
- Background: deep dark navy #1a1a2e
- Header: large bold white serif font "OPORTO WEEKLY" at top center
- Gold (#c9a96e) ornamental divider line below the header
- Week label in gold: "WEEK ${weekRange.toUpperCase()}"
- Section title: "TOP PICKS THIS WEEK" in white with gold flourishes
- 5 event listings in rows, each with:
  - Gold line-art icon on the left (music note, film reel, candle, football, etc.)
  - Event name in bold white uppercase
  - Venue in gold italic
  - On the RIGHT side of each row: a small realistic photo thumbnail matching the event — actual photographic imagery, NOT placeholder boxes, NOT text, NOT borders with "placeholder" written — real-looking editorial photography
- Beige vintage/textured border around the whole image
- Footer: "OPORTO WEEKLY" logo bottom left, @oportoweekly bottom right
- Overall: elegant, editorial, upscale magazine feel

EVENTS TO LIST (with thumbnail visual guide):
${picksBlock}

CRITICAL: Each thumbnail on the right MUST be a real-looking atmospheric photo. No placeholder boxes. No empty rectangles. No "IMAGE" text. Actual photographic-style imagery.`;
}

// --- Generate EN + PT caption via Gemini with fallback chain ---
async function generateCaption(picks: Pick[], weekRange: string): Promise<string> {
  const picksForCaption = picks.map((p, i) => `${i + 1}. ${p.name} @ ${p.venue}`).join('\n');
  const prompt = `Write a short Instagram caption for Oporto Weekly's weekly post.

Week: ${weekRange}
Top picks this week:
${picksForCaption}

Rules:
- 2-3 sentences max, punchy and warm
- Include 1-2 relevant emojis
- End with: 🔗 Link in bio for full guide
- Then add a PT translation (label it "🇵🇹 PT:")
- Then a hashtag block (15-20 tags, mix of #porto #events #oporto #portugal etc.)
- Keep it natural, not corporate

Output format:
[EN caption]

🇵🇹 PT:
[PT caption]

[hashtag block]`;

  // Fallback chain: Pro for best writing quality, drop to flash variants only if rate-limited.
  const MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const errors: string[] = [];

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        cache: 'no-store',
      }
    );

    if (res.status === 429) {
      const msg = `${model} rate-limited (429)`;
      console.warn(`[cron/instagram] ${msg} — trying next model`);
      errors.push(msg);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini caption (${model}) failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (text.trim()) {
      console.log(`[cron/instagram] Caption generated via ${model}`);
      return text;
    }
    errors.push(`${model} returned empty`);
  }

  throw new Error(`Gemini caption generation failed (all models): ${errors.join(', ')}`);
}

// --- Schedule the post via Buffer GraphQL API ---
async function scheduleBufferPost(imageUrl: string, caption: string): Promise<{ id: string; status: string; dueAt?: string }> {
  const payload = {
    query: `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id status dueAt } }
        ... on NotFoundError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on RestProxyError { message code }
        ... on LimitReachedError { message }
        ... on InvalidInputError { message }
      }
    }`,
    variables: {
      input: {
        channelId: BUFFER_CHANNEL_ID,
        schedulingType: 'automatic',
        mode: 'addToQueue',
        metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
        text: caption,
        assets: { images: [{ url: imageUrl }] },
      },
    },
  };

  const res = await fetch('https://api.buffer.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BUFFER_API_KEY}`,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = data?.data?.createPost;

  if (result?.post?.id) {
    return { id: result.post.id, status: result.post.status, dueAt: result.post.dueAt };
  }
  const errMsg = result?.message || JSON.stringify(data?.errors || data).slice(0, 400);
  throw new Error(`Buffer scheduling failed: ${errMsg}`);
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    // 1. Load the latest newsletter edition
    const newsletters = listNewsletters();
    const latest = newsletters[0];
    if (!latest) {
      return NextResponse.json({ error: 'No newsletters found' }, { status: 404 });
    }
    const html = getNewsletterHtml(latest.slug);
    if (!html) {
      return NextResponse.json({ error: `Newsletter HTML not found for ${latest.slug}` }, { status: 404 });
    }
    console.log(`[cron/instagram] Using edition: ${latest.slug}`);

    // 2. Parse top 5 picks from the HTML
    const picks = parseTopPicks(html);
    if (picks.length === 0) {
      throw new Error('Could not parse any events from newsletter HTML');
    }
    console.log(`[cron/instagram] Parsed ${picks.length} picks:`, picks.map(p => p.name).join(' | '));

    // 3. Generate Instagram image via Gemini 3 Pro Image
    const imagePrompt = buildImagePrompt(picks, latest.weekRange);
    console.log('[cron/instagram] Generating Instagram image...');
    const { base64 } = await generateImage(imagePrompt, '1:1');
    console.log(`[cron/instagram] Image generated (${base64.length} b64 chars)`);

    // 4. Upload to Imgur for a public URL
    console.log('[cron/instagram] Uploading image to Imgur...');
    const imgurUrl = await uploadImageToImgur(base64);
    console.log(`[cron/instagram] Imgur URL: ${imgurUrl}`);

    // 5. Generate bilingual caption
    console.log('[cron/instagram] Generating caption...');
    const caption = await generateCaption(picks, latest.weekRange);

    // 6. Schedule via Buffer
    console.log('[cron/instagram] Scheduling post via Buffer...');
    const bufferResult = await scheduleBufferPost(imgurUrl, caption);
    console.log(`[cron/instagram] Scheduled: ${bufferResult.id} (${bufferResult.status}, due ${bufferResult.dueAt})`);

    return NextResponse.json({
      success: true,
      edition: latest.slug,
      picks: picks.length,
      imgurUrl,
      buffer: bufferResult,
    });
  } catch (err: unknown) {
    console.error('[cron/instagram]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
