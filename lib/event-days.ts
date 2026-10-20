/**
 * "Today" and "This weekend" pages: /porto-events/today, /porto-events/this-weekend
 * and /pt/eventos/hoje, /pt/eventos/este-fim-de-semana.
 *
 * Owner priority (2026-10-18): the most common question is "what's on today /
 * this weekend?", and no page answered it — /porto-events lists everything
 * upcoming, month hubs a whole month. These pages are ISR (hourly) so the date
 * stays right between deploys; dates are Porto's (Europe/Lisbon), not UTC.
 */

import { listEvents, FORWARD_SOURCE, type EventRecord } from './events';
import { monthOf } from './event-months';

export type DayHubKind = 'today' | 'weekend';

/** ISO date (YYYY-MM-DD) in Porto. */
export function portoToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now);
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = Sun

/**
 * Date range a page covers. The weekend is Fri–Sun: the coming one Mon–Thu,
 * the current one from today on Fri–Sun (Saturday shows Sat–Sun).
 */
export function dayHubRange(kind: DayHubKind, now: Date = new Date()): { from: string; to: string } {
  const today = portoToday(now);
  if (kind === 'today') return { from: today, to: today };
  const wd = weekday(today);
  if (wd === 0) return { from: today, to: today };
  if (wd >= 5) return { from: today, to: addDays(today, 7 - wd) };
  return { from: addDays(today, 5 - wd), to: addDays(today, 7 - wd) };
}

/** Runs longer than this go under "Also on" so exhibitions don't bury tonight's gig. */
const LONG_RUN_DAYS = 7;
const day = (iso: string) => iso.slice(0, 10);
const spanDays = (e: EventRecord) =>
  (Date.parse(day(e.endDate ?? e.date)) - Date.parse(day(e.date))) / 86_400_000;

/** Events overlapping the range: short ones first by date, long runs ending soonest first. */
export function eventsInRange(range: { from: string; to: string }) {
  const all = listEvents().filter((e) => day(e.date) <= range.to && day(e.endDate ?? e.date) >= range.from);
  const main = all.filter((e) => spanDays(e) <= LONG_RUN_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const longRuns = all.filter((e) => spanDays(e) > LONG_RUN_DAYS)
    .sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date));
  return { main, longRuns };
}

/** The month containing the given Porto date. */
export const monthOfIso = (iso: string) => monthOf(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1);

/**
 * True when no edition event starts on or after `from`: the listings for that
 * period haven't been published yet (they arrive with Thursday's edition).
 * Forward-scan events (weeks ahead) don't count — they aren't the listings.
 */
export function listingsPending(from: string): boolean {
  return !listEvents().some((e) => e.sourceEdition !== FORWARD_SOURCE && day(e.date) >= from);
}

export const DAY_HUB_PATHS: Record<DayHubKind, { en: string; pt: string }> = {
  today: { en: '/porto-events/today', pt: '/pt/eventos/hoje' },
  weekend: { en: '/porto-events/this-weekend', pt: '/pt/eventos/este-fim-de-semana' },
};
