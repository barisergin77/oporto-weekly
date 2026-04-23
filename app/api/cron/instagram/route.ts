export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { listNewsletters } from '@/lib/archive';
import { listEvents, type EventRecord } from '@/lib/events';
import { generateImage } from '@/lib/imagen';
import { uploadImageToImgur } from '@/lib/imgur';
import { scheduleBufferPost } from '@/lib/buffer';
import { checkCronAuth } from '@/lib/cron-auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

interface Pick {
  name: string;
  venue: string;
  price: string;
}

// --- Top 5 picks for an edition ---
// Selection priority:
//   1. Events flagged isEditorPick=true during extraction (the newsletter's
//      curated "Top Five" section — the whole point of this IG post).
//   2. If fewer than 5 picks were flagged (older editions, extraction miss),
//      pad with earliest upcoming events for the same edition.
//
// Sourced from data/events/<slug>.json records rather than HTML scraping —
// way more stable across newsletter-template changes.
function pickTopEvents(sourceEdition: string): Pick[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const all = listEvents().filter((e) => e.sourceEdition === sourceEdition);

  // Primary: curated Editor's Picks sorted by editorPickRank (Pick 1
  // first, Pick 5 last) so the IG grid matches what readers saw at the
  // top of the newsletter.
  const editorsPicks = all
    .filter((e): e is EventRecord & { editorPickRank: number } => typeof e.editorPickRank === 'number')
    .sort((a, b) => a.editorPickRank - b.editorPickRank);
  const chosen: EventRecord[] = editorsPicks.slice(0, 5);

  // Fallback if fewer than 5 picks were flagged — pad with upcoming events
  // by date, skipping anything already chosen.
  if (chosen.length < 5) {
    const upcoming = all
      .filter((e) => (e.endDate ?? e.date) >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const e of upcoming) {
      if (chosen.some((c) => c.slug === e.slug)) continue;
      chosen.push(e);
      if (chosen.length >= 5) break;
    }
  }

  return chosen.map((e) => ({
    name: e.name,
    venue: e.venue,
    price: e.price ?? '',
  }));
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

// Buffer scheduler lives in lib/buffer.ts now — shared with instagram-blog.

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
    console.log(`[cron/instagram] Using edition: ${latest.slug}`);

    // 2. Pull top 5 picks from the structured event records (committed by
    //    the newsletter cron's extraction pass). Replaces the earlier
    //    HTML-scraping approach, which broke every time the newsletter
    //    template changed (e.g. April 23 switched <p Georgia> → <h4>).
    const picks = pickTopEvents(latest.slug);
    if (picks.length === 0) {
      throw new Error(`No event records found for edition ${latest.slug} — newsletter cron extraction may have failed`);
    }
    console.log(`[cron/instagram] ${picks.length} picks:`, picks.map(p => p.name).join(' | '));

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
