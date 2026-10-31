/**
 * Assertions for the finer event categories (lib/event-categories.ts), the
 * venue areas (lib/event-areas.ts) and the listing filters
 * (lib/event-filters.ts). Plain node:assert under tsx; the last block runs
 * the classifier over the real data/events. No network.
 *
 *   npm run test:filters
 */

import assert from 'node:assert/strict';
import { classifyEvent, isKidsEvent, inCategory, SUBCATEGORIES, SUBCATEGORY_PARENT, SUBCATEGORY_LABEL, SUBCATEGORY_LABEL_PT, SUBCATEGORY_EMOJI, type ClassifyInput } from '../lib/event-categories';
import { areaForVenue, AREAS, AREA_LABEL, AREA_LABEL_PT } from '../lib/event-areas';
import {
  activeCount, dayHubRange, filtersToSearch, isFreePrice, lowestPrice, matchesFilters, normalize, parseFilters, priceBand,
  type FilterItem,
} from '../lib/event-filters';
import { listEvents, subcategoryOf } from '../lib/events';
import { HUMANIZER_RULES } from '../lib/humanizer';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
};
const c = (name: string, category: ClassifyInput['category'], description = '', venue = 'Casa da Música') =>
  classifyEvent({ name, category, description, venue });

test('music splits into concerts, fado, jazz, classical, dj-club', () => {
  assert.equal(c('Paus', 'music', 'A farewell concert of math rock and krautrock, along with a choir.'), 'concerts');
  assert.equal(c('Traditional Fado Concert', 'music', '', 'Casa da Guitarra'), 'fado');
  assert.equal(c('Viviane', 'music', 'An evening of fado songs.'), 'fado');
  assert.equal(c('ALL ABOUT BLUES', 'music', '', 'Hot Five Jazz&Blues Club'), 'jazz');
  assert.equal(c('Jazz in the Space Age', 'music'), 'jazz');
  assert.equal(c('A Terceira de Rachmaninoff', 'music'), 'classical');
  assert.equal(c('Floresta do Amazonas', 'music', 'The Orquestra Sinfónica do Porto performs Villa-Lobos.'), 'classical');
  assert.equal(c('Candlelight: Queen vs. The Beatles', 'music', '', 'Palácio da Bolsa'), 'concerts'); // pop covers by a quartet (owner 2026-10-31)
  assert.equal(c('Candlelight: Vivaldi Four Seasons', 'music', '', 'Igreja'), 'classical');
  assert.equal(c('Sigur Rós Orchestral Tour', 'music', '', 'Coliseu'), 'concerts');
  assert.equal(c('Orquestra Sinfónica do Porto: Mahler 5', 'music', '', 'Casa da Música'), 'classical');
  assert.equal(c('Outworld', 'music', 'German DJ and producer Klangkuenstler, known for his techno sound.'), 'dj-club');
  assert.equal(c('Techno Night at Gare Porto', 'nightlife', '', 'Gare Porto'), 'dj-club');
  assert.equal(c('Electronic Sunday Brunch', 'music', '', 'Parque da Cidade'), 'dj-club');
});
test('description-only words do not over-classify', () => {
  // "styles including jazz" in a description stays a concert; jazz needs the name or venue.
  assert.equal(c('Porto Sounds Secret: Bruno Pernadas', 'music', 'Exploring styles including jazz and improvisation.', 'Escola Garcia de Orta'), 'concerts');
  // "an electronic pop duo" is still a live band.
  assert.equal(c('Svaneborg Kardyb', 'music', 'A Danish duo mixing electronic textures with keys.'), 'concerts');
  // Exhibitions mentioning music stay art; the genre rules only run for musical categories.
  assert.equal(c('Sound and Vision', 'art', 'A jazz soundtrack and a DJ set accompany the show.', 'Serralves'), 'art');
  // "Câmara Municipal" is the city hall, not chamber music.
  assert.equal(c('Noite Branca', 'music', 'Organised by the Câmara Municipal do Porto.'), 'concerts');
});
test('markets, talks-workshops, outdoor-sport, family', () => {
  assert.equal(c('Boa Nova Street Market', 'other', '', 'Escola Secundária da Boa Nova'), 'markets');
  assert.equal(c('Mercado Porto Belo', 'food', '', 'Praça de Carlos Alberto'), 'markets');
  assert.equal(c('Há Fado no Mercado', 'music', '', 'Mercado do Bolhão'), 'fado');
  assert.equal(c('TALK WITH PAULO RANGEL', 'art', '', 'Serralves'), 'talks-workshops');
  assert.equal(c('Lucía Solla Sobral | Lançamento do Livro "Comerás Flores"', 'other', '', 'Livraria Lello'), 'talks-workshops');
  assert.equal(c('Cerâmica em Família Workshop', 'family', '', 'Oficina Matérica'), 'talks-workshops');
  assert.equal(c('"Oficina Arara" Exhibition Opening', 'art', '', 'Casa São Roque'), 'art');
  assert.equal(c('EDP Porto Marathon', 'sports', '', 'Queimódromo'), 'outdoor-sport');
  assert.equal(c('FC Porto vs Sporting CP', 'sports', '', 'Estádio do Dragão'), 'sports');
  assert.equal(c('World Rock Bebé 2026: A Rock Party for the Whole Family', 'music', '', 'Auditório Municipal de Gaia'), 'family');
  assert.equal(c('Run DMC Tribute', 'music'), 'concerts'); // "run" is outdoor only for sports/other/family
});
test('old category is the fallback', () => {
  assert.equal(c('Something', 'music'), 'concerts');
  for (const cat of ['art', 'food', 'family', 'nightlife', 'sports', 'other'] as const) assert.equal(c('Xyz', cat), cat);
  assert.equal(c('Xyz', 'theatre' as never), 'other');
});
test('every subcategory has a parent, labels in EN + PT and an emoji', () => {
  for (const s of SUBCATEGORIES) {
    assert.ok(SUBCATEGORY_PARENT[s] && SUBCATEGORY_LABEL[s] && SUBCATEGORY_LABEL_PT[s] && SUBCATEGORY_EMOJI[s], s);
    assert.ok(!/—/.test(SUBCATEGORY_LABEL[s] + SUBCATEGORY_LABEL_PT[s]), `em dash in ${s} label`);
  }
  for (const s of ['concerts', 'fado', 'jazz', 'classical', 'dj-club'] as const) assert.equal(SUBCATEGORY_PARENT[s], 'music');
  assert.ok(inCategory('fado', 'music') && inCategory('fado', 'fado') && !inCategory('art', 'music') && !inCategory('jazz', 'fado'));
  assert.ok(HUMANIZER_RULES.includes('NO em dashes'));
});
test('kids & family', () => {
  assert.ok(isKidsEvent({ name: 'Puppets', category: 'family' }));
  assert.ok(isKidsEvent({ name: 'World Rock Bebé', category: 'music' }));
  assert.ok(isKidsEvent({ name: 'Brahms, a Segunda Sinfonia', category: 'music', description: 'A morning concert for families with children.' }));
  assert.ok(!isKidsEvent({ name: 'Techno Night', category: 'nightlife', description: 'Until 6am.' }));
});

