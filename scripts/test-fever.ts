/**
 * Assertions for the Fever affiliate integration (lib/fever.ts). Plain
 * node:assert under tsx, like test-dedupe.ts. No network.
 *
 *   npm run test:fever
 */

import assert from 'node:assert/strict';
import {
  type FeverItem, feverPlanId, isGiftCard, isEventLike, feverOccurrences, matchFever, ticketLink, MAX_FEVER_PER_EDITION,
} from '../lib/fever';
import { selectEditionEvents, eventDigest } from '../lib/edition-compose';
import { alreadyListed } from './fever-events';
import { FORWARD_SOURCE, type EventRecord } from '../lib/events';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const item = (p: Partial<FeverItem> & { id: string; name: string }): FeverItem => ({
  url: `https://fever.pxf.io/c/8040588/1928078/16345?prodsku=${p.id}`, feverUrl: `https://feverup.com/m/${p.id}`,
  venue: 'Palácio da Bolsa', sessions: [], price: 19.5, currency: 'EUR', image: null, tier: 2, commissionable: true,
  subCategory: 'Candlelight Concerts', ...p,
});
const ev = (p: Partial<EventRecord> & { name: string; date: string }): EventRecord => ({
  slug: p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.date.slice(0, 10),
  venue: 'Palácio da Bolsa', category: 'music', description: 'A concert.', sourceEdition: FORWARD_SOURCE,
  addedAt: '2026-10-01T00:00:00Z', ...p,
});

const coldplay = item({ id: '144035', name: 'Candlelight: Coldplay & Imagine Dragons', sessions: ['2026-10-31T19:30', '2026-11-21T19:30', '2026-11-21T22:00'] });
const maxCooper = item({ id: '648919', name: 'MAX COOPER no Hard Club, Porto 2026', venue: 'Hard Club', tier: 4, commissionable: false, sessions: ['2026-11-13T21:00'], subCategory: 'Concerts' });
const giftCard = item({ id: '82298', name: 'Cartão Oferta Candlelight - Porto', sessions: ['2026-11-01T00:00'] });
const tour = item({ id: '106579', name: 'Cruzeiro das 6 Pontes no Rio Douro', tier: 1, venue: 'Tomaz do Douro', sessions: ['2026-11-01T10:00'], subCategory: '' });
const ongoing = item({ id: '113206', name: 'Spiritus by Ocubo na Igreja dos Clérigos', tier: 1, sessionCount: 241, sessions: ['2026-11-01T10:00'] });
const ITEMS = [coldplay, maxCooper, giftCard, tour, ongoing];

test('plan id from feverup.com URLs only', () => {
  assert.equal(feverPlanId('https://feverup.com/m/144035'), '144035');
  assert.equal(feverPlanId('https://feverup.com/pt/porto/m/144035?x=1'), '144035');
  assert.equal(feverPlanId('https://example.com/m/144035'), null);
  assert.equal(feverPlanId(undefined), null);
});

test('matches by plan id, and by venue + session date + name', () => {
  assert.equal(matchFever(ev({ name: 'Anything', date: '2030-01-01', externalLink: 'https://feverup.com/m/144035' }), ITEMS)?.id, '144035');
  assert.equal(matchFever(ev({ name: 'Candlelight: Coldplay and Imagine Dragons', date: '2026-11-21T19:30' }), ITEMS)?.id, '144035');
  assert.equal(matchFever(ev({ name: 'Candlelight: Coldplay and Imagine Dragons', date: '2026-11-22T19:30' }), ITEMS), null, 'no session that day');
  assert.equal(matchFever(ev({ name: 'Candlelight: Coldplay and Imagine Dragons', date: '2026-11-21', venue: 'Hard Club' }), ITEMS), null, 'other venue');
  assert.equal(matchFever(ev({ name: 'Fado Night', date: '2026-11-21' }), ITEMS), null, 'different name');
});

