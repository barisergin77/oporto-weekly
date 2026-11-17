/**
 * Assertions for the English subtitles under PT titles in the EN newsletter
 * (lib/name-en-subtitles.ts). Plain node:assert under tsx, no network.
 * Fixture: the archived 12 Nov 2026 EN edition as it went out (before the
 * subtitles existed).
 *
 *   npm run test:name-en
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  insertNameEnSubtitles, stripNameEnSubtitles, subtitleFor, headingText, NAME_EN_OPEN,
} from '../lib/name-en-subtitles';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'edition-november-12-18-2026.html'), 'utf-8');
const count = (s: string, sub: string) => s.split(sub).length - 1;
const alsoOn = (s: string) => /<!-- ALSO ON -->[\s\S]*?<!-- END ALSO ON -->/.exec(s)![0];

// The edition's records as extracted (nameEn as in data/events after the fix).
const events = [
  { slug: 'floresta-do-amazonas-casa-da-musica-nov-14-2026', name: 'Floresta do Amazonas', nameEn: 'Forest of the Amazon' },
  { slug: 'les-ballets-trockadero-de-monte-carlo-coliseu-porto-ageas-nov-17-2026', name: 'Les Ballets Trockadero de Monte Carlo', nameEn: null },
  { slug: 'bryan-adams-super-bock-arena-nov-17-2026', name: 'Bryan Adams', nameEn: null },
  { slug: 'the-immigrant-cinema-trindade-nov-12-2026', name: 'The Immigrant, The Cure e Easy Street, de Charlie Chaplin', nameEn: 'The Immigrant, The Cure and Easy Street, by Charlie Chaplin' },
  { slug: 'recriacao-do-magusto-tradicional-parque-biologico-de-gaia-nov-14-2026', name: 'Recriação do Magusto Tradicional', nameEn: 'Traditional Chestnut Roast Festival Re-enactment' },
  { slug: 'jose-cid-septeto-hard-club-nov-13-2026', name: 'José Cid & Septeto', nameEn: null },
  { slug: 'baluarte-4-exposicao-de-arte-urbana-do-porto-varios-locais-nov-13-2026', name: 'BALUARTE 4.ª Exposição de Arte Urbana do Porto', nameEn: 'BALUARTE: 4th Porto Urban Art Exhibition' },
  { slug: 'teatro-de-marionetas-do-porto-joana-magalhaes-teatro-campo-alegre-nov-14-2026', name: 'Teatro de Marionetas do Porto & Joana Magalhães / #Não somos cactos#', nameEn: 'Porto Puppet Theatre & Joana Magalhães / We Are Not Cacti' },
  { slug: 'opera-para-bebes-clube-fenianos-portuenses-nov-15-2026', name: 'Ópera para Bebés', nameEn: 'Opera for Babies' },
  // In the "Also on" list only: must stay untouched.
  { slug: 'dar-corpo-a-sombra-galeria-municipal-de-matosinhos-sep-15-2026', name: 'Dar corpo à sombra', nameEn: 'Giving Body to the Shadow' },
];

test('subtitleFor: null, empty and same-as-name give nothing', () => {
  assert.equal(subtitleFor({ name: 'Bryan Adams', nameEn: null }), null);
  assert.equal(subtitleFor({ name: 'Bryan Adams', nameEn: undefined }), null);
  assert.equal(subtitleFor({ name: 'Bryan Adams', nameEn: '  ' }), null);
  assert.equal(subtitleFor({ name: 'Trampolim', nameEn: ' trampolim ' }), null);
  assert.equal(subtitleFor({ name: 'Trampolim', nameEn: 'Trampoline' }), 'Trampoline');
});

test('headingText decodes entities and strips tags', () => {
  assert.equal(headingText('\n  <a href="x" style="y">Queen &amp; ABBA</a>\n '), 'Queen & ABBA');
  assert.equal(headingText('Caf&eacute;&#39;s'), 'Caf&eacute;\'s');
});

const { html, added } = insertNameEnSubtitles(fixture, events);

test('fixture: picks and category sections get subtitles', () => {
  // Floresta, Chaplin, Magusto (picks) + BALUARTE, Marionetas, Ópera (categories)
  assert.equal(added, 6);
  for (const t of ['Forest of the Amazon', 'The Immigrant, The Cure and Easy Street, by Charlie Chaplin',
    'Traditional Chestnut Roast Festival Re-enactment', 'BALUARTE: 4th Porto Urban Art Exhibition',
    'Porto Puppet Theatre &amp; Joana Magalhães / We Are Not Cacti', 'Opera for Babies']) {
    assert.equal(count(html, `>${t}</p>`), 1, t);
  }
});

test('fixture: subtitle sits directly after the heading, styled like the site', () => {
  const i = html.indexOf('>Floresta do Amazonas</a>');
  const after = html.slice(i, i + 400);
  assert.match(after, /<\/a>\s*<\/h3>\n<!--ow:name-en--><p style="margin:2px 0 6px 0;font-family:Georgia,'Playfair Display',serif;font-size:15px;font-style:italic;color:#6b6b6b;[^"]*">Forest of the Amazon<\/p>/);
});

test('fixture: English, French and proper names are left alone', () => {
  for (const n of ['Les Ballets Trockadero de Monte Carlo', 'Bryan Adams', 'José Cid & Septeto']) {
    const i = html.indexOf(`>${n}</a>`);
    assert.ok(i > 0, n);
    assert.ok(!html.slice(i, i + 80).includes(NAME_EN_OPEN), n);
  }
});

test('fixture: "Also on" block untouched', () => {
  assert.equal(alsoOn(html), alsoOn(fixture));
});

test('idempotent: a second pass adds nothing', () => {
  const again = insertNameEnSubtitles(html, events);
  assert.equal(again.added, 0);
  assert.equal(again.html, html);
});

test('strip restores the original exactly (PT translation input)', () => {
  assert.equal(stripNameEnSubtitles(html), fixture);
});

test('corpus fills nameEn by slug, then by name; explicit null wins', () => {
  const bare = [
    { slug: 'floresta-do-amazonas-casa-da-musica-nov-14-2026', name: 'Floresta do Amazonas' },
    { slug: 'fresh-slug', name: 'Ópera para Bebés' },
    { slug: 'the-immigrant-cinema-trindade-nov-12-2026', name: 'The Immigrant, The Cure e Easy Street, de Charlie Chaplin', nameEn: null },
  ];
  const corpus = [
    { slug: 'floresta-do-amazonas-casa-da-musica-nov-14-2026', name: 'Floresta do Amazonas', nameEn: 'Forest of the Amazon' },
    { slug: 'opera-para-bebes-clube-fenianos-portuenses-nov-15-2026', name: 'Ópera para Bebés', nameEn: 'Opera for Babies' },
    { slug: 'the-immigrant-cinema-trindade-nov-12-2026', name: 'x', nameEn: 'Should not be used' },
  ];
  const r = insertNameEnSubtitles(fixture, bare, corpus);
  assert.equal(r.added, 2); // Floresta (pick) + Ópera (category); Chaplin stays bare
  assert.ok(r.html.includes('>Forest of the Amazon</p>'));
  assert.ok(r.html.includes('>Opera for Babies</p>'));
  assert.ok(!r.html.includes('Should not be used'));
});

test('older template: /event/ link heading and Georgia <p> title, HTML escaped', () => {
  const src =
    `<h3 style="font-family:Georgia;margin:0 0 6px;"><a href="https://oportoweekly.com/event/a" style="color:inherit;text-decoration:none;">Canções de Granito</a></h3>` +
    `<p style="font-family: Georgia, serif;font-size:19px">Feira &amp; Mercado</p><p style="font-family:Inter">Feira &amp; Mercado</p>`;
  const r = insertNameEnSubtitles(src, [
    { name: 'Canções de Granito', nameEn: 'Granite Songs' },
    { name: 'Feira & Mercado', nameEn: 'Fair <&> Market' },
  ]);
  assert.equal(r.added, 2);
  assert.ok(r.html.includes('</h3>\n<!--ow:name-en--><p'));
  assert.ok(r.html.includes('>Fair &lt;&amp;&gt; Market</p>'));
  assert.equal(count(r.html, NAME_EN_OPEN), 2); // the Inter description <p> is not a title
});

test('no events with a gloss: HTML returned unchanged', () => {
  const r = insertNameEnSubtitles(fixture, [{ name: 'Bryan Adams', nameEn: null }]);
  assert.equal(r.added, 0);
  assert.equal(r.html, fixture);
});

console.log(`test-name-en-subtitles: ${passed} passed`);
