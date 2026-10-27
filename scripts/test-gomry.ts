/**
 * Assertions for the Gomry integration (lib/gomry.ts, lib/tickets.ts,
 * scripts/gomry-events.ts) and the adult-content filter (lib/fever.ts).
 * Plain node:assert under tsx, no network.
 *
 *   npm run test:gomry
 */

import assert from 'node:assert/strict';
import {
  GOMRY_ENABLED, GOMRY_REF, GOMRY_ORGANIZER_URL, type GomryItem, gomryEventId, gomryTracked, isPortoHomeMatch, lisbonLocal, matchGomry, organizerCtaEligible,
} from '../lib/gomry';
import { type FeverItem, isAdultContent, isEventLike } from '../lib/fever';
import { ticketFor } from '../lib/tickets';
import { selectEditionEvents } from '../lib/edition-compose';
import { alreadyListed, homeMatchCandidates, kickoff, matchRecord, priceText } from './gomry-events';
import { FORWARD_SOURCE, type EventRecord } from '../lib/events';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const g = (p: Partial<GomryItem> & { id: string; name: string; start: string }): GomryItem => ({
  url: `https://www.gomry.com/event/${p.name.replace(/\W+/g, '-')}-${p.id}`, end: null, venue: 'Estadio do Dragao', city: 'Porto',
  priceFrom: 87.05, currency: 'USD', isFree: false, availability: 'on_sale', organization: 'Gomry Retail', categories: ['sports'], ...p,
});
const ev = (p: Partial<EventRecord> & { name: string; date: string }): EventRecord => ({
  slug: p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.date.slice(0, 10),
  venue: 'Maus Hábitos', category: 'music', description: 'A gig.', sourceEdition: FORWARD_SOURCE, addedAt: '2026-10-01T00:00:00Z', ...p,
});
const fever = (p: Partial<FeverItem> & { id: string; name: string }): FeverItem => ({
  url: `https://fever.pxf.io/c/8040588/1928078/16345?prodsku=${p.id}`, feverUrl: `https://feverup.com/m/${p.id}`, venue: 'Maus Hábitos',
  sessions: [], price: 15, currency: 'EUR', image: null, tier: 1, commissionable: true, subCategory: 'Music Events', ...p,
});

const ESTORIL = g({ id: '384lrsJDvWQG1KOtUqXt', name: 'Porto vs Estoril Praia', start: '2026-10-31T20:30:00.000Z' });
const GIG = g({ id: 'AbCdEfGhIjKlMnOpQr12', name: 'Night Shift Live', start: '2026-11-07T21:00:00.000Z', venue: 'Maus Hábitos', priceFrom: 10, currency: 'EUR' });

