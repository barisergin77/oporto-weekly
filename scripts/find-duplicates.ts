/**
 * Audit data/events/*.json for duplicate events and duplicate venues.
 *
 *   npm run find-duplicates            # report (strong + review candidates)
 *   npm run find-duplicates -- --check # exit 1 if any STRONG duplicate exists
 *
 * STRONG event pairs are what lib/event-identity.ts isSameEvent() would merge
 * in the pipeline (same canonical venue or a placeholder venue, overlapping
 * dates, matching distinctive name). REVIEW pairs are looser leads for a human:
 * similar names with overlapping dates at different venues, or contained
 * names where one side is a single day. Recurring events on different dates
 * are never reported.
 *
 * Venue candidates: canonical venue slugs (after data/venue-aliases.json)
 * whose names reduce to the same distinctive words once language variants
 * and generic words (Museu/Museo/Museum, Fundação/Foundation, Club, Park…)
 * are dropped, or that differ by one or two letters (Eléctrico/Elétrico).
 * Add confirmed ones to data/venue-aliases.json.
 *
 * Read-only: never writes data.
 */

import fs from 'fs';
import { listEvents, type EventRecord } from '../lib/events';
import {
  compareNames,
  datesOverlap,
  isMultiDay,
  isVagueVenue,
  nameTokens,
  sameEventReason,
  venueKey,
} from '../lib/event-identity';
import { canonicalVenueSlugFor, hasVenuePage } from '../lib/venues';

const check = process.argv.includes('--check');
const events = listEvents().sort((a, b) => a.date.localeCompare(b.date));

const fmt = (e: EventRecord) =>
  `${e.slug}\n      "${e.name}" · ${e.date.slice(0, 10)}${e.endDate ? '→' + e.endDate.slice(0, 10) : ''} · ${e.venue}`;

// ---------------------------------------------------------------- events
// Document frequency of name tokens: a token in ≤3 names ("gehry", "holzer")
// is distinctive enough to flag a same-venue pair across languages.
const df = new Map<string, number>();
for (const e of events) nameTokens(e.name).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
const daysApart = (a: EventRecord, b: EventRecord) =>
  Math.abs(Date.parse(a.date.slice(0, 10)) - Date.parse(b.date.slice(0, 10))) / 86_400_000;

const strong: Array<[EventRecord, EventRecord, string]> = [];
const review: Array<[EventRecord, EventRecord, string]> = [];
for (let i = 0; i < events.length; i++) {
  for (let j = i + 1; j < events.length; j++) {
    const a = events[i];
    const b = events[j];
    const why = sameEventReason(a, b);
    if (why) { strong.push([a, b, why]); continue; }
    const va = venueKey(a);
    const vb = venueKey(b);
    const ta = nameTokens(a.name, va === vb ? va : undefined);
    const tb = nameTokens(b.name, va === vb ? vb : undefined);
    const m = compareNames(ta, tb);
    // R1: matching names, overlapping dates, different venues.
    if (m && va !== vb && datesOverlap(a, b, 3)) { review.push([a, b, `${m} name, venues ${va} / ${vb}`]); continue; }
    if (va !== vb) continue;
    // A long run re-extracted weekly with that week as its range: same venue,
    // dates don't overlap, at least one multi-day, starts within ~6 months.
    const longRun = (isMultiDay(a) || isMultiDay(b)) && daysApart(a, b) <= 180;
    // R2: matching name at the same venue, a long run on disjoint dates.
    if (m && longRun) { review.push([a, b, `${m} name, same venue ${va}, disjoint dates`]); continue; }
    // R3: shares a rare distinctive token (cross-language titles).
    const rare = Array.from(ta).filter((t) => tb.has(t) && t.length >= 4 && (df.get(t) ?? 0) <= 3);
    if (rare.length && (datesOverlap(a, b, 3) || longRun)) review.push([a, b, `shares rare token(s) ${rare.join(', ')}, same venue ${va}`]);
  }
}

