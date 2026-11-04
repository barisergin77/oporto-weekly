/**
 * "Is this the same event?" — shared by the extraction pipeline
 * (findExistingEventByIdentity), the forward scan and
 * scripts/find-duplicates.ts.
 *
 * Owner report 2026-10-25: "Jenny Holzer: Wrong Answers" (Serralves Museum)
 * and "\"Wrong Answers\" Exhibition" (Museo de Arte Contemporáneo de
 * Serralves) were two records, as were two "Porto Contemporary Art
 * Exhibition" entries under different placeholder venues. Exact
 * (name, venue) identity can't see either.
 *
 * Deliberately conservative — a false merge hides a real event:
 *   - dates must overlap (±1 day), so a weekly residency on different
 *     dates is never "the same event";
 *   - the venue must be the same canonical venue, except when one side is a
 *     placeholder ("Various Galleries") — then the names must match exactly
 *     after normalisation;
 *   - a name contained in another ("Wrong Answers" ⊂ "Jenny Holzer: Wrong
 *     Answers") only counts when both are multi-day runs, so a festival
 *     night ("Porto Jazz Festival: X", one day) is never folded into the
 *     festival itself.
 *
 * 2026-11-01 (event-coverage audit): records carry a PT title in `namePt`
 * and PT sources name events in Portuguese, so "Sinfonia Órgão" (CdM's PT
 * page) never matched the existing "Organ Symphony" and became a second
 * record. Every name variant (name / namePt) on each side is now compared,
 * and a few common PT words fold to their EN form (sinfonia → symphony,
 * órgão → organ, maratona → marathon) before tokens are compared.
 */

import type { EventRecord } from './events';
import { canonicalVenueSlug, canonicalVenueSlugFor, hasVenuePage, kebab } from './venues';

/** Words that don't distinguish one event from another (EN / PT / ES). */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'of', 'in', 'at', 'on', 'for', 'with', 'by', 'to',
  'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'com', 'um', 'uma',
  'el', 'la', 'los', 'las', 'del', 'y', 'en', 'con',
  'porto', 'oporto',
  'exhibition', 'exhibit', 'exposicao', 'exposicion', 'expo', 'mostra', 'show', 'retrospective', 'retrospectiva',
  'opening', 'inauguracao', 'vernissage', 'final', 'last', 'days', 'chance', 'closing',
]);

/**
 * PT (and a few ES/EN spelling) words folded to one EN form so a Portuguese
 * title and its English record share tokens. Keep to unambiguous words.
 */
const FOLD: Record<string, string> = {
  sinfonia: 'symphony', sinfonica: 'symphony', symphonic: 'symphony',
  orgao: 'organ', orquestra: 'orchestra', orquesta: 'orchestra', coro: 'choir',
  maratona: 'marathon', natal: 'christmas', noite: 'night', mercado: 'market', feira: 'fair',
  danca: 'dance', teatro: 'theatre', theater: 'theatre', jardim: 'garden', luz: 'light',
  concerto: 'concert', concertos: 'concert', concerts: 'concert', bailado: 'ballet',
};

/** Distinctive name tokens; venue words dropped ("… at Serralves"). */
export function nameTokens(name: string, venueSlug?: string): Set<string> {
  const all = kebab(name).split('-').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d{4}$/.test(t)).map((t) => FOLD[t] ?? t);
  const venueWords = new Set((venueSlug ?? '').split('-').map((t) => FOLD[t] ?? t));
  const distinct = all.filter((t) => !venueWords.has(t));
  return new Set(distinct.length ? distinct : all);
}

export type NameMatch = 'equal' | 'similar' | 'contained' | null;

export function compareNames(a: Set<string>, b: Set<string>): NameMatch {
  if (a.size === 0 || b.size === 0) return null;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  if (inter === a.size && a.size === b.size) return 'equal';
  if (inter / (a.size + b.size - inter) >= 0.6) return 'similar';
  if (inter === Math.min(a.size, b.size) && inter >= 2) return 'contained';
  return null;
}

