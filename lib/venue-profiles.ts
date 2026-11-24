/**
 * Verified basics for venue pages (/venue/<slug>, /pt/venue/<slug>): type,
 * street address, official website. Growth item G9 (2026-11-24): people who
 * search a venue by name ("move club porto", "lola hifi") want to know where
 * it is and what it is; our venue pages only listed events.
 *
 * Every entry in data/venue-profiles.json is checked by hand against the
 * venue's own site or an official listing (`source`, `checkedAt`). A venue
 * missing from the file shows nothing extra. Never add an address from a
 * guess or an event description.
 */

import raw from '../data/venue-profiles.json';

export interface VenueProfile {
  type: { en: string; pt: string };
  /** Street address with postal code, as the source writes it. */
  address: string;
  streetAddress: string;
  /** Only when the venue's own site or an official listing prints it. */
  postalCode?: string;
  locality: string;
  /** The venue's own site (or official social page when it has no site). */
  website?: string;
  source: string;
  checkedAt: string;
}

const PROFILES = (raw as unknown as { venues: Record<string, VenueProfile> }).venues;

export function venueProfile(slug: string): VenueProfile | undefined {
  return PROFILES[slug];
}

export function venueMapsUrl(name: string, p: VenueProfile): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${p.address}`)}`;
}

/** schema.org PostalAddress for the venue page's Place JSON-LD. */
export function venueAddressJsonLd(p: VenueProfile | undefined) {
  if (!p) return { '@type': 'PostalAddress', addressLocality: 'Porto', addressCountry: 'PT' };
  return {
    '@type': 'PostalAddress',
    streetAddress: p.streetAddress,
    ...(p.postalCode ? { postalCode: p.postalCode } : {}),
    addressLocality: p.locality,
    addressCountry: 'PT',
  };
}

/** Extra Place fields (map link, official site) when a profile exists. */
export function venuePlaceExtras(name: string, p: VenueProfile | undefined): Record<string, unknown> {
  if (!p) return {};
  return {
    hasMap: venueMapsUrl(name, p),
    ...(p.website ? { sameAs: [p.website] } : {}),
  };
}

export function venueAddressFaq(name: string, p: VenueProfile | undefined, lang: 'en' | 'pt') {
  if (!p) return undefined;
  return lang === 'pt'
    ? { q: `Onde fica ${name}?`, a: `A morada de ${name} é ${p.address}.` }
    : { q: `Where is ${name}?`, a: `${name} is at ${p.address}.` };
}
