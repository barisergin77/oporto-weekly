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
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;

  try {
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

  const siteUrl = encodeURIComponent(`${SITE}/`);
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
// Master export — call this after every new newsletter is published
// ---------------------------------------------------------------------------
export async function notifySearchEngines(slug: string): Promise<void> {
  const urls = [
    SITE,
    `${SITE}/archive`,
    `${SITE}/archive/${slug}`,
  ];

  await Promise.allSettled([
    notifyIndexNow(urls),
    notifyGoogleIndexingAPI(urls),
    submitSitemapToGSC(),
    pingWebSub(),
  ]);
}