// ---------------------------------------------------------------- venues
const GENERIC = new Set([
  'the', 'a', 'of', 'de', 'da', 'do', 'das', 'dos', 'del', 'e', 'y', 'and', 'at', 'porto', 'oporto',
  'museu', 'museo', 'museum', 'fundacao', 'foundation', 'fundacion', 'parque', 'park', 'jardim', 'jardins',
  'garden', 'gardens', 'club', 'clube', 'bar', 'galeria', 'gallery', 'galerias', 'teatro', 'theatre', 'theater',
  'centro', 'center', 'centre', 'arte', 'art', 'contemporanea', 'contemporaneo', 'contemporary', 'sala',
  'venue', 'municipal', 'biblioteca', 'library', 'nacional', 'national', 'mercado', 'market', 'praca', 'square',
  'rua', 'r', 'av', 'avenida', 'largo', 'igreja', 'church', 'mosteiro', 'monastery', 'estacao', 'station',
]);
const venueWords = (slug: string) => new Set(slug.split('-').filter((t) => t && !GENERIC.has(t)));
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const venues = new Map<string, Set<string>>(); // canonical slug → raw venue strings
const staleSlugs: string[] = [];
for (const e of events) {
  const v = canonicalVenueSlugFor(e.venue);
  if (!venues.has(v)) venues.set(v, new Set());
  venues.get(v)!.add(e.venue);
}
// Stored venueSlug that isn't what the alias map now computes (needs data rewrite).
for (const f of fs.readdirSync('data/events').filter((n) => n.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(`data/events/${f}`, 'utf-8')) as EventRecord;
  if (raw.venueSlug !== canonicalVenueSlugFor(raw.venue)) staleSlugs.push(`${raw.slug}: ${raw.venueSlug} → ${canonicalVenueSlugFor(raw.venue)}`);
}

const venueSlugs = Array.from(venues.keys()).filter(hasVenuePage).sort();
const venuePairs: string[] = [];
for (let i = 0; i < venueSlugs.length; i++) {
  for (let j = i + 1; j < venueSlugs.length; j++) {
    const a = venueSlugs[i];
    const b = venueSlugs[j];
    if (isVagueVenue(a) || isVagueVenue(b)) continue;
    const wa = venueWords(a);
    const wb = venueWords(b);
    let why = '';
    if (wa.size && wb.size) {
      let inter = 0;
      wa.forEach((t) => { if (wb.has(t)) inter++; });
      if (inter === wa.size && inter === wb.size) why = 'same distinctive words';
      else if (inter === Math.min(wa.size, wb.size)) why = 'distinctive words contained';
    }
    if (!why && Math.min(a.length, b.length) >= 8 && editDistance(a, b) <= 2) why = 'near-identical spelling';
    if (why) venuePairs.push(`  ${a}  ⇄  ${b}   (${why})\n      ${Array.from(venues.get(a)!).join(' ; ')}  |  ${Array.from(venues.get(b)!).join(' ; ')}`);
  }
}

// ---------------------------------------------------------------- report
console.log(`${events.length} events, ${venueSlugs.length} venue pages\n`);
console.log(`STRONG duplicate events (${strong.length}) — the pipeline would now merge these:`);
for (const [a, b, why] of strong) console.log(`  [${why}]\n    ${fmt(a)}\n    ${fmt(b)}`);
console.log(`\nREVIEW event pairs (${review.length}) — similar names, overlapping dates; check by hand:`);
for (const [a, b, why] of review) console.log(`  [${why}]\n    ${fmt(a)}\n    ${fmt(b)}`);
console.log(`\nVENUE candidates (${venuePairs.length}) — add confirmed ones to data/venue-aliases.json:`);
for (const p of venuePairs) console.log(p);
console.log(`\nStored venueSlug out of date (${staleSlugs.length}):`);
for (const s of staleSlugs) console.log(`  ${s}`);

if (check && (strong.length || staleSlugs.length)) {
  console.error(`\n--check failed: ${strong.length} strong duplicate event pair(s), ${staleSlugs.length} stale venueSlug(s).`);
  process.exit(1);
}
