/**
 * Static landing pages for the filter combinations people actually search
 * for (owner 2026-10-31): free events, kids & family, and free this weekend.
 * Each is a real, indexable page with its own title and list, not a
 * filtered view of a hub (those keep the hub's canonical).
 *
 * Counts checked against data/events on 2026-10-31, replaying each Thursday
 * since April: 3-13 free events upcoming (median 8), 2-11 free on a weekend
 * once its edition is out, and 1-5 kids & family events upcoming (median 3;
 * 6 now that the forward scan lists weeks ahead). Single-category pages
 * (fado, jazz) were left out: most weeks they would list one or two events.
 *
 * Below MIN_INDEXABLE events a page renders but asks not to be indexed and
 * drops out of the sitemap, so a thin week never ships a thin page to Google.
 */

import { listUpcomingEvents, isKidsEvent, type EventRecord } from './events';
import { dayHubRange, eventsInRange } from './event-days';
import { isFreePrice, priceBand } from './event-filters';

export type LandingKind = 'free' | 'kids' | 'weekend-free' | 'christmas';

export const LANDING_PATHS: Record<LandingKind, { en: string; pt: string }> = {
  free: { en: '/porto-events/free', pt: '/pt/eventos/gratis' },
  kids: { en: '/porto-events/kids', pt: '/pt/eventos/criancas' },
  'weekend-free': { en: '/porto-events/this-weekend/free', pt: '/pt/eventos/este-fim-de-semana/gratis' },
  christmas: { en: '/porto-events/christmas', pt: '/pt/eventos/natal' },
};

/**
 * Christmas + New Year's Eve (#40, 2026-11-06): events whose own name says
 * so, up to Epiphany (6 Jan). Names only: a description that mentions
 * "Christmas gifts" doesn't make a concert a Christmas event. Out of season
 * the page lists nothing and stays out of the index (MIN_INDEXABLE).
 */
const FESTIVE = /\b(natal|christmas|xmas|r[ée]veillon|new year|ano novo|passagem de ano|pres[ée]pios?|quebra-nozes|nutcracker|advento|advent)\b/i;
export const isFestiveEvent = (e: Pick<EventRecord, 'name' | 'namePt'>) => FESTIVE.test(`${e.name} ${e.namePt ?? ''}`);

/** The season this page is about: the year of its Christmas, and its last day (6 Jan). */
export function christmasSeason(now: Date = new Date()): { year: number; end: string } {
  const y = now.getUTCFullYear();
  const early = now.getUTCMonth() === 0 && now.getUTCDate() <= 6;
  const year = early ? y - 1 : y;
  return { year, end: `${year + 1}-01-06` };
}

export const MIN_INDEXABLE = 3;

const LONG_RUN_DAYS = 7;
const day = (iso: string) => iso.slice(0, 10);
const spanDays = (e: EventRecord) => (Date.parse(day(e.endDate ?? e.date)) - Date.parse(day(e.date))) / 86_400_000;
const isFree = (e: EventRecord) => isFreePrice(e.price) || priceBand(e.price, e.priceFrom) === 'free';

/** The page's events: short ones by date, then long runs closing soonest first. */
export function landingEvents(kind: LandingKind, now: Date = new Date()): { main: EventRecord[]; longRuns: EventRecord[] } {
  if (kind === 'weekend-free') {
    const { main, longRuns } = eventsInRange(dayHubRange('weekend', now));
    return { main: main.filter(isFree), longRuns: longRuns.filter(isFree) };
  }
  const { end } = christmasSeason(now);
  const keep = kind === 'free' ? isFree
    : kind === 'christmas' ? (e: EventRecord) => isFestiveEvent(e) && day(e.date) <= end
    : (e: EventRecord) => isKidsEvent(e);
  const all = listUpcomingEvents(now).filter(keep);
  return {
    main: all.filter((e) => spanDays(e) <= LONG_RUN_DAYS),
    longRuns: all.filter((e) => spanDays(e) > LONG_RUN_DAYS)
      .sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date)),
  };
}

export function landingIndexable(kind: LandingKind, now: Date = new Date()): boolean {
  const { main, longRuns } = landingEvents(kind, now);
  return main.length + longRuns.length >= MIN_INDEXABLE;
}
