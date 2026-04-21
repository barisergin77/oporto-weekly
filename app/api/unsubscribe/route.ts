export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { removeSubscriber } from '@/lib/audiences';

/**
 * One-click unsubscribe endpoint.
 * Supports both:
 * - GET /api/unsubscribe?email=x (link in email footer)
 * - POST /api/unsubscribe (RFC 8058 List-Unsubscribe-Post header)
 */

async function handleUnsubscribe(email: string | null) {
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    await removeSubscriber(email.trim().toLowerCase());
  } catch (err) {
    // Even if the audience update fails, show success to the user — don't leak internal errors
    console.error('[unsubscribe]', err);
  }

  // Return a simple confirmation page
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — Oporto Weekly</title></head>
<body style="background:#1a1a2e;color:#ccd6f6;font-family:Georgia,serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
  <div style="text-align:center;max-width:400px;padding:40px;">
    <h1 style="color:#c9a96e;font-size:28px;margin-bottom:16px;">You've been unsubscribed</h1>
    <p style="font-size:16px;line-height:1.6;color:#9999bb;">You won't receive any more emails from Oporto Weekly.</p>
    <p style="font-size:14px;color:#666899;margin-top:24px;">Changed your mind?</p>
    <a href="https://oportoweekly.com" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#c9a96e;color:#1a1a2e;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Re-subscribe</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// GET — clicked from email footer link
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  return handleUnsubscribe(email);
}

// POST — RFC 8058 one-click via List-Unsubscribe-Post header
export async function POST(req: NextRequest) {
  let email = req.nextUrl.searchParams.get('email');
  if (!email) {
    try {
      const body = await req.text();
      // RFC 8058 sends: List-Unsubscribe=One-Click
      // The email is in the URL params, not the body
      const params = new URLSearchParams(body);
      email = params.get('email') ?? params.get('List-Unsubscribe');
    } catch { /* ignore */ }
  }
  return handleUnsubscribe(email);
}
