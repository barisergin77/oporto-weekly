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

// Pure date helpers live in lib/event-filters.ts (bundled client-side by the
// listing filters); re-exported so existing imports keep working.
import type { DayHubKind } from './event-filters';
export { portoToday, dayHubRange, type DayHubKind } from './event-filters';

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
