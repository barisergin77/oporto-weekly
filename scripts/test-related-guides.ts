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
  assert.equal(guide({ name: 'Francesinha Fest', category: 'food' }), 'the-ultimate-foodies-guide-to-porto-what-to-eat-in-2025');
  assert.equal(guide({ name: 'Essência do Vinho', category: 'food' }), 'sip-see-porto-your-2025-2026-port-wine-cellar-guide');
  assert.equal(guide({ name: 'Chef dinner at Euskalduna', category: 'other' }), 'the-ultimate-foodies-guide-to-porto-what-to-eat-in-2025');
});
test('markets, crafts, Christmas -> shopping guides', () => {
  assert.equal(guide({ name: 'Christmas Market at Batalha', category: 'other' }), 'made-in-porto-shop-online');
  assert.equal(guide({ name: 'Handmade crafts fair', category: 'art' }), 'made-in-porto-shop-online');
  assert.equal(guide({ name: 'Mercado Porto Belo', category: 'other' }), 'shop-like-a-local-in-porto-your-2026-vintage-market-guide');
  const two = relatedGuidesForEvent(ev({ name: 'Vintage flea market' }), posts, 2).map((p) => p.slug);
  assert.deepEqual(two, ['shop-like-a-local-in-porto-your-2026-vintage-market-guide', 'made-in-porto-shop-online']);
});
test('word boundaries: no false hits', () => {
  assert.notEqual(guide({ name: 'Filmmakers talk', category: 'other' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Natalia Lafourcade', category: 'music' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Adventure Club', category: 'music' }), 'made-in-porto-shop-online');
  assert.notEqual(guide({ name: 'Travel talk', category: 'other' }), 'porto-nightlife-your-ultimate-after-dark-guide-for-2025');
});
test('Ribeira / Gaia / Foz venues -> neighbourhood guide', () => {
  const n = 'your-porto-neighborhood-guide-where-to-stay-eat-2025';
  assert.equal(guide({ name: 'Candlelight: ABBA', venue: 'Hilton Porto Gaia' }), n);
  assert.equal(guide({ name: 'Concert', venue: 'Cais da Ribeira' }), n);
  assert.equal(guide({ name: 'Concert', venue: 'Foz do Douro' }), n, 'venue words only count as an area');
  assert.equal(guide({ name: 'Concert', venue: 'Praia da Foz' }), n);
});
test('festivals / seasonal -> seasonal guide; free -> budget guide', () => {
  assert.equal(guide({ name: 'São João 2027', category: 'other' }), 'porto-a-seasonal-guide-for-your-2025-2026-trip');
  assert.equal(guide({ name: 'Halloween at Hard Club', category: 'nightlife' }), 'porto-a-seasonal-guide-for-your-2025-2026-trip');
  assert.equal(guide({ name: 'Open rehearsal', price: 'Free' }), 'porto-on-a-budget-the-ultimate-free-activity-guide');
});
test('category fallback, then a guide for every real event', () => {
  assert.equal(guide({ name: 'Paus', venue: 'Casa da Música' }), 'porto-nightlife-your-ultimate-after-dark-guide-for-2025');
  assert.equal(guide({ name: 'Puppets', category: 'family' }), 'porto-with-kids-the-ultimate-family-adventure-guide');
  assert.equal(guide({ name: 'Xyz', category: 'other' }), 'portos-hidden-gems-your-guide-to-the-citys-secrets');
  for (const e of listEvents()) assert.equal(relatedGuidesForEvent(e, posts).length, 1, e.slug);
});
test('venues: name, area, then what the venue hosts', () => {
  assert.equal(relatedGuidesForVenue('Mercado do Bolhão', [], posts)[0].slug, 'the-ultimate-foodies-guide-to-porto-what-to-eat-in-2025');
  assert.equal(relatedGuidesForVenue('Galeria Municipal do Porto', [], posts)[0].slug, 'portos-art-culture-guide-galleries-street-art-in-2025');
  assert.equal(relatedGuidesForVenue('Coliseu Porto Ageas', [{ category: 'family' }, { category: 'family' }, { category: 'music' }], posts)[0].slug,
    'porto-with-kids-the-ultimate-family-adventure-guide');
  assert.equal(relatedGuidesForVenue('Somewhere', [], posts)[0].slug, 'porto-a-seasonal-guide-for-your-2025-2026-trip', 'fallback');
});
test('hubs: season first, distinct guides, capped', () => {
  const dec = guidesForHub([{ category: 'music' }, { category: 'art' }], 11, posts).map((p) => p.slug);
  assert.deepEqual(dec, ['made-in-porto-shop-online', 'porto-a-seasonal-guide-for-your-2025-2026-trip', 'portos-art-culture-guide-galleries-street-art-in-2025']);
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

console.log(`test-related-guides: ${passed} passed`);
