const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!;
const PUB_ID = 'pub_8e15aa9e-4215-4fe3-b803-d991916b0dd9';
const BASE = 'https://api.beehiiv.com/v2';

export async function addSubscriber(email: string, lang: 'en' | 'pt' = 'en'): Promise<void> {
  const res = await fetch(`${BASE}/publications/${PUB_ID}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEEHIIV_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: false,
      utm_source: lang === 'pt' ? 'website-pt' : 'website',
      utm_medium: 'organic',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Beehiiv addSubscriber failed: ${res.status} ${body}`);
  }
}

export interface BeehiivSubscriber {
  id: string;
  email: string;
  status: string;
}

/**
 * Fetches active subscribers, optionally filtered by language.
 * - 'en' → utm_source=website (all existing + new EN subscribers)
 * - 'pt' → utm_source=website-pt
 * - undefined → all active subscribers (backwards compat)
 */
export async function getActiveSubscribers(lang?: 'en' | 'pt'): Promise<BeehiivSubscriber[]> {
  const subscribers: BeehiivSubscriber[] = [];
  let page = 1;
  const limit = 100;

  // Build query params
  const params = new URLSearchParams({ status: 'active', limit: String(limit) });
  if (lang === 'en') params.set('utm_source', 'website');
  if (lang === 'pt') params.set('utm_source', 'website-pt');

  while (true) {
    params.set('page', String(page));
    const res = await fetch(
      `${BASE}/publications/${PUB_ID}/subscriptions?${params}`,
      {
        headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Beehiiv getActiveSubscribers failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    const batch: BeehiivSubscriber[] = (data.data ?? []).map((s: BeehiivSubscriber) => ({
      id: s.id,
      email: s.email,
      status: s.status,
    }));

    subscribers.push(...batch);

    if (batch.length < limit) break;
    page++;
  }

  return subscribers;
}
