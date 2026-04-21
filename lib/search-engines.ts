/**
 * Search engine notification utilities.
 *
 * Called by the cron route after each new newsletter is archived.
 * Requires the following environment variables:
 *
 *  INDEXNOW_KEY              — any alphanumeric string (also hosted at /<key>.txt)
 *  GOOGLE_SERVICE_ACCOUNT_JSON — full JSON content of a Google Cloud service account
 *                                key that has been granted Owner access in GSC and has
 *                                the Indexing API + Search Console API enabled.
 */

const SITE = 'https://oportoweekly.com';

// ---------------------------------------------------------------------------
// IndexNow — instant indexing for Bing, Yandex, and other IndexNow members
// ---------------------------------------------------------------------------
export async function notifyIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log('[search-engines] INDEXNOW_KEY not set — skipping IndexNow');
    return;
  }

  const body = {
    host: 'oportoweekly.com',
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: urls,
  };

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  console.log(`[search-engines] IndexNow → ${res.status} (${urls.length} URLs)`);
}

// ---------------------------------------------------------------------------
// Google helpers
// ---------------------------------------------------------------------------
async function getGoogleToken(scope: string): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    // The service-account JSON contains a PEM private_key with embedded
    // newlines. Setting that via `vercel env add` / shell pipes mangles the
    // `\n` escape sequences (actual newlines leak into the string literal,
    // causing JSON.parse to fail with "Bad control character").
    //
    // To avoid the shell-roundtrip fragility, we accept two formats:
    //   1. A base64-encoded JSON string (preferred — bulletproof transit).
    //   2. Raw JSON (legacy; works if the value survived unescaped).
    //
    // Heuristic: if the value starts with `{`, treat as raw JSON; otherwise
    // assume base64 and decode first.
    const json = raw.trimStart().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf-8');

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ credentials: JSON.parse(json), scopes: [scope] });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    return token ?? null;
  } catch (err) {
    console.error('[search-engines] Failed to get Google token:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google Indexing API — notifies Google about new/updated URLs
// Officially for job postings & live streams, but works for any URL when the
// service account is an Owner in GSC.
// ---------------------------------------------------------------------------
export async function notifyGoogleIndexingAPI(urls: string[]): Promise<void> {
  const token = await getGoogleToken('https://www.googleapis.com/auth/indexing');
  if (!token) {
    console.log('[search-engines] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping Indexing API');
    return;
  }

  for (const url of urls) {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    console.log(`[search-engines] Google Indexing API: ${url} → ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Google Search Console — resubmits the sitemap so GSC picks up new URLs
// ---------------------------------------------------------------------------
export async function submitSitemapToGSC(): Promise<void> {
  const token = await getGoogleToken('https://www.googleapis.com/auth/webmasters');
  if (!token) {
    console.log('[search-engines] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping GSC sitemap');
    return;
  }

  // The site identifier must match the GSC property format the service account
  // has Owner access to. The oporto-weekly SA is granted on a DOMAIN property
  // (`sc-domain:oportoweekly.com`), which covers http + https + all subdomains
  // under one property. URL-prefix properties (`https://oportoweekly.com/`)
  // require a separate explicit grant, so we hard-code the domain form here.
  const siteUrl = encodeURIComponent('sc-domain:oportoweekly.com');
  const sitemapUrl = encodeURIComponent(`${SITE}/sitemap.xml`);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/sitemaps/${sitemapUrl}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[search-engines] GSC sitemap submit → ${res.status}`);
}

// ---------------------------------------------------------------------------
// WebSub / PubSubHubbub — instant RSS distribution to Feedly, Flipboard, etc.
// Pings Google's public hub so subscribers are notified the moment a new
// edition is published.
// ---------------------------------------------------------------------------
export async function pingWebSub(): Promise<void> {
  const params = new URLSearchParams({
    'hub.mode': 'publish',
    'hub.url': `${SITE}/feed.xml`,
  });

  const res = await fetch('https://pubsubhubbub.appspot.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  console.log(`[search-engines] WebSub ping → ${res.status}`);
}

// ---------------------------------------------------------------------------
// Master export — call this after every new content is published.
// Pass a path like "march-21-2026" for newsletters or "blog/my-post" for blog posts.
// ---------------------------------------------------------------------------
export async function notifySearchEngines(slug: string): Promise<void> {
  // If slug already contains a path prefix (e.g. "blog/my-post"), use it directly.
  // Otherwise assume it's a newsletter slug under /archive/.
  const contentUrl = slug.includes('/')
    ? `${SITE}/${slug}`
    : `${SITE}/archive/${slug}`;

  // Parent page (archive index or blog index)
  const parentUrl = slug.startsWith('blog/')
    ? `${SITE}/blog`
    : `${SITE}/archive`;

  const urls = [
    SITE,
    parentUrl,
    contentUrl,
  ];

  await Promise.allSettled([
    notifyIndexNow(urls),
    notifyGoogleIndexingAPI(urls),
    submitSitemapToGSC(),
    pingWebSub(),
  ]);
}
