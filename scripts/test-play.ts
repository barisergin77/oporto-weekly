/**
 * Assertions for Porto Zoom (lib/play.ts) and the Porto facts data
 * (lib/porto-facts.ts): daily pick, scoring, share string, stats, and the
 * data files themselves (images on disk, credits, licences, sources).
 * Plain node:assert under tsx, like test-related-guides.ts. No network.
 *
 *   npm run test:play
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  LAUNCH_DATE, MAX_GUESSES, PUZZLES, SKIP, ZOOM_STEPS, addDays, choicesFor, computeStats, dayNumber, gameState,
  lisbonDate, matchPlace, minutesToNextPuzzle, placeList, puzzleForDate, puzzleForNumber, shareText, suggestPlaces, zoomFor,
} from '../lib/play';
import { PORTO_FACTS, factIndexForDate } from '../lib/porto-facts';
import { GUIDE_TOPICS, guideForTopic } from '../lib/related-guides';
import { listBlogPosts } from '../lib/blog';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
};

// --- data -------------------------------------------------------------------

test('at least 40 puzzles, unique ids and images', () => {
  assert.ok(PUZZLES.length >= 40, `only ${PUZZLES.length} puzzles`);
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length);
  assert.equal(new Set(PUZZLES.map((p) => p.image)).size, PUZZLES.length);
});
test('every image exists under public/, total under 15 MB, file names do not leak the answer', () => {
  let total = 0;
  for (const p of PUZZLES) {
    const f = path.join(process.cwd(), 'public', p.image);
    assert.ok(fs.existsSync(f), `missing ${p.image}`);
    total += fs.statSync(f).size;
    assert.match(p.image, /^\/play\/p\/[0-9a-f]{10}\.webp$/);
    assert.ok(p.width <= 1200 && p.height <= 1200, `${p.id} larger than 1200px`);
  }
  assert.ok(total < 15e6, `images total ${(total / 1e6).toFixed(1)} MB`);
});
test('every puzzle has a free licence, author, Commons file page, source and guide topic', () => {
  const posts = listBlogPosts();
  for (const p of PUZZLES) {
    assert.match(p.credit.licence, /^(CC BY(-SA)? [1-4]\.0|CC0|Public domain)$/, `${p.id}: ${p.credit.licence}`);
    if (p.credit.licence !== 'Public domain') assert.match(p.credit.licenceUrl, /^https:\/\/creativecommons\.org\//, p.id);
    assert.ok(p.credit.author.trim().length > 1, `${p.id} has no author`);
    assert.match(p.credit.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, p.id);
    assert.match(p.sourceUrl, /^https:\/\//, p.id);
    assert.ok(p.guide in GUIDE_TOPICS && guideForTopic(p.guide, posts), `${p.id}: guide topic ${p.guide}`);
    assert.ok(p.fx >= 0 && p.fx <= 100 && p.fy >= 0 && p.fy <= 100, p.id);
  }
});
test('names and aliases never collide between places', () => {
  for (const p of PUZZLES) for (const n of [p.en, p.pt, ...p.aliases]) assert.equal(matchPlace(n), p.id, `${n} -> ${matchPlace(n)}`);
});
test('at least 60 facts, each with EN, PT and an https source', () => {
  assert.ok(PORTO_FACTS.length >= 60, `only ${PORTO_FACTS.length} facts`);
  assert.equal(new Set(PORTO_FACTS.map((f) => f.id)).size, PORTO_FACTS.length);
  for (const f of PORTO_FACTS) {
    assert.ok(f.en.length > 20 && f.pt.length > 20, f.id);
    assert.match(f.sourceUrl, /^https:\/\//, f.id);
  }
});

// --- daily pick ---------------------------------------------------------------

test('Lisbon date and puzzle numbers', () => {
  assert.equal(lisbonDate(new Date('2026-11-01T00:30:00Z')), '2026-11-01'); // WET = UTC in winter
  assert.equal(lisbonDate(new Date('2026-07-01T23:30:00Z')), '2026-07-02'); // WEST = UTC+1 in summer
  assert.equal(dayNumber(LAUNCH_DATE), 1);
  assert.equal(dayNumber('2026-11-12'), 12);
  assert.equal(dayNumber('2026-10-20'), 1, 'before launch plays #1');
  assert.equal(dayNumber('2027-03-29'), 149, 'DST change does not shift the count');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('puzzle of the day is deterministic and walks the list in order, then loops', () => {
  assert.equal(puzzleForDate('2026-11-01').puzzle.id, PUZZLES[0].id);
  assert.equal(puzzleForDate('2026-11-02').puzzle.id, PUZZLES[1].id);
  assert.equal(puzzleForDate('2026-11-05').number, 5);
  assert.equal(puzzleForNumber(PUZZLES.length + 1).id, PUZZLES[0].id);
  assert.deepEqual(puzzleForDate('2026-11-20'), puzzleForDate('2026-11-20'));
});
test('appending puzzles keeps every day that already had one', () => {
  const longer = [...PUZZLES, { ...PUZZLES[0], id: 'new-one' }];
  for (let n = 1; n <= PUZZLES.length; n++) assert.equal(puzzleForNumber(n, longer).id, puzzleForNumber(n).id);
});
test('minutes to next puzzle', () => {
  assert.equal(minutesToNextPuzzle(new Date('2026-11-01T23:00:00Z')), 60);
  assert.equal(minutesToNextPuzzle(new Date('2026-07-01T22:30:00Z')), 30); // 23:30 in Lisbon
});

// --- guessing and scoring -------------------------------------------------------

const answer = PUZZLES[0].id;
const wrong = PUZZLES.filter((p) => p.id !== answer).map((p) => p.id);

test('match typed names: accents, case, PT and EN names, aliases', () => {
  assert.equal(matchPlace('capela das almas'), 'capela-almas');
  assert.equal(matchPlace('  CHAPEL OF SOULS '), 'capela-almas');
  assert.equal(matchPlace('Torre dos Clerigos'), 'clerigos');
  assert.equal(matchPlace('ponte luis i'), 'luis-i');
  assert.equal(matchPlace('Sé do Porto'), 'se');
  assert.equal(matchPlace('nowhere'), undefined);
  assert.equal(matchPlace(''), undefined);
});
test('autocomplete finds places by partial words in either language', () => {
  assert.ok(suggestPlaces('bolh', 'en', PUZZLES).some((p) => p.id === 'bolhao'));
  assert.ok(suggestPlaces('ponte', 'pt', PUZZLES).length >= 3);
  assert.equal(suggestPlaces('clerig', 'pt', PUZZLES)[0].id, 'clerigos');
  assert.deepEqual(suggestPlaces('', 'en', PUZZLES), []);
  assert.ok(suggestPlaces('a', 'en', PUZZLES).length <= 6);
});
test('client place list carries names only', () => {
  const pl = placeList();
  assert.equal(pl.length, PUZZLES.length);
  assert.deepEqual(Object.keys(pl[0]).sort(), ['aliases', 'en', 'id', 'pt']);
});
test('play one puzzle end to end: two misses, a skip, then the answer', () => {
  let g: string[] = [];
  assert.deepEqual(gameState(g, answer), { status: 'playing', misses: 0 });
  assert.equal(zoomFor(gameState(g, answer)), ZOOM_STEPS[0]);
  g = [wrong[0]];
  assert.equal(gameState(g, answer).misses, 1);
  assert.equal(zoomFor(gameState(g, answer)), ZOOM_STEPS[1]);
  g = [wrong[0], wrong[1], SKIP];
  assert.equal(zoomFor(gameState(g, answer)), ZOOM_STEPS[3]);
  g = [...g, answer];
  const st = gameState(g, answer);
  assert.deepEqual(st, { status: 'won', misses: 3, solvedAt: 4 });
  assert.equal(zoomFor(st), 1, 'full photo after the game');
});
test('five misses lose; guesses after the end are ignored', () => {
  const five = wrong.slice(0, MAX_GUESSES);
  assert.deepEqual(gameState(five, answer), { status: 'lost', misses: 5 });
  assert.equal(gameState([...five, answer], answer).status, 'lost');
  assert.deepEqual(gameState([answer], answer), { status: 'won', misses: 0, solvedAt: 1 });
});
test('zoom only ever goes out', () => {
  for (let i = 1; i < ZOOM_STEPS.length; i++) assert.ok(ZOOM_STEPS[i] < ZOOM_STEPS[i - 1]);
  assert.equal(ZOOM_STEPS.length, MAX_GUESSES);
});
test('four choices: the answer plus three others, the same for everyone that day', () => {
  for (let n = 1; n <= 60; n++) {
    const c = choicesFor(n);
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(puzzleForNumber(n).id));
    assert.deepEqual(choicesFor(n), c);
  }
});

// --- share ---------------------------------------------------------------------

test('share string: spoiler-free, score, squares, URL', () => {
  const s = shareText({ number: 12, guesses: [wrong[0], SKIP, answer], answerId: answer, lang: 'en' });
  assert.equal(s, 'Porto Zoom #12 3/5\n\u{1F7E5}⬛\u{1F7E9}⬜⬜\nhttps://oportoweekly.com/play');
  for (const p of PUZZLES) assert.ok(!s.toLowerCase().includes(p.en.toLowerCase()), 'no place names');
  const lost = shareText({ number: 3, guesses: wrong.slice(0, 5), answerId: answer, lang: 'pt', usedChoices: true });
  assert.equal(lost, 'Porto Zoom #3 X/5 (com 4 opções)\n\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E5}\nhttps://oportoweekly.com/pt/jogar');
  const first = shareText({ number: 1, guesses: [answer], answerId: answer, lang: 'en', usedChoices: true });
  assert.equal(first, 'Porto Zoom #1 1/5 (with 4 choices)\n\u{1F7E9}⬜⬜⬜⬜\nhttps://oportoweekly.com/play');
});

// --- stats ---------------------------------------------------------------------

test('stats: played, win %, streak, best streak, distribution', () => {
  const r = (won: boolean, guesses: number) => ({ number: 0, won, guesses });
  const history = {
    '2026-11-01': r(true, 2),
    '2026-11-02': r(true, 3),
    '2026-11-03': r(false, 5),
    '2026-11-05': r(true, 1),
    '2026-11-06': r(true, 2),
    '2026-11-07': r(true, 5),
  };
  const s = computeStats(history, '2026-11-07');
  assert.equal(s.played, 6);
  assert.equal(s.wins, 5);
  assert.equal(s.winPct, 83);
  assert.equal(s.streak, 3);
  assert.equal(s.maxStreak, 3);
  assert.deepEqual(s.distribution, [1, 2, 1, 0, 1]);
  assert.equal(computeStats(history, '2026-11-08').streak, 3, 'today not played yet keeps the streak');
  assert.equal(computeStats(history, '2026-11-09').streak, 0, 'a missed day breaks it');
  assert.deepEqual(computeStats({}, '2026-11-01'), { played: 0, wins: 0, winPct: 0, streak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0] });
});

// --- facts ---------------------------------------------------------------------

test('fact of the day is stable per date and in range', () => {
  const a = factIndexForDate('2026-11-10');
  assert.equal(factIndexForDate('2026-11-10'), a);
  assert.notEqual(factIndexForDate('2026-11-11'), a);
  for (let i = 0; i < 400; i++) {
    const k = factIndexForDate(addDays('2026-11-01', i));
    assert.ok(k >= 0 && k < PORTO_FACTS.length);
  }
});

console.log(`test-play: ${passed} passed`);
