/**
 * Christmas with kids in Porto (growth item G11, 2026-11-27):
 * /porto-events/christmas-with-kids and /pt/eventos/natal-com-criancas.
 *
 * Lists our own verified event records for children and families from today
 * to the end of the city's Christmas programme (10 Jan, when Praça da
 * Fantasia closes): Santa's House, the Coliseu circus, kids' shows, Christmas
 * films, family concerts and festive markets. Generic weekly markets and
 * nightlife are left out. Past events drop off; after the season the page is
 * noindexed and leaves the sitemap.
 */

import { listUpcomingEvents, type EventRecord } from './events';
import { isFestiveEvent } from './event-landings';
import { SEASON_END } from './christmas-lights';

export const KIDS_XMAS_YEAR = 2026;

export const CHRISTMAS_KIDS_PATHS = {
  en: '/porto-events/christmas-with-kids',
  pt: '/pt/eventos/natal-com-criancas',
} as const;

/** Below this many events the page asks not to be indexed. */
export const MIN_KIDS_XMAS = 5;

/** Spans longer than this go under "On all season". */
export const LONG_RUN_DAYS = 7;

const KIDS_NAME = /\b(circo|circus|pai natal|santa['’]s|santa claus|grinch|home alone|sozinho em casa|quebra-nozes|nutcracker|patrulha pata|paw patrol|caricas|frozen|pocahontas|marionetas|infantil|crian[cç]as|mi[uú]dos|fam[ií]lias?|family|beb[eé]s?|babies)\b/i;
const GENERIC_MARKET = /\b(mercado|market|feira|fair|swap)\b/i;

const day = (iso: string) => iso.slice(0, 10);
const names = (e: EventRecord) => [e.name, e.namePt, e.nameEn].filter(Boolean).join(' ');
export const spanDays = (e: EventRecord) => (Date.parse(day(e.endDate ?? e.date)) - Date.parse(day(e.date))) / 86_400_000;

/**
 * A family/kids event for this page: category "family" or a kids word in the
 * name, no nightlife, no non-festive weekly markets. Descriptions don't count
 * (isKidsEvent's text match lets in concerts and matches that mention
 * "family" in passing).
 */
export function isChristmasKidsEvent(e: EventRecord): boolean {
  if (e.category === 'nightlife') return false;
  if (!(e.category === 'family' || KIDS_NAME.test(names(e)))) return false;
  if (!isFestiveEvent(e) && GENERIC_MARKET.test(names(e))) return false;
  return true;
}

export function christmasKidsEvents(now: Date = new Date()): { main: EventRecord[]; longRuns: EventRecord[] } {
  const all = listUpcomingEvents(now).filter((e) => day(e.date) <= SEASON_END && isChristmasKidsEvent(e));
  return {
    main: all.filter((e) => spanDays(e) <= LONG_RUN_DAYS).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
    longRuns: all.filter((e) => spanDays(e) > LONG_RUN_DAYS).sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date)),
  };
}

export function christmasKidsIndexable(now: Date = new Date()): boolean {
  if (now.toISOString().slice(0, 10) > SEASON_END) return false;
  const { main, longRuns } = christmasKidsEvents(now);
  return main.length + longRuns.length >= MIN_KIDS_XMAS;
}

/** Monday of the week containing a date (YYYY-MM-DD). */
export function weekStart(iso: string): string {
  const t = Date.parse(`${day(iso)}T12:00:00Z`);
  const wd = (new Date(t).getUTCDay() + 6) % 7; // Mon = 0
  return new Date(t - wd * 86_400_000).toISOString().slice(0, 10);
}

/** Short events grouped by week (Mon–Sun); events that started before `from` go under the current week. */
export function byWeek(events: EventRecord[], from: string): Map<string, EventRecord[]> {
  const out = new Map<string, EventRecord[]>();
  for (const e of events) {
    const start = day(e.date) < from ? from : day(e.date);
    const k = weekStart(start);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(e);
  }
  return out;
}
