/**
 * Fever affiliate links (owner decision 2026-10-27: Fever affiliate via
 * Impact, "go for all 5").
 *
 * data/fever.json is Fever's Porto catalog, synced daily on the server
 * (~/fever-sync, Impact API, read-only). Each item carries a tracked
 * fever.pxf.io link and a commission tier:
 *   Tier 1 general experiences · Tier 2 Candlelight · Tier 3 limited ·
 *   Tier 4 NON-commissionable (third-party concerts Fever only resells).
 *
 * ticketLink(event) returns the tracked link only for tiers 1–3; Tier 4 and
 * unmatched events keep their normal externalLink. Tracked links must be
 * rendered with rel="sponsored nofollow noopener" and the AFFILIATE_NOTE.
 * Never use these links in Facebook-group posts (fb-groups.md).
 */

import feverData from '../data/fever.json';
import { type EventRecord, isRealEventUrl } from './events';
import { compareNames, nameTokens } from './event-identity';
import { canonicalVenueSlug, canonicalVenueSlugFor } from './venues';

export interface FeverItem {
  id: string;
  name: string;
  /** Tracked fever.pxf.io link. */
  url: string;
  /** Plain feverup.com/m/<id> page. */
  feverUrl: string;
  venue: string;
  city?: string;
  /** "YYYY-MM-DDTHH:MM", upcoming only (≤ ~4 months, capped). */
  sessions: string[];
  sessionCount?: number;
  price: number | null;
  currency: string;
  image: string | null;
  tier: number;
  commissionable: boolean;
  subCategory: string;
  lat?: number | null;
  lng?: number | null;
}

export const FEVER_ITEMS: FeverItem[] = (feverData as { items: FeverItem[] }).items ?? [];

/** Campaign deep link for a feverup.com page that isn't in the catalog. */
const DEEPLINK_BASE = 'https://fever.pxf.io/c/8040588/1356939/16345';

export const AFFILIATE_NOTE = {
  en: 'Affiliate link: we may earn a small commission at no extra cost to you.',
  pt: 'Link de afiliado: podemos receber uma pequena comissão, sem custo extra para si.',
};
export const SPONSORED_REL = 'sponsored nofollow noopener';

/** Fever plan id from a feverup.com URL (/m/<id>), else null. */
export function feverPlanId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)feverup\.com$/i.test(u.hostname)) return null;
    return /\/m\/(\d+)/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export const isGiftCard = (name: string) => /cart[ãa]o[- ](oferta|presente)|gift ?card|vale[- ]presente/i.test(name);

const day = (iso: string) => iso.slice(0, 10);

type Matchable = Pick<EventRecord, 'name' | 'venue' | 'date'> & Partial<Pick<EventRecord, 'venueSlug' | 'endDate' | 'externalLink'>> & { feverId?: string };

/**
 * The catalog item for one of our events: by Fever plan id (feverId or a
 * feverup.com externalLink), else same canonical venue + a session on the
 * event's date + similar name.
 */
export function matchFever(ev: Matchable, items: FeverItem[] = FEVER_ITEMS): FeverItem | null {
  const id = ev.feverId ?? feverPlanId(ev.externalLink);
  if (id) {
    const byId = items.find((i) => i.id === id);
    if (byId) return byId;
  }
  const venue = canonicalVenueSlug(ev.venueSlug) ?? canonicalVenueSlugFor(ev.venue);
  const date = day(ev.date);
  for (const i of items) {
    if (canonicalVenueSlugFor(i.venue) !== venue) continue;
    if (!i.sessions.some((s) => day(s) === date)) continue;
    const m = compareNames(nameTokens(ev.name, venue), nameTokens(i.name, venue));
    if (m === 'equal' || m === 'similar' || m === 'contained') return i;
  }
  return null;
}

export interface TicketLink {
  href: string;
  affiliate: boolean;
}

/**
 * The "Get tickets" link for an event: Fever's tracked link when the event is
 * a commissionable (tier 1–3) catalog item; a campaign deep link for a
 * feverup.com page that isn't in the catalog; otherwise the plain
 * externalLink (or null).
 */
export function ticketLink(ev: Matchable, items: FeverItem[] = FEVER_ITEMS): TicketLink | null {
  const item = matchFever(ev, items);
  if (item?.commissionable) return { href: item.url, affiliate: true };
  const plain = isRealEventUrl(ev.externalLink) ? ev.externalLink : null;
  if (!item && plain && feverPlanId(plain)) {
    return { href: `${DEEPLINK_BASE}?u=${encodeURIComponent(plain)}`, affiliate: true };
  }
  return plain ? { href: plain, affiliate: false } : null;
}

/** Fever-sourced events allowed per weekly edition (owner: "max 1–2"). */
export const MAX_FEVER_PER_EDITION = 2;
export const isFeverEvent = (e: Pick<EventRecord, 'feverId'>) => Boolean(e.feverId);

/**
 * Catalog items that are real dated events (Candlelight, Jazz Room, theatre
 * shows, one-off parties and fests), not ongoing attractions or tours:
 * tier 1–3, no gift cards, few sessions, not a tour/cruise/game/pub crawl.
 */
const NOT_AN_EVENT = /cruise|cruzeiro|boat|barco|tour|visita|passeio|game|jogo|escape|pub crawl|admission|bilhete de entrada|ingresso|menú|menu/i;
const NOT_AN_EVENT_SUB = /gift cards|cruises|city tours|tourism|games/i;
export const MAX_EVENT_SESSIONS = 8;

export function isEventLike(i: FeverItem): boolean {
  return i.commissionable && !isGiftCard(i.name) && !NOT_AN_EVENT.test(i.name) && !NOT_AN_EVENT_SUB.test(i.subCategory) &&
    (i.sessionCount ?? i.sessions.length) > 0 && (i.sessionCount ?? i.sessions.length) <= MAX_EVENT_SESSIONS;
}

export interface FeverOccurrence {
  /** `${id}@${YYYY-MM-DD}` */
  key: string;
  item: FeverItem;
  /** First session that day, "YYYY-MM-DDTHH:MM". */
  date: string;
  /** All session times that day ("19:30", "22:00"). */
  times: string[];
}

/** One occurrence per (event-like item, day) between `from` and `to` (inclusive, YYYY-MM-DD). */
export function feverOccurrences(from: string, to: string, items: FeverItem[] = FEVER_ITEMS): FeverOccurrence[] {
  const out: FeverOccurrence[] = [];
  for (const item of items.filter(isEventLike)) {
    const byDay = new Map<string, string[]>();
    for (const s of item.sessions) {
      const d = day(s);
      if (d < from || d > to) continue;
      byDay.set(d, [...(byDay.get(d) ?? []), s]);
    }
    byDay.forEach((ss, d) => {
      ss.sort();
      out.push({ key: `${item.id}@${d}`, item, date: ss[0], times: ss.map((s) => s.slice(11, 16)) });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.item.name.localeCompare(b.item.name));
}
