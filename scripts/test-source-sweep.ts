/**
 * Assertions for the daily source sweep (lib/source-sweep.ts + the parsers in
 * scripts/source-sweep.ts). Plain node:assert under tsx, like the other tests.
 *
 *   npm run test:sweep
 */

import assert from 'node:assert/strict';
import {
  type SweepCandidate, collapseSessions, formatDigest, groupFestivalSessions, inWindow, lisbonWallClock, mergeAcrossSources,
  noiseReason, normalizeVenue, portoAreaReason, portoPostalCode, routeCandidate, splitMessages,
} from '../lib/source-sweep';
import { parseAgendaCards, parseCdm, parseSerralves, parseShotgun } from './source-sweep';
import { type PageFields, reconcile, timesIn } from '../lib/sweep-double-check';
import type { EventRecord } from '../lib/events';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}
const c = (o: Partial<SweepCandidate>): SweepCandidate => ({ source: 'bol', sourceId: 'x', name: 'X', date: '2026-11-10', venue: 'Hard Club', url: 'https://example.com/x', tags: [], ...o });
const known = new Set(['hard-club', 'casa-da-musica', 'coliseu-porto-ageas', 'serralves']);

test('Lisbon wall clock from offsets (winter and summer)', () => {
  assert.equal(lisbonWallClock('2026-11-07T22:30:00+00:00'), '2026-11-07T22:30');
  assert.equal(lisbonWallClock('2026-07-07T21:30:00+00:00'), '2026-07-07T22:30');
  assert.equal(lisbonWallClock('2026-11-07T23:30:00-01:00'), '2026-11-08T00:30');
});
test('window overlap includes runs that started earlier', () => {
  assert.ok(inWindow(c({ date: '2026-10-16', endDate: '2027-03-31' }), '2026-11-01', '2026-12-31'));
  assert.ok(!inWindow(c({ date: '2026-10-16', endDate: '2026-10-31' }), '2026-11-01', '2026-12-31'));
  assert.ok(!inWindow(c({ date: '2027-01-02' }), '2026-11-01', '2026-12-31'));
});
test('Porto area: postal 4000–4479 decides; known venues pass; elsewhere fails', () => {
  assert.equal(portoPostalCode('4000-102'), true);
  assert.equal(portoPostalCode('4450-208 Matosinhos'), true);
  assert.equal(portoPostalCode('4580-670'), false); // Paredes
  assert.equal(portoPostalCode('4480-001'), false); // Vila do Conde
  assert.equal(portoAreaReason(c({ postalCode: '4580-670', venue: 'Museu do Mobiliário' }), known)?.startsWith('outside'), true);
  assert.equal(portoAreaReason(c({ venue: 'Hard Club' }), known), null);
  assert.ok(portoAreaReason(c({ venue: 'Theatro Circo', city: 'Braga' }), known));
  assert.equal(portoAreaReason(c({ source: 'agendaporto', venue: 'Fonoteca Municipal' }), known), null);
  assert.ok(portoAreaReason(c({ source: 'serralves', venue: 'Forum Arte Braga', city: 'Braga' }), known));
  assert.equal(portoAreaReason(c({ source: 'serralves', venue: 'Serralves' }), known), null);
});
test('editorial filter drops classes, admissions, tours, screenings; keeps concerts and festivals', () => {
  for (const n of ['Workshop de Kokedamas', 'Oficina de Famílias', 'Visita guiada ao Treetop Walk', 'Bilhete de Entrada - Museu', 'Porto Pub Crawl', 'Aula de Tango', 'Curso Livre de Fotografia', 'Geral', 'Networking Night'])
    assert.ok(noiseReason(c({ name: n })), n);
  for (const n of ['Concurso de Fado Amador', 'Linda Martini', 'Auto da Barca do Inferno', 'Feira de Antiguidades e Velharias'])
    assert.equal(noiseReason(c({ name: n })), null, n);
  assert.ok(noiseReason(c({ name: 'Eu, Capitão', venue: 'Batalha Centro de Cinema' })));
  assert.equal(noiseReason(c({ name: 'Porto/Post/Doc 2026 - Eu, Capitão', venue: 'Batalha Centro de Cinema' })), null);
  assert.ok(noiseReason(c({ source: 'agendaporto', name: 'Cerâmica Livre', tags: ['Explorar sem regras', 'Famílias', 'Oficina'] })));
  assert.ok(noiseReason(c({ source: 'casadamusica', name: 'Estação Casa da Música', tags: ['Participar', 'Oficinas'] })));
  assert.ok(noiseReason(c({ name: 'Mercado X', date: '2026-01-01', endDate: '2026-12-31' })), 'year-long run, not an exhibition');
  assert.equal(noiseReason(c({ name: 'Exposição Lee Ufan', date: '2026-01-01', endDate: '2026-12-31' })), null);
});
test('venue spellings normalise to our records', () => {
  assert.equal(normalizeVenue('TMP-Rivoli'), 'Rivoli Theatre');
  assert.equal(normalizeVenue('Hard Club LI'), 'Hard Club');
  assert.equal(normalizeVenue('Outsite Cowork Cafe (Mouco) - Porto'), 'M.Ou.Co');
  assert.equal(normalizeVenue('Teatro Nacional de São João'), 'Teatro Nacional São João');
  assert.equal(normalizeVenue('Pérola Negra Club'), 'Pérola Negra');
  assert.equal(normalizeVenue('Some New Bar'), 'Some New Bar');
});
test('sessions collapse into one run; spread-out series go to review', () => {
  const run = collapseSessions([
    c({ source: 'coliseu', name: "Em Casa D'Amália", venue: 'Coliseu Porto Ageas', date: '2026-11-12T21:30' }),
    c({ source: 'coliseu', name: "Em Casa D'Amália", venue: 'Coliseu Porto Ageas', date: '2026-11-13T21:30' }),
  ]);
  assert.equal(run.length, 1);
  assert.equal(run[0].date, '2026-11-12T21:30');
  assert.equal(run[0].endDate, '2026-11-13');
  const series = collapseSessions([
    c({ source: 'agendaporto', name: 'Há Fado no Mercado', venue: 'Mercado do Bolhão', date: '2026-11-04' }),
    c({ source: 'agendaporto', name: 'Há Fado no Mercado', venue: 'Mercado do Bolhão', date: '2026-12-30' }),
  ]);
  assert.equal(series[0].recurring, true);
  assert.equal(routeCandidate(series[0], known).route, 'review');
});
test('festival screenings fold into one festival candidate for review', () => {
  const g = groupFestivalSessions([
    c({ name: 'Porto/Post/Doc 2026 - Eu, Capitão', venue: 'Batalha Centro de Cinema', date: '2026-11-20T17:00' }),
    c({ name: 'Porto/Post/Doc 2026 - Hex', venue: 'Passos Manuel', date: '2026-11-21T21:15' }),
    c({ name: 'Porto/Post/Doc 2026 - Dao', venue: 'Batalha Centro de Cinema', date: '2026-11-29T20:45' }),
    c({ name: 'Linda Martini', date: '2026-11-11' }),
  ]);
  assert.equal(g.length, 2);
  const f = g.find((x) => x.festival)!;
  assert.equal(f.name, 'Porto/Post/Doc 2026');
  assert.equal(f.date, '2026-11-20');
  assert.equal(f.endDate, '2026-11-29');
  assert.equal(routeCandidate(f, known).route, 'review');
});
test('the same event from two sources merges; the venue\'s own page wins', () => {
  const k = mergeAcrossSources([
    c({ source: 'agendaporto', name: 'Linda Martini', venue: 'Coliseu Porto Ageas', date: '2026-11-11', url: 'https://www.agenda-porto.pt/evento/linda-martini/' }),
    c({ source: 'coliseu', name: 'Linda Martini - SON Estrella Galicia', venue: 'Coliseu Porto Ageas', date: '2026-11-11T21:00', url: 'https://www.coliseu.pt/evento/x' }),
    c({ source: 'bol', name: 'Gisela João', venue: 'Teatro Municipal Constantino Nery', date: '2026-11-14' }),
  ]);
  assert.equal(k.length, 2);
  assert.equal(k[0].primary.source, 'coliseu');
  assert.equal(k[0].members.length, 2);
});
test('routing: club nights at any named venue and talks auto (owner 2026-11-01); templates and vague venues to review', () => {
  assert.equal(routeCandidate(c({ source: 'shotgun', venue: 'Switch', name: 'Rebolledo' }), known).route, 'auto');
  assert.equal(routeCandidate(c({ source: 'shotgun', venue: 'MOVE CLUB', name: 'Divas Pop' }), known).route, 'auto');
  assert.equal(routeCandidate(c({ source: 'shotgun', venue: 'Maria Pistolas', name: 'Sat. 07/11 - Nexo X Maria Pistolas' }), known).route, 'review');
  assert.equal(routeCandidate(c({ source: 'shotgun', venue: 'Era Uma Vez no Porto', name: 'Domingo 08 Nov - Zdm / Zoe' }), known).route, 'review');
  assert.equal(routeCandidate(c({ source: 'agendaporto', venue: 'Vários locais', name: 'BALUARTE' }), known).route, 'review');
  assert.equal(routeCandidate(c({ source: 'bol', venue: 'Teatro Nacional São João', name: 'Lançamento de Livro | ABC da Guerra' }), known).route, 'auto');
  assert.equal(routeCandidate(c({ source: 'bol', venue: 'Teatro Nacional São João', name: 'Auto da Barca do Inferno' }), known).route, 'auto');
});
test('digest: header, numbered review lines, reply hint, under 2000 chars per message', () => {
  const msgs = formatDigest({ coliseu: 3, bol: 5 }, [
    { name: 'BALUARTE', date: '2026-11-13', endDate: '2026-11-15', venue: 'Vários locais', url: 'https://www.agenda-porto.pt/evento/baluarte-2026/' },
  ]);
  assert.match(msgs[0], /^Source sweep: 8 new events published \(coliseu 3, bol 5\), 1 for review:/);
  assert.match(msgs[0], /\n1\. BALUARTE \| 13 Nov–15 Nov \| Vários locais \| <https:/);
  assert.match(msgs[0], /add 1,3/);
  const many = formatDigest({}, Array.from({ length: 60 }, (_, i) => ({ name: `Event number ${i} with a long title for testing`, date: '2026-11-13', venue: 'Somewhere', url: `https://example.com/very/long/path/${i}` })));
  assert.ok(many.length > 1 && many.every((m) => m.length < 2000));
  assert.deepEqual(splitMessages(['a', 'b'], 3), ['a\nb']);
});
test('parsers: Agenda Porto card, Shotgun card, Serralves card, Casa da Música session', () => {
  const ap = parseAgendaCards('<a href="evento/261104-dr-love/" data-content-id="c1"><div data-bl-name="Text" data-content-id="c1">Maus Hábitos</div><div data-bl-name="Text" data-content-id="c1">04</div><div data-bl-name="Text" data-content-id="c1">Nov</div><div data-bl-name="Text" data-content-id="c1">Dr. Love</div><div data-bl-name="Tag" data-content-id="c1">Conversas</div>', '2026-11-01');
  assert.equal(ap.length, 1);
  assert.deepEqual([ap[0].name, ap[0].date, ap[0].venue, ap[0].url], ['Dr. Love', '2026-11-04', 'Maus Hábitos', 'https://www.agenda-porto.pt/evento/261104-dr-love/']);
  const sg = parseShotgun('[![Rebolledo](https://assets/x.jpg)\\\n\\\nRebolledo (Pachanga Boys)\\\n\\\nSwitch\\\n\\\nNov 20\\\n\\|11:00 PM\\\n\\\n€18.00\\\n\\\nHouse](https://shotgun.live/en/events/rebolledo)', '2026-11-01');
  assert.equal(sg.length, 1);
  assert.deepEqual([sg[0].name, sg[0].venue, sg[0].date, sg[0].priceFrom], ['Rebolledo (Pachanga Boys)', 'Switch', '2026-11-20T23:00', 18]);
  const sv = parseSerralves('[![2607 Lee Ufan](https://img/x.jpg)\\\n\\\nLee Ufan\\\n\\\nFRAGMENTOS DO INFINITO\\\n\\\nCasa de Serralves\\\n\\\n16 OUT 2026 – MAR 2027](https://www.serralves.pt/ciclo-serralves/2607-lee-ufan/)');
  assert.equal(sv.length, 1);
  assert.deepEqual([sv[0].name, sv[0].date, sv[0].endDate, sv[0].venue], ['Lee Ufan: FRAGMENTOS DO INFINITO', '2026-10-16', '2027-03-31', 'Serralves']);
  assert.equal(routeCandidate(sv[0], known).route, 'auto'); // end month only now publishes (owner 2026-11-01)
  const cdm = parseCdm('21.11.2026 sábado, 18:00\n\nSala Suggia\n\n[![x](y)](https://casadamusica.com/event/sinfonia-orgao/?selected_session=1)\n\n## [Sinfonia Órgão](https://casadamusica.com/event/sinfonia-orgao/?selected_session=1)\n\nOrquestra Sinfónica · Concerto\n');
  assert.deepEqual([cdm[0].name, cdm[0].date], ['Sinfonia Órgão', '2026-11-21T18:00']);
});

