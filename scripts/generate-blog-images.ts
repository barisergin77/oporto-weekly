/**
 * Generate the hero (16:9) and inline (4:3) images for a hand-written blog
 * post, the same way app/api/cron/blog/route.ts does for cron posts, then
 * wire them in: public/blog/images/<slug>-{hero,inline}.png, heroImage/images
 * in data/blog-posts.json, and the <!-- IMAGE_INLINE --> placeholder in
 * <slug>.html and <slug>-pt.html.
 *
 *   npx tsx --env-file=.env.local scripts/generate-blog-images.ts made-in-porto-shop-online
 *
 * Needs GEMINI_API_KEY (lib/imagen.ts). If a generation fails, nothing is
 * changed for that image, so the post keeps rendering without it.
 */

import fs from 'fs';
import path from 'path';

const PROMPTS: Record<string, { hero: string; inline: string; alt: string; altPt: string }> = {
  'made-in-porto-shop-online': {
    hero:
      'Photorealistic photo of a sunny, narrow cobblestone street in Porto, Portugal, lined with old facades ' +
      'covered in blue and white azulejo tiles and wrought-iron balconies, small independent shop windows at ' +
      'street level, the Douro river and the Dom Luis I bridge glimpsed at the end of the street, warm golden ' +
      'hour light. No people in focus, no text, no words, no signage lettering, no logos, no brand names, no products.',
    inline:
      'Photorealistic close-up of a simple brown cardboard parcel tied with plain twine, resting on a wooden ' +
      'table beside a window, with a blurred view of Porto rooftops with terracotta tiles and a tiled facade ' +
      'outside. Soft daylight. No text, no words, no labels, no logos, no branded products.',
    alt: 'A tiled street in Porto with small shop windows',
    altPt: 'Uma rua de azulejos no Porto com pequenas montras',
  },
};

async function main() {
  const slug = process.argv[2];
  const p = slug && PROMPTS[slug];
  if (!p) throw new Error(`Usage: generate-blog-images.ts <slug>; known: ${Object.keys(PROMPTS).join(', ')}`);
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set (lib/imagen.ts needs it)');
  const { generateImage } = await import('../lib/imagen');

  const root = process.cwd();
  const imgDir = path.join(root, 'public', 'blog', 'images');
  fs.mkdirSync(imgDir, { recursive: true });

  const made: { hero?: string; inline?: string } = {};
  for (const [kind, ratio] of [['hero', '16:9'], ['inline', '4:3']] as const) {
    try {
      const { base64 } = await generateImage(p[kind], ratio);
      const file = path.join(imgDir, `${slug}-${kind}.png`);
      fs.writeFileSync(file, Buffer.from(base64, 'base64'));
      made[kind] = `/blog/images/${slug}-${kind}.png`;
      console.log(`[images] ${kind} written: ${path.relative(root, file)}`);
    } catch (err) {
      console.error(`[images] ${kind} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const indexPath = path.join(root, 'data', 'blog-posts.json');
  const posts = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const post = posts.find((x: { slug: string }) => x.slug === slug);
  if (!post) throw new Error(`${slug} is not in data/blog-posts.json`);
  if (made.hero) post.heroImage = made.hero;
  if (made.inline) post.images = [made.inline];
  fs.writeFileSync(indexPath, JSON.stringify(posts, null, 2) + '\n');

  if (made.inline) {
    for (const [file, alt] of [[`${slug}.html`, p.alt], [`${slug}-pt.html`, p.altPt]]) {
      const htmlPath = path.join(root, 'public', 'blog', file);
      if (!fs.existsSync(htmlPath)) continue;
      const html = fs.readFileSync(htmlPath, 'utf-8').replace(
        '<!-- IMAGE_INLINE -->',
        `<figure style="margin: 24px 0; text-align: center;">` +
          `<img src="${made.inline}" alt="${alt}" ` +
          `style="width: 100%; max-width: 640px; border-radius: 8px; margin: 0 auto;" />` +
          `</figure>`
      );
      fs.writeFileSync(htmlPath, html);
    }
  }
  console.log(`[images] done: hero=${!!made.hero} inline=${!!made.inline}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