type Dated = { date: string; endDate?: string | null };
const day = (iso: string) => iso.slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(day(iso) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const isMultiDay = (e: Dated) => Boolean(e.endDate) && day(e.endDate!) > day(e.date);
export function datesOverlap(a: Dated, b: Dated, slackDays = 1): boolean {
  return day(a.date) <= addDays(b.endDate || b.date, slackDays) && day(b.date) <= addDays(a.endDate || a.date, slackDays);
}

export interface EventLike extends Dated {
  name: string;
  description?: string | null;
  longDescription?: string | null;
  /** PT title (records: only when it differs from `name`). Compared too. */
  namePt?: string | null;
  venue: string;
  venueSlug?: string;
}

/** Every distinct title an event goes by (name, namePt). */
export const nameVariants = (e: Pick<EventLike, 'name' | 'namePt'>): string[] =>
  e.namePt?.trim() && e.namePt.trim() !== e.name ? [e.name, e.namePt.trim()] : [e.name];

const MATCH_RANK: Record<Exclude<NameMatch, null>, number> = { equal: 3, similar: 2, contained: 1 };

/** Best name match over all name variants of `a` and `b`. */
export function compareEventNames(a: Pick<EventLike, 'name' | 'namePt'>, b: Pick<EventLike, 'name' | 'namePt'>, va?: string, vb?: string): NameMatch {
  let best: NameMatch = null;
  for (const na of nameVariants(a)) {
    for (const nb of nameVariants(b)) {
      const m = compareNames(nameTokens(na, va), nameTokens(nb, vb));
      if (m && (!best || MATCH_RANK[m] > MATCH_RANK[best])) best = m;
    }
  }
  return best;
}

/** Canonical venue slug of a record (stored slug may predate the alias map). */
export function venueKey(e: EventLike): string {
  return canonicalVenueSlug(e.venueSlug) ?? canonicalVenueSlugFor(e.venue);
}

/** Placeholder or multi-venue listing ("Various Galleries", "X & Various"). */
export function isVagueVenue(slug: string): boolean {
  return !hasVenuePage(slug) || /(^|-)(various|multiple|varies|vary|tbc|tbd)(-|$)/.test(slug);
}

/**
 * isVagueVenue plus PT "many places" venues ("Vários locais", "Diversos
 * locais"), for identity only: "EDP Maratona do Porto" (Vários locais) and
 * "EDP Porto Marathon" (Queimódromo) were two records (#37, 2026-11-02).
 * Kept out of isVagueVenue itself, which also gates venue pages and Gomry.
 */
const isVagueForIdentity = (slug: string) => isVagueVenue(slug) || /(^|-)(varios|diversos)-(locais|lugares|espacos)(-|$)/.test(slug);

/** Why two records are the same event, or null. */
export function sameEventReason(a: EventLike, b: EventLike): string | null {
  if (!datesOverlap(a, b)) return null;
  const va = venueKey(a);
  const vb = venueKey(b);
  const sameVenue = va === vb;
  if (!sameVenue && !(isVagueForIdentity(va) || isVagueForIdentity(vb))) return null;

  if (!sameVenue) {
    // Venue words only get dropped at a shared venue ("Joan Miró at Serralves"
    // vs "Joan Miró"); across venues compare the full names.
    return compareEventNames(a, b) === 'equal'
      ? `same name, vague venue (${va} / ${vb})`
      : null;
  }
  const m = compareEventNames(a, b, va, vb);
  if (!m) return null;
  if (m === 'contained' && !(isMultiDay(a) && isMultiDay(b))) return null;
  return `${m} name, same venue (${va})`;
}

/**
 * Same organiser/ticketing page → same event (owner OK 2026-10-27). The
 * 10-26 forward scan wrote Moonspell (Hard Club) and Voulez-Vous (Maria
 * Pistolas) twice each under different names from the same source page,
 * which the name match can't see. Still requires the same canonical venue
 * and the exact same dates (a festival page also lists its single nights),
 * and ignores homepages and generic agenda/listing pages.
 */
export function normalizeEventUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return null;
  const last = segs[segs.length - 1];
  if (/^(agenda|programa|programacao|programação|programme|program|eventos?|events?|calendar|calendario|whats-on|concertos|concerts|espetaculos|bilheteira|tickets?|pt|en)$/.test(last)) return null;
  const params = new URLSearchParams(u.search);
  Array.from(params.keys()).forEach((k) => { if (/^(utm_|fbclid|gclid|mc_|ref$)/.test(k)) params.delete(k); });
  params.sort();
  const q = params.toString();
  return u.hostname.toLowerCase().replace(/^www\./, '') + path + (q ? `?${q}` : '');
}

