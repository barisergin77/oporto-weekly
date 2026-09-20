/**
 * Instagram follower count via the Meta Graph API.
 *
 * Why not scrape: instagram.com serves a login wall to logged-out clients and
 * i.instagram.com/api/v1/users/web_profile_info returns 401 (checked
 * 2026-09-20, from a residential IP — a datacenter IP like Vercel's is
 * blocked harder). Buffer's GraphQL API has no follower field either, so the
 * official Graph API is the only durable source.
 *
 * Setup (once): IG Business/Creator account linked to a Facebook Page → Meta
 * app → long-lived token. Then set IG_GRAPH_TOKEN + IG_USER_ID.
 * Unset = feature off: callers get null and the report just omits the row.
 */

export interface InstagramStats {
  followers: number;
  posts: number;
  username: string;
}

/**
 * Returns null when not configured (no token) so the weekly report degrades
 * gracefully. Throws on a real API failure — a silently-zero follower count
 * would look like catastrophic churn in the week-over-week delta.
 */
export async function getInstagramStats(): Promise<InstagramStats | null> {
  const token = process.env.IG_GRAPH_TOKEN;
  const userId = process.env.IG_USER_ID;
  if (!token || !userId) return null;

  const url =
    `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}` +
    `?fields=username,followers_count,media_count&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = (await res.json()) as {
    username?: string;
    followers_count?: number;
    media_count?: number;
    error?: { message?: string; code?: number };
  };

  if (!res.ok || body.error) {
    throw new Error(
      `Instagram Graph API ${res.status}: ${body.error?.message ?? 'unknown error'}` +
      (body.error?.code === 190 ? ' (token expired — long-lived tokens last ~60 days and need refreshing)' : '')
    );
  }
  if (typeof body.followers_count !== 'number') {
    throw new Error('Instagram Graph API returned no followers_count');
  }

  return {
    followers: body.followers_count,
    posts: body.media_count ?? 0,
    username: body.username ?? 'oportoweekly',
  };
}
