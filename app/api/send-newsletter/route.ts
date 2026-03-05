export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveSubscribers } from '@/lib/beehiiv';
import { sendBatch } from '@/lib/resend-client';

export async function POST(req: NextRequest) {
  // Auth check
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.NEWSLETTER_SECRET}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { html, subject } = body as { html: string; subject: string };

    if (!html || !subject) {
      return NextResponse.json({ error: 'Missing html or subject' }, { status: 400 });
    }

    // Fetch active subscribers from Beehiiv
    const subscribers = await getActiveSubscribers();
    const emails = subscribers.map(s => s.email);

    // Send via Resend batch
    const sent = await sendBatch(emails, subject, html);

    return NextResponse.json({ success: true, sent });
  } catch (err: unknown) {
    console.error('[send-newsletter]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
