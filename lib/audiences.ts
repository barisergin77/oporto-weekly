/**
 * Subscriber storage backed by Resend Audiences.
 *
 * Replaces lib/beehiiv.ts. Same three public functions so callers don't care:
 *   addSubscriber(email, lang)
 *   removeSubscriber(email)
 *   getActiveSubscribers(lang?)
 *
 * Architecture:
 *   - One Resend audience per language: RESEND_AUDIENCE_EN, RESEND_AUDIENCE_PT.
 *   - "Active" = `unsubscribed === false` in the audience.
 *   - Unsubscribe flips the flag rather than deleting, so we preserve intent
 *     if the same email re-subscribes later.
 *
 * Required env vars:
 *   RESEND_API_KEY        — same key already used for sending
 *   RESEND_AUDIENCE_EN    — id of the EN audience (from the migration script)
 *   RESEND_AUDIENCE_PT    — id of the PT audience
 *
 * Note on the Resend SDK (v3.x): `contacts.update` takes an `id`, not an
 * email, so we have to resolve email → id by listing the audience first.
 * Listing is paginated on Resend's side but currently returns the full list
 * for audiences we care about (<1k contacts). Revisit if the list grows.
 */

import { Resend } from 'resend';

export type Lang = 'en' | 'pt';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function audienceId(lang: Lang): string {
  const id = lang === 'pt'
    ? process.env.RESEND_AUDIENCE_PT
    : process.env.RESEND_AUDIENCE_EN;
  if (!id) {
    throw new Error(
      `Missing audience id env var: RESEND_AUDIENCE_${lang.toUpperCase()}. ` +
      `Run \`npm run migrate-subs setup\` once to create audiences.`
    );
  }
  return id;
}

async function findContactId(aud: string, email: string): Promise<string | null> {
  const res = await getResend().contacts.list({ audienceId: aud });
  if (res.error) {
    throw new Error(`Resend contacts.list failed: ${JSON.stringify(res.error)}`);
  }
  const target = email.trim().toLowerCase();
  const found = (res.data?.data ?? []).find(c => c.email.toLowerCase() === target);
  return found?.id ?? null;
}

// ---------------------------------------------------------------------------
// addSubscriber — idempotent. If the contact already exists in the audience
// (e.g. re-subscribing after opting out), flip `unsubscribed: false`.
// ---------------------------------------------------------------------------
export async function addSubscriber(email: string, lang: Lang = 'en'): Promise<void> {
  const resend = getResend();
  const aud = audienceId(lang);
  const normalized = email.trim().toLowerCase();

  const created = await resend.contacts.create({
    email: normalized,
    unsubscribed: false,
    audienceId: aud,
  });

  if (!created.error) return;

  // Most common error: contact already exists. Fall back to an update so a
  // re-subscription clears a prior `unsubscribed: true` flag.
  const msg = (created.error.message ?? '').toLowerCase();
  const alreadyExists = msg.includes('already') || msg.includes('exist') || msg.includes('duplicate');
  if (!alreadyExists) {
    throw new Error(`Resend contacts.create failed: ${JSON.stringify(created.error)}`);
  }

  const id = await findContactId(aud, normalized);
  if (!id) {
    // Resend said "exists" but we can't find them — treat as success and move on.
    return;
  }
  const updated = await resend.contacts.update({
    id,
    audienceId: aud,
    unsubscribed: false,
  });
  if (updated.error) {
    throw new Error(`Resend contacts.update failed: ${JSON.stringify(updated.error)}`);
  }
}

// ---------------------------------------------------------------------------
// removeSubscriber — flips `unsubscribed: true` in BOTH audiences. The email
// might be in either (or both, if someone subscribed to both languages).
// Missing from an audience is not an error.
// ---------------------------------------------------------------------------
export async function removeSubscriber(email: string): Promise<void> {
  const resend = getResend();
  const normalized = email.trim().toLowerCase();

  const results = await Promise.allSettled((['en', 'pt'] as Lang[]).map(async lang => {
    const aud = audienceId(lang);
    const id = await findContactId(aud, normalized);
    if (!id) return 'skipped' as const;

    const res = await resend.contacts.update({
      id,
      audienceId: aud,
      unsubscribed: true,
    });
    if (res.error) {
      throw new Error(`Resend contacts.update (${lang}) failed: ${JSON.stringify(res.error)}`);
    }
    return 'ok' as const;
  }));

  // If both calls hard-errored, surface it. One "skipped" + one "ok" is fine.
  const hardErrors = results.filter(r => r.status === 'rejected');
  if (hardErrors.length === results.length) {
    throw new Error(
      `Resend unsubscribe failed in all audiences: ` +
      hardErrors.map(r => (r as PromiseRejectedResult).reason).join('; ')
    );
  }
}

// ---------------------------------------------------------------------------
// getActiveSubscribers — returns contacts with `unsubscribed === false`.
// Shape-compat with the old BeehiivSubscriber.
// ---------------------------------------------------------------------------
export interface Subscriber {
  id: string;
  email: string;
  status: 'active';
  utm_source?: string; // preserved for shape-compat; callers read .email
}

// ---------------------------------------------------------------------------
// getSubscriberStats — per-audience counts for the dashboard. Returns total,
// active (unsubscribed===false), and unsubscribed for EN and PT, plus a
// deduped active total across both (someone subscribed to both counts once).
// ---------------------------------------------------------------------------
export interface AudienceStats { total: number; active: number; unsubscribed: number }
export interface SubscriberStats {
  en: AudienceStats;
  pt: AudienceStats;
  activeUniqueTotal: number;
}

export async function getSubscriberStats(): Promise<SubscriberStats> {
  const resend = getResend();
  const activeEmails = new Set<string>();
  const per = async (lang: Lang): Promise<AudienceStats> => {
    const res = await resend.contacts.list({ audienceId: audienceId(lang) });
    if (res.error) throw new Error(`Resend contacts.list (${lang}) failed: ${JSON.stringify(res.error)}`);
    const contacts = res.data?.data ?? [];
    let active = 0, unsub = 0;
    for (const c of contacts) {
      if (c.unsubscribed) { unsub++; continue; }
      active++;
      activeEmails.add(c.email.toLowerCase());
    }
    return { total: contacts.length, active, unsubscribed: unsub };
  };
  const en = await per('en');
  const pt = await per('pt');
  return { en, pt, activeUniqueTotal: activeEmails.size };
}

export async function getActiveSubscribers(lang?: Lang): Promise<Subscriber[]> {
  const resend = getResend();
  const langs: Lang[] = lang ? [lang] : ['en', 'pt'];

  const byEmail = new Map<string, Subscriber>(); // dedupe across audiences

  for (const l of langs) {
    const aud = audienceId(l);
    const res = await resend.contacts.list({ audienceId: aud });
    if (res.error) {
      throw new Error(`Resend contacts.list (${l}) failed: ${JSON.stringify(res.error)}`);
    }
    const contacts = res.data?.data ?? [];
    for (const c of contacts) {
      if (c.unsubscribed) continue;
      const email = c.email.toLowerCase();
      if (byEmail.has(email)) continue;
      byEmail.set(email, {
        id: c.id,
        email,
        status: 'active',
        utm_source: l === 'pt' ? 'website-pt' : 'website',
      });
    }
  }

  return Array.from(byEmail.values());
}
