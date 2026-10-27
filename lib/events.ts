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
import { canonicalVenueSlug, canonicalVenueSlugFor, venueToSlug } from './venues';
import { isSameEvent, sameSourcePageReason, pickCanonical } from './event-identity';

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
  /**
   * European-Portuguese translations for the /pt/event/<slug> page. Populated
   * by the event-translations cron. `namePt` is present only when the name is
   * an editorial/descriptive title that SHOULD translate (e.g. "Paper Costume
   * Parade" → "Cortejo do Traje de Papel"); it's omitted for proper-noun names
   * (bands, venues) that must stay as-is. All fall back to the EN field.
   */
  namePt?: string;
  descriptionPt?: string;
  longDescriptionPt?: string;
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
  /**
   * Set by the daily scan's page reader (lib/forward-scan.ts): a specific,
   * time-sensitive event (concert on a date, festival, premiere, one-off
   * party) that may take an Editor's Pick slot. Always false for runs > 7
   * days. Thursday composition (lib/edition-compose.ts) ranks these first.
   */
  pickCandidate?: boolean;
  /** Fever catalog plan id (data/fever.json) for events created from the Fever catalog (lib/fever.ts). */
  feverId?: string;
  /** Gomry catalog event id (data/gomry.json) for events created from Gomry — FC Porto home matches only (lib/gomry.ts). */
  gomryId?: string;
  /** ISO timestamp — last time the daily scan re-found and re-verified this event. */
  lastSeenAt?: string;
  /** ISO timestamp — when this record was created. */
  addedAt: string;
}

/** `sourceEdition` of events published ahead by the forward scan (lib/forward-scan.ts). */
export const FORWARD_SOURCE = 'forward-scan';

const EVENTS_DIR = path.join(process.cwd(), 'data', 'events');

/**
 * Records written before data/venue-aliases.json existed (or before an alias
 * was added) may carry an alias venueSlug; resolve it on read so venue pages
 * and "more at this venue" always use the canonical slug.
 */
function readEvent(file: string): EventRecord {
  const e = JSON.parse(fs.readFileSync(file, 'utf-8')) as EventRecord;
  if (e.venueSlug) e.venueSlug = canonicalVenueSlug(e.venueSlug);
  return e;
}

export function listEvents(): EventRecord[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  return fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readEvent(path.join(EVENTS_DIR, f)))
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

