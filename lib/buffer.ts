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

/** Instagram photo tag on one image (Buffer UserTagInput): handle without @, x/y normalized 0..1. */
export interface UserTag {
  handle: string;
  x: number;
  y: number;
}

/**
 * Optional Instagram extras (owner 2026-11-01).
 * - userTags: per image, same order as the image URLs. Buffer only takes tags on IMAGE assets
 *   (ImageMetadataInput.userTags); video assets and stories have no tag field.
 * - Location: Buffer's InstagramPostMetadataInput.geolocation { id, text }. The API has no
 *   location search, so the id comes from env BUFFER_IG_LOCATION_ID (read back from a post where
 *   the location was picked in Buffer's composer). Unset = no location sent.
 */
export interface InstagramExtras {
  userTags?: UserTag[][];
  /** Per-image alt text; Buffer requires altText whenever image metadata is sent. */
  altTexts?: string[];
}

function igGeolocation(): { id: string; text: string } | undefined {
  const id = process.env.BUFFER_IG_LOCATION_ID?.trim();
  if (!id) return undefined;
  return { id, text: process.env.BUFFER_IG_LOCATION_NAME?.trim() || 'Porto, Portugal' };
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
  dueAt?: string,
  extras: InstagramExtras = {}
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
        metadata: { instagram: { type: 'post', shouldShareToFeed: true, ...(igGeolocation() ? { geolocation: igGeolocation() } : {}) } },
        text: caption,
        // Buffer API breaking change announced 2026-05-06: `assets` moved
        // from { images: [{ url }] } to an ordered array of [{ image: {
        // url } }]. The old shape is still accepted until May 25, 2026,
        // but transparently translated — and the announcement warned
        // some implementations might break before that anyway. Migrating
        // now to be safe.
        // Several URLs = an Instagram carousel, in slide order (owner 2026-10-27).
        // userTags ride on each image's metadata (Buffer requires altText there too).
        assets: (Array.isArray(imageUrl) ? imageUrl : [imageUrl]).map((url, i) => {
          const tags = extras.userTags?.[i];
          return tags?.length
            ? { image: { url, metadata: { altText: extras.altTexts?.[i] || 'Oporto Weekly slide', userTags: tags } } }
            : { image: { url } };
        }),
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
        metadata: { instagram: { type: 'reel', shouldShareToFeed: true, isAiGenerated: true, ...(igGeolocation() ? { geolocation: igGeolocation() } : {}) } },
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

/**
 * Read-only: one Buffer post's status and Instagram geolocation. Used once to learn the
 * location id for BUFFER_IG_LOCATION_ID after "Porto" is picked in Buffer's composer
 * (the API has no location search). Never creates or edits anything.
 */
export async function inspectBufferPost(postId: string): Promise<unknown> {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) throw new Error('BUFFER_API_KEY not set');
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: `query InspectPost($input: PostInput!) {
        post(input: $input) {
          id status dueAt
          metadata { ... on InstagramPostMetadata { type geolocation { id text } } }
        }
      }`,
      variables: { input: { id: postId } },
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data?.errors) throw new Error(`Buffer inspect failed: ${JSON.stringify(data.errors).slice(0, 400)}`);
  return data?.data?.post ?? null;
}
