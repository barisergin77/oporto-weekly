/**
 * Manual / scheduled full re-submission to search engines.
 *
 * Triggers IndexNow + Google Indexing API + GSC sitemap submission + WebSub for
 * EVERY canonical URL on the site (home, section pages, blog posts, EN + PT
 * newsletter archive). Used when:
 *   - A new GSC property is verified and we want Google to pull everything
 *   - The weekly cron ping might have been skipped (env var missing) and we
 *     want to catch up
 *   - Manual re-submit from `workflow_dispatch`
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Response includes env-var diagnostics so you can see WHY something was
 * skipped (e.g. GOOGLE_SERVICE_ACCOUNT_JSON unset → GSC submit is a no-op).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';
import {
  notifyIndexNow,
  notifyGoogleIndexingAPI,
  submitSitemapToGSC,
  pingWebSub,
} from '@/lib/search-engines';
import { checkCronAuth } from '@/lib/cron-auth';

const SITE = 'https://oportoweekly.com';

function collectAllUrls(): string[] {
  const urls = new Set<string>();

  // Top-level index pages
  urls.add(SITE);
  urls.add(`${SITE}/blog`);
  urls.add(`${SITE}/porto-events`);
  urls.add(`${SITE}/pt`);
  urls.add(`${SITE}/archive`);
  urls.add(`${SITE}/pt/arquivo`);

  // Blog posts
  for (const p of listBlogPosts()) urls.add(`${SITE}/blog/${p.slug}`);

  // EN newsletter archive
  for (const n of listNewsletters()) urls.add(`${SITE}/archive/${n.slug}`);

  // PT newsletter archive
  for (const n of listNewslettersPT()) urls.add(`${SITE}/pt/arquivo/${n.slug}`);

  return Array.from(urls);
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  return runResubmit();
}

// Allow POST too so `workflow_dispatch` with no body works, and so CURL scripts
// that use -X POST by habit don't 405.
export async function POST(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  return runResubmit();
}

async function runResubmit() {
  const urls = collectAllUrls();

  const env = {
    INDEXNOW_KEY: Boolean(process.env.INDEXNOW_KEY),
    GOOGLE_SERVICE_ACCOUNT_JSON: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  };

  // Kick off all four pings in parallel. Each one is self-contained — if an
  // env var is missing it just logs and returns. We collect the timings and
  // settled status for the response.
  const tasks: Array<{ name: string; run: () => Promise<void> }> = [
    { name: 'IndexNow', run: () => notifyIndexNow(urls) },
    { name: 'GoogleIndexingAPI', run: () => notifyGoogleIndexingAPI(urls) },
    { name: 'GSCSitemap', run: () => submitSitemapToGSC() },
    { name: 'WebSub', run: () => pingWebSub() },
  ];

  const results = await Promise.all(
    tasks.map(async ({ name, run }) => {
      const started = Date.now();
      try {
        await run();
        return { name, status: 'ok' as const, ms: Date.now() - started };
      } catch (err) {
        return {
          name,
          status: 'error' as const,
          ms: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    site: SITE,
    urlCount: urls.length,
    urls, // echo list back so the caller can verify what was submitted
    envConfigured: env,
    notes: [
      !env.INDEXNOW_KEY && 'INDEXNOW_KEY not set → IndexNow ping skipped (Bing/Yandex).',
      !env.GOOGLE_SERVICE_ACCOUNT_JSON &&
        'GOOGLE_SERVICE_ACCOUNT_JSON not set → Google Indexing API + GSC sitemap submit skipped. ' +
          'Create a service account with the Indexing API + Search Console API enabled, ' +
          'add it as an Owner in GSC, and paste the JSON key into Vercel env vars.',
    ].filter(Boolean),
    results,
  });
}