// ------------------------------------------------- second check (owner rule 2026-11-01)
// The 5 errors a manual re-check of 11 sweep picks found on 2026-11-01, as the
// refetched page showed them. The reader's fields are given (the LLM is not
// under test); reconcile() must correct or hold each one.
const rec = (o: Partial<EventRecord>): EventRecord => ({
  slug: 's', name: 'X', date: '2026-11-15', venue: 'Era Uma Vez no Porto', venueSlug: 'era-uma-vez-no-porto', category: 'nightlife',
  description: 'A night of house music.', longDescription: 'DJs play house music all night.', sourceEdition: 'forward-scan', addedAt: '2026-11-01T00:00:00Z', ...o,
} as EventRecord);
const fields = (o: Partial<PageFields>): PageFields => ({
  name: null, nameQuote: null, date: null, dateQuote: null, time: null, timeQuote: null, endDate: null, endDateQuote: null,
  venue: null, venueQuote: null, venueRole: 'venue', price: null, priceFrom: null, priceQuote: null, ...o,
});

test('times on pages: "11:59 PM", "23h59", "21.30", "9 pm"', () => {
  assert.deepEqual(timesIn('Sun, Nov 15 · 11:59 PM'), ['23:59']);
  assert.deepEqual(timesIn('Início: 23h59'), ['23:59']);
  assert.deepEqual(timesIn('às 21.30'), ['21:30']);
  assert.deepEqual(timesIn('doors 9 pm'), ['21:00']);
  assert.deepEqual(timesIn('Duração 45 minutos, 15 nov 2026'), []);
});