export function sameSourcePageReason(a: EventLike & { externalLink?: string | null }, b: EventLike & { externalLink?: string | null }): string | null {
  const ua = normalizeEventUrl(a.externalLink);
  if (!ua) return null;
  const ub = normalizeEventUrl(b.externalLink);
  if (!ub) return null;
  if (ua !== ub) return sameSiteOtherLanguageReason(a, b);
  // Exact same dates: a festival page also hosts its single nights
  // (Primavera Sound: the festival and "The xx + Big Thief" share one URL).
  if (!sameDays(a, b)) return null;
  const va = venueKey(a);
  return va === venueKey(b) ? `same source page (${ua}), same venue (${va})` : null;
}

const endDay = (e: Dated) => day(e.endDate || e.date);
const sameDays = (a: Dated, b: Dated) => day(a.date) === day(b.date) && endDay(a) === endDay(b);
const startTime = (e: Dated) => (/T(\d{2}:\d{2})/.exec(e.date)?.[1] ?? null);

/**
 * Multi-venue listing, ticketing and municipal agenda sites: one host, many
 * venues and many events per evening (agenda-porto.pt lists three TMP Campo
 * Alegre shows all at 19:30 on 11-06), so "same site" says nothing there.
 */
const LISTING_HOSTS = new Set([
  'agenda-porto.pt', 'visitporto.travel', 'cm-porto.pt', 'portoalive.pt', 'cm-matosinhos.pt', 'cm-gaia.pt',
  'bol.pt', 'ticketline.pt', 'blueticket.pt', 'feverup.com', 'shotgun.live', '3cket.com', 'seetickets.com',
  'eventbrite.com', 'eventbrite.pt', 'viralagenda.com', 'xceed.me', 'dice.fm', 'ra.co',
]);

/** Registrable domain ("www.serralves.pt" → "serralves.pt", "x.com.pt" kept 3 labels). */
export function siteOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  const p = host.split('.');
  const n = p.length >= 3 && /^(com|org|gov|edu|co|net)$/.test(p[p.length - 2]) ? 3 : 2;
  return p.slice(-n).join('.');
}

const LANG_SEG = /^(en|pt|es|fr|de)(-[a-z]{2})?$/;
/**
 * Page language from the URL ("/en/event/x" → en, "?lang=pt" → pt, "x-en"
 * → en), "" when the URL doesn't say (the site's default language), and the
 * path with the language marker removed, so /en/x and /x are one page.
 */
export function urlLanguage(url: string): { lang: string; page: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  let lang = '';
  const segs = u.pathname.toLowerCase().split('/').filter(Boolean).filter((s) => {
    if (LANG_SEG.test(s)) { lang = s.slice(0, 2); return false; }
    return true;
  });
  const q = u.searchParams.get('lang') ?? u.searchParams.get('language') ?? u.searchParams.get('locale');
  if (q) lang = q.toLowerCase().slice(0, 2);
  if (segs.length) {
    const m = /^(.*?)[-_](en|pt)$/.exec(segs[segs.length - 1]);
    if (m && m[1]) { lang = lang || m[2]; segs[segs.length - 1] = m[1]; }
  }
  return { lang, page: siteOf(url) + '/' + segs.join('/') };
}

/**
 * Backlog #37 (owner OK 2026-11-02): the forward scan picks up the PT and the
 * EN page of one event on the venue's own site, under translated names and
 * different slugs (casadamusica.com/event/irmaos-jussen vs
 * /en/event/jussen-brothers; serralves.pt "O MUSEU COMO PERFORMANCE" vs
 * /en/… "THE MUSEUM AS PERFORMANCE"), so neither the name nor the URL match
 * sees it. Same event when ALL of:
 *   - same site (registrable domain), not a listing/ticketing host;
 *   - same canonical venue, not a placeholder;
 *   - identical start day and end day;
 * and EITHER the two URLs are one page in two languages (/en/x vs /x), OR
 * the pages are in different languages and
 *   - both have a start time: the times are equal, or
 *   - otherwise: the names share a distinctive word ("performance") or
 *     match by name (namePt / PT→EN folding).
 * Checked against all 878 records 2026-11-02: 40 same-site, same-venue,
 * same-day pairs; the rule matches exactly 3, all real EN/PT duplicates
 * (Jussen 11-05, The Art of Fugue 11-08, The Museum as Performance 11-07).
 * Same time but same page language (three TMP shows at 19:30 on
 * agenda-porto.pt, a listing host anyway), different end dates (GMP opening
 * vs the exhibition) or different times (CdM, Serralves, Coliseu same-day
 * programmes) stay separate.
 */