test('tracked URL carries our ref, drops utm and is idempotent', () => {
  const t = gomryTracked('https://www.gomry.com/event/Porto-vs-Estoril-Praia-384lrsJDvWQG1KOtUqXt?utm_medium=web&utm_campaign=catalogApi');
  assert.equal(t, `https://www.gomry.com/event/Porto-vs-Estoril-Praia-384lrsJDvWQG1KOtUqXt?ref=${GOMRY_REF}`);
  assert.equal(gomryTracked(t), t);
  assert.equal(GOMRY_ORGANIZER_URL, `https://www.gomry.com/?ref=${GOMRY_REF}`);
});
test('event id from gomry.com/event URLs only', () => {
  assert.equal(gomryEventId('https://www.gomry.com/event/Porto-vs-Estoril-Praia-384lrsJDvWQG1KOtUqXt?x=1'), '384lrsJDvWQG1KOtUqXt');
  assert.equal(gomryEventId('https://www.gomry.com/oportoweekly'), null);
  assert.equal(gomryEventId('https://example.com/event/foo-384lrsJDvWQG1KOtUqXt'), null);
});
test('Lisbon local time (WET/WEST)', () => {
  assert.equal(lisbonLocal('2026-10-31T20:30:00.000Z'), '2026-10-31T20:30');
  assert.equal(lisbonLocal('2027-04-04T17:00:00.000Z'), '2027-04-04T18:00');
});
test('matching: venue + Lisbon date + name, or by id/link', () => {
  assert.equal(matchGomry(ev({ name: 'Night Shift', date: '2026-11-07T21:00' }), [GIG])?.id, GIG.id);
  assert.equal(matchGomry(ev({ name: 'Night Shift', date: '2026-11-08' }), [GIG]), null);
  assert.equal(matchGomry(ev({ name: 'Night Shift', venue: 'Hard Club', date: '2026-11-07' }), [GIG]), null);
  assert.equal(matchGomry(ev({ name: 'x', date: '2026-10-31', venue: 'y', externalLink: ESTORIL.url }), [ESTORIL])?.id, ESTORIL.id);
});
test('ticket precedence: Fever tiers 1–3 > Gomry > plain; Fever tier 4 falls through to Gomry', () => {
  const e = ev({ name: 'Night Shift', date: '2026-11-07T21:00', externalLink: 'https://maushabitos.com/night-shift' });
  const f1 = fever({ id: '1', name: 'Night Shift', sessions: ['2026-11-07T21:00'] });
  assert.equal(ticketFor(e, [f1], [GIG])?.provider, 'fever');
  const t4 = ticketFor(e, [{ ...f1, tier: 4, commissionable: false }], [GIG]);
  assert.equal(t4?.provider, 'gomry');
  assert.ok(t4?.href.endsWith(`?ref=${GOMRY_REF}`) && t4.affiliate);
  const plain = ticketFor(e, [], []);
  assert.deepEqual(plain, { href: 'https://maushabitos.com/night-shift', affiliate: false, provider: null });
  assert.equal(ticketFor(ev({ name: 'x', date: '2026-11-07' }), [], []), null);
});
test('organizer CTA: independent upcoming events only', () => {
  const today = '2026-10-27';
  const ok = ev({ name: 'Night Shift', date: '2026-11-07', venue: 'Maus Hábitos', externalLink: 'https://maushabitos.com/x' });
  assert.equal(organizerCtaEligible(ok, false, today, true), true);
  assert.equal(organizerCtaEligible({ ...ok, venue: 'Hard Club', venueSlug: 'hard-club' }, false, today, true), true);
  assert.equal(organizerCtaEligible(ok, true, today, true), false, 'already has an affiliate ticket');
  assert.equal(organizerCtaEligible({ ...ok, venue: 'Casa da Música', venueSlug: undefined }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, venue: 'Serralves Museum', venueSlug: undefined }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, venue: 'Coliseu Porto Ageas', venueSlug: undefined }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, category: 'sports' }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, date: '2026-10-01' }, false, today, true), false, 'past');
  assert.equal(organizerCtaEligible({ ...ok, endDate: '2026-11-20' }, false, today, true), false, 'long festival');
  assert.equal(organizerCtaEligible({ ...ok, externalLink: 'https://ticketline.sapo.pt/evento/x' }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, externalLink: 'https://www.bol.pt/Comprar/Bilhetes/1' }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, externalLink: 'https://www.eventbrite.pt/e/x' }, false, today, true), false);
  assert.equal(organizerCtaEligible({ ...ok, feverId: '1' }, false, today, true), false);
});
test('paused (GOMRY_ENABLED=false): no organizer box, no Gomry ticket by default', () => {
  const ok = ev({ name: 'Indie Night', venue: 'Muxima Bar', date: '2099-11-07', category: 'music' });
  assert.equal(organizerCtaEligible(ok, false, '2026-10-27', false), false);
  if (!GOMRY_ENABLED) assert.equal(ticketFor(ev({ name: 'x', date: '2026-11-07', externalLink: 'https://www.gomry.com/event/a-b' }), [])?.provider ?? null, null);
});