test('failure 1: start 23:00 stored, page says 23:59 → corrected to 23:59', () => {
  const page = 'Domingo 15 Nov - T-Cross B2b K-Croix / Project-2tk Era Uma Vez No Porto Sun, Nov 15 · 11:59 PM From €10.00';
  const r = reconcile(rec({ name: 'Domingo 15 Nov - T-Cross B2b K-Croix / Project-2tk', date: '2026-11-15T23:00', price: 'From €10', priceFrom: 10 }), fields({
    name: 'Domingo 15 Nov - T-Cross B2b K-Croix / Project-2tk', nameQuote: 'Domingo 15 Nov - T-Cross B2b K-Croix / Project-2tk',
    date: '2026-11-15', dateQuote: 'Sun, Nov 15', time: '23:59', timeQuote: '11:59 PM',
    venue: 'Era Uma Vez No Porto', venueQuote: 'Era Uma Vez No Porto', price: '€10.00', priceFrom: 10, priceQuote: 'From €10.00',
  }), page);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.date, '2026-11-15T23:59');
  assert.deepEqual(r.corrections, ['start time 23:00 → 23:59']);
});

test('failure 2: start 20:00 stored, page says 23:59 → corrected', () => {
  const page = 'Domingo 29 Nov - Especial Bday Manuel Malheiro Era Uma Vez No Porto Sunday 29 November 23:59';
  const r = reconcile(rec({ name: 'Domingo 29 Nov - Especial Bday Manuel Malheiro', date: '2026-11-29T20:00' }), fields({
    name: 'Domingo 29 Nov - Especial Bday Manuel Malheiro', nameQuote: 'Domingo 29 Nov - Especial Bday Manuel Malheiro',
    date: '2026-11-29', dateQuote: 'Sunday 29 November', time: '23:59', timeQuote: '23:59',
    venue: 'Era Uma Vez No Porto', venueQuote: 'Era Uma Vez No Porto',
  }), page);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.date, '2026-11-29T23:59');
});

