import { NextRequest } from 'next/server';

/**
 * Verifies the request is coming from our trusted GitHub Actions cron caller
 * (or anyone we've shared the CRON_SECRET with).
 *
 * Expects: `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Returns null if authorized; returns an error message if not.
 */
export function checkCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If the secret isn't configured, fail closed in production but allow locally
    if (process.env.VERCEL_ENV === 'production') {
      return 'CRON_SECRET not configured';
    }
    return null;
  }

  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return 'Unauthorized';
  }

  return null;
}
