/**
 * "Is this the same event?" — shared by the extraction pipeline
 * (findExistingEventByIdentity), the forward scan and
 * scripts/find-duplicates.ts.
 *
 * Owner report 2026-10-25: "Jenny Holzer: Wrong Answers" (Serralves Museum)
 * and "\"Wrong Answers\" Exhibition" (Museo de Arte Contemporáneo de
 * Serralves) were two records, as were two "Porto Contemporary Art
 * Exhibition" entries under different placeholder venues. Exact
 * (name, venue) identity can't see either.
 *
 * Deliberately conservative — a false merge hides a real event:
 *   - dates must overlap (±1 day), so a weekly residency on different
 *     dates is never "the same event";
 *   - the venue must be the same canonical venue, except when one side is a
 *     placeholder ("Various Galleries") — then the names must match exactly
 *     after normalisation;
 *   - a name contained in another ("Wrong Answers" ⊂ "Jenny Holzer: Wrong
 *     Answers") only counts when both are multi-day runs, so a festival
 *     night ("Porto Jazz Festival: X", one day) is never folded into the
 *     festival itself.
 *
 * 2026-11-01 (event-coverage audit): records carry a PT title in `namePt`
 * and PT sources name events in Portuguese, so "Sinfonia Órgão" (CdM's PT
 * page) never matched the existing "Organ Symphony" and became a second
 * record. Every name variant (name / namePt) on each side is now compared,
 * and a few common PT words fold to their EN form (sinfonia → symphony,
 * órgão → organ, maratona → marathon) before tokens are compared.
 */

import type { EventRecord } from './events';
import { canonicalVenueSlug, canonicalVenueSlugFor, hasVenuePage, kebab } from './venues';

/** Words that don't distinguish one event from another (EN / PT / ES). */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'of', 'in', 'at', 'on', 'for', 'with', 'by', 'to',
  'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'com', 'um', 'uma',
  'el', 'la', 'los', 'las', 'del', 'y', 'en', 'con',
  'porto', 'oporto',
  'exhibition', 'exhibit', 'exposicao', 'exposicion', 'expo', 'mostra', 'show', 'retrospective', 'retrospectiva',
  'opening', 'inauguracao', 'vernissage', 'final', 'last', 'days', 'chance', 'closing',
]);

/**
 * PT (and a few ES/EN spelling) words folded to one EN form so a Portuguese
 * title and its English record share tokens. Keep to unambiguous words.
 */
const FOLD: Record<string, string> = {
  sinfonia: 'symphony', sinfonica: 'symphony', symphonic: 'symphony',
  orgao: 'organ', orquestra: 'orchestra', orquesta: 'orchestra', coro: 'choir',
  maratona: 'marathon', natal: 'christmas', noite: 'night', mercado: 'market', feira: 'fair',
  danca: 'dance', teatro: 'theatre', theater: 'theatre', jardim: 'garden', luz: 'light',
  concerto: 'concert', concertos: 'concert', concerts: 'concert', bailado: 'ballet',
};

/** Distinctive name tokens; venue words dropped ("… at Serralves"). */
export function nameTokens(name: string, venueSlug?: string): Set<string> {
  const all = kebab(name).split('-').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d{4}$/.test(t)).map((t) => FOLD[t] ?? t);
  const venueWords = new Set((venueSlug ?? '').split('-').map((t) => FOLD[t] ?? t));
  const distinct = all.filter((t) => !venueWords.has(t));
  return new Set(distinct.length ? distinct : all);
}

export type NameMatch = 'equal' | 'similar' | 'contained' | null;

export function compareNames(a: Set<string>, b: Set<string>): NameMatch {
  if (a.size === 0 || b.size === 0) return null;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  if (inter === a.size && a.size === b.size) return 'equal';
  if (inter / (a.size + b.size - inter) >= 0.6) return 'similar';
  if (inter === Math.min(a.size, b.size) && inter >= 2) return 'contained';
  return null;
}