test('FC Porto home matches only', () => {
  assert.equal(isPortoHomeMatch(ESTORIL), true);
  assert.equal(isPortoHomeMatch(g({ id: 'x'.repeat(20), name: 'Benfica vs Porto (Date TBD)', start: '2027-02-28T00:00:00.000Z', venue: 'Estadio da Luz' })), false);
  assert.equal(isPortoHomeMatch(g({ id: 'y'.repeat(20), name: 'Porto vs Benfica (Date TBD)', start: '2027-02-28T00:00:00.000Z' })), false);
  assert.equal(isPortoHomeMatch(GIG), false);
});
test('match record: factual copy, Lisbon kickoff, resale price as listed, never a pick', () => {
  const r = matchRecord(ESTORIL, '2026-10-27T00:00:00Z');
  assert.equal(r.name, 'FC Porto vs Estoril Praia');
  assert.equal(r.date, '2026-10-31T20:30');
  assert.equal(r.venueSlug, 'estadio-do-dragao');
  assert.equal(r.price, 'From US$87.05 (resale)');
  assert.equal(r.priceFrom, 87.05);
  assert.equal(r.currency, 'USD');
  assert.equal(r.category, 'sports');
  assert.equal(r.gomryId, ESTORIL.id);
  assert.equal(r.pickCandidate, false);
  assert.match(r.description, /Saturday 31 October at 20:30/);
  assert.equal(priceText({ ...ESTORIL, priceFrom: null }), null);
  assert.equal(kickoff({ ...ESTORIL, start: '2026-12-13T11:00:00.000Z' }), null, 'placeholder slot');
  assert.match(matchRecord({ ...ESTORIL, start: '2026-12-13T11:00:00.000Z' }).description, /kickoff time to be confirmed/);
});
test('home matches dedupe against existing FC Porto events', () => {
  const existing = ev({ name: 'FC Porto vs. GD Estoril Praia', date: '2026-10-31', venue: 'Estádio do Dragão', venueSlug: 'estadio-do-dragao', category: 'sports' });
  assert.equal(alreadyListed(ESTORIL, [existing]), true);
  assert.equal(alreadyListed(ESTORIL, []), false);
  assert.deepEqual(homeMatchCandidates([ESTORIL], [], '2026-10-28', '2026-12-08').map((i) => i.id), [ESTORIL.id]);
  assert.deepEqual(homeMatchCandidates([ESTORIL], [], '2026-11-01', '2026-12-08'), []);
});
test('Gomry events never enter the Editor\'s Pick pool', () => {
  const m = { ...matchRecord(ESTORIL, '2026-10-27T00:00:00Z'), image: undefined };
  const sel = selectEditionEvents([m, ev({ name: 'Night Shift', date: '2026-10-31' })], '2026-10-29', '2026-11-04');
  assert.ok(sel.short.some((e) => e.slug === m.slug));
  assert.ok(!sel.pickPool.some((e) => e.slug === m.slug));
});
test('adult content filter (owner: no sensual/adult shows); age limits alone are fine', () => {
  assert.equal(isAdultContent('Noite de Halloween no Magic Moments Restaurant Porto', 'Magic Moments Restaurante & Dance Club Porto'), true);
  assert.equal(isAdultContent('Universo Magic Mike no Porto'), true);
  assert.equal(isAdultContent('Burlesque night', 'Some Bar'), true);
  assert.equal(isAdultContent('Halloween dinner', 'Bar X', 'Restaurant & Show', 'um jantar com espetáculos sensuais'), true);
  assert.equal(isAdultContent('Noite erótica'), true);
  assert.equal(isAdultContent('Striptease show'), true);
  assert.equal(isAdultContent('The Jazz Room', 'Hot Five', 'Jazz', 'Idade: para maiores de 18 anos'), false);
  assert.equal(isAdultContent('Pub Crawl noturno no Porto', '', '', 'Idade: +18'), false);
  assert.equal(isAdultContent('Halloween Party', 'Hard Club'), false);
  assert.equal(isEventLike(fever({ id: '2', name: 'Universo Magic Mike no Porto', sessions: ['2026-11-07T21:00'], sessionCount: 1 })), false);
  assert.equal(isEventLike(fever({ id: '3', name: 'The Jazz Room', sessions: ['2026-11-07T21:00'], sessionCount: 1 })), true);
});

console.log(`test-gomry: ${passed} passed`);
