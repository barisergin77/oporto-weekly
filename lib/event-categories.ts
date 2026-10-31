/**
 * Finer event categories (owner 2026-10-31): "music" was 40% of all events,
 * too broad to filter on, so it splits into concerts, fado, jazz, dj-club and
 * classical, and markets, talks-workshops and outdoor-sport get their own.
 *
 * The stored `category` (lib/events.ts EventCategory) does NOT change: the
 * extraction prompts, the newsletter's five sections, related guides, the
 * Instagram carousel and every saved record keep using it. The subcategory
 * is derived on read (readEvent) by deterministic keyword rules over the
 * name, description and venue, so existing and future events get one with no
 * data migration, and the old category is the fallback when no rule fires.
 * SUBCATEGORY_PARENT maps back to the legacy value for anything that only
 * understands the old set (filters treat ?cat=music as "any music").
 *
 * Pure module (no fs): the filter UI imports the labels client-side.
 * Tests: npm run test:filters.
 */

import { kebab } from './venues';

/** Mirrors EventCategory in lib/events.ts (kept here so this module has no fs import chain). */
export type LegacyCategory = 'music' | 'art' | 'food' | 'family' | 'nightlife' | 'sports' | 'other';

export type EventSubcategory =
  | 'concerts'
  | 'fado'
  | 'jazz'
  | 'classical'
  | 'dj-club'
  | 'art'
  | 'food'
  | 'markets'
  | 'family'
  | 'nightlife'
  | 'sports'
  | 'outdoor-sport'
  | 'talks-workshops'
  | 'other';

/** Display order in the category filter. */
export const SUBCATEGORIES: EventSubcategory[] = [
  'concerts', 'classical', 'jazz', 'fado', 'dj-club', 'nightlife', 'art', 'talks-workshops',
  'family', 'food', 'markets', 'sports', 'outdoor-sport', 'other',
];

export const SUBCATEGORY_PARENT: Record<EventSubcategory, LegacyCategory> = {
  concerts: 'music',
  fado: 'music',
  jazz: 'music',
  classical: 'music',
  'dj-club': 'music',
  art: 'art',
  food: 'food',
  markets: 'food',
  family: 'family',
  nightlife: 'nightlife',
  sports: 'sports',
  'outdoor-sport': 'sports',
  'talks-workshops': 'other',
  other: 'other',
};

export const SUBCATEGORY_EMOJI: Record<EventSubcategory, string> = {
  concerts: '🎤',
  fado: '🎸',
  jazz: '🎷',
  classical: '🎻',
  'dj-club': '🎧',
  art: '🎨',
  food: '🍷',
  markets: '🧺',
  family: '👨‍👩‍👧',
  nightlife: '🌙',
  sports: '⚽',
  'outdoor-sport': '🏃',
  'talks-workshops': '🎙️',
  other: '🎭',
};

export const SUBCATEGORY_LABEL: Record<EventSubcategory, string> = {
  concerts: 'Concerts',
  fado: 'Fado',
  jazz: 'Jazz',
  classical: 'Classical',
  'dj-club': 'DJs & Club Nights',
  art: 'Art & Exhibitions',
  food: 'Food & Wine',
  markets: 'Markets',
  family: 'Family',
  nightlife: 'Nightlife',
  sports: 'Sports',
  'outdoor-sport': 'Running & Outdoor',
  'talks-workshops': 'Talks & Workshops',
  other: 'Other',
};

export const SUBCATEGORY_LABEL_PT: Record<EventSubcategory, string> = {
  concerts: 'Concertos',
  fado: 'Fado',
  jazz: 'Jazz',
  classical: 'Música Clássica',
  'dj-club': 'DJs e Clubbing',
  art: 'Arte e Exposições',
  food: 'Gastronomia e Vinhos',
  markets: 'Mercados e Feiras',
  family: 'Família',
  nightlife: 'Vida Noturna',
  sports: 'Desporto',
  'outdoor-sport': 'Corrida e Ar Livre',
  'talks-workshops': 'Conversas e Workshops',
  other: 'Outros',
};

export const isSubcategory = (s: string): s is EventSubcategory =>
  (SUBCATEGORIES as string[]).includes(s);

/** Word-bounded match on kebab-cased text ("-" separates words). */
const words = (alts: string) => new RegExp(`(^|-)(${alts})(-|$)`);

// Name-only rules: these words in a description are too often incidental
// ("the gallery hosts a talk", "near the Bolhão market").
const TALKS = words(
  'talks?|conversas?|palestras?|lectures?|conferencias?|conference|debates?|workshops?|oficinas?-de|masterclass(es)?|' +
  'seminars?|seminarios?|coloquios?|mesa-redonda|book-launch|lancamento(-do)?-livro|apresentacao-(do|de)-livro|' +
  'visita-(guiada|curatorial|orientada)|guided-tour|curator(ial)?-(tour|talk|visit)|q-a|storytelling-workshop'
);
const MARKETS = words('markets?|mercados?|mercadinho|feiras?|flea|bazaa?r|vintage-fair|craft-fair|street-market|christmas-market');
const OUTDOOR = words(
  'marathon|maratona|meia-maratona|half-marathon|run|running|corrida|trail|caminhada|walk-run|hike|hiking|' +
  'cycling|ciclismo|bike-ride|surf(ing)?|bodyboard|regata|regatta|kayak|canoagem|triathlon|triatlo|open-water|swim(ming)?|5k|10k'
);
const KIDS_NAME = words(
  'kids|criancas|infantil|bebe|bebes|baby|babies|toddlers?|for-the-whole-family|para-toda-a-familia|em-familia|family-day|para-familias'
);

