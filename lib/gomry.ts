/**
 * Gomry partnership (owner decision 2026-10-27; deal per Erick's recap,
 * 2026-10-20): 50% of Gomry's platform fee on tickets sold through our
 * links, and 20% of the platform fees of every organizer who signs up
 * through our referral link.
 *
 * data/gomry.json is Gomry's public Porto catalog (no credential:
 * GET https://www.gomry.com/api/v1/catalog/events), synced daily on the
 * server with the Fever sync (~/fever-sync). Our attribution is the `ref`
 * query parameter on any gomry.com URL.
 *
 * - gomryTicket(event): tracked link when one of our events is on Gomry.
 * - organizerCtaEligible(event): whether the "Organising this event?" box
 *   shows — independent organizers only, never institutions with their own
 *   ticketing (data/gomry-cta-exclude.json), Fever/Gomry-ticketed events,
 *   sports, long festivals, past events or big-ticketing links.
 * - FC Porto home matches are the only events created from Gomry
 *   (owner 2026-10-27, scripts/gomry-events.ts); never their dance classes
 *   or networking events.
 * Like Fever, these links are rendered rel="sponsored …" with the affiliate
 * note, and never used in Facebook-group posts (fb-groups.md).
 */

import gomryData from '../data/gomry.json';
import excludeData from '../data/gomry-cta-exclude.json';
import { type EventRecord, isRealEventUrl } from './events';
import { compareNames, isVagueVenue, nameTokens } from './event-identity';
import { canonicalVenueSlug, canonicalVenueSlugFor } from './venues';

export const GOMRY_REF = 'Pi2YQafpuFtB';
/** Organizer referral landing (Gomry home with our ref). */
export const GOMRY_ORGANIZER_URL = `https://www.gomry.com/?ref=${GOMRY_REF}`;

export const ORGANIZER_CTA = {
  en: 'Organising this event? Sell tickets online with Gomry: lower fees than the big platforms →',
  pt: 'Organiza este evento? Venda bilhetes online com o Gomry, com taxas mais baixas do que as grandes plataformas →',
};
export const ORGANIZER_FOOTER = {
  en: 'For organizers: sell tickets with Gomry',
  pt: 'Para organizadores: venda bilhetes com o Gomry',
};

export interface GomryItem {
  id: string;
  name: string;
  /** gomry.com/event/… without utm parameters and without our ref. */
  url: string;
  /** ISO UTC. */
  start: string;
  end: string | null;
  venue: string;
  city: string;
  priceFrom: number | null;
  currency: string | null;
  isFree: boolean;
  availability: string;
  organization: string;
  categories: string[];
}

export const GOMRY_ITEMS: GomryItem[] = (gomryData as { items: GomryItem[] }).items ?? [];
const EXCLUDED_VENUES = new Set<string>((excludeData as { venues: string[] }).venues);

/** Any gomry.com URL with our ref (utm parameters dropped). */
export function gomryTracked(url: string): string {
  const u = new URL(url);
  [...Array.from(u.searchParams.keys())].forEach((k) => { if (k.startsWith('utm_')) u.searchParams.delete(k); });
  u.searchParams.set('ref', GOMRY_REF);
  return u.toString();
}

/** Gomry event id from a gomry.com/event/<Name-Slug-ID> URL, else null. */
export function gomryEventId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)gomry\.com$/i.test(u.hostname)) return null;
    const m = /^\/event\/(?:.*-)?([A-Za-z0-9]{16,})\/?$/.exec(u.pathname);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

const day = (iso: string) => iso.slice(0, 10);
/** Lisbon calendar day / "YYYY-MM-DDTHH:MM" of a UTC instant. */
export function lisbonLocal(utc: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

type Matchable = Pick<EventRecord, 'name' | 'venue' | 'date'> &
  Partial<Pick<EventRecord, 'venueSlug' | 'endDate' | 'externalLink' | 'gomryId'>>;

/** The Gomry listing for one of our events: by id/URL, else venue + Lisbon date + similar name. */
export function matchGomry(ev: Matchable, items: GomryItem[] = GOMRY_ITEMS): GomryItem | null {
  const id = ev.gomryId ?? gomryEventId(ev.externalLink);
  if (id) {
    const byId = items.find((i) => i.id === id);
    if (byId) return byId;
  }
  const venue = canonicalVenueSlug(ev.venueSlug) ?? canonicalVenueSlugFor(ev.venue);
  const date = day(ev.date);
  for (const i of items) {
    if (canonicalVenueSlugFor(i.venue) !== venue) continue;
    if (day(lisbonLocal(i.start)) !== date) continue;
    const m = compareNames(nameTokens(ev.name, venue), nameTokens(i.name, venue));
    if (m === 'equal' || m === 'similar' || m === 'contained') return i;
  }
  return null;
}

/** Tracked Gomry ticket link for an event, or null. */
export function gomryTicket(ev: Matchable, items: GomryItem[] = GOMRY_ITEMS): string | null {
  const item = matchGomry(ev, items);
  if (item) return gomryTracked(item.url);
  // A gomry.com event link we already hold but the Porto sync didn't list.
  if (gomryEventId(ev.externalLink)) return gomryTracked(ev.externalLink!);
  return null;
}

/** Ticketing sites big enough that the organizer already sells online. */
const BIG_TICKETING = /(^|\.)(ticketline\.pt|ticketline\.sapo\.pt|blueticket\.pt|blueticket\.meo\.pt|bol\.pt|seetickets\.com|eventbrite\.[a-z.]+|feverup\.com|fever\.pxf\.io|livenation\.[a-z.]+|ticketmaster\.[a-z.]+|dice\.fm|gomry\.com|xistickets\.com|imperdivel\.pt)$/i;

type CtaEvent = Pick<EventRecord, 'name' | 'venue' | 'date' | 'category'> &
  Partial<Pick<EventRecord, 'venueSlug' | 'endDate' | 'externalLink' | 'feverId' | 'gomryId'>>;

/**
 * "Organising this event?" box: only for independent organizers' upcoming
 * events that have no affiliate ticket link (`hasAffiliateTicket`).
 */
export function organizerCtaEligible(ev: CtaEvent, hasAffiliateTicket: boolean, today = new Date().toISOString().slice(0, 10)): boolean {
  if (hasAffiliateTicket || ev.feverId || ev.gomryId) return false;
  if (ev.category === 'sports') return false;
  if (day(ev.endDate ?? ev.date) < today) return false;
  const span = ev.endDate ? (Date.parse(day(ev.endDate)) - Date.parse(day(ev.date))) / 86_400_000 : 0;
  if (span > 3) return false;
  const venue = canonicalVenueSlug(ev.venueSlug) ?? canonicalVenueSlugFor(ev.venue);
  if (EXCLUDED_VENUES.has(venue) || isVagueVenue(venue)) return false;
  if (isRealEventUrl(ev.externalLink)) {
    try {
      if (BIG_TICKETING.test(new URL(ev.externalLink).hostname)) return false;
    } catch { /* unparseable link: ignore */ }
  }
  return true;
}

/** FC Porto home league/cup matches at the Dragão (not "Date TBD", not away games). */
export function isPortoHomeMatch(i: GomryItem): boolean {
  return /^(fc\s+)?porto\s+vs\.?\s+/i.test(i.name) && !/\bTBD\b|to be (confirmed|decided)/i.test(i.name) &&
    canonicalVenueSlugFor(i.venue) === 'estadio-do-dragao';
}

export const isGomryEvent = (e: Pick<EventRecord, 'gomryId'>) => Boolean(e.gomryId);