test('failure 3: a festival series end date on a single 45-minute concert → end date removed', () => {
  const page = 'NOVOS TALENTOS | Gil Brito Teatro & Arte | Música TMP-Rivoli Próxima Sessão 14 nov 2026 19:00 Duração 45 minutos Preços 7€';
  const r = reconcile(rec({ name: 'Novos Talentos: Gil Brito', date: '2026-11-14T19:00', endDate: '2026-12-12', venue: 'Rivoli Theatre', venueSlug: 'rivoli-theatre', category: 'music', price: '€7', priceFrom: 7 }), fields({
    name: 'NOVOS TALENTOS | Gil Brito', nameQuote: 'NOVOS TALENTOS | Gil Brito', date: '2026-11-14', dateQuote: '14 nov 2026', time: '19:00', timeQuote: '14 nov 2026 19:00',
    endDate: null, venue: 'TMP-Rivoli', venueQuote: 'TMP-Rivoli', price: '7€', priceFrom: 7, priceQuote: 'Preços 7€',
  }), page);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.endDate, undefined);
  assert.deepEqual(r.corrections, ['end date 2026-12-12 removed (page shows one date)']);
});

test('failure 4: a one-night show given an extra day → end date removed', () => {
  const page = 'V Festival Internacional de Magia da Maia - O Carcereiro Fórum da Maia 11 dez 2026 21:30 Preço 10€';
  const r = reconcile(rec({ name: 'V Festival Internacional de Magia da Maia: O Carcereiro', date: '2026-12-11T21:30', endDate: '2026-12-12', venue: 'Fórum da Maia', venueSlug: 'forum-da-maia', category: 'family', price: '€10', priceFrom: 10 }), fields({
    name: 'V Festival Internacional de Magia da Maia - O Carcereiro', nameQuote: 'V Festival Internacional de Magia da Maia - O Carcereiro',
    date: '2026-12-11', dateQuote: '11 dez 2026', time: '21:30', timeQuote: '21:30', venue: 'Fórum da Maia', venueQuote: 'Fórum da Maia',
    price: '10€', priceFrom: 10, priceQuote: 'Preço 10€',
  }), page);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.endDate, undefined);
  assert.equal(r.record.date, '2026-12-11T21:30');
});