export function getEvent(slug: string): EventRecord | null {
  const p = path.join(EVENTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  return readEvent(p);
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

// Venue slugging + canonical alias map live in lib/venues.ts (re-exported
// here so existing imports keep working).
export { venueToSlug, hasVenuePage, canonicalVenueSlugFor, canonicalVenueSlug, canonicalVenueName } from './venues';

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
  const venueSlug = canonicalVenueSlugFor(venue);
  const d = new Date(isoDate);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase(); // apr
  const day = d.getDate();
  const year = d.getFullYear();
  return `${nameSlug}-${venueSlug}-${month}-${day}-${year}`;
}

/**
 * Returns the canonical existing event record for a given (name, venue),
 * if one exists. Used by the extraction pipeline to dedupe — if a
 * long-running exhibition (e.g. "It's a Pink Area" at Casa São Roque) was
 * already extracted in a prior week's run, we want to reuse that record's
 * slug rather than create a parallel `<event>-<thisweek>` duplicate.
 *
 * Two tiers:
 *   1. Exact identity (unchanged behaviour): kebab-cased name + canonical
 *      venue slug. Matches across punctuation/casing ("It's a Pink Area" ===
 *      "Its a Pink Area") and venue spellings in data/venue-aliases.json.
 *   2. Fuzzy identity, only when `dates` is given: lib/event-identity.ts
 *      isSameEvent() — distinctive-name match + same canonical venue (or a
 *      placeholder venue with an identical name) + overlapping dates. Catches
 *      "Jenny Holzer: Wrong Answers" vs "Wrong Answers Exhibition" at
 *      Serralves (2026-10-25) without merging a weekly gig's other dates.
 *
 * Among multiple matches we return the OLDEST by addedAt — that record has
 * the most accumulated enrichment (longDescription, image, externalLink)
 * from prior backfill cron runs.
 */
export function findExistingEventByIdentity(
  name: string,
  venue: string,
  dates?: { date: string; endDate?: string | null; url?: string | null },
  events: EventRecord[] = listEvents()
): EventRecord | null {
  const targetName = venueToSlug(name);
  const targetVenue = canonicalVenueSlugFor(venue);
  const exact = events.filter(
    (e) => venueToSlug(e.name) === targetName && canonicalVenueSlugFor(e.venue) === targetVenue
  );
  if (exact.length) return pickCanonical(exact);
  if (!dates?.date) return null;
  const probe = { name, venue, venueSlug: targetVenue, date: dates.date, endDate: dates.endDate, externalLink: dates.url };
  const fuzzy = events.filter((e) => isSameEvent(probe, e) || sameSourcePageReason(probe, e) !== null);
  return fuzzy.length ? pickCanonical(fuzzy) : null;
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

/** European-Portuguese category labels for the /pt/event/ pages. */
export const CATEGORY_LABEL_PT: Record<EventCategory, string> = {
  music: 'Música',
  art: 'Arte e Exposições',
  food: 'Gastronomia e Vinhos',
  family: 'Família',
  nightlife: 'Vida Noturna',
  sports: 'Desporto',
  other: 'Outros',
};

/**
 * Display fields for an event in a given language. PT falls back to the EN
 * field whenever a translation hasn't been generated yet, so a PT page is
 * always complete (just partially English until the translation cron runs).
 */
export function eventDisplay(ev: EventRecord, lang: 'en' | 'pt') {
  if (lang === 'pt') {
    return {
      name: ev.namePt ?? ev.name,
      description: ev.descriptionPt ?? ev.description,
      longDescription: ev.longDescriptionPt ?? ev.longDescription,
    };
  }
  return { name: ev.name, description: ev.description, longDescription: ev.longDescription };
}

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
 * Build a schema.org `performer` object. Always returns a value — GSC's
 * 2026-05-06 Events structured-data audit flagged "Missing field
 * 'performer'" on art / food / family events (non-critical, but they
 * accumulate and the warning email gets sent every cycle).
 *
 * Type picked to match the category's semantics:
 *   - music     → PerformingGroup (artist / band / DJ)
 *   - nightlife → Organization (venue / DJ / promoter)
 *   - sports    → SportsTeam
 *   - art / food / family / other → Organization (organizer or featured
 *     artist / collective / market operator; using a generic Organization
 *     keeps the JSON-LD valid without semantic overreach)
 *
 * Name is the event name itself, which is what readers actually
 * recognize — "Impressive Monet & Brilliant Klimt" is more useful in a
 * SERP performer slot than the venue name.
 */
function derivePerformer(e: EventRecord): { '@type': string; name: string } | null {
  if (!e.name) return null;
  const type =
    e.category === 'sports' ? 'SportsTeam' :
    e.category === 'music' ? 'PerformingGroup' :
    'Organization';
  return { '@type': type, name: e.name };
}

/**
 * Build a schema.org Event JSON-LD object for rich snippets + Google Events.
 * `lang` picks EN vs PT display fields and the page URL (/event vs /pt/event)
 * and stamps inLanguage so Google treats the two as language variants.
 */
export function toEventJsonLd(
  e: EventRecord,
  siteUrl = 'https://oportoweekly.com',
  lang: 'en' | 'pt' = 'en'
): object {
  const disp = eventDisplay(e, lang);
  const url = lang === 'pt'
    ? `${siteUrl}/pt/event/${e.slug}`
    : `${siteUrl}/event/${e.slug}`;

  // Offers: ALWAYS emit, with `price` and `priceCurrency` ALWAYS present.
  //
  // Iteration history:
  //   - 2026-04-30: emitted offers only when we had priceFrom or "free".
  //     GSC: "Missing field 'offers'" for ~60% of events.
  //   - 2026-05-01: always emit offers, but price/priceCurrency only when
  //     known. GSC: "Missing field 'price' (in 'offers')" warning.
  //   - This iteration: price + priceCurrency are always present. Unknown
  //     prices fall back to 0 EUR. Trade-off: rich-result snippets may
  //     show "Free" for ticketed-but-price-unknown events. The event detail
  //     page itself still displays the correct "Tickets Required" label,
  //     so click-through visitors aren't misled — only a small minority of
  //     SERP impressions surface the price chip at all.
  const hasPaidOffer = e.priceFrom != null;
  const isFree = !hasPaidOffer && e.price?.toLowerCase().includes('free');
  const price = hasPaidOffer ? e.priceFrom : (isFree ? 0 : 0);
  const offers = {
    '@type': 'Offer',
    price,
    priceCurrency: e.currency ?? 'EUR',
    url: e.externalLink ?? url,
    availability: 'https://schema.org/InStock',
    validFrom: e.addedAt,
  };

  const performer = derivePerformer(e);
  if (performer) performer.name = disp.name;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    inLanguage: lang === 'pt' ? 'pt-PT' : 'en',
    name: disp.name,
    description: disp.description,
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
    // image: ALWAYS emit. GSC's 2026-05-17 audit flagged "Missing field
    // 'image'" on the ~23 events whose press photo hasn't been acquired
    // yet (event-images cron backfills these in batches). Falling back
    // to the site hero banner — not pretty in a SERP rich-result
    // preview, but it clears the warning and is honest (it's our brand
    // image, not a misleading claim about the event itself). The event
    // detail page still shows a category-coloured placeholder for
    // imageless events; only the JSON-LD payload Google sees changes.
    image: e.image?.url ?? `${siteUrl}/hero-banner.png`,
    offers,
    ...(performer ? { performer } : {}),
    url,
    organizer: {
      '@type': 'Organization',
      name: 'Oporto Weekly',
      url: siteUrl,
    },
  };
}