// Music genres: name, description and venue, but only for events whose
// stored category is musical (or vague), so an exhibition that mentions a
// jazz soundtrack stays art.
const FADO = words('fado|fados|fadista|casa-de-fados|guitarra-portuguesa');
// Name and venue only: "styles including jazz" describes half the indie gigs.
const JAZZ = words('jazz|blues|bebop|big-band|swing|bossa-nova');
const COMPOSERS =
  'mozart|bach|beethoven|brahms|rachmaninoff|rachmaninov|tchaikovsky|chopin|vivaldi|haydn|schubert|mahler|' +
  'britten|debussy|ravel|villa-lobos|stravinsky|prokofiev|shostakovich|handel|strauss';
// Description matches use the stricter list: "along with a choir" or "on cello"
// turns up in rock and pop write-ups too.
const CLASSICAL_DESC = words(
  'orquestra|orchestra|sinfonia|sinfonica|symphony|symphonic|philharmonic|filarmonica|string-quartet|' +
  'quarteto-de-cordas|recital|requiem|opera|baroque|barroco|chamber-music|musica-de-camara|remix-ensemble|' +
  'candlelight|' + COMPOSERS
);
const CLASSICAL_NAME = words(
  'orquestra|orchestra|sinfonia|sinfonica|symphony|symphonic|philharmonic|filarmonica|quartet|quarteto|' +
  'recital|requiem|barroco|baroque|opera|operas|coro|choir|missa|cantata|oratorio|candlelight|piano-solo|' +
  'violoncelo|violino|cello|violin|orgao|musica-de-camara|chamber-music|remix-ensemble|musica-antiga|' +
  'early-music|' + COMPOSERS
);
const DJ_CLUB = words(
  'dj|djs|dj-set|b2b|techno|house-music|deep-house|tech-house|drum-and-bass|dnb|club-night|clubbing|rave|raves|' +
  'boiler-room|afterparty|after-party|house-party|disco-night'
);
// Name only: "an electronic pop duo" in a description is still a live band.
const ELECTRONIC = words('electronic|electronica|eletronica|electro');

const MUSICAL: LegacyCategory[] = ['music', 'nightlife', 'other'];

export interface ClassifyInput {
  name: string;
  description?: string;
  venue?: string;
  category: LegacyCategory | string;
}

/**
 * First rule that fires wins. Order matters: a "Talk with the orchestra's
 * conductor" is a talk, a "Christmas market with DJs" is a market, a "Rock
 * party for the whole family" is family.
 */
export function classifyEvent(ev: ClassifyInput): EventSubcategory {
  const legacy = ev.category as LegacyCategory;
  const name = kebab(ev.name);
  const all = kebab(`${ev.name} ${ev.description ?? ''}`);
  const withVenue = kebab(`${ev.name} ${ev.description ?? ''} ${ev.venue ?? ''}`);

  if (TALKS.test(name)) return 'talks-workshops';
  if (FADO.test(name) && MUSICAL.includes(legacy)) return 'fado'; // "Há Fado no Mercado" is fado, not a market
  if (MARKETS.test(name)) return 'markets';
  if (OUTDOOR.test(name) && (legacy === 'sports' || legacy === 'other' || legacy === 'family')) return 'outdoor-sport';
  if (KIDS_NAME.test(name)) return 'family';

  if (MUSICAL.includes(legacy)) {
    if (FADO.test(withVenue)) return 'fado';
    if (JAZZ.test(kebab(`${ev.name} ${ev.venue ?? ''}`)) && legacy !== 'other') return 'jazz';
    if (CLASSICAL_NAME.test(name) || CLASSICAL_DESC.test(kebab(ev.description ?? ''))) return 'classical';
    if (DJ_CLUB.test(all) || ELECTRONIC.test(name)) return 'dj-club';
  }

  if (legacy === 'music') return 'concerts';
  if (legacy === 'sports' && OUTDOOR.test(all)) return 'outdoor-sport';
  return isSubcategory(legacy) ? legacy : 'other';
}

/** True when an event's subcategory matches a ?cat= value; "music" (the old category) matches every music subcategory. */
export function inCategory(sub: EventSubcategory, filter: string): boolean {
  return sub === filter || (filter === 'music' && SUBCATEGORY_PARENT[sub] === 'music');
}

// Kids & family filter: the family category, a family subcategory, or a
// clear kids word anywhere in the name or description.
const KIDS_TEXT = words(
  'kids|children|childrens|child|criancas|crianca|infantil|infantis|familias|families|family-friendly|bebe|bebes|' +
  'baby|babies|toddlers?|puppets?|marionetas|fantoches|para-toda-a-familia|for-the-whole-family|ages-\\d+'
);

export function isKidsEvent(ev: ClassifyInput): boolean {
  if (ev.category === 'family') return true;
  if (classifyEvent(ev) === 'family') return true;
  return KIDS_TEXT.test(kebab(`${ev.name} ${ev.description ?? ''}`));
}
