export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { removeSubscriber } from '@/lib/audiences';

/**
 * Unsubscribe endpoint.
 *
 * - GET  /api/unsubscribe?email=x — shows a CONFIRMATION page with a
 *   button. Does NOT mutate. (Until 2026-06-12 the GET itself
 *   unsubscribed — which meant any link-prefetching mail client,
 *   security scanner, or crawler that followed the footer link silently
 *   unsubscribed the person without a click.)
 * - POST /api/unsubscribe?email=x — performs the unsubscribe. Used by
 *   the confirmation button AND by RFC 8058 one-click
 *   (List-Unsubscribe-Post header), which mail clients send as POST.
 */

const PAGE_STYLE = `background:#1a1a2e;color:#ccd6f6;font-family:Georgia,serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;`;

function page(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — Oporto Weekly</title></head>
<body style="${PAGE_STYLE}">
  <div style="text-align:center;max-width:420px;padding:40px;">${inner}</div>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html' } });
}

function invalidPage() {
  return htmlResponse(
    page('Invalid link', `
    <h1 style="color:#c9a96e;font-size:28px;margin-bottom:16px;">Invalid unsubscribe link</h1>
    <p style="font-size:16px;line-height:1.6;color:#9999bb;">This link is missing its email address. Please use the unsubscribe link from one of our emails, or contact hello@oportoweekly.com.</p>`),
    400
  );
}

// GET — show confirmation. NO state change.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email || !email.includes('@')) return invalidPage();

  const action = `/api/unsubscribe?email=${encodeURIComponent(email.trim().toLowerCase())}`;
  return htmlResponse(
    page('Unsubscribe', `
    <h1 style="color:#c9a96e;font-size:28px;margin-bottom:16px;">Unsubscribe from Oporto Weekly?</h1>
    <p style="font-size:16px;line-height:1.6;color:#9999bb;">You'll stop receiving the weekly Porto events newsletter at<br><strong style="color:#ccd6f6;">${email.replace(/</g, '&lt;')}</strong></p>
    <p style="font-size:13px;color:#666899;margin-top:8px;">Deixará de receber a newsletter semanal.</p>
    <form method="POST" action="${action}" style="margin-top:24px;">
      <button type="submit" style="padding:12px 28px;background:#c9a96e;color:#1a1a2e;border:none;border-radius:6px;font-weight:700;font-size:14px;font-family:Georgia,serif;cursor:pointer;">Yes, unsubscribe me</button>
    </form>
    <a href="https://oportoweekly.com" style="display:inline-block;margin-top:16px;color:#666899;font-size:13px;">Never mind — keep my subscription</a>`)
  );
}

// POST — perform the unsubscribe. Confirmation button + RFC 8058 one-click.
export async function POST(req: NextRequest) {
  let email = req.nextUrl.searchParams.get('email');
  if (!email) {
    try {
      const body = await req.text();
      // RFC 8058 sends body "List-Unsubscribe=One-Click"; email is in URL
      // params normally, but tolerate it in the body too.
      const params = new URLSearchParams(body);
      email = params.get('email');
    } catch { /* ignore */ }
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    await removeSubscriber(email.trim().toLowerCase());
  } catch (err) {
    // Even if the audience update fails, show success to the user — don't leak internal errors
    console.error('[unsubscribe]', err);
  }

  return htmlResponse(
    page('Unsubscribed', `
    <h1 style="color:#c9a96e;font-size:28px;margin-bottom:16px;">You've been unsubscribed</h1>
    <p style="font-size:16px;line-height:1.6;color:#9999bb;">You won't receive any more emails from Oporto Weekly.</p>
    <p style="font-size:14px;color:#666899;margin-top:24px;">Changed your mind?</p>
    <a href="https://oportoweekly.com" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#c9a96e;color:#1a1a2e;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Re-subscribe</a>`)
  );
}
