/**
 * Porto area for an event, for the area filter on the events hubs.
 *
 * Event records carry no address or coordinates, so the area comes from the
 * venue: first the curated slug list in data/venue-areas.json (only venues
 * whose location is certain), then place words in the venue name ("Leça
 * Beach, Matosinhos", "Terreiro do Molhe, Foz"). No match means no area:
 * the event shows under "Any area" only, never in a guessed one.
 *
 * Pure module (no fs).
 */

import areaData from '../data/venue-areas.json';
import { canonicalVenueSlug, kebab } from './venues';

export type EventArea = 'baixa' | 'ribeira' | 'palacio-de-cristal' | 'boavista' | 'foz' | 'gaia' | 'matosinhos' | 'east';

/** Display order in the filter (roughly west to east along the river, then the sea). */
export const AREAS: EventArea[] = ['baixa', 'ribeira', 'palacio-de-cristal', 'boavista', 'foz', 'matosinhos', 'gaia', 'east'];

export const AREA_LABEL: Record<EventArea, string> = {
  baixa: 'Baixa (centre)',
  ribeira: 'Ribeira & Miragaia',
  'palacio-de-cristal': 'Palácio de Cristal & Massarelos',
  boavista: 'Boavista & Serralves',
  foz: 'Foz & Parque da Cidade',
  matosinhos: 'Matosinhos & Leça',
  gaia: 'Vila Nova de Gaia',
  east: 'Bonfim & Campanhã',
};

export const AREA_LABEL_PT: Record<EventArea, string> = {
  baixa: 'Baixa (centro)',
  ribeira: 'Ribeira e Miragaia',
  'palacio-de-cristal': 'Palácio de Cristal e Massarelos',
  boavista: 'Boavista e Serralves',
  foz: 'Foz e Parque da Cidade',
  matosinhos: 'Matosinhos e Leça',
  gaia: 'Vila Nova de Gaia',
  east: 'Bonfim e Campanhã',
};

const BY_SLUG = new Map<string, EventArea>();
for (const [area, slugs] of Object.entries(areaData.areas as Record<string, string[]>)) {
  for (const s of slugs) BY_SLUG.set(s, area as EventArea);
}

// Venue-name fallbacks, first match wins. Word-bounded on the kebab-cased name.
const NAME_RULES: Array<[RegExp, EventArea]> = [
  [/(^|-)(matosinhos|leca|leca-da-palmeira|leixoes)(-|$)/, 'matosinhos'],
  [/(^|-)(gaia|vila-nova-de-gaia)(-|$)/, 'gaia'],
  [/(^|-)foz(-|$)/, 'foz'],
  [/(^|-)(ribeira|miragaia)(-|$)/, 'ribeira'],
  [/(^|-)(palacio-de-cristal|crystal-palace|massarelos)(-|$)/, 'palacio-de-cristal'],
  [/(^|-)(boavista|serralves)(-|$)/, 'boavista'],
  [/(^|-)(aliados|bolhao|baixa|sao-bento|trindade|clerigos|cordoaria|santa-catarina)(-|$)/, 'baixa'],
  [/(^|-)(campanha|bonfim|fontainhas)(-|$)/, 'east'],
];

// "Various venues", "Venue TBC", "Serralves & Downtown": no single place.
const MULTI = /(^|-)(various|varies|multiple|tbc|tbd|city-wide|citywide)(-|$)|&| and /i;

export function areaForVenue(venue: string, venueSlug?: string): EventArea | undefined {
  const slug = venueSlug ? canonicalVenueSlug(venueSlug) : undefined;
  if (slug && BY_SLUG.has(slug)) return BY_SLUG.get(slug);
  if (MULTI.test(venue)) return undefined;
  const hay = kebab(venue);
  for (const [re, area] of NAME_RULES) if (re.test(hay)) return area;
  return undefined;
}
