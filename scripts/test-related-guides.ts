/**
 * Assertions for the related-guide matching (lib/related-guides.ts), against
 * the real data/blog-posts.json. Plain node:assert under tsx, like
 * test-gyg.ts. No network.
 *
 *   npm run test:guides
 */

import assert from 'node:assert/strict';
import { listBlogPosts } from '../lib/blog';
import { listEvents, type EventRecord } from '../lib/events';
import {
  GUIDE_TOPICS, guideForTopic, relatedGuidesForEvent, relatedGuidesForVenue, guidesForHub, featuredGuides,
} from '../lib/related-guides';
import { GUIDE_CHECKS, guidesDue } from '../lib/guide-checks';

const posts = listBlogPosts();
let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
};
const ev = (p: Partial<EventRecord> & { name: string }) =>
  ({ description: '', venue: 'Hard Club', category: 'music', ...p }) as EventRecord;
const guide = (p: Partial<EventRecord> & { name: string }) => relatedGuidesForEvent(ev(p), posts)[0].slug;

test('every topic resolves to a real guide', () => {
  for (const t of Object.keys(GUIDE_TOPICS)) assert.ok(guideForTopic(t, posts), `topic ${t} has no guide`);
});
test('food / wine / gastronomy -> foodie or wine guide', () => {
  assert.equal(guide({ name: 'Francesinha Fest', category: 'food' }), 'the-ultimate-food-guide-to-porto-5-dishes-you-must-try');
  assert.equal(guide({ name: 'Essência do Vinho', category: 'food' }), 'sip-savor-porto-your-2025-guide-to-port-wine-cellars');
  assert.equal(guide({ name: 'Chef dinner at Euskalduna', category: 'other' }), 'the-ultimate-food-guide-to-porto-5-dishes-you-must-try');
});
test('markets, crafts, Christmas -> shopping guides', () => {
  assert.equal(guide({ name: 'Christmas Market at Batalha', category: 'other' }), 'made-in-porto-shop-online');
  assert.equal(guide({ name: 'Handmade crafts fair', category: 'art' }), 'made-in-porto-shop-online');
  assert.equal(guide({ name: 'Mercado Porto Belo', category: 'other' }), 'porto-shopping-guide-your-map-to-vintage-artisan-finds');
  const two = relatedGuidesForEvent(ev({ name: 'Vintage flea market' }), posts, 2).map((p) => p.slug);
  assert.deepEqual(two, ['porto-shopping-guide-your-map-to-vintage-artisan-finds', 'made-in-porto-shop-online']);
});
test('word boundaries: no false hits', () => {
  assert.notEqual(guide({ name: 'Filmmakers talk', category: 'other' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Natalia Lafourcade', category: 'music' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Adventure Club', category: 'music' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Travel talk', category: 'other' }), 'porto-nightlife-2025-2026-fado-bars-unforgettable-evenings');
});
test('Ribeira / Gaia / Foz venues -> neighbourhood guide', () => {
  const n = 'porto-neighborhood-guide-where-to-stay-eat-explore';
  assert.equal(guide({ name: 'Candlelight: ABBA', venue: 'Hilton Porto Gaia' }), n);
  assert.equal(guide({ name: 'Concert', venue: 'Cais da Ribeira' }), n);
  assert.equal(guide({ name: 'Concert', venue: 'Foz do Douro' }), n, 'venue words only count as an area');
  assert.equal(guide({ name: 'Concert', venue: 'Praia da Foz' }), n);
});
test('festivals / seasonal -> seasonal guide; free -> budget guide', () => {
  assert.equal(guide({ name: 'São João 2027', category: 'other' }), 'porto-a-seasonal-guide-for-your-2025-2026-trip');
  assert.equal(guide({ name: 'Halloween at Hard Club', category: 'nightlife' }), 'porto-a-seasonal-guide-for-your-2025-2026-trip');
  assert.equal(guide({ name: 'Open rehearsal', price: 'Free' }), 'porto-on-a-budget-free-sights-cheap-eats-guide');
});
test('category fallback, then a guide for every real event', () => {
  assert.equal(guide({ name: 'Paus', venue: 'Casa da Música' }), 'porto-nightlife-2025-2026-fado-bars-unforgettable-evenings');
  assert.equal(guide({ name: 'Puppets', category: 'family' }), 'family-fun-porto-kid-friendly-activities-2025-2026');
  assert.equal(guide({ name: 'Xyz', category: 'other' }), 'secret-porto-a-guide-to-the-citys-hidden-gems');
  for (const e of listEvents()) assert.equal(relatedGuidesForEvent(e, posts).length, 1, e.slug);
});
test('venues: name, area, then what the venue hosts', () => {
  assert.equal(relatedGuidesForVenue('Mercado do Bolhão', [], posts)[0].slug, 'the-ultimate-food-guide-to-porto-5-dishes-you-must-try');
  assert.equal(relatedGuidesForVenue('Galeria Municipal do Porto', [], posts)[0].slug, 'the-ultimate-art-lovers-guide-to-porto-2025-2026');
  assert.equal(relatedGuidesForVenue('Coliseu Porto Ageas', [{ category: 'family' }, { category: 'family' }, { category: 'music' }], posts)[0].slug,
    'family-fun-porto-kid-friendly-activities-2025-2026');
  assert.equal(relatedGuidesForVenue('Somewhere', [], posts)[0].slug, 'porto-a-seasonal-guide-for-your-2025-2026-trip', 'fallback');
});
test('hubs: season first, distinct guides, capped', () => {
  const dec = guidesForHub([{ category: 'music' }, { category: 'art' }], 11, posts).map((p) => p.slug);
  assert.deepEqual(dec, ['made-in-porto-shop-online', 'porto-a-seasonal-guide-for-your-2025-2026-trip', 'the-ultimate-art-lovers-guide-to-porto-2025-2026']);
  const jun = guidesForHub([], 5, posts);
  assert.equal(jun.length, 3);
  assert.equal(new Set(jun.map((p) => p.slug)).size, 3);
});
test('home: newest guide per topic', () => {
  const f = featuredGuides(posts, 4);
  assert.equal(f.length, 4);
  assert.equal(f[0].slug, posts.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0].slug);
  assert.equal(new Set(f.map((p) => p.slug)).size, 4);
});

test('every guide is on the monthly fact-check, and only real guides are', () => {
  const slugs = new Set(posts.map((p) => p.slug));
  for (const s of posts.map((p) => p.slug)) assert.ok(GUIDE_CHECKS[s], `${s} missing from data/guide-checks.json`);
  for (const [s, c] of Object.entries(GUIDE_CHECKS)) {
    assert.ok(slugs.has(s), `${s} in guide-checks.json but not a guide`);
    assert.match(c.lastChecked, /^\d{4}-\d{2}-\d{2}$/, s);
    assert.ok(c.notes.length > 0, s);
  }
});
test('guidesDue: 30 days after the last check, oldest first', () => {
  const oldest = Object.values(GUIDE_CHECKS).map((c) => c.lastChecked).sort()[0];
  assert.deepEqual(guidesDue(oldest), []);
  const due = guidesDue('2099-01-01');
  assert.equal(due.length, Object.keys(GUIDE_CHECKS).length);
  assert.equal(GUIDE_CHECKS[due[0]].lastChecked, oldest);
});

console.log(`test-related-guides: ${passed} passed`);
