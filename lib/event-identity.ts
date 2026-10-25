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

/** Distinctive name tokens; venue words dropped ("… at Serralves"). */
export function nameTokens(name: string, venueSlug?: string): Set<string> {
  const all = kebab(name).split('-').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d{4}$/.test(t));
  const venueWords = new Set((venueSlug ?? '').split('-'));
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
  venue: string;
  venueSlug?: string;
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
    return compareNames(nameTokens(a.name), nameTokens(b.name)) === 'equal'
      ? `same name, vague venue (${va} / ${vb})`
      : null;
  }
  const m = compareNames(nameTokens(a.name, va), nameTokens(b.name, vb));
  if (!m) return null;
  if (m === 'contained' && !(isMultiDay(a) && isMultiDay(b))) return null;
  return `${m} name, same venue (${va})`;
}

export function isSameEvent(a: EventLike, b: EventLike): boolean {
  return sameEventReason(a, b) !== null;
}

/** Among duplicates, the record to keep: oldest addedAt (most enrichment). */
export function pickCanonical<T extends Pick<EventRecord, 'addedAt'>>(records: T[]): T {
  return records.slice().sort((x, y) => x.addedAt.localeCompare(y.addedAt))[0];
}
