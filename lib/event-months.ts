/**
 * Month hubs: /porto-events/<month>-<year>.
 *
 * GSC (2026-10): "events in porto october 2026", "porto events september
 * 2026" and similar recurring searches landed on a weekly edition or the
 * homepage at position 7-9 — pages that cover one week, not the month asked
 * about. One page per month answers that query directly.
 */

import { listEvents, type EventRecord } from './events';

export const MONTH_SLUGS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface Month {
  year: number;
  month: number; // 0-11
  slug: string; // "october-2026"
  label: string; // "October 2026"
}

export function monthFromSlug(slug: string): Month | null {
  const m = /^([a-z]+)-(\d{4})$/.exec(slug);
  if (!m) return null;
  const idx = (MONTH_SLUGS as readonly string[]).indexOf(m[1]);
  if (idx < 0) return null;
  const year = Number(m[2]);
  return { year, month: idx, slug, label: `${MONTH_NAMES[idx]} ${year}` };
}

export function monthOf(year: number, month: number): Month {
  const d = new Date(Date.UTC(year, month, 1));
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  return { year: y, month: mo, slug: `${MONTH_SLUGS[mo]}-${y}`, label: `${MONTH_NAMES[mo]} ${y}` };
}

const day = (iso: string) => iso.slice(0, 10);

/** Events overlapping the month, split into those starting in it and those already running. */
export function eventsInMonth(m: Month): { starting: EventRecord[]; ongoing: EventRecord[] } {
  const first = new Date(Date.UTC(m.year, m.month, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(m.year, m.month + 1, 0)).toISOString().slice(0, 10);
  const starting: EventRecord[] = [];
  const ongoing: EventRecord[] = [];
  for (const e of listEvents()) {
    const s = day(e.date);
    const end = e.endDate ? day(e.endDate) : s;
    if (end < first || s > last) continue;
    (s >= first ? starting : ongoing).push(e);
  }
  starting.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  ongoing.sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date));
  return { starting, ongoing };
}

/** Months worth a page: at least MIN events starting in them. */
export const MIN_EVENTS_FOR_PAGE = 5;

export function listEventMonths(): Month[] {
  const seen = new Map<string, Month>();
  for (const e of listEvents()) {
    const d = new Date(day(e.date) + 'T00:00:00Z');
    const m = monthOf(d.getUTCFullYear(), d.getUTCMonth());
    seen.set(m.slug, m);
  }
  return Array.from(seen.values())
    .filter((m) => eventsInMonth(m).starting.length >= MIN_EVENTS_FOR_PAGE)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
