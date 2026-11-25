/**
 * Newsletter delivery: Resend Broadcasts first, batch API as fallback.
 *
 * Why (2026-11-25): the Resend free plan caps TRANSACTIONAL sends
 * (/emails, /emails/batch) at 100/day and 3,000/month. With ~100 active
 * subscribers the Thursday batch send was hitting the daily cap.
 * Broadcasts are "marketing" email: they don't count toward the
 * transactional quota (free tier = up to 1,000 contacts, unlimited
 * sends), Resend skips unsubscribed contacts itself, and it adds the
 * List-Unsubscribe headers.
 *
 * Unsubscribe: the footer link becomes {{{RESEND_UNSUBSCRIBE_URL}}}.
 * Resend's page flips the contact to `unsubscribed: true` in the audience,
 * the same state our own /api/unsubscribe sets (removeSubscriber), so
 * subscriber counts (getSubscriberStats) keep working for both paths.
 *
 * Idempotency: the caller's run-ledger claim still guards against double
 * sends. On top of that, each broadcast is named `newsletter-<slug>-<lang>`;
 * if one with that name was already queued/sent we refuse to send again.
 *
 * Fallback rules:
 *   - Broadcast create fails, or the send call fails AND the broadcast is
 *     still a draft → nothing went out → fall back to sendBatch.
 *   - Send call errored but Resend shows the broadcast queued/sending/sent
 *     → it IS going out → throw BroadcastInFlightError (caller keeps its
 *     claim, never falls back — a fallback would double-send).
 *
 * Kill switch: NEWSLETTER_VIA_BROADCAST=false forces the batch path.
 */

import { sendBatch, type ResendTag } from './resend-client';
import { getActiveSubscribers, type Lang } from './audiences';

const API = 'https://api.resend.com';
const FROM = 'Oporto Weekly <hello@oportoweekly.com>';

export class BroadcastInFlightError extends Error {
  constructor(public readonly broadcastId: string, cause: string) {
    super(`Broadcast ${broadcastId} is queued/sent but the send call reported an error — NOT falling back (would double-send): ${cause}`);
    this.name = 'BroadcastInFlightError';
  }
}

async function rs<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(`Resend ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json as T;
}

function audienceId(lang: Lang): string {
  const id = lang === 'pt' ? process.env.RESEND_AUDIENCE_PT : process.env.RESEND_AUDIENCE_EN;
  if (!id) throw new Error(`Missing RESEND_AUDIENCE_${lang.toUpperCase()}`);
  return id;
}

export function broadcastName(slug: string, lang: Lang): string {
  return `newsletter-${slug}-${lang}`;
}

/**
 * Add UTM params to oportoweekly.com links (send-time only — the archived
 * HTML on the site stays clean). Skips /api/ links, mailto, and links that
 * already carry utm_ params.
 */
export function addUtm(html: string, campaign: string): string {
  return html.replace(/href="(https:\/\/(?:www\.)?oportoweekly\.com[^"]*)"/g, (m, url: string) => {
    if (/[?&]utm_/.test(url) || url.includes('/api/')) return m;
    const [base, hash] = url.split('#');
    const sep = base.includes('?') ? '&amp;' : '?';
    const q = `utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=${encodeURIComponent(campaign)}`;
    return `href="${base}${sep}${q}${hash ? '#' + hash : ''}"`;
  });
}

/** Footer unsubscribe → Resend's per-contact unsubscribe URL. */
export function toBroadcastHtml(html: string): string {
  return html
    .replace(/https:\/\/oportoweekly\.com\/api\/unsubscribe\?email=SUBSCRIBER_EMAIL/g, '{{{RESEND_UNSUBSCRIBE_URL}}}')
    .replace(/SUBSCRIBER_EMAIL/g, '{{{EMAIL}}}');
}

type Broadcast = { id: string; name?: string | null; status?: string; audience_id?: string; created_at?: string; sent_at?: string | null };

export async function listBroadcasts(): Promise<Broadcast[]> {
  const res = await rs<{ data: Broadcast[] }>('GET', '/broadcasts');
  return res?.data ?? [];
}

export async function findBroadcast(slug: string, lang: Lang): Promise<Broadcast | undefined> {
  const name = broadcastName(slug, lang);
  return (await listBroadcasts()).find(b => b.name === name);
}

const IN_FLIGHT = new Set(['queued', 'sending', 'sent', 'scheduled']);

/** Create + send one broadcast. Returns its id. */
export async function sendBroadcast(opts: {
  audienceId: string; name: string; subject: string; html: string;
}): Promise<string> {
  const created = await rs<{ id: string }>('POST', '/broadcasts', {
    audience_id: opts.audienceId,
    from: FROM,
    reply_to: 'hello@oportoweekly.com',
    subject: opts.subject,
    html: opts.html,
    name: opts.name,
  });
  const id = created.id;
  try {
    await rs('POST', `/broadcasts/${id}/send`, {});
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    let status = 'unknown';
    try { status = (await rs<Broadcast>('GET', `/broadcasts/${id}`)).status ?? 'unknown'; } catch { /* keep unknown */ }
    if (IN_FLIGHT.has(status) || status === 'unknown') throw new BroadcastInFlightError(id, `${cause} (status=${status})`);
    // Still a draft: nothing went out. Remove the draft so a retry can recreate it.
    try { await rs('DELETE', `/broadcasts/${id}`); } catch { /* best effort */ }
    throw new Error(`Broadcast send failed while still draft: ${cause}`);
  }
  return id;
}

export interface DeliveryResult { via: 'broadcast' | 'batch'; count: number; broadcastId?: string; fallbackReason?: string }

/**
 * Deliver one newsletter edition to one language audience.
 * `html` is the final email HTML (forward/game blocks already applied),
 * still containing the SUBSCRIBER_EMAIL placeholder unsubscribe link.
 */
export async function deliverNewsletter(opts: {
  lang: Lang; slug: string; subject: string; html: string; tags?: ResendTag[];
}): Promise<DeliveryResult> {
  const { lang, slug, subject, tags } = opts;
  const html = addUtm(opts.html, `${slug}-${lang}`);
  const active = await getActiveSubscribers(lang);
  if (active.length === 0) return { via: 'batch', count: 0 };

  let fallbackReason: string | undefined;
  if (process.env.NEWSLETTER_VIA_BROADCAST !== 'false') {
    try {
      const existing = await findBroadcast(slug, lang);
      if (existing && IN_FLIGHT.has(existing.status ?? '')) {
        throw new BroadcastInFlightError(existing.id, `broadcast ${existing.name} already ${existing.status}`);
      }
      if (existing) { try { await rs('DELETE', `/broadcasts/${existing.id}`); } catch { /* stale draft */ } }
      const id = await sendBroadcast({
        audienceId: audienceId(lang),
        name: broadcastName(slug, lang),
        subject,
        html: toBroadcastHtml(html),
      });
      console.log(`[newsletter-delivery] ${lang} broadcast ${id} sent to audience (~${active.length} active)`);
      return { via: 'broadcast', count: active.length, broadcastId: id };
    } catch (e) {
      if (e instanceof BroadcastInFlightError) throw e;
      fallbackReason = e instanceof Error ? e.message : String(e);
      console.error(`[newsletter-delivery] ${lang} broadcast failed, falling back to batch:`, fallbackReason);
    }
  }
  const sent = await sendBatch(active.map(s => s.email), subject, html, tags);
  return { via: 'batch', count: sent, fallbackReason: fallbackReason ?? 'NEWSLETTER_VIA_BROADCAST=false' };
}
