export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { generateBlogSlug, type BlogPost } from '@/lib/blog';
import { generateImage } from '@/lib/imagen';
import { commitFiles } from '@/lib/github';
import { notifySearchEngines } from '@/lib/search-engines';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429 && url === GEMINI_URL) {
    console.log('[geminiPost] 429 on gemini-2.5-pro, retrying with gemini-2.5-flash');
    return geminiPost(GEMINI_URL_FALLBACK, body);
  }

  console.log(`[geminiPost] Used model: ${url.includes('2.5-pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash'}`);
  return res;
}

const AUTHOR = 'Baris Ergin';

// Topic categories to rotate through
const TOPIC_POOLS = [
  'Best hidden gems and local secrets in Porto that most tourists miss',
  'Porto food guide: traditional dishes, best restaurants, and food markets',
  'Porto neighborhoods guide: where to stay, eat, and explore',
  'Porto wine culture: Port wine cellars, tastings, and wine bars',
  'Best viewpoints and rooftop bars in Porto with stunning views',
  'Porto day trips: Douro Valley, Braga, Guimarães, and coastal towns',
  'Porto on a budget: free things to do, cheap eats, and money-saving tips',
  'Porto nightlife guide: bars, clubs, fado houses, and live music',
  'Porto for families: kid-friendly activities, parks, and museums',
  'Porto art and culture: galleries, street art, theaters, and festivals',
  'Seasonal guide: what to do in Porto in spring/summer/autumn/winter',
  'Porto coffee culture: best cafes, specialty coffee, and pastéis de nata spots',
  'Walking tours in Porto: self-guided routes through historic streets',
  'Porto beaches: best beaches near Porto for swimming and surfing',
  'Porto markets and shopping: from vintage finds to artisan crafts',
];

async function geminiGenerate(prompt: string): Promise<string> {
  const res = await geminiPost(GEMINI_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 16384 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? ''
  );
}

