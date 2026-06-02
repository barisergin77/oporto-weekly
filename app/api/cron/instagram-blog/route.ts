/**
 * Tuesday 09:30 UTC — 30 min after the blog cron at 09:00 UTC.
 *
 * Takes the newest blog post, generates a 1:1 editorial Instagram image
 * themed to the article topic, composes a bilingual caption referencing
 * the title + excerpt + a "link in bio" CTA, and queues the post via
 * Buffer.
 *
 * Separate from the Thursday weekly-roundup IG cron (/api/cron/instagram)
 * because the source material and prompt are completely different — this
 * one promotes ONE long-form article, not a set of weekly events.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { listBlogPosts, type BlogPost } from '@/lib/blog';
import { generateImage } from '@/lib/imagen';
import { uploadImageToImgur } from '@/lib/imgur';
import { scheduleBufferPost } from '@/lib/buffer';
import { checkCronAuth } from '@/lib/cron-auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_CAPTION_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

// ---------------------------------------------------------------------------
// Image prompt — derive a scene from the blog's topic tags + title
// ---------------------------------------------------------------------------

// Tags the blog cron emits (lib/blog.ts + cron/blog research phase), mapped
// to a visual scene cue. Keeps the generated imagery coherent across weeks.
const TAG_SCENE: Record<string, string> = {
  food: 'Portuguese market atmosphere, rustic wooden counters, warm golden-hour light',
  wine: 'Port wine cellars along the Douro, barrels and dim warm lighting',
  culture: 'historic Porto street scene, azulejo tile walls, soft daylight',
  family: 'friendly community scene, daytime, warm and welcoming',
  nightlife: 'Ribeira at dusk, Douro reflections, lantern lights',
  history: 'old-town architecture, ornate stone detail, golden hour',
  arts: 'gallery or museum interior, minimal, natural side light',
  shopping: 'artisan shop windows, vintage atmosphere, soft daylight',
  budget: 'sunny public plaza, locals walking, informal cafe scene',
  outdoors: 'Foz coastline or Douro riverfront, open sky, wide composition',
  transit: 'Porto tram line 1 along the river, iconic yellow carriage',
  hidden: 'quiet side street in Porto, subtle discovery feel',
};

function buildBlogImagePrompt(post: BlogPost): string {
  const tagHints = (post.tags ?? [])
    .map((t) => TAG_SCENE[t.toLowerCase()])
    .filter(Boolean);
  const scene = tagHints.length > 0
    ? tagHints[0]
    : 'iconic Porto rooftop view with orange-tile houses and the Douro';

  // Build a prompt that produces an editorial, text-free cover image.
  // Instagram squares can't reliably render overlaid text via AI generation
  // (text comes out garbled), so we let the caption carry the words.
  return (
    `Editorial magazine-cover photograph for an article titled "${post.title}", set in Porto, Portugal. ` +
    `${scene}. ` +
    `Cinematic, warm colour palette, rich texture, shallow depth of field where appropriate. ` +
    `NO text overlays, NO logos, NO watermarks, NO visible faces in close-up. ` +
    `1:1 aspect ratio suitable for Instagram feed. Travel-magazine aesthetic.`
  );
}

// ---------------------------------------------------------------------------
// Caption — bilingual EN/PT, hook-driven, link-in-bio CTA
// ---------------------------------------------------------------------------

async function generateCaption(post: BlogPost): Promise<string> {
  const errors: string[] = [];
  const articleUrl = `https://oportoweekly.com/blog/${post.slug}`;

  const prompt = `Write an Instagram caption promoting a blog article on oportoweekly.com — a weekly Porto events + culture publication.

Article:
  Title:   ${post.title}
  Excerpt: ${post.excerpt}
  Tags:    ${(post.tags ?? []).join(', ') || '(none)'}
  URL:     ${articleUrl}

OUTPUT STRUCTURE (exactly this order, separated by single blank lines):

Line 1 — ONE-LINE HOOK (≤ 90 chars): a curiosity gap or specific claim, not a generic tease. Pick a concrete detail from the excerpt; don't paraphrase the title.

Three short PARAGRAPHS (~2-3 sentences each):
  Para 1: what the article covers, practically. One specific thing a reader will learn.
  Para 2: who it's for ("first-time visitors looking for...", "locals after...", etc.).
  Para 3: soft CTA — "full guide at oportoweekly.com/blog (link in bio)".

Then blank line, then ***PORTUGUESE***, blank line.

Then the SAME THREE paragraphs translated into casual European Portuguese (Portugal, not Brazil). Use "quinta-feira" style conventions. The CTA in PT: "artigo completo em oportoweekly.com/blog (link na bio)".

Then blank line, then up to 10 hashtags relevant to Porto + the article's topic. Prefer #Porto, #Portugal, #VisitPorto + 2-4 topic-specific ones. No fluff hashtags like #instagood.

STRICT RULES:
- NO press-release adjectives ("unmissable", "vibrant", "stunning", "a rich tapestry", "breathtaking", "must-see").
- NO emoji-flood — one or two max, only where a normal person would use them (not at every line start).
- Factual, observational voice. Write like a local sharing a recommendation, not marketing copy.
- Don't repeat the article title verbatim in the hook.
- Output the caption text only — no markdown fences, no "Caption:" prefix, no commentary.`;

  for (const model of GEMINI_CAPTION_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        errors.push(`${model} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text: string = (
        data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? '')
          .join('') ?? ''
      ).trim();
      if (text) {
        console.log(`[cron/instagram-blog] Caption generated via ${model}`);
        return text;
      }
      errors.push(`${model} returned empty`);
    } catch (err) {
      errors.push(`${model} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Caption generation failed (all models): ${errors.join(', ')}`);
}

// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  // 0. Atomic claim via the run-ledger (outside the work try/catch so the
  //    claim itself isn't unmarked on its own failure).
  const { tryClaimStep, unmarkStep, getWeekEntry, blogWeekKey } = await import('@/lib/run-ledger');
  const weekKey = blogWeekKey(new Date());
  const claimed = await tryClaimStep(weekKey, 'blog-instagram');
  if (!claimed) {
    const entry = await getWeekEntry(weekKey);
    console.log(`[cron/instagram-blog] blog-instagram already claimed for ${weekKey} — skipping`);
    return NextResponse.json({
      skipped: true,
      reason: 'blog-instagram-already-claimed',
      weekKey,
      ledger: entry,
    });
  }

  try {
    // 1. Load the newest blog post
    const posts = listBlogPosts();
    const latest = posts[0];
    if (!latest) {
      // No blog post is a legitimate skip-this-week, not a recoverable
      // failure — but we should still unmark so next week can run.
      await unmarkStep(weekKey, 'blog-instagram');
      return NextResponse.json({ error: 'No blog posts found' }, { status: 404 });
    }

    // Guard against running when this week's post hasn't been published yet
    // (e.g. blog cron failed earlier — we'd end up re-promoting last week's).
    // A post is "fresh" if published within the last 48 hours.
    const ageMs = Date.now() - new Date(latest.publishedAt).getTime();
    const FRESH_WINDOW = 48 * 60 * 60 * 1000;
    if (ageMs > FRESH_WINDOW) {
      // Same — soft skip should release the claim.
      await unmarkStep(weekKey, 'blog-instagram');
      return NextResponse.json({
        skipped: true,
        reason: 'latest blog post is >48h old — skipping to avoid re-promoting',
        latestSlug: latest.slug,
        latestPublishedAt: latest.publishedAt,
      });
    }
    console.log(`[cron/instagram-blog] Using post: ${latest.slug}`);

    // 2. Generate 1:1 Instagram image
    const imagePrompt = buildBlogImagePrompt(latest);
    console.log('[cron/instagram-blog] Generating image…');
    const { base64 } = await generateImage(imagePrompt, '1:1');

    // 3. Upload to Imgur
    const imgurUrl = await uploadImageToImgur(base64);
    console.log(`[cron/instagram-blog] Imgur: ${imgurUrl}`);

    // 4. Generate caption
    const caption = await generateCaption(latest);
    console.log(`[cron/instagram-blog] Caption (${caption.length} chars)`);

    // 5. Queue on Buffer — the only irreversible step. Past this point,
    //    we keep the claim even on subsequent errors (rare here since the
    //    function returns immediately after this).
    const post = await scheduleBufferPost(imgurUrl, caption);
    console.log(`[cron/instagram-blog] Scheduled: ${post.id} (${post.status})`);

    return NextResponse.json({
      ok: true,
      slug: latest.slug,
      title: latest.title,
      imgurUrl,
      buffer: post,
    });
  } catch (err) {
    // Work failed AFTER the claim. Nothing in this handler has reached
    // Buffer yet (we only get past scheduleBufferPost in the success
    // branch above). Safe to release the claim so a retry can run.
    console.error('[cron/instagram-blog] work failed after claim, unmarking:', err);
    await unmarkStep(weekKey, 'blog-instagram');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
