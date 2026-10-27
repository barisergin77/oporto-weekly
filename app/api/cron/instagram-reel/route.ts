export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly "Digital Baris" Instagram Reel (owner 2026-10-27, 1-month trial). The video is
 * rendered on the ops server (~/oporto-reel, HeyGen) and sent here because the Imgur and
 * Buffer credentials live in this project's env. Buffer fetches media at publish time, so
 * the HeyGen presigned URL (expires) is re-hosted on Imgur first:
 *   { action: 'upload_video', videoUrl: 'https://files*.heygen.ai/...mp4' }  → { url }
 *   { action: 'schedule', url: 'https://i.imgur.com/....mp4', caption, dueAt } → Buffer reel
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { uploadVideoToImgur } from '@/lib/imgur';
import { scheduleBufferReel } from '@/lib/buffer';

const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  let body: { action?: string; videoUrl?: string; url?: string; caption?: string; dueAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    if (body.action === 'upload_video') {
      let host = '';
      try {
        const u = new URL(body.videoUrl ?? '');
        host = u.protocol === 'https:' ? u.hostname : '';
      } catch { /* invalid url */ }
      if (!/(^|\.)heygen\.(ai|com)$/.test(host)) {
        return NextResponse.json({ error: 'videoUrl must be an https HeyGen file url' }, { status: 400 });
      }
      const res = await fetch(body.videoUrl!, { cache: 'no-store' });
      if (!res.ok) return NextResponse.json({ error: `video fetch failed: HTTP ${res.status}` }, { status: 502 });
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: `video too large (${buf.byteLength} bytes)` }, { status: 400 });
      }
      return NextResponse.json({ url: await uploadVideoToImgur(buf), bytes: buf.byteLength });
    }
    if (body.action === 'schedule') {
      if (!/^https:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.mp4$/.test(body.url ?? '')) {
        return NextResponse.json({ error: 'url must be an i.imgur.com .mp4' }, { status: 400 });
      }
      if (!body.caption) return NextResponse.json({ error: 'caption required' }, { status: 400 });
      const due = body.dueAt && !Number.isNaN(Date.parse(body.dueAt)) ? body.dueAt : undefined;
      if (!due || Date.parse(due) < Date.now()) {
        return NextResponse.json({ error: 'dueAt must be a future ISO time' }, { status: 400 });
      }
      const post = await scheduleBufferReel(body.url!, body.caption, due);
      console.log(`[cron/instagram-reel] scheduled ${post.id} (due ${post.dueAt})`);
      return NextResponse.json({ success: true, buffer: post });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[cron/instagram-reel]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
