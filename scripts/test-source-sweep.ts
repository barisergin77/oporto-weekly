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

console.log(`ok — ${passed} source-sweep tests passed`);