test('areas: curated slugs, then place words in the venue name, never a guess', () => {
  assert.equal(areaForVenue('Casa da Música, Sala Suggia', 'casa-da-musica-sala-suggia'), 'boavista');
  assert.equal(areaForVenue('Hard Club', 'hard-club'), 'ribeira');
  assert.equal(areaForVenue('Gare Porto', 'gare-porto'), 'baixa');
  assert.equal(areaForVenue('Super Bock Arena Porto', 'super-bock-arena'), 'palacio-de-cristal');
  assert.equal(areaForVenue('Leça Beach, Matosinhos', 'leca-beach'), 'matosinhos');
  assert.equal(areaForVenue('Terreiro do Molhe, Foz', 'terreiro-do-molhe'), 'foz');
  assert.equal(areaForVenue('Sala Estúdio IG, Gaia', 'sala-estudio-ig'), 'gaia');
  assert.equal(areaForVenue('Various Venues', 'various-venues'), undefined);
  assert.equal(areaForVenue('Serralves Foundation & Downtown', 'serralves-foundation-downtown'), undefined);
  assert.equal(areaForVenue('Switch', 'switch'), undefined);
  for (const a of AREAS) assert.ok(AREA_LABEL[a] && AREA_LABEL_PT[a], a);
});

test('price: free, lowest euro amount, bands', () => {
  for (const p of ['Free', 'Free Entry', 'free entry', 'Entrada livre', 'Gratuito', 'Free (registration req.)']) assert.ok(isFreePrice(p), p);
  for (const p of ['Mostly Free', 'Free with ticket', 'Free & Ticketed Events', 'Ticketed', undefined]) assert.ok(!isFreePrice(p), String(p));
  assert.equal(lowestPrice('€22,00 – €26,00'), 22);
  assert.equal(lowestPrice('20€ – 60€'), 20);
  assert.equal(lowestPrice('35 - 100 EUR'), 35);
  assert.equal(lowestPrice('From €16.50'), 16.5);
  assert.equal(lowestPrice('Ticketed'), null);
  assert.equal(lowestPrice('US$25'), null);
  assert.equal(lowestPrice('anything', 12), 12);
  assert.equal(priceBand('Free'), 'free');
  assert.equal(priceBand('From €0', 0), 'free');
  assert.equal(priceBand('€10'), 'under-15');
  assert.equal(priceBand('€15–€19'), '15-30');
  assert.equal(priceBand('€30,00'), '15-30');
  assert.equal(priceBand('53€'), 'over-30');
  assert.equal(priceBand('Varies'), undefined);
});