test('failure 5: a promoter listed as the venue → held for review', () => {
  const page = 'The Groove People presented by Too Much Information Sat, Dec 5 · 11:30 PM Porto';
  const r = reconcile(rec({ name: 'The Groove People', date: '2026-12-05T23:30', venue: 'Too Much Information', venueSlug: 'too-much-information' }), fields({
    name: 'The Groove People', nameQuote: 'The Groove People', date: '2026-12-05', dateQuote: 'Sat, Dec 5', time: '23:30', timeQuote: '11:30 PM',
    venue: 'Too Much Information', venueQuote: 'Too Much Information', venueRole: 'organiser',
  }), page);
  assert.equal(r.status, 'hold');
  assert.match(r.problems.join(' '), /organiser\/promoter/);
  assert.equal(r.record.venue, 'Too Much Information'); // held records are not altered
});

test('no time on the page → no time stored (never guessed); price not on the page → removed', () => {
  const page = 'Feira de Antiguidades e Velharias Praça Velásquez 21 de novembro';
  const r = reconcile(rec({ name: 'Feira de Antiguidades e Velharias', date: '2026-11-21T08:00', venue: 'Praça Velásquez', venueSlug: 'praca-velasquez', price: '€5', priceFrom: 5 }), fields({
    name: 'Feira de Antiguidades e Velharias', nameQuote: 'Feira de Antiguidades e Velharias', date: '2026-11-21', dateQuote: '21 de novembro',
    venue: 'Praça Velásquez', venueQuote: 'Praça Velásquez',
  }), page);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.date, '2026-11-21');
  assert.equal(r.record.price, undefined);
});

