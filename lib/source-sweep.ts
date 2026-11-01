/**
 * Daily event "source sweep" — pure logic (no network, no fs). The collectors
 * and the run live in scripts/source-sweep.ts; the server job is
 * ~/oporto-sweep/run.sh (06:00 UTC).
 *
 * Owner decisions 2026-11-01 (event-coverage audit, ~20% coverage):
 *   - Read venue and ticketing listings directly (Coliseu, Super Bock Arena,
 *     BOL, Agenda Porto, Dice venue pages, Fever dated one-offs, Shotgun,
 *     Serralves, Casa da Música). Never Ticketline (robots blocks bots), RA,
 *     Eventbrite or Meetup.
 *   - Events from reliable structured sources publish on their own, after the
 *     forward scan's page check (lib/forward-scan.ts verifyCandidate). Club
 *     nights (Shotgun, Dice) only at allowlisted venues. Everything uncertain
 *     goes to a short daily review digest in Discord #oporto-weekly.
 *
 * Pipeline: collect → window → Porto area → editorial filter → collapse
 * sessions → merge across sources → dedupe against data/events → route.
 */

import { compareEventNames, datesOverlap, isVagueVenue, normalizeEventUrl } from './event-identity';
import { canonicalVenueSlugFor, kebab } from './venues';

export type SweepSource =
  | 'coliseu' | 'superbockarena' | 'bol' | 'agendaporto' | 'dice' | 'fever' | 'shotgun' | 'serralves' | 'casadamusica';

export const SOURCES: SweepSource[] = ['coliseu', 'superbockarena', 'bol', 'agendaporto', 'dice', 'fever', 'shotgun', 'serralves', 'casadamusica'];

/** Run Serralves and Casa da Música (Firecrawl) once a week. */
export const WEEKLY_SOURCES: SweepSource[] = ['serralves', 'casadamusica'];

