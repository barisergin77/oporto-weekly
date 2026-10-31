/**
 * "Related guide" matching: which blog guide to promote on an event page,
 * a venue page, the events hubs, the home page and the newsletter (owner
 * 2026-10-31; event pages + hubs get ~4x the blog's views). Same shape as
 * lib/getyourguide.ts: keyword rules over kebab-cased text pick topic keys,
 * and each topic resolves to the NEWEST guide whose slug matches it, so a
 * new guide on a topic takes over automatically. Every page gets a guide:
 * when nothing matches, FALLBACK_TOPIC, then the newest guide.
 *
 * Pure module (no fs): callers pass the posts (listBlogPosts() or the JSON
 * index), so the newsletter cron and the tests can share it.
 */

import type { BlogPost } from './blog';
import type { EventCategory, EventRecord } from './events';
import { kebab } from './venues';

/** Topic key -> slug pattern. Order is also the newsletter rotation order. */
export const GUIDE_TOPICS: Record<string, RegExp> = {
  food: /food|what-to-eat|dishes/,
  wine: /port-wine|wine-cellar/,
  madeinporto: /made-in-porto/,
  art: /art-culture|art-lovers|street-art/,
  neighbourhood: /neighbou?rhood/,
  seasonal: /seasonal/,
  family: /kids|family/,
  views: /views|rooftops/,
  markets: /vintage|artisan/,
  walking: /walk|on-foot|historic/,
  daytrips: /day-trips/,
  nightlife: /nightlife-your|after-dark/,
  beaches: /beach|surf/,
  coffee: /coffee|pastis|nata/,
  hiddengems: /hidden-gems|secret/,
  budget: /budget|free-activit/,
  fado: /fado/,
};

export const FALLBACK_TOPIC = 'seasonal';

/** First matching rules first; keys are de-duplicated. Matched on the event's name + description. */
const TEXT_RULES: Array<[RegExp, string[]]> = [
  [/christmas|xmas|(^|-)(natal|advent|gifts?|presentes)(-|$)/, ['madeinporto', 'markets']],
  [/bolhao/, ['food', 'markets']],
  [/(^|-)(crafts?|artesan\w*|artisans?|makers|handmade|design-(market|fair)|shop(s|ping)?|lojas?|made-in-portugal)(-|$)/, ['madeinporto', 'markets']],
  [/(^|-)(markets?|mercados?|feiras?|flea|bazaa?r|vintage)(-|$)/, ['markets', 'madeinporto']],
  [/(^|-)wines?(-|$)|vinhos?(-|$)|cellar|(^|-)caves(-|$)|port-tasting/, ['wine', 'food']],
  [/douro|day-trip|guimaraes|braga|aveiro|amarante/, ['daytrips']],
  [/fado/, ['fado', 'nightlife']],
  [/coffee|(^|-)nata(-|$)|pastel|bakery|pastry/, ['coffee', 'food']],
  [/(^|-)food|gastronom|(^|-)chefs?(-|$)|dinner|brunch|francesinha|petisc|cooking|culinar|cuisine|restaurant|comida|jantar/, ['food']],
  [/festival|sao-joao|carna?val|new-year|reveillon|passagem-de-ano|halloween|(^|-)easter(-|$)|pascoa|santos-populares|fireworks|queima|magusto|sao-martinho/, ['seasonal']],
  [/street-art|graffiti|mural|urban-art/, ['art']],
  [/galler|galeria|exhibit|exposic|museum|museu|vernissage|photograph|fotograf|painting|pintura|sculpt|escultur/, ['art']],
  [/kids|child|family|famil|crianc|infantil|puppet|marionet|(^|-)bab(y|ies)(-|$)|toddler/, ['family']],
  [/beach|praia|surf/, ['beaches']],
  [/rooftop|viewpoint|miradouro|sunset|por-do-sol/, ['views']],
  [/walking-tour|guided-walk|(^|-)walks?(-|$)|historic|heritage|patrimonio|architect|arquitet/, ['walking']],
  [/(^|-)club(bing)?(-|$)|(^|-)djs?(-|$)|(^|-)(party|parties|raves?|techno)(-|$)|cocktail|karaoke/, ['nightlife']],
  [/free-entry|free-admission|entrada-livre|gratuit/, ['budget']],
];

/** Venue areas (on the venue name). Only the riverside / seaside areas the neighbourhood guide covers. */
const AREA_RULES: Array<[RegExp, string[]]> = [
  [/ribeira|miragaia|alfandega|infante|palacio-da-bolsa|gaia/, ['neighbourhood']],
  [/(^|-)(foz|leca)(-|$)|matosinhos/, ['neighbourhood', 'beaches']],
];

/** Last resort before FALLBACK_TOPIC: the event category. */
const CATEGORY_TOPICS: Record<EventCategory, string[]> = {
  food: ['food'],
  family: ['family'],
  art: ['art'],
  nightlife: ['nightlife'],
  music: ['nightlife'],
  sports: ['neighbourhood'],
  other: ['hiddengems'],
};

function collect(hay: string, rules: Array<[RegExp, string[]]>, into: string[]) {
  for (const [re, ks] of rules) {
    if (!re.test(hay)) continue;
    for (const k of ks) if (!into.includes(k)) into.push(k);
  }
}

