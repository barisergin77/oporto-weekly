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

const BUFFER_API = 'https://api.buffer.com/graphql';

export interface ScheduledPost {
  id: string;
  status: string;
  dueAt?: string;
}

export async function scheduleBufferPost(
  imageUrl: string,
  caption: string
): Promise<ScheduledPost> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_CHANNEL_ID;
  if (!apiKey) throw new Error('BUFFER_API_KEY not set');
  if (!channelId) throw new Error('BUFFER_CHANNEL_ID not set');

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
        mode: 'addToQueue',
        metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
        text: caption,
        assets: { images: [{ url: imageUrl }] },
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
