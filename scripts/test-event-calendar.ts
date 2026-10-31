/**
 * Assertions for "Add to calendar" (lib/event-calendar.ts): Google link
 * dates, .ics structure, UTC conversion across Lisbon's DST change, folding
 * and escaping. Plain node:assert under tsx. No network.
 *
 *   npm run test:calendar
 */

import assert from 'node:assert/strict';
import { buildIcs, calendarWindow, googleCalendarUrl, lisbonToUtc } from '../lib/event-calendar';
import { listEvents } from '../lib/events';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
};
const text = { title: 'Fado; Night, Live', description: 'Line one.\nLine two.', location: 'Casa da Guitarra, Porto', url: 'https://oportoweekly.com/event/x' };

test('windows: timed, timed with end, date-only, multi-day', () => {
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-11-05T19:30' }), { allDay: false, start: '2026-11-05T19:30', end: '2026-11-05T21:30' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-10-31T23:30', endDate: '2026-11-01' }), { allDay: false, start: '2026-10-31T23:30', end: '2026-11-01T01:30' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-11-05T19:30', endDate: '2026-11-05T23:00' }), { allDay: false, start: '2026-11-05T19:30', end: '2026-11-05T23:00' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-11-07' }), { allDay: true, start: '2026-11-07', endExclusive: '2026-11-08' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-11-07', endDate: '2026-11-08' }), { allDay: true, start: '2026-11-07', endExclusive: '2026-11-09' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-06-13', endDate: '2027-01-10' }), { allDay: true, start: '2026-06-13', endExclusive: '2027-01-11' });
  assert.deepEqual(calendarWindow({ slug: 'a', date: '2026-11-26T21:00', endDate: '2026-11-29' }), { allDay: true, start: '2026-11-26', endExclusive: '2026-11-30' });
});
test('Lisbon to UTC: winter +0, summer +1, both sides of the change', () => {
  assert.equal(lisbonToUtc('2026-11-05T19:30'), '20261105T193000Z');
  assert.equal(lisbonToUtc('2026-07-09T21:00'), '20260709T200000Z');
  assert.equal(lisbonToUtc('2026-10-25T00:30'), '20261024T233000Z'); // still summer time
  assert.equal(lisbonToUtc('2026-10-25T03:00'), '20261025T030000Z'); // after clocks went back
  assert.equal(lisbonToUtc('2026-12-31T23:30'), '20261231T233000Z');
});
test('Google Calendar link', () => {
  const u = new URL(googleCalendarUrl({ slug: 'a', date: '2026-11-05T19:30' }, text));
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('dates'), '20261105T193000/20261105T213000');
  assert.equal(u.searchParams.get('ctz'), 'Europe/Lisbon');
  assert.equal(u.searchParams.get('text'), text.title);
  assert.ok(u.searchParams.get('details')!.endsWith(text.url));
  const allDay = new URL(googleCalendarUrl({ slug: 'a', date: '2026-11-07', endDate: '2026-11-08' }, text));
  assert.equal(allDay.searchParams.get('dates'), '20261107/20261109');
});
test('.ics is valid RFC 5545', () => {
  const ics = buildIcs({ slug: 'fado-x', date: '2026-11-05T19:30', addedAt: '2026-10-26T07:00:00Z' }, text);
  assert.ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'CRLF line endings');
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  for (const k of ['VERSION:2.0', 'PRODID:-//Oporto Weekly//Events//EN', 'BEGIN:VEVENT', 'UID:fado-x@oportoweekly.com',
    'DTSTAMP:20261026T070000Z', 'DTSTART:20261105T193000Z', 'DTEND:20261105T213000Z', 'END:VEVENT', 'END:VCALENDAR']) {
    assert.ok(lines.includes(k), k);
  }
  assert.ok(lines.includes('SUMMARY:Fado\\; Night\\, Live'), 'escaped ; and ,');
  assert.ok(ics.includes('DESCRIPTION:Line one.\\nLine two.'), 'escaped newline');
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `line over 75 octets: ${l}`);
  const day = buildIcs({ slug: 'expo', date: '2026-06-13', endDate: '2027-01-10' }, text);
  assert.ok(day.includes('DTSTART;VALUE=DATE:20260613\r\n') && day.includes('DTEND;VALUE=DATE:20270111\r\n'));
});
test('long UTF-8 text folds on character boundaries', () => {
  const long = { ...text, description: 'Concerto de música clássica com a Orquestra Sinfónica do Porto Casa da Música, no coração da cidade. '.repeat(4) };
  const ics = buildIcs({ slug: 'a', date: '2026-11-05' }, long);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(`DESCRIPTION:${long.description.trim().replace(/,/g, '\\,')}`));
  assert.ok(!ics.includes('�'));
});
test('every real event gets a calendar window with start before end', () => {
  for (const e of listEvents()) {
    const w = calendarWindow(e);
    if (w.allDay) assert.ok(w.start < w.endExclusive, e.slug);
    else assert.ok(w.start < w.end, e.slug);
    assert.match(buildIcs(e, { ...text, title: e.name }), /BEGIN:VEVENT[\s\S]+END:VEVENT/);
  }
});

console.log(`test-event-calendar: ${passed} passed`);