export function sameSiteOtherLanguageReason(a: EventLike & { externalLink?: string | null }, b: EventLike & { externalLink?: string | null }): string | null {
  if (!a.externalLink || !b.externalLink) return null;
  const site = siteOf(a.externalLink);
  if (!site || site !== siteOf(b.externalLink) || LISTING_HOSTS.has(site)) return null;
  const va = venueKey(a);
  if (va !== venueKey(b) || isVagueForIdentity(va)) return null;
  if (!sameDays(a, b)) return null;
  const la = urlLanguage(a.externalLink);
  const lb = urlLanguage(b.externalLink);
  if (!la || !lb) return null;
  if (la.page === lb.page) return `same page in two languages (${la.page}), same venue (${va})`;
  if (la.lang === lb.lang) return null;
  const ta = startTime(a);
  const tb = startTime(b);
  if (ta && tb) return ta === tb ? `${site} EN/PT pages, same venue (${va}), same day and time (${ta})` : null;
  const na = new Set(nameVariants(a).flatMap((n) => Array.from(nameTokens(n, va))));
  const shared = nameVariants(b).flatMap((n) => Array.from(nameTokens(n, va))).filter((t) => t.length >= 4 && na.has(t));
  if (shared.length || compareEventNames(a, b, va, va)) return `${site} EN/PT pages, same venue (${va}), same days, shared name (${shared[0] ?? 'variant'})`;
  return null;
}

/**
 * Backlog #38b (owner OK 2026-11-04): the same show on two different sites
 * under two spellings. Isabél Zuaa "AFRO SALOYÁ" (teatromunicipaldoporto.pt)
 * and "AFRO SAL.OYÁ" (bol.pt, venue "Rivoli Palco do Grande Auditório") at the
 * Rivoli on 11-06 at 19:30 share no URL and too few words for the name match.
 * Same event when ALL of:
 *   - same canonical venue, not a placeholder;
 *   - same start day AND the same stated start time (both sides have one);
 *   - the names share a rare word: 4+ letters, in at most RARE_MAX names
 *     among the known records (`isRare`), venue words dropped.
 * Different shows at one venue at one time (two rooms at Casa da Música at
 * 21:00) don't share a rare word; weekly nights differ by day.
 */
export const RARE_MAX = 3;
/** Format words that are rare in titles but say nothing about which show it is. */
const FORMAT_WORDS = new Set(['solo', 'group', 'collective', 'coletiva', 'colectiva', 'individual', 'duo', 'trio', 'quartet', 'quarteto', 'launch', 'lancamento', 'talk', 'conversa', 'workshop', 'oficina', 'visit', 'visita', 'guided', 'guiada']);
const runDays = (e: Dated) => (Date.parse(endDay(e)) - Date.parse(day(e.date))) / 86_400_000;
export function sameStartRareWordReason(a: EventLike, b: EventLike, isRare: (token: string) => boolean): string | null {
  const ta = startTime(a);
  if (!ta || ta !== startTime(b) || day(a.date) !== day(b.date)) return null;
  // An opening night and the exhibition it opens start together (GMP 11-21:
  // one opening for three shows); a long run is never the same as a one-off.
  if ((runDays(a) > 3) !== (runDays(b) > 3)) return null;
  const va = venueKey(a);
  if (va !== venueKey(b) || isVagueForIdentity(va)) return null;
  const na = new Set(nameVariants(a).flatMap((n) => Array.from(nameTokens(n, va))));
  const shared = nameVariants(b).flatMap((n) => Array.from(nameTokens(n, va))).find((t) => t.length >= 4 && !FORMAT_WORDS.has(t) && na.has(t) && isRare(t));
  return shared ? `same venue (${va}), same start (${day(a.date)} ${ta}), shared rare word (${shared})` : null;
}

const rarityCache = new WeakMap<readonly EventLike[], Map<string, number>>();
/** Name-token document frequency over `events` (cached per array) → "is this word rare?". */
export function rareTokens(events: readonly EventLike[]): (token: string) => boolean {
  let df = rarityCache.get(events);
  if (!df) {
    const m = new Map<string, number>();
    for (const e of events) {
      new Set(nameVariants(e).flatMap((n) => Array.from(nameTokens(n)))).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
    }
    rarityCache.set(events, m);
    df = m;
  }
  const counts = df;
  return (t) => (counts.get(t) ?? 0) <= RARE_MAX;
}