const item = (p: Partial<FilterItem>): FilterItem => ({
  slug: 's', href: '/event/s', name: 'X', meta: '', emoji: '', categoryLabel: '', sub: 'concerts', parent: 'music',
  kids: false, start: '2026-11-07', end: '2026-11-07', search: normalize('X'), ...p,
});
// Wednesday 4 Nov 2026, 12:00 Lisbon: today = 4 Nov, weekend = 6-8 Nov.
const WED = new Date('2026-11-04T12:00:00Z');

test('URL params round-trip and reject junk', () => {
  const f = parseFilters('?q=fado%20ribeira&cat=fado&area=ribeira&price=free&when=weekend&kids=1');
  assert.deepEqual(f, { q: 'fado ribeira', cat: 'fado', area: 'ribeira', price: 'free', when: 'weekend', kids: true });
  assert.equal(filtersToSearch(f), '?q=fado+ribeira&when=weekend&price=free&kids=1&cat=fado&area=ribeira');
  assert.deepEqual(parseFilters(filtersToSearch(f)), f);
  assert.deepEqual(parseFilters('?price=cheap&when=tomorrow&cat=<script>&kids=yes'), {});
  assert.deepEqual(parseFilters('?free=1'), { price: 'free' });
  assert.equal(filtersToSearch({}), '');
  assert.equal(activeCount(f), 6);
});
test('filters match', () => {
  const fado = item({ sub: 'fado', area: 'ribeira', band: 'free', search: normalize('Noite de Fado Casa da Guitarra Fado tradicional') });
  const expo = item({ sub: 'art', parent: 'art', start: '2026-09-01', end: '2027-01-10', band: '15-30', kids: true, search: normalize('Alice Neel Serralves') });
  assert.ok(matchesFilters(fado, { cat: 'fado' }, WED));
  assert.ok(matchesFilters(fado, { cat: 'music' }, WED), 'music matches every music subcategory');
  assert.ok(!matchesFilters(expo, { cat: 'music' }, WED));
  assert.ok(matchesFilters(fado, { area: 'ribeira', price: 'free' }, WED));
  assert.ok(!matchesFilters(fado, { area: 'foz' }, WED));
  assert.ok(!matchesFilters(expo, { price: 'free' }, WED));
  assert.ok(matchesFilters(expo, { kids: true }, WED) && !matchesFilters(fado, { kids: true }, WED));
  assert.ok(matchesFilters(fado, { q: 'FADO guitarra' }, WED), 'case + every word');
  assert.ok(matchesFilters(fado, { q: 'tradiciónal' }, WED), 'diacritics ignored');
  assert.ok(!matchesFilters(fado, { q: 'fado jazz' }, WED), 'all words must match');
  assert.ok(matchesFilters(fado, { when: 'weekend' }, WED) && !matchesFilters(fado, { when: 'today' }, WED));
  assert.ok(matchesFilters(expo, { when: 'today' }, WED), 'a long run overlapping today counts');
});
test('weekend range matches the day hubs', () => {
  assert.deepEqual(dayHubRange('weekend', WED), { from: '2026-11-06', to: '2026-11-08' });
  assert.deepEqual(dayHubRange('weekend', new Date('2026-11-07T10:00:00Z')), { from: '2026-11-07', to: '2026-11-08' });
  assert.deepEqual(dayHubRange('today', new Date('2026-07-01T23:30:00Z')), { from: '2026-07-02', to: '2026-07-02' }, 'Lisbon is UTC+1 in summer');
});

test('every real event classifies, and music is actually split', () => {
  const all = listEvents();
  const n = new Map<string, number>();
  for (const e of all) {
    const s = subcategoryOf(e);
    assert.ok(SUBCATEGORIES.includes(s), `${e.slug}: ${s}`);
    // Never move an event out of a non-musical category into a music genre.
    if (!['music', 'nightlife', 'other'].includes(e.category)) assert.ok(SUBCATEGORY_PARENT[s] !== 'music', `${e.slug}: ${e.category} -> ${s}`);
    n.set(s, (n.get(s) ?? 0) + 1);
  }
  for (const s of ['concerts', 'classical', 'jazz', 'fado', 'dj-club', 'markets', 'talks-workshops']) assert.ok((n.get(s) ?? 0) > 0, `no ${s} events`);
  assert.ok((n.get('concerts') ?? 0) < all.filter((e) => e.category === 'music').length, 'music should split');
});

console.log(`test-event-filters: ${passed} passed`);
