/**
 * Second, independent check before a sweep event is published (owner rule
 * 2026-11-01: "nothing goes live without double checking", sweep included).
 *
 * Why: a manual re-check of 11 sweep-published events found 5 errors the
 * first page check (lib/forward-scan.ts verifyCandidate) had passed:
 *   - start times 23:00 and 20:00 where the page said 23:59;
 *   - a series end date put on a single 45-minute concert;
 *   - a one-night show given an extra day;
 *   - a promoter ("Too Much Information") listed as the venue.
 *
 * How: scripts/source-sweep.ts refetches the record's externalLink (fresh,
 * never the cache), a separate strict reader (extractPageFields) returns
 * each field WITH the exact text it read it from, and reconcile() checks
 * every field against the page on its own:
 *   - name: must be the same event;
 *   - start date and start time: a time is kept only when the page shows
 *     it; no time on the page → no time stored (never guessed);
 *   - endDate: only when the page shows a multi-day run or series of THIS
 *     event, otherwise removed;
 *   - venue: the physical place, not the organiser or promoter;
 *   - price: as on the page, removed when the page shows none.
 * A field the page settles unambiguously is corrected; anything else holds
 * the event back for the review digest.
 */

import type { EventRecord } from './events';
import { composeEventSlug, canonicalVenueSlugFor } from './events';
import { compareEventNames } from './event-identity';
import { kebab } from './venues';
import { lisbonWallClock, normalizeVenue } from './source-sweep';

export interface PageFields {
  name: string | null;
  nameQuote: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  dateQuote: string | null;
  /** HH:MM, 24-hour, only if the page shows a start time. */
  time: string | null;
  timeQuote: string | null;
  /** YYYY-MM-DD, only for a multi-day run or a series of dates of this event. */
  endDate: string | null;
  endDateQuote: string | null;
  venue: string | null;
  venueQuote: string | null;
  /** Is `venue` the place where it happens, or the organiser/promoter/brand? */
  venueRole: 'venue' | 'organiser' | 'unclear';
  price: string | null;
  priceFrom: number | null;
  priceQuote: string | null;
  isFree?: boolean;
}

/** JSON-LD Event dates on the refetched page (independent of the reader). */
export interface LdDates { name?: string; startDate?: string; endDate?: string }