test('held, not corrected: invented quote, other date without corroboration, other venue, copy repeating the old time', () => {
  const base = { name: 'Linda Martini', nameQuote: 'Linda Martini', date: '2026-11-11', dateQuote: '11 de novembro', venue: 'Coliseu Box', venueQuote: 'Coliseu Box' };
  const page = 'Linda Martini 11 de novembro 21:00 Coliseu Box Coliseu Porto Ageas';
  const r0 = rec({ name: 'Linda Martini', date: '2026-11-11T21:00', venue: 'Coliseu Porto Ageas', venueSlug: 'coliseu-porto-ageas' });
  assert.equal(reconcile(r0, fields({ ...base, time: '21:00', timeQuote: '21:00' }), page).status, 'ok');
  assert.equal(reconcile(r0, fields({ ...base, time: '21:00', timeQuote: '21:00', nameQuote: 'Linda Martini ao vivo' }), page).status, 'hold');
  assert.equal(reconcile(r0, fields({ ...base, date: '2026-11-12', dateQuote: '12 de novembro' }), 'Linda Martini 12 de novembro Coliseu Box').status, 'hold');
  assert.equal(reconcile(r0, fields({ ...base, venue: 'Hard Club', venueQuote: 'Hard Club' }), page + ' Hard Club').status, 'hold');
  const said = rec({ ...r0, date: '2026-11-11T20:00', longDescription: 'The concert starts at 20:00 in the Coliseu Box.' });
  const h = reconcile(said, fields({ ...base, time: '21:00', timeQuote: '21:00' }), page);
  assert.equal(h.status, 'hold');
  assert.match(h.problems.join(' '), /old time 20:00/);
});

test('a run shown on the page keeps (or gains) its end date; JSON-LD backs the date', () => {
  const page = 'Auto da Barca do Inferno | Gil Vicente 2026 nov 12 a 2026 dez 13 Próxima Sessão 12 nov 2026 19:00 Teatro Nacional São João';
  const r = reconcile(rec({ name: 'Auto da Barca do Inferno', date: '2026-11-12T19:00', venue: 'Teatro Nacional São João', venueSlug: 'teatro-nacional-sao-joao' }), fields({
    name: 'Auto da Barca do Inferno', nameQuote: 'Auto da Barca do Inferno', date: '2026-11-12', dateQuote: '12 nov 2026', time: '19:00', timeQuote: '12 nov 2026 19:00',
    endDate: '2026-12-13', endDateQuote: '2026 dez 13', venue: 'Teatro Nacional São João', venueQuote: 'Teatro Nacional São João',
  }), page, [{ name: 'Auto da Barca do Inferno', startDate: '2026-11-12T19:00:00.0000000' }]);
  assert.equal(r.status, 'corrected');
  assert.equal(r.record.endDate, '2026-12-13');
});

test('one page per night: the source\'s own session list keeps a two-night run; a festival fold does not', () => {
  const page = 'Bryan Adams 17 Novembro, 21:00 Super Bock Arena';
  const f = fields({ name: 'Bryan Adams', nameQuote: 'Bryan Adams', date: '2026-11-17', dateQuote: '17 Novembro', time: '21:00', timeQuote: '21:00', venue: 'Super Bock Arena', venueQuote: 'Super Bock Arena' });
  const r0 = rec({ name: 'Bryan Adams', date: '2026-11-17T21:00', endDate: '2026-11-18', venue: 'Super Bock Arena', venueSlug: 'super-bock-arena', category: 'music' });
  assert.equal(reconcile(r0, f, page, [], ['2026-11-17T21:00', '2026-11-18T21:00']).status, 'ok');
  assert.equal(reconcile(r0, f, page, []).record.endDate, undefined);
});
test('a stored lowest price written on the page is kept (BOL lists full and discount prices)', () => {
  const page = 'Gisela João 14 nov 2026 21:30 Teatro Municipal Constantino Nery Preços Plateia 12,50€ Desconto 6,25€';
  const r = reconcile(rec({ name: 'Gisela João', date: '2026-11-14T21:30', venue: 'Teatro Municipal Constantino Nery', venueSlug: 'teatro-municipal-constantino-nery', price: '€6.25–€12.50', priceFrom: 6.25 }), fields({
    name: 'Gisela João', nameQuote: 'Gisela João', date: '2026-11-14', dateQuote: '14 nov 2026', time: '21:30', timeQuote: '21:30',
    venue: 'Teatro Municipal Constantino Nery', venueQuote: 'Teatro Municipal Constantino Nery', price: '12,50€', priceFrom: 12.5, priceQuote: 'Plateia 12,50€',
  }), page);
  assert.equal(r.status, 'ok');
  assert.equal(r.record.priceFrom, 6.25);
});

console.log(`ok — ${passed} source-sweep tests passed`);
