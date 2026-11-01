export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly Instagram carousel (owner 2026-10-27), replacing the single-image roundup.
 * The slides are rendered on the ops server (~/oporto-carousel) and sent here because the
 * Imgur and Buffer credentials live in this project's env. Two actions, so no request
 * carries more than one image:
 *   { action: 'upload', image: '<base64 jpeg>' }                → { url }
 *   { action: 'schedule', urls: [...], caption, dueAt,
 *     userTags?: [[{ handle, x, y }], ...], altTexts?: [...] }   → Buffer post
 *   { action: 'inspect', postId }                               → read-only: a Buffer post's
 *     Instagram geolocation (to learn the location id for BUFFER_IG_LOCATION_ID)
 * userTags (owner 2026-11-01): one list per slide; every handle must be in
 * data/venue-instagram.json (verified on the venue's own site), else the request is refused.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { uploadImageToImgur } from '@/lib/imgur';
import { scheduleBufferPost, inspectBufferPost, type UserTag } from '@/lib/buffer';
import { isKnownVenueHandle } from '@/lib/venue-instagram';

export async function POST(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  let body: {
    action?: string; image?: string; urls?: string[]; caption?: string; dueAt?: string;
    userTags?: UserTag[][]; altTexts?: string[]; postId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    if (body.action === 'upload') {
      if (!body.image) return NextResponse.json({ error: 'image required' }, { status: 400 });
      return NextResponse.json({ url: await uploadImageToImgur(body.image) });
    }
    if (body.action === 'schedule') {
      const urls = body.urls ?? [];
      if (urls.length < 2 || urls.length > 20) {
        return NextResponse.json({ error: 'a carousel needs 2–20 image urls (Buffer and Instagram allow 20)' }, { status: 400 });
      }
      if (!urls.every((u) => /^https:\/\/i\.imgur\.com\//.test(u))) {
        return NextResponse.json({ error: 'only i.imgur.com urls' }, { status: 400 });
      }
      if (!body.caption) return NextResponse.json({ error: 'caption required' }, { status: 400 });
      const due = body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? body.dueAt : undefined;
      if (!due || Date.parse(due) < Date.now()) {
        return NextResponse.json({ error: 'dueAt must be a future ISO time' }, { status: 400 });
      }
      const userTags = body.userTags;
      if (userTags !== undefined) {
        const bad = !Array.isArray(userTags) || userTags.length > urls.length || userTags.some((tags) =>
          !Array.isArray(tags) || tags.length > 20 || tags.some((t) =>
            typeof t?.handle !== 'string' || !isKnownVenueHandle(t.handle)
            || typeof t.x !== 'number' || typeof t.y !== 'number'
            || t.x < 0 || t.x > 1 || t.y < 0 || t.y > 1));
        if (bad) {
          return NextResponse.json({ error: 'userTags: one list per slide, handles from data/venue-instagram.json, x/y numbers in 0..1' }, { status: 400 });
        }
      }
      const cleanTags = userTags?.map((tags) => tags.map((t) => ({ handle: t.handle.replace(/^@/, ''), x: t.x, y: t.y })));
      const altTexts = Array.isArray(body.altTexts) ? body.altTexts.map((a) => String(a).slice(0, 1000)) : undefined;
      const post = await scheduleBufferPost(urls, body.caption, due, { userTags: cleanTags, altTexts });
      console.log(`[cron/instagram-carousel] scheduled ${post.id} (${urls.length} slides, due ${post.dueAt})`);
      return NextResponse.json({ success: true, buffer: post });
    }
    if (body.action === 'inspect') {
      if (!body.postId || !/^[A-Za-z0-9]{8,40}$/.test(body.postId)) {
        return NextResponse.json({ error: 'postId required' }, { status: 400 });
      }
      return NextResponse.json({ post: await inspectBufferPost(body.postId) });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cron/instagram-carousel]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
