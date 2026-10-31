/**
 * "Add to calendar" for event pages (owner 2026-10-31): a Google Calendar
 * template link and an .ics file (/event/<slug>/calendar.ics and the PT twin).
 *
 * Event dates are Porto wall-clock times with no zone ("2026-11-05T19:30").
 * Google gets them as-is with ctz=Europe/Lisbon; the .ics converts them to
 * UTC so it needs no VTIMEZONE block. The rules for the end mirror the
 * JSON-LD (lib/events.ts deriveEndDate): a timed event without an end runs
 * two hours, a date-only event is all day, and anything spanning more than a
 * day (an exhibition, a festival) becomes an all-day block over its dates.
 *
 * Pure module (no fs). Tests: npm run test:calendar.
 */

export interface CalendarInput {
  slug: string;
  date: string;
  endDate?: string;
  addedAt?: string;
}

export interface CalendarText {
  title: string;
  description: string;
  location: string;
  url: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const compactDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
const day = (iso: string) => iso.slice(0, 10);
const nextDay = (iso: string) => {
  const d = new Date(day(iso) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => (Date.parse(day(b)) - Date.parse(day(a))) / 86_400_000;

/** Wall-clock parts of "YYYY-MM-DDTHH:MM". */
function parts(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? m.slice(1).map(Number) as [number, number, number, number, number] : null;
}

/** Local wall-clock + hours, as "YYYY-MM-DDTHH:MM" (no zone). */
function addHours(iso: string, h: number): string {
  const p = parts(iso)!;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2], p[3] + h, p[4]));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export type CalendarWindow =
  | { allDay: true; start: string; endExclusive: string } // YYYY-MM-DD
  | { allDay: false; start: string; end: string }; // YYYY-MM-DDTHH:MM, Porto wall clock

export function calendarWindow(ev: CalendarInput): CalendarWindow {
  const timed = parts(ev.date) !== null;
  const end = ev.endDate;
  // Multi-day runs: an all-day block over the dates, not a 3-month meeting.
  if (end && daysBetween(ev.date, end) > 1) return { allDay: true, start: day(ev.date), endExclusive: nextDay(end) };
  if (!timed) return { allDay: true, start: day(ev.date), endExclusive: nextDay(end ?? ev.date) };
  if (end && parts(end) && end > ev.date) return { allDay: false, start: ev.date.slice(0, 16), end: end.slice(0, 16) };
  return { allDay: false, start: ev.date.slice(0, 16), end: addHours(ev.date, 2) };
}

/** Porto wall clock -> UTC "YYYYMMDDTHHMMSSZ" (Europe/Lisbon is UTC+0 in winter, +1 in summer). */
export function lisbonToUtc(local: string): string {
  const p = parts(local)!;
  const asUtc = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]);
  // Offset of Lisbon at that instant: format it there and diff. Two passes
  // settle the DST changeover hour.
  const offsetAt = (t: number) => {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(f.find((x) => x.type === k)!.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - t;
  };
  let t = asUtc - offsetAt(asUtc);
  t = asUtc - offsetAt(t);
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

const localCompact = (iso: string) => iso.slice(0, 16).replace(/[-:]/g, '') + '00';

export function googleCalendarUrl(ev: CalendarInput, text: CalendarText): string {
  const w = calendarWindow(ev);
  const dates = w.allDay
    ? `${compactDate(w.start)}/${compactDate(w.endExclusive)}`
    : `${localCompact(w.start)}/${localCompact(w.end)}`;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: text.title,
    dates,
    details: `${text.description}\n\n${text.url}`.trim(),
    location: text.location,
    ctz: 'Europe/Lisbon',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** RFC 5545 TEXT escaping. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold content lines at 75 octets (UTF-8), continuation lines start with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function utcStamp(iso: string | undefined): string {
  const d = iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : new Date(0);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function buildIcs(ev: CalendarInput, text: CalendarText): string {
  const w = calendarWindow(ev);
  const when = w.allDay
    ? [`DTSTART;VALUE=DATE:${compactDate(w.start)}`, `DTEND;VALUE=DATE:${compactDate(w.endExclusive)}`]
    : [`DTSTART:${lisbonToUtc(w.start)}`, `DTEND:${lisbonToUtc(w.end)}`];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oporto Weekly//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.slug}@oportoweekly.com`,
    // Stable across builds (the record's addedAt), so re-downloads update the same entry.
    `DTSTAMP:${utcStamp(ev.addedAt)}`,
    ...when,
    `SUMMARY:${esc(text.title)}`,
    `DESCRIPTION:${esc(`${text.description}\n\n${text.url}`.trim())}`,
    `LOCATION:${esc(text.location)}`,
    `URL:${text.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