/**
 * Backlog #26c (owner OK 2026-11-04: "stop using aggregator sites if the event
 * is already added from the venue page"). On 11-04, 3 of 4 duplicates were
 * agenda-porto.pt copies of events already listed from the venue's or ticket
 * seller's page, under other titles and venue spellings: Accordia ("Serralves"
 * vs "Livraria de Serralves"), Nativo ("Palácio do Bolhão" vs "Teatro do
 * Bolhão"), the OSP solidarity concert ("Orquestra Sinfónica do Porto Casa da
 * Música" vs "Concerto Solidário · Liga Portuguesa Contra o Cancro").
 * An aggregator page is the same event as a record from a non-aggregator page
 * when both state the same day and start time at the same place: the same
 * canonical venue, or venues sharing a distinctive word ("serralves",
 * "bolhao"). No name match needed: the aggregator retitles. The cost is that
 * a second show at the same venue and minute, listed only on the aggregator,
 * is skipped; the owner prefers that to duplicates.
 */
export const AGGREGATOR_SITES = new Set(['agenda-porto.pt', 'viralagenda.com', 'agendaculturalporto.org', 'e-cultura.pt', 'rottacuradoria.com.br', 'portoalive.pt', 'visitporto.travel', 'sustainableliving.pt']);
const GENERIC_VENUE_WORDS = new Set(['teatro', 'theatre', 'theater', 'palacio', 'palace', 'livraria', 'museu', 'museum', 'galeria', 'gallery', 'centro', 'centre', 'center', 'casa', 'auditorio', 'jardim', 'garden', 'igreja', 'church', 'biblioteca', 'library', 'mercado', 'market', 'praca', 'square', 'municipal', 'cultural', 'cultura', 'espaco', 'space', 'porto', 'oporto', 'sala', 'salao', 'grande', 'clube', 'club', 'fundacao', 'foundation', 'cinema', 'escola', 'school', 'hotel', 'restaurante', 'restaurant']);
const venueWords = (e: EventLike) => new Set([venueKey(e), canonicalVenueSlugFor(e.venue)].flatMap((s) => s.split('-')).filter((w) => w.length >= 5 && !GENERIC_VENUE_WORDS.has(w)));
export function aggregatorCopyReason(a: EventLike & { externalLink?: string | null }, b: EventLike & { externalLink?: string | null }): string | null {
  const sa = siteOf(a.externalLink);
  const sb = siteOf(b.externalLink);
  if (!sa || !sb || AGGREGATOR_SITES.has(sa) === AGGREGATOR_SITES.has(sb)) return null;
  const ta = startTime(a);
  if (!ta || ta !== startTime(b) || day(a.date) !== day(b.date)) return null;
  const va = venueKey(a);
  const vb = venueKey(b);
  if (isVagueForIdentity(va) || isVagueForIdentity(vb)) return null;
  let where = `same venue (${va})`;
  if (va !== vb) {
    const wb = venueWords(b);
    const shared = Array.from(venueWords(a)).find((w) => wb.has(w));
    if (!shared) return null;
    where = `venues share "${shared}" (${va} / ${vb})`;
  }
  // The aggregator's title must point at the other record: one of its words
  // (venue words dropped) in that record's name or copy. "Orquestra Sinfónica
  // do Porto" is in the solidarity concert's description; an unrelated show in
  // the next room at the same minute is not.
  const [agg, own] = AGGREGATOR_SITES.has(sa) ? [a, b] : [b, a];
  const vw = new Set([...Array.from(venueWords(agg)), ...Array.from(venueWords(own)), ...venueKey(agg).split('-'), ...venueKey(own).split('-')]);
  const ownWords = new Set([own.name, own.namePt ?? '', own.description ?? '', own.longDescription ?? ''].flatMap((t) => Array.from(nameTokens(t))));
  const hit = nameVariants(agg).flatMap((n) => Array.from(nameTokens(n))).find((t) => t.length >= 4 && !vw.has(t) && ownWords.has(t));
  if (!hit) return null;
  return `aggregator copy (${AGGREGATOR_SITES.has(sa) ? sa : sb}): ${where}, same day and time (${day(a.date)} ${ta}), "${hit}" in the other record`;
}

export function isSameEvent(a: EventLike, b: EventLike): boolean {
  return sameEventReason(a, b) !== null;
}

/** Among duplicates, the record to keep: oldest addedAt (most enrichment). */
export function pickCanonical<T extends Pick<EventRecord, 'addedAt'>>(records: T[]): T {
  return records.slice().sort((x, y) => x.addedAt.localeCompare(y.addedAt))[0];
}