const newestFirst = (posts: BlogPost[]) =>
  [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

/** Newest guide for a topic key, if any guide matches it. */
export function guideForTopic(topic: string, posts: BlogPost[]): BlogPost | undefined {
  const re = GUIDE_TOPICS[topic];
  return re ? newestFirst(posts).find((p) => re.test(p.slug)) : undefined;
}

/** First topic key a guide belongs to (undefined for a guide no topic covers). */
export function topicOf(post: BlogPost): string | undefined {
  return Object.keys(GUIDE_TOPICS).find((k) => GUIDE_TOPICS[k].test(post.slug));
}

/** Topic keys -> distinct guides, topped up with the fallback chain, capped at `limit`. */
function resolve(topics: string[], posts: BlogPost[], limit: number): BlogPost[] {
  const out: BlogPost[] = [];
  const add = (p?: BlogPost) => { if (p && out.length < limit && !out.some((o) => o.slug === p.slug)) out.push(p); };
  for (const t of [...topics, FALLBACK_TOPIC]) add(guideForTopic(t, posts));
  for (const p of newestFirst(posts)) add(p);
  return out;
}

/** Topic keys for one event: its words, then its venue's area, then its category. */
export function eventTopics(ev: Pick<EventRecord, 'name' | 'description' | 'venue' | 'category' | 'price'>): string[] {
  const keys: string[] = [];
  collect(kebab(`${ev.name} ${ev.description ?? ''}`), TEXT_RULES, keys);
  if (ev.price && /^(free|gr[aá]tis|gratuito)/i.test(ev.price.trim()) && !keys.includes('budget')) keys.push('budget');
  collect(kebab(ev.venue), AREA_RULES, keys);
  for (const k of CATEGORY_TOPICS[ev.category] ?? []) if (!keys.includes(k)) keys.push(k);
  return keys;
}

/** Guides for an event page, best first. */
export function relatedGuidesForEvent(
  ev: Pick<EventRecord, 'name' | 'description' | 'venue' | 'category' | 'price'>,
  posts: BlogPost[],
  limit = 1
): BlogPost[] {
  return resolve(eventTopics(ev), posts, limit);
}

/** Most common categories first (ties by name, so the order is stable). */
function topCategories(events: Array<Pick<EventRecord, 'category'>>): EventCategory[] {
  const n = new Map<EventCategory, number>();
  for (const e of events) n.set(e.category, (n.get(e.category) ?? 0) + 1);
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

/** Guides for a venue page: the venue's name and area, then what it mostly hosts. */
export function relatedGuidesForVenue(
  venueName: string,
  events: Array<Pick<EventRecord, 'category'>>,
  posts: BlogPost[],
  limit = 1
): BlogPost[] {
  const keys: string[] = [];
  const hay = kebab(venueName);
  collect(hay, TEXT_RULES, keys);
  collect(hay, AREA_RULES, keys);
  for (const c of topCategories(events)) for (const k of CATEGORY_TOPICS[c]) if (!keys.includes(k)) keys.push(k);
  return resolve(keys, posts, limit);
}

/** Guides for an events hub (month / today / weekend): the season, then the two biggest categories. */
export function guidesForHub(
  events: Array<Pick<EventRecord, 'category'>>,
  monthIndex: number, // 0 = January
  posts: BlogPost[],
  limit = 3
): BlogPost[] {
  // Nov/Dec: Christmas shopping. Otherwise the seasonal guide leads.
  const keys = monthIndex >= 10 ? ['madeinporto', 'seasonal'] : ['seasonal'];
  for (const c of topCategories(events).slice(0, 2)) for (const k of CATEGORY_TOPICS[c]) if (!keys.includes(k)) keys.push(k);
  return resolve(keys, posts, limit);
}

/** Newest guide per topic, newest first: the home page "Guides" section. */
export function featuredGuides(posts: BlogPost[], limit = 4): BlogPost[] {
  const seen = new Set<string>();
  const out: BlogPost[] = [];
  for (const p of newestFirst(posts)) {
    const key = topicOf(p) ?? p.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * The newsletter's "From the blog" guide: one guide per edition, rotating
 * through the newest guide of each topic (GUIDE_TOPICS order, then guides no
 * topic covers) by week number, so a guide comes back only after every other
 * topic had its turn. Deterministic: the same week always gets the same guide,
 * so a re-run or the PT edition never disagrees with the EN one.
 */
export function newsletterGuide(posts: BlogPost[], weekStartIso: string): BlogPost | undefined {
  const pool: BlogPost[] = [];
  for (const t of Object.keys(GUIDE_TOPICS)) {
    const p = guideForTopic(t, posts);
    if (p && !pool.some((o) => o.slug === p.slug)) pool.push(p);
  }
  for (const p of newestFirst(posts)) if (!topicOf(p) && !pool.includes(p)) pool.push(p);
  if (!pool.length) return undefined;
  const week = Math.floor(Date.parse(weekStartIso.slice(0, 10) + 'T00:00:00Z') / (7 * 86_400_000));
  return pool[((week % pool.length) + pool.length) % pool.length];
}
