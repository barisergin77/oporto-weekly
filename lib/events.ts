/**
 * Structured event records. Extracted from weekly newsletter HTML (phase 1)
 * and written by the Thursday cron going forward (phase 3).
 *
 * One file per event at `data/events/<slug>.json`. Slug embeds the date so
 * recurring events (residencies, weekly markets) don't collide — URL format
 * is `/event/<name>-<mon><day>-<year>`, e.g. `tito-paris-apr-17-2026`.
 *
 * Shape is intentionally aligned with schema.org `Event` so `toEventJsonLd()`
 * is a near-direct mapping.
 */

import fs from 'fs';
import path from 'path';

export type EventCategory =
  | 'music'
  | 'art'
  | 'food'
  | 'family'
  | 'nightlife'
  | 'sports'
  | 'other';

export interface EventImage {
  /** CDN URL (Imgur or direct). Always re-hosted, never hot-linked. */
  url: string;
  /** e.g. "Photo: FEVER Press Release", "Photo: Casa da Música", or the venue name. */
  credit: string;
  /** Where the image originated — ticketing page, venue event page, etc. Used for attribution link. */
  sourceUrl?: string;
}

export interface EventRecord {
  slug: string;
  name: string;
  /** ISO date. Time-of-day included when the newsletter gave us one ("2026-04-17T21:30"). */
  date: string;
  /** Second date for ranges like "Until April 19" — omitted for single-day events. */
  endDate?: string;
  venue: string;
  /** Kebab-case venue slug for `/venue/<slug>` aggregation pages. */
  venueSlug?: string;
  /** Display-as-is price string: "€20-€40", "From €15", "Free". May be undefined if unknown. */
  price?: string;
  /** Numeric starting price for JSON-LD offers. */
  priceFrom?: number;
  currency?: string;
  category: EventCategory;
  /** 1-2 sentence short description — for listings, cards, newsletter, OG. */
  description: string;
  /**
   * 3-paragraph long-form description for the /event/<slug> detail page.
   * Populated separately from extraction via the event-descriptions cron or
   * scripts/enrich-event-descriptions.ts. Falls back to `description` on
   * the detail page when absent.
   */
  longDescription?: string;
  /** Slug of the newsletter edition this event was extracted from. */
  sourceEdition: string;
  /**
   * If the event appears in the newsletter's Editor's Picks section
   * (the numbered "Top Five" list at the top), this holds its 1-based
   * rank — 1 for Pick #1, 2 for Pick #2, etc. Missing means the event
   * is not an Editor's Pick. Used by the Instagram cron to prioritise
   * picks over random upcoming events AND to preserve the editor's
   * intended presentation order.
   */
  editorPickRank?: number;
  /** Populated by the photo-acquisition step (phase 2). */
  image?: EventImage;
  /** External ticket / event URL for the "Get tickets →" link. */
  externalLink?: string;
  /** ISO timestamp — when this record was created. */
  addedAt: string;
}

const EVENTS_DIR = path.join(process.cwd(), 'data', 'events');

export function listEvents(): EventRecord[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  return fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, f), 'utf-8')) as EventRecord)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

export function getEvent(slug: string): EventRecord | null {
  const p = path.join(EVENTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as EventRecord;
}

export function listUpcomingEvents(now: Date = new Date()): EventRecord[] {
  const today = now.toISOString().slice(0, 10);
  return listEvents()
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date)); // upcoming sorted ascending
}