async function geminiSearchAndGenerate(prompt: string): Promise<string> {
  const res = await geminiPost(GEMINI_URL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { maxOutputTokens: 16384 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini search failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? ''
  );
}

export async function GET() {
  try {
    // 1. Pick a topic — use day of year to rotate through the pool
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const topicSeed = TOPIC_POOLS[dayOfYear % TOPIC_POOLS.length];

    // 2. Research the topic via Gemini with web search
    console.log(`[cron/blog] Researching topic: ${topicSeed}`);
    const research = await geminiSearchAndGenerate(
      `Research the following topic about Porto, Portugal. Find specific names, addresses, ` +
      `prices, and current details (2025-2026). Include real venue names and locations.\n\n` +
      `Topic: ${topicSeed}\n\nProvide detailed, factual research results.`
    );

    await new Promise(r => setTimeout(r, 2000)); // rate limit pause

    // 3. Generate the article metadata (title, excerpt, tags) via Gemini
    const metaRaw = await geminiGenerate(
      `Based on this research about Porto, generate a blog article plan.\n\n` +
      `RESEARCH:\n${research.slice(0, 4000)}\n\n` +
      `Return ONLY valid JSON (no markdown, no code fences) with these fields:\n` +
      `{\n` +
      `  "title": "SEO-optimized article title (50-65 chars, include 'Porto')",\n` +
      `  "excerpt": "Compelling meta description (120-155 chars)",\n` +
      `  "tags": ["3-5 relevant tags like 'food', 'culture', 'wine', 'nightlife'"],\n` +
      `  "heroImagePrompt": "Detailed prompt for a photorealistic hero image set IN PORTO, PORTUGAL. MUST include recognizable Porto elements like: Ribeira district, Douro River, Dom Luís I Bridge, colorful tiled facades (azulejos), Clérigos Tower, Livraria Lello, Port wine cellars in Vila Nova de Gaia, or the narrow cobblestone streets of Porto. Describe specific Porto scenery, golden hour lighting, no text/words in image.",\n` +
      `  "inlineImagePrompt": "Detailed prompt for a photorealistic image of a specific Porto location or scene related to the article topic. MUST be clearly set in Porto, Portugal — include Portuguese signage, azulejo tiles, Porto architecture, or Douro River views. No text/words in image."\n` +
      `}`
    );

    // Parse metadata JSON — strip code fences if present
    const cleanMeta = metaRaw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim();
    const meta = JSON.parse(cleanMeta);

    await new Promise(r => setTimeout(r, 2000));

    // 4. Generate the article HTML
    console.log(`[cron/blog] Generating article: ${meta.title}`);
    const articleRaw = await geminiGenerate(
      `You are Baris Ergin, editor of Oporto Weekly, a Porto lifestyle blog.\n\n` +
      `Write a complete blog article based on this research. The article should be:\n` +
      `- 800-1200 words\n` +
      `- Written in a warm, knowledgeable, first-person voice\n` +
      `- Include specific venue names, addresses, and practical tips\n` +
      `- SEO-optimized with natural keyword usage\n` +
      `- Well-structured with H2 and H3 subheadings\n\n` +
      `RESEARCH:\n${research}\n\n` +
      `TITLE: ${meta.title}\n\n` +
      `OUTPUT FORMAT:\n` +
      `- Return ONLY the article body as clean HTML (no <!DOCTYPE>, no <html>, no <head>, no <body> tags)\n` +
      `- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags\n` +
      `- Add a placeholder <!-- IMAGE_INLINE --> where the second image should go (after the 2nd or 3rd section)\n` +
      `- Style: clean semantic HTML, no inline styles (the page template handles styling)\n` +
      `- End with a brief practical tip or recommendation\n` +
      `- Do NOT include the title (it's rendered by the page template)\n` +
      `- Do NOT include author byline (it's rendered by the page template)\n\n` +
      `Output ONLY the HTML. No markdown, no code fences, no explanation.`
    );

    let articleHtml = articleRaw
      .replace(/^```html\n?/i, '')
      .replace(/\n?```$/, '')
      .trim();

    // 5. Generate images
    console.log('[cron/blog] Generating hero image...');
    let heroImageBase64 = '';
    let inlineImageBase64 = '';

    try {
      const heroResult = await generateImage(meta.heroImagePrompt, '16:9');
      heroImageBase64 = heroResult.base64;
      console.log('[cron/blog] Hero image generated');
    } catch (imgErr) {
      console.error('[cron/blog] Hero image generation failed:', imgErr);
    }

    await new Promise(r => setTimeout(r, 2000));

    try {
      const inlineResult = await generateImage(meta.inlineImagePrompt, '4:3');
      inlineImageBase64 = inlineResult.base64;
      console.log('[cron/blog] Inline image generated');
    } catch (imgErr) {
      console.error('[cron/blog] Inline image generation failed:', imgErr);
    }

    // 6. Build file list and commit
    const slug = generateBlogSlug(meta.title);
    const now = new Date().toISOString();

    const heroImagePath = `public/blog/images/${slug}-hero.png`;
    const inlineImagePath = `public/blog/images/${slug}-inline.png`;

    // Replace inline image placeholder with actual img tag
    if (inlineImageBase64) {
      articleHtml = articleHtml.replace(
        '<!-- IMAGE_INLINE -->',
        `<figure style="margin: 24px 0; text-align: center;">` +
        `<img src="/blog/images/${slug}-inline.png" alt="${meta.title}" ` +
        `style="width: 100%; max-width: 640px; border-radius: 8px; margin: 0 auto;" />` +
        `</figure>`
      );
    } else {
      articleHtml = articleHtml.replace('<!-- IMAGE_INLINE -->', '');
    }

    const post: BlogPost = {
      slug,
      title: meta.title,
      excerpt: meta.excerpt,
      author: AUTHOR,
      publishedAt: now,
      heroImage: heroImageBase64 ? `/blog/images/${slug}-hero.png` : '',
      images: inlineImageBase64 ? [`/blog/images/${slug}-inline.png`] : [],
      tags: meta.tags,
    };

    // Build files to commit
    const files: { path: string; content: string; encoding?: 'utf-8' | 'base64' }[] = [
      { path: `public/blog/${slug}.html`, content: articleHtml },
    ];

    if (heroImageBase64) {
      files.push({ path: heroImagePath, content: heroImageBase64, encoding: 'base64' });
    }
    if (inlineImageBase64) {
      files.push({ path: inlineImagePath, content: inlineImageBase64, encoding: 'base64' });
    }

    // Read current blog index, add new post, commit everything
    const { getFileContent } = await import('@/lib/github');
    const currentIndex = await getFileContent('data/blog-posts.json');
    const existing: BlogPost[] = currentIndex ? JSON.parse(currentIndex) : [];
    const filtered = existing.filter(p => p.slug !== slug);
    const updatedIndex = JSON.stringify([post, ...filtered], null, 2);

    files.push({ path: 'data/blog-posts.json', content: updatedIndex });

    // Atomic commit
    const commitSha = await commitFiles(files, `feat: new blog post - ${slug}`);
    console.log(`[cron/blog] Committed ${slug} → ${commitSha.slice(0, 7)}`);

    // Notify search engines (best-effort)
    notifySearchEngines(`blog/${slug}`).catch(e =>
      console.error('[cron/blog] Search engine notification failed:', e)
    );

    return NextResponse.json({
      success: true,
      slug,
      title: meta.title,
      images: {
        hero: !!heroImageBase64,
        inline: !!inlineImageBase64,
      },
    });
  } catch (err: unknown) {
    console.error('[cron/blog]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
