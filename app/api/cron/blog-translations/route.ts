/**
 * Tuesday 10:00 UTC — after the blog cron (09:00) + blog-instagram (09:30).
 *
 * Translates blog articles to European Portuguese for /pt/blog: writes the
 * body to public/blog/<slug>-pt.html and stores titlePt/excerptPt on the
 * blog-posts.json index. A post "needs translation" when it has no titlePt.
 *
 * Caps at 4/run — each post is ~2 Gemini calls and the body can be long, so
 * 4 keeps us well under the 300s budget. 28 posts drain over ~7 runs; a
 * workflow_dispatch backfills on demand. Heavy endpoint → NO --retry.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import type { BlogPost } from '@/lib/blog';
import { translateBlogPost } from '@/lib/blog-translate';
import { getFileContent, commitFiles } from '@/lib/github';
import { checkCronAuth } from '@/lib/cron-auth';

const MAX_PER_RUN = 4;

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const startedAt = Date.now();
    const indexRaw = await getFileContent('data/blog-posts.json');
    if (!indexRaw) throw new Error('data/blog-posts.json not found');
    const posts = JSON.parse(indexRaw) as BlogPost[];

    const candidates = posts.filter((p) => !p.titlePt).slice(0, MAX_PER_RUN);
    console.log(`[cron/blog-translations] ${posts.length} total · ${candidates.length} to translate`);

    const files: Array<{ path: string; content: string }> = [];
    const counts = { ok: 0, error: 0 };
    // Work on a mutable copy of the index so we can write all updates at once.
    const updatedIndex: BlogPost[] = posts.map((p) => ({ ...p }));

    for (const post of candidates) {
      try {
        const enHtml = await getFileContent(`public/blog/${post.slug}.html`);
        if (!enHtml) { console.warn(`[cron/blog-translations] no EN html for ${post.slug}, skipping`); continue; }

        const t = await translateBlogPost(post, enHtml);
        files.push({ path: `public/blog/${post.slug}-pt.html`, content: t.htmlPt });
        const idx = updatedIndex.findIndex((p) => p.slug === post.slug);
        if (idx >= 0) { updatedIndex[idx].titlePt = t.titlePt; updatedIndex[idx].excerptPt = t.excerptPt; }
        counts.ok++;
        console.log(`[cron/blog-translations] ✓ ${post.slug}`);
      } catch (err) {
        counts.error++;
        console.error(`[cron/blog-translations] ❌ ${post.slug}:`, err instanceof Error ? err.message : err);
      }
      if (Date.now() - startedAt > 260_000) { console.warn('[cron/blog-translations] budget exhausted'); break; }
    }

    if (files.length > 0) {
      files.push({ path: 'data/blog-posts.json', content: JSON.stringify(updatedIndex, null, 2) });
      await commitFiles(files, `chore: PT translations for ${counts.ok} blog post${counts.ok === 1 ? '' : 's'}`);
    }

    return NextResponse.json({
      ok: true, totalPosts: posts.length, processed: candidates.length,
      results: counts, committed: files.length, durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[cron/blog-translations]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
