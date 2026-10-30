/**
 * Venue identity: slugging + the canonical alias map.
 *
 * The same place reaches us under many names — "Serralves Museum", "Museo de
 * Arte Contemporáneo de Serralves", "Parque de Serralves", "Casa da Música
 * (Sala 2)", "Sala Suggia, Casa da Música" — and each spelling used to become
 * its own /venue/<slug> page (owner report 2026-10-25). data/venue-aliases.json
 * is the single source of truth mapping those spellings to one canonical slug;
 * everything that derives a venue slug goes through canonicalVenueSlugFor().
 *
 * Pure module (no fs) so next.config.mjs, scripts and the pipeline can share it.
 */

import aliasData from '../data/venue-aliases.json';

interface VenueEntry {
  name: string;
  aliases: string[];
}

const VENUES = aliasData.venues as Record<string, VenueEntry>;
const REDIRECT_ONLY = aliasData.redirectOnly as Record<string, string>;

const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, entry] of Object.entries(VENUES)) {
  for (const alias of entry.aliases) ALIAS_TO_CANONICAL.set(alias, canonical);
}

/** Lowercase, strip diacritics/apostrophes, kebab-case. */
export function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (ó → o, ã → a)
    .replace(/['’]/g, '')       // strip apostrophes (Einstein's → Einsteins)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalise a venue name into a slug. Canonicalises sub-rooms into the
 * parent venue:
 *   "Casa da Música"                → casa-da-musica
 *   "Casa da Música, Sala 2"        → casa-da-musica  (strip after comma)
 *   "Casa da Música, Sala Suggia"   → casa-da-musica
 *   "Casa da Música Café"           → casa-da-musica  (strip " Café")
 *   "Hilton Porto Gaia / Pestana"   → hilton-porto-gaia (strip after slash)
 *   "Einstein's"                    → einsteins       (strip apostrophe)
 *
 * Keeping rooms merged means /venue/casa-da-musica aggregates every Casa da
 * Música event regardless of which room, which is what visitors search for.
 *
 * Also used to kebab event NAMES (composeEventSlug), so it must stay free of
 * venue-specific aliasing — that lives in canonicalVenueSlugFor().
 */
export function venueToSlug(venue: string): string {
  // Keep only the "root" venue name: strip after the first comma or slash,
  // and strip a handful of trailing room-denoting suffixes that some sources
  // concatenate without a comma.
  const root = venue
    .split(/[,/]/)[0]
    .trim()
    .replace(/\s+(Café|Cafe|Sala\s+\w+|Main\s+Hall|Auditorium\s+\w+)$/i, '')
    .trim();
  return kebab(root);
}

/** Map an alias slug to its canonical slug; unknown slugs pass through. */
export function canonicalVenueSlug(slug: string): string;
export function canonicalVenueSlug(slug: string | undefined): string | undefined;
export function canonicalVenueSlug(slug: string | undefined): string | undefined {
  if (!slug) return slug;
  return ALIAS_TO_CANONICAL.get(slug) ?? slug;
}

const ROOM_PREFIX = /^(sala|room|terrace|terraco|auditorio|auditorium|studio|estudio|stage|palco)\b/i;

/**
 * The canonical venue slug for a venue string, e.g.
 *   "Museo de Arte Contemporáneo de Serralves" → serralves
 *   "Casa da Música (Sala Suggia)"             → casa-da-musica
 *   "Sala 2, Casa da Música"                   → casa-da-musica
 * Use this (not venueToSlug) wherever a venue slug is stored or compared.
 */
export function canonicalVenueSlugFor(venue: string): string {
  const noParens = venue.replace(/\s*\([^)]*\)/g, '').trim() || venue;
  // "Sala 2, Casa da Música" / "Terrace, Casa da Música": room first, venue
  // second. Only take the second part when it is a venue we know, so
  // "Sala Estúdio IG, Gaia" doesn't collapse into "gaia".
  const segs = noParens.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  if (segs.length > 1 && ROOM_PREFIX.test(kebab(segs[0]).replace(/-/g, ' '))) {
    const parent = canonicalVenueSlug(venueToSlug(segs[1]));
    if (VENUES[parent]) return parent;
  }
  return canonicalVenueSlug(venueToSlug(noParens));
}

/** Display name for a canonical venue, when the alias map defines one. */
export function canonicalVenueName(slug: string): string | undefined {
  return VENUES[slug]?.name;
}

/** Every retired venue slug → canonical slug (for redirects). */
export function venueSlugRedirects(): Array<[string, string]> {
  return [...Array.from(ALIAS_TO_CANONICAL.entries()), ...Object.entries(REDIRECT_ONLY)];
}

/**
 * Placeholder "venues" the extractor emits when a listing has no single real
 * venue ("Various venues", "TBC", "Porto", "Downtown", "City Centre"). A page
 * for these just lumps unrelated events together — thin content Google
 * declines to index (URL Inspection 2026-09-17: /pt/venue/tbc; GSC flagged
 * /venue/downtown as a duplicate on 2026-09-21). No venue page, no venue
 * link, no "more at this venue" block for them.
 *
 * `^city-` covers City Centre / City Center / City-wide / City Bandstands /
 * City Waterfront — all city-scale, none an actual venue.
 */
// A venue name made only of room words ("Library", "Grande Auditório",
// "Museu") names a room, not a place: it would open a thin /venue/library
// page (forward scan, Serralves talk 2026-10-29).
const GENERIC_ROOM_WORDS = new Set(('library biblioteca auditorium auditorio garden gardens jardim jardins sala salao room hall foyer lobby ' +
  'terrace terraco cafe bar lounge museum museu gallery galeria park parque studio estudio stage palco cinema chapel capela ' +
  'cloister claustro courtyard patio atrium main grand great small big little pequeno pequena grande principal upper lower ' +
  'ground floor piso the do da de dos das of at').split(' '));

export function isGenericRoomName(venue: string): boolean {
  const words = kebab(venue).split('-').filter(Boolean);
  return words.length > 0 && words.every((w) => GENERIC_ROOM_WORDS.has(w) || /^\d+$/.test(w));
}

const HOST_VENUES = (aliasData as { hostVenues?: Record<string, string> }).hostVenues ?? {};

/** The venue a single-venue website belongs to (serralves.pt → "Serralves"), if known. */
export function hostVenueName(url: string): string | undefined {
  try {
    return HOST_VENUES[new URL(url).hostname.replace(/^www\./, '')];
  } catch {
    return undefined;
  }
}

export const PLACEHOLDER_VENUE = /^(tbc|tbd|tba|venue-tb[acd]|porto|online|downtown|downtown-porto|central-porto)$|^(various|multiple|city)-|-various$/;

export function hasVenuePage(venueSlug: string | undefined): venueSlug is string {
  return Boolean(venueSlug) && !PLACEHOLDER_VENUE.test(venueSlug!);
}