export function listEventsByVenue(venueSlug: string): EventRecord[] {
  return listEvents().filter((e) => e.venueSlug === venueSlug);
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

  return root
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics (ó → o, ã → a)
    .replace(/['\u2019]/g, '')        // strip apostrophes (Einstein's → Einsteins)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * True only for a real ticketing / venue / press page URL.
 * Rejects google.com search URLs (Gemini sometimes returns those as a fallback),
 * file: URLs, relative paths, and anything non-http(s).
 *
 * Used both at page-render time (don't show the "Get tickets" CTA for a
 * google search URL) and at image-acquisition time (don't try to scrape
 * og:image from a search results page).
 */
export function isRealEventUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'google.com' || host.endsWith('.google.com')) return false;
    if (host === 'google.pt' || host.endsWith('.google.pt')) return false;
    if (host.includes('google.') && u.pathname.startsWith('/search')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Compose an event slug like `tito-paris-casa-da-musica-apr-17-2026`.
 * Uses abbreviated month to keep it short but chronologically sortable.
 */
export function composeEventSlug(name: string, venue: string, isoDate: string): string {
  const nameSlug = venueToSlug(name); // same kebab rules
  const venueSlug = venueToSlug(venue);
  const d = new Date(isoDate);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase(); // apr
  const day = d.getDate();
  const year = d.getFullYear();
  return `${nameSlug}-${venueSlug}-${month}-${day}-${year}`;
}

/**
 * Category → emoji used in the placeholder image + breadcrumb.
 * Kept small so the placeholder doesn't feel like a category grid.
 */
export const CATEGORY_EMOJI: Record<EventCategory, string> = {
  music: '🎵',
  art: '🎨',
  food: '🍷',
  family: '👨‍👩‍👧',
  nightlife: '🌙',
  sports: '⚽',
  other: '🎭',
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  music: 'Music',
  art: 'Art & Exhibitions',
  food: 'Food & Wine',
  family: 'Family',
  nightlife: 'Nightlife',
  sports: 'Sports',
  other: 'Other',
};

/**
 * Derive an endDate when an event doesn't declare one.
 *
 * Google Search Console flags missing endDate as a non-critical issue on
 * Event structured data. Rather than leaving it off, we synthesise a
 * reasonable default:
 *   - Timed events (ISO includes "T") — add 2 hours (typical concert/show).
 *   - Date-only events — endDate = startDate (single-day event, same as start).
 *
 * This doesn't hallucinate data because we never persist the derived value
 * back into the record; it only appears in the emitted JSON-LD.
 */
function deriveEndDate(start: string): string {
  const hasTime = start.includes('T');
  if (!hasTime) return start; // single-day event

  // Parse the input as a LOCAL clock time (it has no TZ). Date-construct-
  // and-reformat rather than going through toISOString(), which would flip
  // us to UTC and cause a mismatch between the plain-local startDate and
  // a UTC endDate.
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return start;
  const [, y, mo, d, h, mi] = m;
  const local = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  local.setHours(local.getHours() + 2);

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}` +
    `T${pad(local.getHours())}:${pad(local.getMinutes())}`
  );
}

/**
 * Build a schema.org `performer` object. Google wants this for
 * performance-style events (music, nightlife, sports). For those
 * categories the event name IS the performer in practice
 * ("Tito Paris Concert", "Brahms in Concert"). For art / food / family /
 * other we omit it — forcing a "PerformingGroup" for a food market would
 * be semantically wrong and Google doesn't flag its absence on those.
 */
function derivePerformer(e: EventRecord): { '@type': string; name: string } | null {
  if (e.category !== 'music' && e.category !== 'nightlife' && e.category !== 'sports') {
    return null;
  }
  if (!e.name) return null;
  const type =
    e.category === 'sports' ? 'SportsTeam' :
    e.category === 'nightlife' ? 'Organization' :
    'PerformingGroup';
  return { '@type': type, name: e.name };
}

/** Build a schema.org Event JSON-LD object for rich snippets + Google Events. */
export function toEventJsonLd(e: EventRecord, siteUrl = 'https://oportoweekly.com'): object {
  const url = `${siteUrl}/event/${e.slug}`;

  // Offers: when we have a priceFrom OR the price text says "free", emit.
  // Always include `validFrom` (GSC flags its absence) — we use `addedAt`
  // as a safe "the offer was indexed from this point onwards" anchor.
  const hasPaidOffer = e.priceFrom != null;
  const isFree = !hasPaidOffer && e.price?.toLowerCase().includes('free');
  const offers = hasPaidOffer || isFree
    ? {
        '@type': 'Offer',
        price: hasPaidOffer ? e.priceFrom : 0,
        priceCurrency: e.currency ?? 'EUR',
        url: e.externalLink ?? url,
        availability: 'https://schema.org/InStock',
        validFrom: e.addedAt,
      }
    : undefined;

  const performer = derivePerformer(e);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    description: e.description,
    startDate: e.date,
    // endDate is always emitted — derived when not explicit so GSC's
    // "missing endDate" warning clears.
    endDate: e.endDate ?? deriveEndDate(e.date),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: e.venue,
      address: { '@type': 'PostalAddress', addressLocality: 'Porto', addressCountry: 'PT' },
    },
    ...(e.image ? { image: e.image.url } : {}),
    ...(offers ? { offers } : {}),
    ...(performer ? { performer } : {}),
    url,
    organizer: {
      '@type': 'Organization',
      name: 'Oporto Weekly',
      url: siteUrl,
    },
  };
}
