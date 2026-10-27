/**
 * Assertions for the GetYourGuide blog links (lib/getyourguide.ts). Plain
 * node:assert under tsx, like test-fever.ts. No network.
 *
 *   npm run test:gyg
 */

import assert from 'node:assert/strict';
import { GYG_PARTNER_ID, GYG_TARGETS, MAX_GYG_TARGETS, gygLink, gygTargetsFor } from '../lib/getyourguide';
import { listBlogPosts } from '../lib/blog';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const keys = (slug: string) => gygTargetsFor(slug).map((t) => t.key);

test('tracked link carries partner_id and the guide slug as cmp', () => {
  const u = new URL(gygLink(GYG_TARGETS.wine.url, 'sip-see-porto-port-wine'));
  assert.equal(u.searchParams.get('partner_id'), GYG_PARTNER_ID);
  assert.equal(u.searchParams.get('cmp'), 'sip-see-porto-port-wine');
  assert.equal(u.hostname, 'www.getyourguide.com');
});

test('search URLs keep their query', () => {
  const u = new URL(gygLink(GYG_TARGETS.surf.url, 'beaches'));
  assert.equal(u.searchParams.get('q'), 'Porto surf lesson');
  assert.equal(u.searchParams.get('partner_id'), GYG_PARTNER_ID);
});

test('every target is a Porto (l151) page or a search', () => {
  for (const t of Object.values(GYG_TARGETS)) assert.ok(/\/porto-l151\/|\/s\/\?q=/.test(t.url), t.url);
  assert.ok(!Object.values(GYG_TARGETS).some((t) => t.url.includes('-l26/')), 'l26 is Munich');
});

test('mapping: topic guides get matching targets', () => {
  assert.deepEqual(keys('sip-see-porto-your-2025-2026-port-wine-cellar-guide'), ['cellars', 'wine', 'boat']);
  assert.deepEqual(keys('porto-day-trips-your-ultimate-douro-valley-wine-guide'), ['daytrips', 'wine']);
  assert.deepEqual(keys('best-day-trips-from-porto-the-ultimate-2025-2026-guide'), ['daytrips', 'wine']);
  assert.deepEqual(keys('porto-with-kids-the-ultimate-family-adventure-guide'), ['family', 'boat']);
  assert.deepEqual(keys('explore-historic-porto-a-self-guided-walking-tour'), ['walking', 'lello']);
  assert.deepEqual(keys('portos-best-beaches-your-2025-2026-surf-swim-guide'), ['surf']);
  assert.ok(keys('a-food-lovers-guide-to-porto-what-to-eat-in-2025').includes('food'));
});

test('no box for nightlife, shopping or budget guides', () => {
  assert.deepEqual(keys('porto-nightlife-your-ultimate-after-dark-guide-for-2025'), []);
  assert.deepEqual(keys('shop-like-a-local-in-porto-your-2026-vintage-market-guide'), []);
  assert.deepEqual(keys('porto-on-a-budget-the-ultimate-free-activity-guide'), []);
});

test('real guides: capped, de-duplicated', () => {
  for (const p of listBlogPosts()) {
    const ks = gygTargetsFor(p.slug, p.title).map((t) => t.key);
    assert.ok(ks.length <= MAX_GYG_TARGETS, p.slug);
    assert.equal(new Set(ks).size, ks.length, p.slug);
  }
});

console.log(`test-gyg: ${passed} passed`);
