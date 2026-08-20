/**
 * Subscriber count dashboard. Authenticated (Bearer CRON_SECRET) because
 * subscriber numbers are a private business metric.
 *
 * GET /api/subscribers
 *   Authorization: Bearer <CRON_SECRET>
 * →
 *   {
 *     "activeUniqueTotal": 123,
 *     "en": { "total": 90, "active": 85, "unsubscribed": 5 },
 *     "pt": { "total": 45, "active": 42, "unsubscribed": 3 }
 *   }
 *
 * Runs server-side with the production RESEND_API_KEY (which is stored as a
 * Sensitive Vercel env var — injected at runtime, not retrievable via the
 * CLI — so this endpoint is the only read path outside the Resend dashboard).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSubscriberStats } from '@/lib/audiences';
import { checkCronAuth } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const stats = await getSubscriberStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[api/subscribers]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export { GET as POST };