test('only tiers 1–3 get the tracked link; tier 4 keeps the plain link', () => {
  const cl = ticketLink(ev({ name: 'x', date: '2026-10-31', externalLink: 'https://feverup.com/m/144035' }), ITEMS);
  assert.deepEqual(cl, { href: coldplay.url, affiliate: true });
  const mc = ticketLink(ev({ name: 'Max Cooper', venue: 'Hard Club', date: '2026-11-13T21:00', externalLink: 'https://hardclubporto.com/evento/max-cooper' }), ITEMS);
  assert.deepEqual(mc, { href: 'https://hardclubporto.com/evento/max-cooper', affiliate: false });
  const t4 = ticketLink(ev({ name: 'x', date: '2026-11-13', externalLink: 'https://feverup.com/m/648919' }), ITEMS);
  assert.equal(t4?.affiliate, false, 'tier-4 feverup page is not deep-linked');
});

test('a feverup.com page missing from the catalog gets the campaign deep link', () => {
  const t = ticketLink(ev({ name: 'x', date: '2026-11-13', externalLink: 'https://feverup.com/m/999999' }), ITEMS);
  assert.ok(t?.affiliate && t.href.startsWith('https://fever.pxf.io/c/8040588/1356939/16345?u=https%3A%2F%2Ffeverup.com%2Fm%2F999999'));
  assert.equal(ticketLink(ev({ name: 'x', date: '2026-11-13' }), ITEMS), null);
});

test('gift cards, tours and ongoing attractions never become events', () => {
  assert.ok(isGiftCard('Cartão Oferta Candlelight - Porto') && isGiftCard('Parabéns!! - Cartão-presente Special Edition'));
  assert.ok(isEventLike(coldplay));
  for (const i of [maxCooper, giftCard, tour, ongoing]) assert.ok(!isEventLike(i), i.name);
});

test('one occurrence per item and day, all times kept', () => {
  const occ = feverOccurrences('2026-10-28', '2026-12-31', ITEMS);
  assert.deepEqual(occ.map((o) => o.key), ['144035@2026-10-31', '144035@2026-11-21']);
  assert.deepEqual(occ[1].times, ['19:30', '22:00']);
});

test('alreadyListed sees our own record and a matching existing event', () => {
  const [o] = feverOccurrences('2026-10-31', '2026-10-31', ITEMS);
  assert.ok(alreadyListed(o, [ev({ name: 'Candlelight: Coldplay & Imagine Dragons', date: '2026-10-31T19:30', feverId: '144035' })]));
  assert.ok(alreadyListed(o, [ev({ name: 'Candlelight Coldplay Imagine Dragons', date: '2026-10-31T19:30' })]));
  assert.ok(!alreadyListed(o, [ev({ name: 'Candlelight: Coldplay & Imagine Dragons', date: '2026-11-21T19:30', feverId: '144035' })]));
});

test(`edition takes at most ${MAX_FEVER_PER_EDITION} Fever events, earliest first`, () => {
  const fever = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map((d, i) =>
    ev({ name: `Candlelight Show ${i}`, date: `${d}T20:00`, feverId: String(100 + i), venue: `Venue ${i}` }));
  const other = Array.from({ length: 8 }, (_, i) => ev({ name: `Gig ${i}`, date: '2026-10-31T21:00', venue: `Club ${i}` }));
  const sel = selectEditionEvents([...fever, ...other], '2026-10-29', '2026-11-04');
  const kept = sel.short.filter((e) => e.feverId).map((e) => e.name);
  assert.deepEqual(kept, ['Candlelight Show 0', 'Candlelight Show 1']);
  assert.equal(sel.short.length, 8 + MAX_FEVER_PER_EDITION);
});

test('the edition digest links Fever events through the tracked link', () => {
  const real = ev({ name: 'Plain Gig', date: '2026-10-31T21:00', venue: 'Hard Club', externalLink: 'https://hardclubporto.com/x' });
  const digest = eventDigest(selectEditionEvents([real], '2026-10-29', '2026-11-04'));
  assert.ok(digest.includes('link: https://hardclubporto.com/x'));
});

console.log(`test-fever: ${passed} passed`);
