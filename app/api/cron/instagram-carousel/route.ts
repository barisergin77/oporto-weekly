export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly Instagram carousel (owner 2026-10-27), replacing the single-image roundup.
 * The slides are rendered on the ops server (~/oporto-carousel) and sent here because the
 * Imgur and Buffer credentials live in this project's env. Two actions, so no request
 * carries more than one image:
 *   { action: 'upload', image: '<base64 jpeg>' }                → { url }
 *   { action: 'schedule', urls: [...], caption, dueAt }          → Buffer post
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { uploadImageToImgur } from '@/lib/imgur';
import { scheduleBufferPost } from '@/lib/buffer';

export async function POST(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  let body: { action?: string; image?: string; urls?: string[]; caption?: string; dueAt?: string };
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
      if (urls.length < 2 || urls.length > 10) {
        return NextResponse.json({ error: 'a carousel needs 2–10 image urls' }, { status: 400 });
      }
      if (!urls.every((u) => /^https:\/\/i\.imgur\.com\//.test(u))) {
        return NextResponse.json({ error: 'only i.imgur.com urls' }, { status: 400 });
      }
      if (!body.caption) return NextResponse.json({ error: 'caption required' }, { status: 400 });
      const due = body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? body.dueAt : undefined;
      if (!due || Date.parse(due) < Date.now()) {
        return NextResponse.json({ error: 'dueAt must be a future ISO time' }, { status: 400 });
      }
      const post = await scheduleBufferPost(urls, body.caption, due);
      console.log(`[cron/instagram-carousel] scheduled ${post.id} (${urls.length} slides, due ${post.dueAt})`);
      return NextResponse.json({ success: true, buffer: post });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cron/instagram-carousel]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
