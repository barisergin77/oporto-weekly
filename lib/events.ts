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
  /** 1-3 sentence editorial description. */
  description: string;
  /** Slug of the newsletter edition this event was extracted from. */
  sourceEdition: string;
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

/** Normalise "Casa da Música" / "Einstein's" → "casa-da-musica" / "einsteins". */
export function venueToSlug(venue: string): string {
  return venue
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics (ó → o, ã → a)
    .replace(/['\u2019]/g, '')        // strip apostrophes (Einstein's → Einsteins)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  other: '✦',
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

/** Build a schema.org Event JSON-LD object for rich snippets + Google Events. */
export function toEventJsonLd(e: EventRecord, siteUrl = 'https://oportoweekly.com'): object {
  const url = `${siteUrl}/event/${e.slug}`;
  const offers =
    e.priceFrom != null
      ? {
          '@type': 'Offer',
          price: e.priceFrom,
          priceCurrency: e.currency ?? 'EUR',
          url: e.externalLink ?? url,
          availability: 'https://schema.org/InStock',
        }
      : e.price?.toLowerCase().includes('free')
        ? {
            '@type': 'Offer',
            price: 0,
            priceCurrency: 'EUR',
            url: e.externalLink ?? url,
          }
        : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.name,
    description: e.description,
    startDate: e.date,
    ...(e.endDate ? { endDate: e.endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: e.venue,
      address: { '@type': 'PostalAddress', addressLocality: 'Porto', addressCountry: 'PT' },
    },
    ...(e.image ? { image: e.image.url } : {}),
    ...(offers ? { offers } : {}),
    url,
    organizer: {
      '@type': 'Organization',
      name: 'Oporto Weekly',
      url: siteUrl,
    },
  };
}
