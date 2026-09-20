/**
 * GA4 visitor numbers via the Google Analytics Data API.
 *
 * Property 555124096 ("Oporto Weekly", account "Summer World"), measurement
 * id G-X24G8V6BZH, delivered through GTM container GTM-KZ9GGM8W. Collection
 * started 2026-09-20, so week-over-week comparisons only become meaningful
 * from ~2026-10-04; before that the previous window is legitimately zero.
 *
 * Auth reuses GOOGLE_SERVICE_ACCOUNT_JSON (the same service account as GSC),
 * granted Viewer on the property. The property id is not a secret, so it is a
 * constant with an env override rather than a required env var.
 */

import { getGoogleToken } from './search-engines';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID ?? '555124096';

export interface Ga4Traffic {
  users: number;
  sessions: number;
  pageViews: number;
  startDate: string;
  endDate: string;
}

/**
 * Site traffic for an inclusive YYYY-MM-DD window.
 *
 * Returns null when the service account isn't configured at all; throws on a
 * real API failure so the weekly report shows the error instead of silently
 * reporting zero visitors.
 */
export async function getGa4Traffic(startDate: string, endDate: string): Promise<Ga4Traffic | null> {
  const token = await getGoogleToken('https://www.googleapis.com/auth/analytics.readonly');
  if (!token) return null;

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
      }),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!res.ok) {
    throw new Error(`GA4 Data API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }

  const data = (await res.json()) as { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };
  // No rows at all = no traffic in the window (a new property), not an error.
  const v = data.rows?.[0]?.metricValues ?? [];
  const n = (i: number) => Number(v[i]?.value ?? 0) || 0;

  return { users: n(0), sessions: n(1), pageViews: n(2), startDate, endDate };
}
