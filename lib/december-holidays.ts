/**
 * December long weekends in Porto (growth item G10, 2026-11-25):
 * /porto-events/december-long-weekends and /pt/eventos/feriados-de-dezembro.
 *
 * In 2026 both December public holidays fall on a Tuesday: 1 December
 * (Restauração da Independência) and 8 December (Imaculada Conceição), national
 * holidays under article 234 of the Código do Trabalho. Many people take the
 * Monday off, so each makes a four-day weekend (Sat to Tue). The page lists our
 * own verified event records for those days; past weekends drop off, and after
 * the last one the page is noindexed.
 */

import { eventsInRange } from './event-days';
import { portoToday } from './event-filters';

export const HOLIDAYS_YEAR = 2026;

export const DECEMBER_HOLIDAYS_PATHS = {
  en: '/porto-events/december-long-weekends',
  pt: '/pt/eventos/feriados-de-dezembro',
} as const;

export interface LongWeekend {
  /** Saturday the long weekend starts. */
  from: string;
  /** The holiday (a Tuesday in 2026). */
  to: string;
  holiday: { en: string; pt: string };
}

export const LONG_WEEKENDS: LongWeekend[] = [
  { from: '2026-11-28', to: '2026-12-01', holiday: { en: 'Restoration of Independence Day', pt: 'Restauração da Independência' } },
  { from: '2026-12-05', to: '2026-12-08', holiday: { en: 'Feast of the Immaculate Conception', pt: 'Imaculada Conceição' } },
];

/** Long weekends that haven't ended yet (Porto date). */
export function upcomingLongWeekends(today: string = portoToday()): LongWeekend[] {
  return LONG_WEEKENDS.filter((w) => w.to >= today);
}

/** Indexable while a long weekend is still ahead or under way. */
export const holidaysInSeason = (today: string = portoToday()) => upcomingLongWeekends(today).length > 0;

const day = (iso: string) => iso.slice(0, 10);

/** Days of a weekend (from..to inclusive). */
export function weekendDays(w: LongWeekend): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${w.from}T00:00:00Z`); t <= Date.parse(`${w.to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Events for one long weekend: short events grouped by the day they start
 * (events that began earlier, e.g. a 3-day festival, go under the weekend's
 * first day), plus long runs (exhibitions) closing soonest first.
 */
export function weekendEvents(w: LongWeekend, today: string = portoToday()) {
  const from = w.from > today ? w.from : today;
  const { main, longRuns } = eventsInRange({ from, to: w.to });
  const byDay = new Map<string, typeof main>();
  for (const d of weekendDays(w)) if (d >= from) byDay.set(d, []);
  for (const e of main) {
    const start = day(e.date) < from ? from : day(e.date);
    byDay.get(start)?.push(e);
  }
  return { byDay, longRuns, total: main.length };
}
