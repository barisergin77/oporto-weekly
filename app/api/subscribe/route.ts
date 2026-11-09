export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { addSubscriber } from '@/lib/audiences';
import { sendEmail } from '@/lib/resend-client';
import { recordSignupSource, cleanSource } from '@/lib/signup-sources';
import { welcomeEmail } from '@/lib/welcome-email';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = body.email?.trim().toLowerCase();
    const lang: 'en' | 'pt' = body.lang === 'pt' ? 'pt' : 'en';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Add to the Resend Audience for this language
    await addSubscriber(email, lang);

    // Send welcome email in the right language, tagged so welcome-flow opens
    // don't pollute newsletter analytics on the Resend dashboard.
    const { subject, html } = welcomeEmail(lang);
    await sendEmail(email, subject, html, [
      { name: 'type', value: 'welcome' },
      { name: 'lang', value: lang },
    ]);

    // Attribution for the growth loop — after the subscription has succeeded,
    // and swallowed on failure, so it can never cost us a subscriber.
    await recordSignupSource({ lang, source: cleanSource(body.source) });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[subscribe]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
