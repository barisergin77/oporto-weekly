/**
 * Assertions for venue aliasing + event identity (no test runner in this
 * repo, so plain node:assert under tsx).
 *
 *   npm run test:dedupe
 */

import assert from 'node:assert/strict';
import { canonicalVenueSlugFor, venueSlugRedirects } from '../lib/venues';
import { isSameEvent } from '../lib/event-identity';
import { findExistingEventByIdentity, type EventRecord } from '../lib/events';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

// ---------------------------------------------------------------- venues
test('Casa da Música spellings and rooms collapse', () => {
  for (const v of ['Casa da Música', 'Casa da Musica', 'Casa da Música, Sala 2', 'Casa da Música (Sala Suggia)', 'Sala 2, Casa da Música', 'Terrace, Casa da Música', 'Casa da Música Terrace', 'Casa da Musica Cafe']) {
    assert.equal(canonicalVenueSlugFor(v), 'casa-da-musica', v);
  }
});
test('Serralves PT/EN/ES names collapse', () => {
  for (const v of ['Serralves', 'Serralves Museum', 'Museu de Serralves', 'Museo de Arte Contemporáneo de Serralves', 'Fundação de Serralves', 'Serralves Foundation', 'Parque de Serralves', 'Serralves Museum of Contemporary Art', 'Casa de Serralves']) {
    assert.equal(canonicalVenueSlugFor(v), 'serralves', v);
  }
});
test('unknown venues and room-first strings with unknown parents are untouched', () => {
  assert.equal(canonicalVenueSlugFor('Sala Estúdio IG, Gaia'), 'sala-estudio-ig');
  assert.equal(canonicalVenueSlugFor('Palácio do Bolhão'), 'palacio-do-bolhao');
  assert.equal(canonicalVenueSlugFor('Hard Club'), 'hard-club');
});
test('every alias redirects to a canonical slug that is not itself an alias', () => {
  const from = new Set(venueSlugRedirects().map(([a]) => a));
  for (const [a, to] of venueSlugRedirects()) {
    assert.notEqual(a, to);
    assert.ok(!from.has(to), `${a} → ${to} chains`);
  }
});

// ---------------------------------------------------------------- events
const ev = (name: string, venue: string, date: string, endDate?: string) => ({ name, venue, date, endDate });

test('Wrong Answers at Serralves under two names is one event', () => {
  assert.ok(isSameEvent(
    ev('Jenny Holzer: Wrong Answers', 'Serralves Museum', '2026-07-09', '2026-11-01'),
    ev('"Wrong Answers" Exhibition', 'Museo de Arte Contemporáneo de Serralves', '2026-08-27', '2026-11-01'),
  ));
});
test('same name under two placeholder venues, overlapping dates', () => {
  assert.ok(isSameEvent(
    ev('Porto Contemporary Art Exhibition', 'Various Galleries', '2026-10-05', '2026-10-25'),
    ev('Porto Contemporary Art Exhibition', 'Bombarda Art District & Various', '2026-10-15', '2026-10-25'),
  ));
});
test('a weekly gig on different dates is NOT the same event', () => {
  assert.ok(!isSameEvent(ev('Jazz Jam Session', 'Hot Five Jazz & Blues Club', '2026-10-06'), ev('Jazz Jam Session', 'Hot Five Jazz & Blues Club', '2026-10-13')));
});
test('different shows at the same venue are NOT the same event', () => {
  assert.ok(!isSameEvent(
    ev('Alice Neel: Beautifully Imperfect', 'Serralves Museum', '2026-08-13', '2027-01-31'),
    ev('Jenny Holzer: Wrong Answers', 'Serralves Museum', '2026-07-09', '2026-11-01'),
  ));
});
test('a festival night is NOT folded into the festival', () => {
  assert.ok(!isSameEvent(
    ev('Porto Jazz Festival', 'Casa da Música', '2026-10-01', '2026-10-10'),
    ev('Porto Jazz Festival: Kamasi Washington', 'Casa da Música', '2026-10-05'),
  ));
});
test('same name at two real, different venues is NOT merged', () => {
  assert.ok(!isSameEvent(ev('Fado Night', 'Casa da Guitarra', '2026-10-10'), ev('Fado Night', 'Maus Hábitos', '2026-10-10')));
});

test('findExistingEventByIdentity: exact tier unchanged, fuzzy tier needs dates', () => {
  const rec = (slug: string, name: string, venue: string, date: string, endDate?: string, addedAt = '2026-07-01T00:00:00Z'): EventRecord =>
    ({ slug, name, venue, date, endDate, category: 'art', description: '', sourceEdition: 'x', addedAt });
  const corpus = [
    rec('holzer', 'Jenny Holzer: Wrong Answers', 'Serralves Museum', '2026-06-18', '2027-01-03'),
    rec('gig', 'Iguanas', 'Casa da Música', '2026-05-21'),
  ];
  assert.equal(findExistingEventByIdentity('Iguanas', 'Casa da Musica, Sala 2', undefined, corpus)?.slug, 'gig');
  assert.equal(findExistingEventByIdentity('"Wrong Answers" Exhibition', 'Museu de Serralves', undefined, corpus), null);
  assert.equal(findExistingEventByIdentity('"Wrong Answers" Exhibition', 'Museu de Serralves', { date: '2026-10-22', endDate: '2026-10-28' }, corpus)?.slug, 'holzer');
  assert.equal(findExistingEventByIdentity('Wrong Answers Talk', 'Hard Club', { date: '2026-10-22' }, corpus), null);
});

console.log(`ok — ${passed} dedupe tests passed`);
