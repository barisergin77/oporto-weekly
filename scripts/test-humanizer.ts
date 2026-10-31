/**
 * Assertions for the humanizer post-pass (lib/humanizer.ts). Plain
 * node:assert under tsx, like test-compose.ts. No network.
 *
 *   npm run test:humanizer
 */

import assert from 'node:assert/strict';
import { HUMANIZER_RULES, humanizeText, humanizeHtml } from '../lib/humanizer';

const D = '—';
let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
};

test('spaced em dash becomes a comma', () => {
  assert.equal(humanizeText(`Fado at Casa da Mariquinhas ${D} book ahead.`), 'Fado at Casa da Mariquinhas, book ahead.');
});
test('paired dashes become commas', () => {
  assert.equal(humanizeText(`The market ${D} open since 1914 ${D} is back.`), 'The market, open since 1914, is back.');
});
test('unspaced dash between words', () => {
  assert.equal(humanizeText(`Bolhão${D}the old market`), 'Bolhão, the old market');
});
test('number range becomes a hyphen', () => {
  assert.equal(humanizeText(`Tickets €15${D}€30, doors 21h00 ${D} 23h00`), 'Tickets €15-€30, doors 21h00-23h00');
  assert.equal(humanizeText(`Open 10${D}18h`), 'Open 10-18h');
});
test('dash before closing punctuation is dropped', () => {
  assert.equal(humanizeText(`Free entry ${D}.`), 'Free entry.');
  assert.equal(humanizeText(`(Gaia side ${D})`), '(Gaia side)');
  assert.equal(humanizeText(`(${D} Gaia side)`), '(Gaia side)');
});
test('dash after punctuation does not double it', () => {
  assert.equal(humanizeText(`It sells out, ${D} go early.`), 'It sells out, go early.');
  assert.equal(humanizeText(`It sells out. ${D} Go early.`), 'It sells out. Go early.');
});
test('line-leading dash keeps a list bullet; trailing dash is dropped', () => {
  assert.equal(humanizeText(`Picks:\n${D} Serralves\n${D} Coliseu`), 'Picks:\n- Serralves\n- Coliseu');
  assert.equal(humanizeText(`Porto this week ${D}\nmore below`), 'Porto this week\nmore below');
});
test('title mode uses a colon for a single dash', () => {
  assert.equal(humanizeText(`Porto Wine Guide ${D} Cellars and Tastings`, { title: true }), 'Porto Wine Guide: Cellars and Tastings');
});
test('PT text works the same', () => {
  assert.equal(humanizeText(`O mercado ${D} aberto desde 1914 ${D} voltou.`), 'O mercado, aberto desde 1914, voltou.');
});
test('horizontal bar, HTML entity and spaced double hyphen count as dashes', () => {
  assert.equal(humanizeText('Ribeira ― at night'), 'Ribeira, at night');
  assert.equal(humanizeText('Ribeira &mdash; at night'), 'Ribeira, at night');
  assert.equal(humanizeText('Ribeira -- at night'), 'Ribeira, at night');
});
test('curly quotes become straight', () => {
  assert.equal(humanizeText('“Porto’s best nata”, they said ‘twice’'), '"Porto\'s best nata", they said \'twice\'');
});
test('en dashes, hyphens, URLs and hashtags are untouched', () => {
  const s = 'Nov 5–9 · walk-in · https://oportoweekly.com/blog/porto--guide #Porto #VisitPorto';
  assert.equal(humanizeText(s), s);
});
test('text without dashes or curly quotes is returned unchanged', () => {
  const s = 'Get there before 22h. The queue for the terrace is long.';
  assert.equal(humanizeText(s), s);
  assert.equal(humanizeText(''), '');
});

test('HTML: only text nodes change; attributes, comments and style stay', () => {
  const html =
    `<html><head><title>A ${D} B</title><style>p::before{content:"${D}"}</style></head><body>` +
    `<img alt="Porto ${D} “night”" src="https://x.y/a--b.png" />` +
    `<!-- IMAGE_INLINE ${D} -->` +
    `<p>Serralves ${D} free on Sundays ${D} is worth it. It’s “big”.</p>` +
    `</body></html>`;
  const out = humanizeHtml(html);
  assert.ok(out.includes(`<title>A ${D} B</title>`));
  assert.ok(out.includes(`content:"${D}"`));
  assert.ok(out.includes(`<img alt="Porto ${D} “night”" src="https://x.y/a--b.png" />`));
  assert.ok(out.includes(`<!-- IMAGE_INLINE ${D} -->`));
  assert.ok(out.includes(`<p>Serralves, free on Sundays, is worth it. It's "big".</p>`));
});
test('HTML: dash next to inline tags becomes a comma; at block edges it is dropped', () => {
  assert.equal(humanizeHtml(`<p><strong>Coliseu</strong> ${D} the big room</p>`), '<p><strong>Coliseu</strong>, the big room</p>');
  assert.equal(humanizeHtml(`<li>${D} Serralves</li>`), '<li>Serralves</li>');
  assert.equal(humanizeHtml(`<td>Porto ${D}</td>`), '<td>Porto</td>');
  assert.equal(humanizeHtml(`<p>See <a href="https://a.pt/x">this</a> ${D} it helps</p>`), '<p>See <a href="https://a.pt/x">this</a>, it helps</p>');
});
test('HTML: entities are handled in text nodes', () => {
  assert.equal(humanizeHtml('<p>Bolh&atilde;o &mdash; reopened &ldquo;2022&rdquo;</p>'), '<p>Bolh&atilde;o, reopened "2022"</p>');
});
test('HTML without dashes is byte-identical', () => {
  const html = '<p style="color:#3a3a3a">Date · Venue · €10 &amp; more</p>';
  assert.equal(humanizeHtml(html), html);
});

test('rules block covers the core rules and stays compact', () => {
  for (const s of ['NO em dashes', 'Straight quotes', 'Negative parallelism', 'Rule-of-three', '-ing tails', 'European Portuguese', 'vibrant', 'vibrante']) {
    assert.ok(HUMANIZER_RULES.includes(s), `rules mention ${s}`);
  }
  assert.ok(HUMANIZER_RULES.split('\n').length <= 50, 'rules block stays under 50 lines');
});

console.log(`test-humanizer: ${passed} passed`);