type Dated = { date: string; endDate?: string | null };
const day = (iso: string) => iso.slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(day(iso) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const isMultiDay = (e: Dated) => Boolean(e.endDate) && day(e.endDate!) > day(e.date);
export function datesOverlap(a: Dated, b: Dated, slackDays = 1): boolean {
  return day(a.date) <= addDays(b.endDate || b.date, slackDays) && day(b.date) <= addDays(a.endDate || a.date, slackDays);
}

export interface EventLike extends Dated {
  name: string;
  /** PT title (records: only when it differs from `name`). Compared too. */
  namePt?: string | null;
  venue: string;
  venueSlug?: string;
}

/** Every distinct title an event goes by (name, namePt). */
export const nameVariants = (e: Pick<EventLike, 'name' | 'namePt'>): string[] =>
  e.namePt?.trim() && e.namePt.trim() !== e.name ? [e.name, e.namePt.trim()] : [e.name];

const MATCH_RANK: Record<Exclude<NameMatch, null>, number> = { equal: 3, similar: 2, contained: 1 };

/** Best name match over all name variants of `a` and `b`. */
export function compareEventNames(a: Pick<EventLike, 'name' | 'namePt'>, b: Pick<EventLike, 'name' | 'namePt'>, va?: string, vb?: string): NameMatch {
  let best: NameMatch = null;
  for (const na of nameVariants(a)) {
    for (const nb of nameVariants(b)) {
      const m = compareNames(nameTokens(na, va), nameTokens(nb, vb));
      if (m && (!best || MATCH_RANK[m] > MATCH_RANK[best])) best = m;
    }
  }
  return best;
}

/** Canonical venue slug of a record (stored slug may predate the alias map). */
export function venueKey(e: EventLike): string {
  return canonicalVenueSlug(e.venueSlug) ?? canonicalVenueSlugFor(e.venue);
}

/** Placeholder or multi-venue listing ("Various Galleries", "X & Various"). */
export function isVagueVenue(slug: string): boolean {
  return !hasVenuePage(slug) || /(^|-)(various|multiple|varies|vary|tbc|tbd)(-|$)/.test(slug);
}

/** Why two records are the same event, or null. */
export function sameEventReason(a: EventLike, b: EventLike): string | null {
  if (!datesOverlap(a, b)) return null;
  const va = venueKey(a);
  const vb = venueKey(b);
  const sameVenue = va === vb;
  if (!sameVenue && !(isVagueVenue(va) || isVagueVenue(vb))) return null;

  if (!sameVenue) {
    // Venue words only get dropped at a shared venue ("Joan Miró at Serralves"
    // vs "Joan Miró"); across venues compare the full names.
    return compareEventNames(a, b) === 'equal'
      ? `same name, vague venue (${va} / ${vb})`
      : null;
  }
  const m = compareEventNames(a, b, va, vb);
  if (!m) return null;
  if (m === 'contained' && !(isMultiDay(a) && isMultiDay(b))) return null;
  return `${m} name, same venue (${va})`;
}

/**
 * Same organiser/ticketing page → same event (owner OK 2026-10-27). The
 * 10-26 forward scan wrote Moonspell (Hard Club) and Voulez-Vous (Maria
 * Pistolas) twice each under different names from the same source page,
 * which the name match can't see. Still requires the same canonical venue
 * and the exact same dates (a festival page also lists its single nights),
 * and ignores homepages and generic agenda/listing pages.
 */
export function normalizeEventUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return null;
  const last = segs[segs.length - 1];
  if (/^(agenda|programa|programacao|programação|programme|program|eventos?|events?|calendar|calendario|whats-on|concertos|concerts|espetaculos|bilheteira|tickets?|pt|en)$/.test(last)) return null;
  const params = new URLSearchParams(u.search);
  Array.from(params.keys()).forEach((k) => { if (/^(utm_|fbclid|gclid|mc_|ref$)/.test(k)) params.delete(k); });
  params.sort();
  const q = params.toString();
  return u.hostname.toLowerCase().replace(/^www\./, '') + path + (q ? `?${q}` : '');
}

export function sameSourcePageReason(a: EventLike & { externalLink?: string | null }, b: EventLike & { externalLink?: string | null }): string | null {
  const ua = normalizeEventUrl(a.externalLink);
  if (!ua || ua !== normalizeEventUrl(b.externalLink)) return null;
  // Exact same dates: a festival page also hosts its single nights
  // (Primavera Sound: the festival and "The xx + Big Thief" share one URL).
  const end = (e: Dated) => day(e.endDate || e.date);
  if (day(a.date) !== day(b.date) || end(a) !== end(b)) return null;
  const va = venueKey(a);
  return va === venueKey(b) ? `same source page (${ua}), same venue (${va})` : null;
}

export function isSameEvent(a: EventLike, b: EventLike): boolean {
  return sameEventReason(a, b) !== null;
}

/** Among duplicates, the record to keep: oldest addedAt (most enrichment). */
export function pickCanonical<T extends Pick<EventRecord, 'addedAt'>>(records: T[]): T {
  return records.slice().sort((x, y) => x.addedAt.localeCompare(y.addedAt))[0];
}
