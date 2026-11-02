/**
 * Assertions for venue aliasing + event identity (no test runner in this
 * repo, so plain node:assert under tsx).
 *
 *   npm run test:dedupe
 */

import assert from 'node:assert/strict';
import { canonicalVenueSlugFor, venueSlugRedirects, isGenericRoomName, hostVenueName } from '../lib/venues';
import { isSameEvent, normalizeEventUrl, sameSourcePageReason } from '../lib/event-identity';
import { findExistingEventByIdentity, type EventRecord } from '../lib/events';
import { findDuplicate } from '../lib/forward-scan';

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
test('room-only venue names are generic; real venues are not', () => {
  for (const v of ['Library', 'Biblioteca', 'Grande Auditório', 'Sala 2', 'Museu', 'The Garden', 'Main Hall']) assert.ok(isGenericRoomName(v), v);
  for (const v of ['Serralves', 'Sala Estúdio IG', 'Biblioteca Municipal Almeida Garrett', 'Parque da Cidade', 'Hard Club', 'Café Casa da Música']) assert.ok(!isGenericRoomName(v), v);
});
test('single-venue sites map to their venue', () => {
  assert.equal(hostVenueName('https://www.serralves.pt/en/atividades-serralves/3110-conversa-com-paulo-rangel/'), 'Serralves');
  assert.equal(canonicalVenueSlugFor(hostVenueName('https://casadamusica.com/pt/agenda/x')!), 'casa-da-musica');
  assert.equal(hostVenueName('https://www.bol.pt/Comprar/Bilhetes/1'), undefined);
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


// ------------------------------------------------- same source page (2026-10-27)
test('same event page + venue + date = one event, even with different names', () => {
  const a = { name: 'MOONSPELL', venue: 'Hard Club', date: '2026-10-31', externalLink: 'https://www.hardclubporto.com/evento/moonspell/?utm_source=x' };
  const b = { name: 'Moonspell: Invicta Halloween', venue: 'Hard Club, Sala 1', date: '2026-10-31', externalLink: 'https://hardclubporto.com/evento/moonspell' };
  assert.ok(sameSourcePageReason(a, b));
});
test('same page but different venue or date is not merged', () => {
  const a = { name: 'X', venue: 'Hard Club', date: '2026-10-31', externalLink: 'https://hardclubporto.com/evento/x' };
  assert.equal(sameSourcePageReason(a, { ...a, venue: 'Maus Hábitos' }), null);
  assert.equal(sameSourcePageReason(a, { ...a, date: '2026-11-07' }), null);
});
test('a festival and its single nights share a page but stay separate', () => {
  const fest = { name: 'NOS Primavera Sound', venue: 'Parque da Cidade', date: '2026-06-11', endDate: '2026-06-14', externalLink: 'https://www.primaverasound.com/en/porto' };
  assert.equal(sameSourcePageReason(fest, { ...fest, name: 'The xx + Big Thief at Primavera', endDate: undefined }), null);
});
test('homepages and agenda/listing pages never identify an event', () => {
  for (const u of ['https://www.casadamusica.com/', 'https://www.casadamusica.com/pt/agenda/', 'https://agendaporto.pt/eventos', 'https://www.serralves.pt/en']) {
    assert.equal(normalizeEventUrl(u), null, u);
  }
  const a = { name: 'A', venue: 'Casa da Música', date: '2026-11-05', externalLink: 'https://www.casadamusica.com/pt/agenda/' };
  assert.equal(sameSourcePageReason(a, { ...a, name: 'B' }), null);
});
test('findExistingEventByIdentity matches by source page', () => {
  const rec = { slug: 'moonspell-hard-club-oct-31-2026', name: 'Moonspell Invicta Halloween', venue: 'Hard Club', venueSlug: 'hard-club', date: '2026-10-31', category: 'music', description: '', sourceEdition: 'forward-scan', addedAt: '2026-10-26T07:00:00Z', externalLink: 'https://hardclubporto.com/evento/moonspell' } as EventRecord;
  const m = findExistingEventByIdentity('MOONSPELL', 'Hard Club', { date: '2026-10-31', url: 'https://www.hardclubporto.com/evento/moonspell/' }, [rec]);
  assert.equal(m?.slug, rec.slug);
  assert.equal(findExistingEventByIdentity('MOONSPELL', 'Hard Club', { date: '2026-10-31' }, [rec])?.slug, undefined);
});

// ------------------------------------------------- forward scan names (2026-10-28, #31)
test('forward scan: a name with commas/slashes matches the longer live name', () => {
  const live = { slug: 'joana-providencia-campo-alegre-auditorio-oct-29-2026', name: 'Joana Providência / Teatro do Bolhão / Atlas, mapeamento poético', venue: 'Campo Alegre Auditório', venueSlug: 'campo-alegre-auditorio', date: '2026-10-29T19:30', endDate: '2026-10-30', category: 'other', description: '', sourceEdition: 'forward-scan', addedAt: '2026-10-27T12:57:00Z' } as EventRecord;
  assert.equal(findDuplicate({ name: 'Atlas, mapeamento poético', venue: 'TMP-Campo Alegre Auditório', date: '2026-10-29', endDate: '2026-10-30' }, [live])?.slug, live.slug);
});
test('forward scan: shared text after a comma alone does not merge different events', () => {
  const a = { slug: 'a', name: 'Fado Night, Casa da Guitarra', venue: 'Casa da Guitarra', venueSlug: 'casa-da-guitarra', date: '2026-11-05', category: 'music', description: '', sourceEdition: 'x', addedAt: '2026-10-01T00:00:00Z' } as EventRecord;
  assert.equal(findDuplicate({ name: 'Jazz Jam, Hot Five', venue: 'Hot Five Jazz & Blues Club', date: '2026-11-05' }, [a]), undefined);
});

// ------------------------------------------------- PT names (2026-11-01 coverage audit)
test('Sinfonia Órgão (PT page) is the existing Organ Symphony', () => {
  assert.ok(isSameEvent(
    ev('Organ Symphony', 'Casa da Música', '2026-11-21T18:00'),
    ev('Sinfonia Órgão', 'Casa da Música, Sala Suggia', '2026-11-21'),
  ));
  const rec = { slug: 'organ-symphony-casa-da-musica-nov-21-2026', name: 'Organ Symphony', venue: 'Casa da Música', venueSlug: 'casa-da-musica', date: '2026-11-21T18:00', category: 'music', description: '', sourceEdition: 'forward-scan', addedAt: '2026-10-31T00:00:00Z' } as EventRecord;
  assert.equal(findExistingEventByIdentity('Sinfonia Órgão', 'Casa da Música', { date: '2026-11-21' }, [rec])?.slug, rec.slug);
});
test('a record\'s namePt is compared with a PT source name', () => {
  const rec = { slug: 'x', name: 'Paper Costume Parade', namePt: 'Cortejo do Traje de Papel', venue: 'Avenida dos Aliados', venueSlug: 'avenida-dos-aliados', date: '2026-11-08', category: 'family', description: '', sourceEdition: 'forward-scan', addedAt: '2026-10-31T00:00:00Z' } as EventRecord;
  assert.equal(findExistingEventByIdentity('Cortejo do Traje de Papel', 'Avenida dos Aliados', { date: '2026-11-08' }, [rec])?.slug, 'x');
  assert.equal(findDuplicate({ name: 'Cortejo do Traje de Papel', venue: 'Av. dos Aliados', date: '2026-11-08' }, [rec])?.slug, 'x');
});
test('PT folding does not merge different works at the same venue and date', () => {
  assert.ok(!isSameEvent(
    ev('Organ Symphony', 'Casa da Música', '2026-11-21'),
    ev('Sinfonia Alpina', 'Casa da Música', '2026-11-21'),
  ));
  assert.ok(!isSameEvent(
    ev('Sinfonia Órgão', 'Casa da Música', '2026-11-21'),
    ev('Sinfonia Órgão', 'Casa da Música', '2026-12-21'),
  ));
});

// ------------------------------------------------- EN + PT page of one event (2026-11-02, #37)
const page = (name: string, venue: string, date: string, externalLink: string, endDate?: string) => ({ name, venue, date, endDate, externalLink });
const rec37 = (slug: string, p: ReturnType<typeof page>) => ({ slug, ...p, venueSlug: canonicalVenueSlugFor(p.venue), category: 'music', description: '', sourceEdition: 'forward-scan', addedAt: '2026-10-26T00:00:00Z' } as EventRecord);
test('#37 Jussen: CdM PT page + EN page, same day and time, is one event', () => {
  const pt = page('Irmãos Jussen', 'Casa da Música', '2026-11-05T19:30', 'https://casadamusica.com/event/irmaos-jussen/?selected_session=44120');
  const en = page('Jussen Brothers', 'Sala Suggia', '2026-11-05T19:30', 'https://casadamusica.com/en/event/jussen-brothers/');
  assert.ok(sameSourcePageReason(pt, en));
  assert.ok(sameSourcePageReason(en, pt));
  // The scan's lookup against an existing record (lib/events.ts).
  assert.equal(findExistingEventByIdentity(en.name, en.venue, { date: en.date, url: en.externalLink }, [rec37('irmaos-jussen', pt)])?.slug, 'irmaos-jussen');
});
test('#37 Serralves: O MUSEU COMO PERFORMANCE / THE MUSEUM AS PERFORMANCE (no times) is one event', () => {
  const pt = page('O MUSEU COMO PERFORMANCE', 'Serralves', '2026-11-07', 'https://www.serralves.pt/atividades-serralves/070811-museu-como-performance/', '2026-11-08');
  const en = page('THE MUSEUM AS PERFORMANCE - 12nd EDITION', 'Serralves Museum', '2026-11-07', 'https://www.serralves.pt/en/ciclo-serralves/0711-o-museu-como-performance/', '2026-11-08');
  assert.ok(sameSourcePageReason(pt, en));
  assert.equal(findExistingEventByIdentity(en.name, en.venue, { date: en.date, endDate: en.endDate, url: en.externalLink }, [rec37('museu', pt)])?.slug, 'museu');
});
test('#37 EDP Maratona do Porto (Vários locais) is the EDP Porto Marathon', () => {
  const en = page('EDP Porto Marathon', 'Queimódromo (Parque da Cidade do Porto)', '2026-11-08T08:00', 'https://www.porto-marathon.com/en/marathon.html');
  const pt = page('EDP Maratona do Porto', 'Vários locais', '2026-11-08T08:00', 'https://www.agenda-porto.pt/evento/edp-maratona-do-porto-2026/');
  assert.ok(isSameEvent(en, pt));
  assert.equal(findExistingEventByIdentity(pt.name, pt.venue, { date: pt.date, url: pt.externalLink }, [rec37('marathon', en)])?.slug, 'marathon');
  // Different hosts: the same-site rule itself does not fire, the name does.
  assert.equal(sameSourcePageReason(en, pt), null);
});
test('#37 Art of Fugue: one CdM page in two languages, translated slugs', () => {
  assert.ok(sameSourcePageReason(
    page('A Arte da Fuga', 'Casa da Música - Sala Suggia', '2026-11-08T18:00', 'https://casadamusica.com/event/a-arte-da-fuga/'),
    page('The Art of Fugue', 'Sala Suggia', '2026-11-08T18:00', 'https://casadamusica.com/en/event/the-art-of-fugue/'),
  ));
});
test('#37 one page in two languages: /en/ prefix, ?lang= and -en suffix', () => {
  const a = page('Concerto X', 'Hard Club', '2026-11-20T21:00', 'https://hardclubporto.com/evento/concerto-x');
  assert.ok(sameSourcePageReason(a, { ...a, name: 'X Concert', date: '2026-11-20', externalLink: 'https://hardclubporto.com/en/evento/concerto-x' }));
  assert.ok(sameSourcePageReason(a, { ...a, name: 'X Concert', externalLink: 'https://hardclubporto.com/evento/concerto-x?lang=en' }));
  assert.ok(sameSourcePageReason(a, { ...a, name: 'X Concert', externalLink: 'https://hardclubporto.com/evento/concerto-x-en' }));
});
test('#37 different concerts at Casa da Música the same day stay separate', () => {
  // Real 11-29 records (Brahms given an EN URL so the page languages differ): different times.
  const paus = page('Paus', 'Casa da Música', '2026-11-29T21:30', 'https://casadamusica.com/event/paus/?selected_session=51857');
  const brahms = page('Brahms, a Segunda Sinfonia', 'Casa da Música', '2026-11-29T12:00', 'https://casadamusica.com/en/event/brahms-the-second-symphony/');
  assert.equal(sameSourcePageReason(paus, brahms), null);
  // Same day AND same time, but both PT pages (Sala 2 and Sala Suggia at once).
  const s2 = page('Remix Ensemble', 'Casa da Música, Sala 2', '2026-11-28T18:00', 'https://casadamusica.com/event/remix-ensemble/');
  const suggia = page('Javier Perianes', 'Casa da Música', '2026-11-28T18:00', 'https://casadamusica.com/event/javier-perianes/?selected_session=44148');
  assert.equal(sameSourcePageReason(s2, suggia), null);
});
test('#37 same site, same venue, same day: other events stay separate', () => {
  // Real 11-07 Serralves programme: a timed performance vs the weekend EN page.
  assert.equal(sameSourcePageReason(
    page('IVAN CHENG - THE FOUNTAIN', 'Serralves', '2026-11-07T14:30', 'https://www.serralves.pt/atividades-serralves/0711-ivan-cheng-the-fountain/'),
    page('THE MUSEUM AS PERFORMANCE - 12nd EDITION', 'Serralves Museum', '2026-11-07', 'https://www.serralves.pt/en/ciclo-serralves/0711-o-museu-como-performance/', '2026-11-08'),
  ), null);
  // GMP: exhibition opening (EN page, one evening) vs the exhibition run (PT page): end dates differ.
  assert.equal(sameSourcePageReason(
    page('Exhibition opening: Isabel Carvalho + Basel Abbas and Ruanne Abou-Rahme + Leonor Parda', 'Galeria Municipal do Porto', '2026-11-21T17:00', 'https://galeriamunicipaldoporto.pt/en/event/exhibition-opening-2/'),
    page('Leonor Parda. Bosque da Noite', 'Galeria Municipal do Porto', '2026-11-21T17:00', 'https://galeriamunicipaldoporto.pt/evento/leonor-parda/', '2027-02-14'),
  ), null);
  // Listing hosts never count as "same site": three TMP shows at 19:30 on agenda-porto.pt.
  assert.equal(sameSourcePageReason(
    page('Albatroz, de Vasco Gomes', 'Teatro Campo Alegre', '2026-11-06T19:30', 'https://www.agenda-porto.pt/evento/tmp-albatroz/', '2026-11-07'),
    page('NOCAUTE, by Inês Pinho', 'Teatro Campo Alegre', '2026-11-06T19:30', 'https://www.agenda-porto.pt/en/evento/tmp-nocaute/', '2026-11-07'),
  ), null);
});

console.log(`ok — ${passed} dedupe tests passed`);
