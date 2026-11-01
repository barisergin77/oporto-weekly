/**
 * Venue Instagram handles verified on each venue's own website (data/venue-instagram.json,
 * owner 2026-11-01). Server-side allowlist: Instagram photo tags are only sent for handles
 * listed there, so nothing upstream can invent one.
 */
import data from '@/data/venue-instagram.json';

const VENUES = (data as { venues: Record<string, { handle: string }> }).venues;
const KNOWN = new Set(Object.values(VENUES).map((v) => v.handle.toLowerCase()));

export function venueInstagramHandle(venueSlug: string | undefined): string | undefined {
  return venueSlug ? VENUES[venueSlug]?.handle : undefined;
}

export function isKnownVenueHandle(handle: string): boolean {
  return KNOWN.has(handle.replace(/^@/, '').toLowerCase());
}