export interface SweepCandidate {
  source: SweepSource;
  /** Stable id within the source (event id, URL path, slug). */
  sourceId: string;
  name: string;
  /** Europe/Lisbon wall clock: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM". */
  date: string;
  endDate?: string;
  venue: string;
  address?: string;
  postalCode?: string;
  city?: string;
  url: string;
  price?: string;
  priceFrom?: number;
  tags: string[];
  /** Every session start ("YYYY-MM-DD[THH:MM]") once sessions are collapsed. */
  sessions?: string[];
  /** Venue's own event data as text, for sites that are JavaScript-only (Coliseu) or API-only. */
  pageText?: string;
  /** Set by collapseSessions when sessions spread too far to be one run. */
  recurring?: boolean;
  /** Set by groupFestivalSessions: many session listings of one festival, folded into one. */
  festival?: { sessions: number; venues: string[] };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const day = (iso: string) => iso.slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = new Date(day(iso) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const spanDays = (from: string, to?: string) => (Date.parse(day(to || from)) - Date.parse(day(from))) / 86_400_000;

/** An instant with an offset ("2026-11-07T22:30:00+00:00") → Europe/Lisbon "YYYY-MM-DDTHH:MM". */
export function lisbonWallClock(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return instant.slice(0, 16);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  const hh = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

/** Today in Europe/Lisbon. */
export const lisbonToday = (now: Date = new Date()) => lisbonWallClock(now.toISOString()).slice(0, 10);

export function inWindow(c: Pick<SweepCandidate, 'date' | 'endDate'>, from: string, to: string): boolean {
  return day(c.date) <= to && day(c.endDate || c.date) >= from;
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

/** Source spellings → the venue name our records use (so slugs and venue pages line up). */
const VENUE_NAMES: Array<[RegExp, string]> = [
  [/coliseu/i, 'Coliseu Porto Ageas'],
  [/super ?bock arena|pavilh[aã]o rosa mota/i, 'Super Bock Arena'],
  [/rivoli/i, 'Rivoli Theatre'],
  [/campo alegre/i, 'Teatro Campo Alegre'],
  [/teatro nacional (de )?s(ã|a)o jo(ã|a)o|^tnsj\b/i, 'Teatro Nacional São João'],
  [/mosteiro de s(ã|a)o bento da vit(ó|o)ria/i, 'Mosteiro de São Bento da Vitória'],
  [/teatro carlos alberto|^teca\b/i, 'Teatro Carlos Alberto'],
  [/hard ?club/i, 'Hard Club'],
  [/maus h(á|a)bitos/i, 'Maus Hábitos'],
  [/plano ?b\b/i, 'Plano B'],
  [/p(é|e)?rola negra/i, 'Pérola Negra'],
  [/passos manuel/i, 'Passos Manuel'],
  [/batalha centro de cinema|^batalha$/i, 'Batalha Centro de Cinema'],
  [/constantino nery/i, 'Teatro Municipal Constantino Nery'],
  [/radioclube|^rca\b/i, 'RCA - Radioclube Agramonte'],
  [/^gare( porto)?$|gare porto/i, 'Gare Porto'],
  [/^switch( club)?$/i, 'Switch'],
  [/maria pistolas/i, 'Maria Pistolas'],
  [/lottus/i, 'Lottus'],
  [/m\.?\s?ou\.?\s?co\b|mouco/i, 'M.Ou.Co'],
  [/lovers ?(&|and|e)? ?lollypops/i, 'Lovers & Lollypops'],
  [/ferro bar/i, 'Ferro Bar'],
  [/era uma vez no porto/i, 'Era Uma Vez no Porto'],
  [/s(á|a) da bandeira/i, 'Teatro Sá da Bandeira'],
  [/audit(ó|o)rio municipal de (vila nova de )?gaia/i, 'Auditório Municipal de Gaia'],
  [/casa da m(ú|u)sica/i, 'Casa da Música'],
  [/serralves/i, 'Serralves'],
  [/teatro do bolh(ã|a)o/i, 'Teatro do Bolhão'],
  [/mercado do bolh(ã|a)o/i, 'Mercado do Bolhão'],
  [/f(ó|o)rum da maia/i, 'Fórum da Maia'],
  [/alf(â|a)ndega/i, 'Alfândega do Porto'],
  [/hot five/i, 'Hot Five Jazz&Blues Club'],
  [/galeria municipal do porto/i, 'Galeria Municipal do Porto'],
  [/centro portugu(ê|e)s de fotografia|^cpf$/i, 'Centro Português de Fotografia'],
  [/cais das pedras/i, 'Cais das Pedras'],
  [/baron.?s hall/i, "The Baron's Hall"],
  [/^m-?odu$/i, 'M-ODU'],
  [/cinema trindade|^trindade$/i, 'Cinema Trindade'],
  [/porta-?jazz/i, 'Porta-Jazz'],
];

/** "TMP - Rivoli" → "Rivoli Theatre", "Hard Club LI" → "Hard Club"; unknown names pass through trimmed. */
export function normalizeVenue(raw: string): string {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  for (const [re, name] of VENUE_NAMES) if (re.test(v)) return name;
  return v;
}

/**
 * Club nights publish on their own only at these venues (owner list,
 * 2026-11-01, plus the concert rooms that sell through Dice/Shotgun).
 */
export const CLUB_ALLOWLIST = new Set([
  'gare-porto', 'plano-b', 'perola-negra', 'switch', 'lottus', 'maria-pistolas', 'hard-club', 'passos-manuel',
  'era-uma-vez-no-porto', 'm-ou-co', 'rca-radioclube-agramonte', 'ferro-bar',
  'maus-habitos', 'lovers-lollypops', 'super-bock-arena', 'coliseu-porto-ageas',
]);

/** Porto, Gaia, Matosinhos, Maia, Gondomar, Valongo: postal codes 4000–4479. */
export function portoPostalCode(pc: string | undefined): boolean | undefined {
  const m = (pc ?? '').match(/\b(\d{4})(?:-\d{3})?\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 4000 && n <= 4479;
}
const SINGLE_VENUE: Partial<Record<SweepSource, string>> = { coliseu: 'coliseu-porto-ageas', superbockarena: 'super-bock-arena', serralves: 'serralves', casadamusica: 'casa-da-musica' };
const PORTO_AREA = /\b(porto|gaia|matosinhos|maia|gondomar|le[cç]a|valongo|rio tinto|ermesinde|foz|cedofeita|bonfim|campanh[aã]|paranhos|ramalde|massarelos|aldoar|nevogilde|miragaia|boavista|matosinhos)\b/i;
const OUTSIDE = /\b(lisboa|lisbon|braga|coimbra|aveiro|guimar[aã]es|viana|vila do conde|p[oó]voa de varzim|penafiel|paredes|santo tirso|famalic[aã]o|espinho|feira|ovar|viseu|faro)\b/i;

/** In the Porto area: the postal code decides when there is one, else a known venue or the address. */
export function portoAreaReason(c: SweepCandidate, knownVenues: Set<string>): string | null {
  const pc = portoPostalCode(c.postalCode ?? c.address);
  if (pc === false) return `outside Porto area (postal ${c.postalCode ?? c.address})`;
  if (pc === true) return null;
  if (knownVenues.has(canonicalVenueSlugFor(c.venue))) return null;
  const where = `${c.city ?? ''} ${c.address ?? ''} ${c.venue}`;
  if (OUTSIDE.test(where) && !PORTO_AREA.test(c.city ?? '')) return `outside Porto area (${where.trim()})`;
  // The city's own agenda, and single-venue sources at their own venue, are in Porto by definition.
  if (c.source === 'agendaporto' || SINGLE_VENUE[c.source] === canonicalVenueSlugFor(c.venue)) return null;
  return PORTO_AREA.test(where) ? null : `no Porto address (${where.trim() || 'none'})`;
}

// ---------------------------------------------------------------------------
// Editorial filter
// ---------------------------------------------------------------------------

/** Not events for the site: classes, admissions, tours, networking, online. */
const NOISE = new RegExp([
  'workshops?', 'oficinas?', '\\baula', 'aulas\\b', 'masterclass', '\\bcursos?\\b', 'forma[cç][aã]o', 'semin[aá]rio',
  'visitas? guiadas?', 'visita orientada', 'visita[s]? ao', '^visita', 'guided (tour|visit)', 'walking tour', 'food tour', 'free tour',
  'bilhete de entrada', 'entrada geral', 'admission', 'ingresso', 'pass(e)? anual',
  'planet[aá]rio', 'pub ?crawl', 'tasting', 'prova de vinhos', 'degusta[cç][aã]o',
  'networking', 'business', 'empreendedor', 'webinar', 'online', 'live ?stream',
  'yoga', 'medita[cç][aã]o', 'breathwork', 'pilates',
  '^atividade', 'actividade', 'atividade (pr[aá]tica|sazonal|tem[aá]tica)', 'laborat[oó]rio', 'ateli[eê] ', 'colónia de f[eé]rias', 'campo de f[eé]rias',
  'gift ?card', 'cart[aã]o (oferta|presente)', 'vale(-| )presente', 'voucher', 'assinatura', 'abonnement',
  'escape (room|game)', 'cruzeiro', 'cruise', 'boat tour', 'passeio de barco',
  '^pr[aá]ticas\\b', '^kit\\b', '^gemas\\b', 'clube de leitura', 'hora do conto', 'visitias', '^(geral|museu|zona rural|jardim|bilhete)$',
].join('|'), 'i');
const VENUE_CLASS_TAG = /oficinas?|forma[cç][aã]o|\bcursos?\b|workshop|visitas?\b|masterclass/i;
/** Museum activity rooms (natural history, planetarium): sessions, not events. */
const NOISE_VENUE = /MHNC|Galeria da Biodiversidade|Planet[aá]rio|Museu de Hist[oó]ria Natural/i;

const EXHIBITION = /exposi[cç][aã]o|exhibition|exposi[cç]ões|mostra|instala[cç][aã]o|installation/i;
const FESTIVAL_OR_CYCLE = /festival|fest\b|ciclo|cycle|mostra|retrospectiva|porto\/post\/doc|queer porto|fantasporto|curtas|semana/i;
const CINEMA_VENUES = /batalha|trindade|cinema|casa comum|cineclube/i;
const LIVE_WORDS = /concert|concerto|live|ao vivo|dj|cine-?concerto|m[uú]sica/i;
const AGENDA_NOISE_TAGS = /^(aula|oficina|visita|forma[cç][aã]o)/i;
const RACE = /maratona|marathon|corrida|\brun\b|trail|caminhada|regata/i;

/** Why `c` is not an editorial event (null = keep). */
export function noiseReason(c: SweepCandidate): string | null {
  const name = c.name.trim();
  if (name.length < 2) return 'no title';
  if (!/[a-zà-ú]/i.test(name)) return 'title without letters';
  if (NOISE.test(name)) return `class/admission/tour/networking (${name.match(NOISE)![0]})`;
  if (NOISE_VENUE.test(c.venue)) return `museum activity session (${c.venue})`;
  const tags = c.tags.join(' | ');
  // Venue sites tag their own classes ("Participar · Oficinas", "Curso Livre", "Formação").
  if ((c.source === 'casadamusica' || c.source === 'serralves') && VENUE_CLASS_TAG.test(tags.replace(/oficina de artes/i, ''))) return `class/workshop (tag ${tags.slice(0, 60)})`;
  if (c.source === 'agendaporto') {
    if (c.tags.some((t) => AGENDA_NOISE_TAGS.test(t))) return `class or workshop (tag ${tags})`;
    if (/desporto e movimento/i.test(tags) && !RACE.test(name)) return 'sport class (Desporto e movimento)';
  }
  if (/diariamente|todos os dias|daily/i.test(`${name} ${tags}`)) return 'daily attraction';
  const span = spanDays(c.date, c.endDate);
  if (span > 120 && !EXHIBITION.test(`${name} ${tags}`) && !['serralves'].includes(c.source)) return `run of ${span} days, not an exhibition`;
  // Single film screenings: publish festivals and cycles, not sessions.
  const film = span <= 14 && (/cinema|filme|film\b|screening|sess[aã]o de cinema/i.test(tags) || /(^|[|–—-]\s*)filme\b/i.test(name) || (CINEMA_VENUES.test(c.venue) && !LIVE_WORDS.test(name)));
  if (film && !FESTIVAL_OR_CYCLE.test(`${name} ${tags}`)) return 'single film screening';
  return null;
}

// ---------------------------------------------------------------------------
// Sessions → one record
// ---------------------------------------------------------------------------

/** Sessions further apart than this are a recurring series, not one run: review. */
export const MAX_RUN_DAYS = 45;

const sessionKey = (c: SweepCandidate) =>
  c.source === 'bol' || c.source === 'dice' ? `${c.source}|${normalizeEventUrl(c.url) ?? c.url}` : `${c.source}|${kebab(c.name)}|${canonicalVenueSlugFor(c.venue)}`;

/** Multi-session listings (a theatre run, two nights, matinée + evening) → one candidate with date + endDate. */
export function collapseSessions(cands: SweepCandidate[]): SweepCandidate[] {
  const groups = new Map<string, SweepCandidate[]>();
  for (const c of cands) groups.set(sessionKey(c), [...(groups.get(sessionKey(c)) ?? []), c]);
  const out: SweepCandidate[] = [];
  groups.forEach((g) => {
    if (g.length === 1) { out.push(g[0]); return; }
    const sorted = g.slice().sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const sessions = Array.from(new Set(sorted.flatMap((c) => c.sessions ?? [c.date]))).sort();
    const last = sorted.reduce((m, c) => (day(c.endDate || c.date) > m ? day(c.endDate || c.date) : m), day(first.date));
    out.push({
      ...first,
      endDate: last !== day(first.date) ? last : undefined,
      sessions,
      recurring: spanDays(first.date, last) > MAX_RUN_DAYS || undefined,
      tags: Array.from(new Set(g.flatMap((c) => c.tags))),
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** "Porto/Post/Doc 2026 - Eu, Capitão", "Queer Porto 12 | Mouse" → the festival part. */
export function festivalPrefix(name: string): string | null {
  const m = name.match(/^(.{5,60}?)\s+[|–—-]\s+\S/);
  return m ? m[1].trim() : null;
}

/**
 * A ticketer lists every screening or concert of a festival ("Porto/Post/Doc
 * 2026 - X", ×40). Three or more listings from one source sharing a prefix
 * become ONE festival candidate (date range, sessions, venues), which goes to
 * review: festivals and cycles, not single screenings (owner 2026-11-01).
 */
export function groupFestivalSessions(cands: SweepCandidate[], min = 3): SweepCandidate[] {
  const groups = new Map<string, SweepCandidate[]>();
  for (const c of cands) {
    const p = festivalPrefix(c.name);
    if (p) groups.set(`${c.source}|${kebab(p)}`, [...(groups.get(`${c.source}|${kebab(p)}`) ?? []), c]);
  }
  const folded = new Set<SweepCandidate>();
  const out: SweepCandidate[] = [];
  groups.forEach((g) => {
    if (g.length < min) return;
    g.forEach((c) => folded.add(c));
    const sorted = g.slice().sort((a, b) => a.date.localeCompare(b.date));
    const end = sorted.reduce((m, c) => (day(c.endDate || c.date) > m ? day(c.endDate || c.date) : m), day(sorted[0].date));
    const venues = Array.from(new Set(g.map((c) => c.venue)));
    out.push({
      ...sorted[0],
      sourceId: `festival:${kebab(festivalPrefix(sorted[0].name)!)}`,
      name: festivalPrefix(sorted[0].name)!,
      date: day(sorted[0].date),
      endDate: end !== day(sorted[0].date) ? end : undefined,
      venue: venues.length === 1 ? venues[0] : 'Various venues',
      sessions: sorted.map((c) => c.date),
      festival: { sessions: g.length, venues },
      pageText: undefined,
    });
  });
  return [...cands.filter((c) => !folded.has(c)), ...out].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Across sources
// ---------------------------------------------------------------------------

/** Canonical page priority: venue's own > primary ticketer > agenda. */
export const SOURCE_PRIORITY: SweepSource[] = ['coliseu', 'superbockarena', 'serralves', 'casadamusica', 'bol', 'dice', 'shotgun', 'agendaporto', 'fever'];

export interface SweepCluster {
  primary: SweepCandidate;
  members: SweepCandidate[];
}

/** Two listings of the same event (any sources): same start day, same venue or one vague, matching names. */
export function sameListing(a: SweepCandidate, b: SweepCandidate): boolean {
  if (normalizeEventUrl(a.url) && normalizeEventUrl(a.url) === normalizeEventUrl(b.url)) return true;
  const runs = Boolean(a.endDate && b.endDate);
  if (runs ? !datesOverlap(a, b, 0) : day(a.date) !== day(b.date)) return false;
  const va = canonicalVenueSlugFor(a.venue);
  const vb = canonicalVenueSlugFor(b.venue);
  const venueOk = va === vb || isVagueVenue(va) || isVagueVenue(vb) || !a.venue || !b.venue;
  if (!venueOk) return false;
  const m = compareEventNames(a, b, va === vb ? va : undefined, va === vb ? vb : undefined);
  return m === 'equal' || m === 'similar' || (m === 'contained' && va === vb);
}

export function mergeAcrossSources(cands: SweepCandidate[]): SweepCluster[] {
  const clusters: SweepCluster[] = [];
  for (const c of cands) {
    const hit = clusters.find((k) => k.members.some((m) => sameListing(m, c)));
    if (hit) hit.members.push(c);
    else clusters.push({ primary: c, members: [c] });
  }
  for (const k of clusters) {
    k.members.sort((a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source));
    const p = { ...k.members[0] };
    // Fill what the primary listing lacks from the others (all source-stated).
    for (const m of k.members.slice(1)) {
      p.endDate ??= m.endDate && m.endDate > day(p.date) ? m.endDate : undefined;
      p.price ??= m.price;
      p.priceFrom ??= m.priceFrom;
      p.postalCode ??= m.postalCode;
      p.address ??= m.address;
    }
    k.primary = p;
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const STRUCTURED: SweepSource[] = ['coliseu', 'superbockarena', 'bol', 'agendaporto', 'serralves', 'casadamusica', 'fever'];
const CLUB_SOURCES: SweepSource[] = ['dice', 'shotgun'];
/** Promoter weekly-night templates ("Sat. 07/11 - Maria Pistolas"): not a named event. */
const TEMPLATE_NAME = /^(mon|tue|wed|thu|fri|sat|sun|seg|ter|qua|qui|sex|s[aá]b|dom)[a-z]*\.?\s*\d{1,2}([/.-]\d{1,2}|\s+[a-z]{3})\b|^\d{1,2}[/.]\d{1,2}\s+[a-z]{3}\b/i;
const MULTI_VENUE = /v[aá]rios (locais|espa[cç]os)|various|multiple|diversos locais|cidade do porto|vários/i;

export type Route = { route: 'auto' } | { route: 'review'; reason: string };

/** Auto-publish (still subject to the page check) or the review digest. */
export function routeCandidate(c: SweepCandidate, knownVenues: Set<string>): Route {
  const slug = canonicalVenueSlugFor(c.venue);
  if (c.festival) return { route: 'review', reason: `festival: ${c.festival.sessions} sessions at ${c.festival.venues.slice(0, 3).join(', ')}${c.festival.venues.length > 3 ? '…' : ''}` };
  if (c.recurring) return { route: 'review', reason: `sessions spread over ${Math.round(spanDays(c.date, c.endDate))} days (recurring series?)` };
  if (!c.venue || MULTI_VENUE.test(c.venue) || isVagueVenue(slug)) return { route: 'review', reason: `multi-venue or vague venue (${c.venue || 'none'})` };
  if (TEMPLATE_NAME.test(c.name)) return { route: 'review', reason: 'promoter weekly-night title' };
  // Owner 2026-11-01: publish any decent, real event and sort what shows on top later. Talks,
  // month-only end dates and club nights at any named venue now auto-publish (page check still applies).
  if (CLUB_SOURCES.includes(c.source)) return { route: 'auto' };
  if (!STRUCTURED.includes(c.source)) return { route: 'review', reason: `source ${c.source}` };
  if (c.source === 'fever' && !knownVenues.has(slug)) return { route: 'review', reason: `Fever listing at an unknown venue (${c.venue})` };
  return { route: 'auto' };
}

/** Verification failures that mean "not for us" (dropped, not reviewed). */
export const FINAL_REJECT = /not in the Porto area|sales or trade event/;

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export interface DigestItem { name: string; date: string; endDate?: string; venue: string; url: string; reason?: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(d: string, end?: string): string {
  const f = (x: string) => `${Number(x.slice(8, 10))} ${MONTHS[Number(x.slice(5, 7)) - 1]}`;
  return end && day(end) !== day(d) ? `${f(d)}–${f(end)}` : f(d);
}

export const DISCORD_LIMIT = 1900;

/** Split lines into messages under Discord's 2000-char limit. */
export function splitMessages(lines: string[], limit = DISCORD_LIMIT): string[] {
  const out: string[] = [];
  let cur = '';
  for (const raw of lines) {
    const line = raw.length > limit ? raw.slice(0, limit - 1) + '…' : raw;
    if (cur && cur.length + 1 + line.length > limit) { out.push(cur); cur = line; } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * "Source sweep: N new events published (by source), M for review:" then
 * numbered review lines (name, date, venue, source URL).
 */
export function formatDigest(
  publishedBySource: Partial<Record<SweepSource, number>>,
  review: DigestItem[],
  notes: string[] = [],
  moreReview = 0
): string[] {
  const total = Object.values(publishedBySource).reduce((a, b) => a + (b ?? 0), 0);
  const by = Object.entries(publishedBySource).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ');
  const head = `Source sweep: ${total} new events published${by ? ` (${by})` : ''}, ${review.length + moreReview} for review${review.length ? ':' : '.'}`;
  const lines = [head];
  review.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.name} | ${shortDate(r.date, r.endDate)} | ${r.venue} | <${r.url}>${r.reason ? ` (${r.reason})` : ''}`);
  });
  if (moreReview) lines.push(`…and ${moreReview} more in the sweep log.`);
  if (review.length) lines.push('Reply "add 1,3" to publish or "skip 2" to drop.');
  lines.push(...notes);
  return splitMessages(lines);
}
