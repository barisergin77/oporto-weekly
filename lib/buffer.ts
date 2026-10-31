/**
 * Buffer GraphQL scheduling helper.
 *
 * Used by:
 *   - app/api/cron/instagram/route.ts       (weekly newsletter roundup)
 *   - app/api/cron/instagram-blog/route.ts  (weekly blog post promo)
 *
 * Both flows: generate a 1:1 image → upload to Imgur → call this to queue
 * an Instagram post via Buffer's automatic scheduler.
 */

import { humanizeText } from './humanizer';

const BUFFER_API = 'https://api.buffer.com/graphql';

export interface ScheduledPost {
  id: string;
  status: string;
  dueAt?: string;
}

/**
 * Schedule an Instagram post via Buffer.
 *
 * `dueAt` (ISO timestamp) schedules EXPLICITLY via mode customScheduled.
 * Omitting it falls back to addToQueue — but DON'T for time-sensitive
 * content: the queue only has slots the user configured in Buffer (one
 * per week as of June 2026), and with two posts a week (Tue blog promo +
 * Thu roundup) queue posts pile up and drift. The 2026-06-11 weekly
 * roundup got queued for June 19 — after the week's events were over.
 */
export async function scheduleBufferPost(
  imageUrl: string | string[],
  caption: string,
  dueAt?: string
): Promise<ScheduledPost> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_CHANNEL_ID;
  if (!apiKey) throw new Error('BUFFER_API_KEY not set');
  if (!channelId) throw new Error('BUFFER_CHANNEL_ID not set');
  // Humanizer post-pass for every Instagram caption (owner 2026-10-31).
  caption = humanizeText(caption);

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
        channelId,
        schedulingType: 'automatic',
        ...(dueAt
          ? { mode: 'customScheduled', dueAt }
          : { mode: 'addToQueue' }),
        metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
        text: caption,
        // Buffer API breaking change announced 2026-05-06: `assets` moved
        // from { images: [{ url }] } to an ordered array of [{ image: {
        // url } }]. The old shape is still accepted until May 25, 2026,
        // but transparently translated — and the announcement warned
        // some implementations might break before that anyway. Migrating
        // now to be safe.
        // Several URLs = an Instagram carousel, in slide order (owner 2026-10-27).
        assets: (Array.isArray(imageUrl) ? imageUrl : [imageUrl]).map((url) => ({ image: { url } })),
      },
    },
  };

  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = data?.data?.createPost;

  if (result?.post?.id) {
    return {
      id: result.post.id,
      status: result.post.status,
      dueAt: result.post.dueAt,
    };
  }

  const errMsg = result?.message || JSON.stringify(data?.errors || data).slice(0, 400);
  throw new Error(`Buffer scheduling failed: ${errMsg}`);
}


/**
 * Schedule an Instagram Reel via Buffer (owner 2026-10-27: weekly "Digital Baris" reel).
 * `videoUrl` must stay public until it publishes (Buffer fetches at publish time), so it is an
 * Imgur .mp4, not HeyGen's expiring presigned URL. Flagged as AI-generated for Instagram.
 */
export async function scheduleBufferReel(
  videoUrl: string,
  caption: string,
  dueAt: string
): Promise<ScheduledPost> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_CHANNEL_ID;
  if (!apiKey) throw new Error('BUFFER_API_KEY not set');
  if (!channelId) throw new Error('BUFFER_CHANNEL_ID not set');
  // Humanizer post-pass for every Instagram caption (owner 2026-10-31).
  caption = humanizeText(caption);
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
        channelId,
        schedulingType: 'automatic',
        mode: 'customScheduled',
        dueAt,
        metadata: { instagram: { type: 'reel', shouldShareToFeed: true, isAiGenerated: true } },
        text: caption,
        assets: [{ video: { url: videoUrl, metadata: { thumbnailOffset: 1500 } } }],
      },
    },
  };
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = data?.data?.createPost;
  if (result?.post?.id) return { id: result.post.id, status: result.post.status, dueAt: result.post.dueAt };
  const errMsg = result?.message || JSON.stringify(data?.errors || data).slice(0, 400);
  throw new Error(`Buffer reel scheduling failed: ${errMsg}`);
}