export interface CheckResult {
  status: 'ok' | 'corrected' | 'hold';
  /** The record to publish (corrections applied); the input record when held. */
  record: EventRecord;
  corrections: string[];
  problems: string[];
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`"“”«»]/g, '').replace(/\s+/g, ' ').trim();
/** The quote really is on the page (case, accents, quotes and spacing ignored). */
export const onPage = (quote: string | null | undefined, pageText: string) =>
  Boolean(quote && fold(quote).length >= 2 && fold(pageText).includes(fold(quote)));

const day = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => (/T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : '');
const pad = (n: number) => String(n).padStart(2, '0');

/** Every clock time written in a text: "23:59", "21h30", "21.30", "11:59 PM", "9 pm", "21h". */
export function timesIn(text: string): string[] {
  const out = new Set<string>();
  const re = /(\d{1,2})(?:\s*[:h.]\s*(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|h(?![a-z]))?/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const [, hh, mm, suffix] = m;
    if (!mm && !suffix) continue; // a bare number is not a time
    let h = Number(hh);
    const min = mm ? Number(mm) : 0;
    const sx = (suffix ?? '').toLowerCase().replace(/\./g, '');
    if (sx === 'pm' && h < 12) h += 12;
    if (sx === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) continue;
    out.add(`${pad(h)}:${pad(min)}`);
  }
  return Array.from(out);
}

/** Numbers written in a text ("15€", "€26,00", "12.50"). */
export const numbersIn = (t: string) => (t.match(/\d+(?:[.,]\d{1,2})?/g) ?? []).map((n) => Number(n.replace(',', '.')));

/** The text names this calendar day (day number present; month name or number when the quote has one). */
export function quoteHasDay(quote: string, iso: string): boolean {
  const d = String(Number(iso.slice(8, 10)));
  return new RegExp(`(^|\\D)0?${d}(\\D|$)`).test(quote);
}

const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** Copy that states this day ("12 December", "December 12", "12 de dezembro"). */
export function mentionsDay(text: string, iso: string): boolean {
  const d = Number(iso.slice(8, 10));
  const m = Number(iso.slice(5, 7)) - 1;
  const t = fold(text);
  const en = EN_MONTHS[m];
  const pt = fold(PT_MONTHS[m]);
  return new RegExp(`\\b${d}(st|nd|rd|th)?( of)? ${en}\\b|\\b${en} ${d}(st|nd|rd|th)?\\b|\\b${d} de ${pt}\\b`).test(t);
}
/** Copy that states this clock time in any common form. */
export function mentionsTime(text: string, hhmm: string): boolean {
  return timesIn(text).includes(hhmm);
}

const sameName = (a: string, b: string) => {
  const ka = kebab(a); const kb = kebab(b);
  if (!ka || !kb) return false;
  if (ka === kb || ka.includes(kb) || kb.includes(ka)) return true;
  const m = compareEventNames({ name: a }, { name: b });
  return m === 'equal' || m === 'similar' || m === 'contained';
};
const sameVenue = (a: string, b: string) => {
  const sa = canonicalVenueSlugFor(normalizeVenue(a));
  const sb = canonicalVenueSlugFor(normalizeVenue(b));
  return sa === sb || (sa.length >= 4 && sb.length >= 4 && (sa.includes(sb) || sb.includes(sa)));
};

/** A JSON-LD startDate → wall clock in Lisbon ("…Z"/offset converted; bare local kept). */
const ldWall = (s: string) => (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? lisbonWallClock(s) : s.slice(0, 16));

/**
 * Field-by-field reconciliation of a built record with what the refetched
 * page says. Pure: no network.
 */
export function reconcile(
  rec: EventRecord, f: PageFields, pageText: string, ld: LdDates[] = [],
  /** Days of the same show listed as separate sessions by the source (Super Bock Arena nights, Coliseu dates). Never festival folds. */
  sessionDays: string[] = []
): CheckResult {
  const corrections: string[] = [];
  const problems: string[] = [];
  const out: EventRecord = { ...rec };
  const recDay = day(rec.date);
  const recTime = timeOf(rec.date);
  // JSON-LD entries for this event (by name, else the page's only one).
  const ldMine = ld.filter((e) => e.startDate && (!e.name || sameName(e.name, rec.name)));
  const ldOne = ldMine.length === 1 ? ldMine[0] : ld.length === 1 && ld[0].startDate ? ld[0] : undefined;

  // ---- name
  if (!f.name || !onPage(f.nameQuote, pageText)) problems.push('name not confirmed on the page');
  else if (!sameName(f.name, rec.name)) problems.push(`name: page says "${f.name}"`);

  // ---- start date
  const dateOk = f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && onPage(f.dateQuote, pageText) && quoteHasDay(f.dateQuote!, f.date);
  const ldDay = ldOne?.startDate ? day(ldWall(ldOne.startDate)) : undefined;
  let newDay = recDay;
  if (dateOk && f.date === recDay) { /* confirmed */ }
  else if (dateOk && ldDay === f.date) { newDay = f.date!; corrections.push(`date ${recDay} → ${f.date}`); }
  else if (dateOk) problems.push(`date: page says ${f.date}, record ${recDay}`);
  else if (ldDay === recDay) { /* JSON-LD confirms */ }
  else problems.push('start date not confirmed on the page');

  // ---- start time (never guessed: no time on the page → no time stored)
  const timeOk = f.time && /^\d{2}:\d{2}$/.test(f.time) && onPage(f.timeQuote, pageText) && timesIn(f.timeQuote!).includes(f.time);
  const ldTime = ldOne?.startDate && /T\d{2}:\d{2}/.test(ldOne.startDate) ? ldWall(ldOne.startDate).slice(11, 16) : '';
  let newTime = recTime;
  if (timeOk) newTime = f.time!;
  else if (ldTime && ldTime !== '00:00' && day(ldWall(ldOne!.startDate!)) === newDay) newTime = ldTime;
  else newTime = '';
  if (newTime !== recTime) corrections.push(newTime ? `start time ${recTime || 'none'} → ${newTime}` : `start time ${recTime} removed (not on the page)`);
  out.date = newTime ? `${newDay}T${newTime}` : newDay;

  // ---- end date: only a multi-day run or series shown on the page
  const endOk = f.endDate && /^\d{4}-\d{2}-\d{2}$/.test(f.endDate) && f.endDate > newDay && onPage(f.endDateQuote, pageText) && quoteHasDay(f.endDateQuote!, f.endDate);
  const ldEnd = ldOne?.endDate ? day(ldWall(ldOne.endDate)) : undefined;
  const newEnd = endOk ? f.endDate! : undefined;
  const lastSession = sessionDays.length > 1 ? sessionDays.map(day).sort().pop() : undefined;
  if (!endOk && ldEnd && ldEnd > newDay && rec.endDate && day(rec.endDate) === ldEnd) {
    // The reader missed it but the page's own structured data states the run: keep.
  } else if (!endOk && lastSession && rec.endDate && day(rec.endDate) === lastSession && sessionDays.map(day).includes(newDay)) {
    // One page per night (Bryan Adams, 17 and 18 Nov): the source's own session list is the series.
  } else if ((rec.endDate ? day(rec.endDate) : undefined) !== newEnd) {
    corrections.push(newEnd ? `end date ${rec.endDate ? day(rec.endDate) : 'none'} → ${newEnd}` : `end date ${day(rec.endDate!)} removed (page shows one date)`);
    out.endDate = newEnd;
  }

  // ---- venue: the place, not the organiser
  if (f.venueRole !== 'venue') problems.push(`venue: "${f.venue ?? rec.venue}" looks like the ${f.venueRole === 'organiser' ? 'organiser/promoter' : 'organiser or is unclear'}, not the place`);
  else if (!f.venue || !onPage(f.venueQuote, pageText)) problems.push('venue not confirmed on the page');
  else if (!sameVenue(f.venue, rec.venue)) problems.push(`venue: page says "${f.venue}", record "${rec.venue}"`);

  // ---- price
  const priceOk = onPage(f.priceQuote, pageText);
  // The stored lowest price written on the page (BOL lists full and discount prices): confirmed as is.
  const recPriceOnPage = typeof rec.priceFrom === 'number' && rec.priceFrom > 0 && numbersIn(pageText.replace(/\d{1,2}[:h]\d{2}/g, ' ')).includes(rec.priceFrom) && /€|eur/i.test(pageText);
  if (recPriceOnPage) { /* confirmed */ }
  else if (priceOk && f.isFree) {
    if (rec.price !== 'Free') { corrections.push(`price ${rec.price ?? 'none'} → Free`); out.price = 'Free'; out.priceFrom = undefined; out.currency = undefined; }
  } else if (priceOk && typeof f.priceFrom === 'number' && f.priceFrom > 0 && numbersIn(f.priceQuote!).includes(f.priceFrom)) {
    if (rec.priceFrom !== f.priceFrom) {
      const p = f.price?.trim() || `From €${f.priceFrom}`;
      corrections.push(`price ${rec.price ?? 'none'} → ${p}`);
      out.price = p; out.priceFrom = f.priceFrom!; out.currency = 'EUR';
    }
  } else if (rec.price) {
    corrections.push(`price ${rec.price} removed (not on the page)`);
    out.price = undefined; out.priceFrom = undefined; out.currency = undefined;
  }

  // ---- the copy must not repeat a value we just corrected
  const copy = [rec.description, rec.longDescription, rec.descriptionPt, rec.longDescriptionPt].filter(Boolean).join('\n');
  if (recTime && newTime !== recTime && mentionsTime(copy, recTime)) problems.push(`description states the old time ${recTime}`);
  if (rec.endDate && day(rec.endDate) !== (out.endDate ? day(out.endDate) : undefined) && mentionsDay(copy, day(rec.endDate))) problems.push(`description states the old end date ${day(rec.endDate)}`);
  if (newDay !== recDay && mentionsDay(copy, recDay)) problems.push(`description states the old date ${recDay}`);

  if (problems.length) return { status: 'hold', record: rec, corrections, problems };
  if (newDay !== recDay) out.slug = composeEventSlug(out.name, out.venue, newDay);
  return { status: corrections.length ? 'corrected' : 'ok', record: out, corrections, problems };
}

/** The strict reader. Separate prompt from the first check; every field comes with the text it was read from. */
export async function extractPageFields(pageText: string, url: string, hint: { name: string; date: string }): Promise<PageFields> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const prompt = `You are checking one event listing against its web page (${url}). The listing claims "${hint.name}" on ${hint.date.slice(0, 10)}. Ignore the claim; read ONLY the page text below. No outside knowledge, no guessing.

Return ONLY this JSON:
{
  "name": the event's name as the page gives it, or null,
  "nameQuote": that name copied EXACTLY from the page text, or null,
  "date": "YYYY-MM-DD" of the event's start (the first date of a run; for a festival page listing many sessions, the date of THIS event), or null,
  "dateQuote": the shortest passage copied EXACTLY from the page that states that date (must contain the day number), or null,
  "time": "HH:MM" 24-hour start time ONLY if the page states the start time of this event (doors-open is not the start if a start time is also given; "11:59 PM" is "23:59"), else null,
  "timeQuote": the passage copied EXACTLY from the page that states that time, or null,
  "endDate": "YYYY-MM-DD" ONLY if the page shows THIS event running over several days (a run "12 nov a 13 dez", an exhibition until a date, or several performance dates of this same show). A single performance, a duration ("45 minutos"), other events of a festival or cycle, or a ticket-sale end date are NOT an end date: null,
  "endDateQuote": the passage copied EXACTLY from the page that states the end date, or null,
  "venue": the PLACE where it happens (a venue, room, club, theatre, park, street address), or null,
  "venueQuote": the venue copied EXACTLY from the page text, or null,
  "venueRole": "venue" if that is the physical place; "organiser" if the only name given is a promoter, organiser, collective, party brand or ticket seller; "unclear" if you cannot tell,
  "price": the lowest ticket price as shown ("€15", "15€", "Free"), or null,
  "priceFrom": that lowest price as a number in EUR, or null,
  "isFree": true only if the page says entry is free,
  "priceQuote": the passage copied EXACTLY from the page that states the price, or null
}

PAGE TEXT:
${pageText.slice(0, 30_000)}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(45_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  const a = text.indexOf('{'); const b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('second check: no JSON from the reader');
  const f = JSON.parse(text.slice(a, b + 1)) as PageFields;
  if (!['venue', 'organiser', 'unclear'].includes(f.venueRole)) f.venueRole = 'unclear';
  return f;
}
