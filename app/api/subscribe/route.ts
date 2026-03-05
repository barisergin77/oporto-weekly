export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { addSubscriber } from '@/lib/beehiiv';
import { sendEmail } from '@/lib/resend-client';

const WELCOME_HTML = `
<!DOCTYPE html>
<html>
<body style="background:#1a1a2e;color:#ccd6f6;font-family:Georgia,serif;padding:2rem;max-width:600px;margin:auto;">
  <h1 style="color:#c9a96e;">Welcome to Oporto Weekly 🦁</h1>
  <p>You're now subscribed to the best weekly guide to Porto.</p>
  <p>Every Thursday morning, you'll get:</p>
  <ul>
    <li>🎵 Concerts & live music</li>
    <li>🎨 Art & exhibitions</li>
    <li>🥩 Food markets & wine events</li>
    <li>👨‍👩‍👧 Family activities</li>
    <li>🌙 Nightlife picks</li>
  </ul>
  <p>First issue lands this Thursday. See you then!</p>
  <p style="color:#8892b0;font-size:0.85rem;">© Oporto Weekly · Porto, Portugal</p>
</body>
</html>
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = body.email?.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Add to Beehiiv
    await addSubscriber(email);

    // Send welcome email via Resend
    await sendEmail(email, 'Welcome to Oporto Weekly 🦁', WELCOME_HTML);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[subscribe]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
