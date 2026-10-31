/**
 * Assertions for "daily research + weekly composition" (plain node:assert
 * under tsx, like test-dedupe.ts). No network.
 *
 *   npm run test:compose
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  editionWindows, scanWindow, inFreezeWindow, discoverySearches, needsUpdate, mergeVerified,
} from '../lib/forward-scan';
import {
  selectEditionEvents, composeDecision, eventDigest, renderAlsoOn, insertAlsoOn, longRunsNotFeatured,
  mergeEventFiles, ALSO_ON_PLACEHOLDER, whenText,
  renderFromTheBlog, insertFromTheBlog, localizeFromTheBlog,
} from '../lib/edition-compose';
import { newsletterGuide } from '../lib/related-guides';
import { listBlogPosts, type BlogPost } from '../lib/blog';
import { gitBlobSha } from '../lib/event-store';
import { FORWARD_SOURCE, type EventRecord } from '../lib/events';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const ev = (p: Partial<EventRecord> & { name: string; date: string }): EventRecord => ({
  slug: p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  venue: 'Hard Club', category: 'music', description: 'A concert.', sourceEdition: FORWARD_SOURCE,
  addedAt: '2026-10-01T00:00:00Z', ...p,
});

// ------------------------------------------------------------- windows
test('edition windows: Sunday → next Thu–Wed + rest of this week', () => {
  const w = editionWindows(new Date('2026-10-25T07:00:00Z')); // Sun
  assert.deepEqual(w.next, { from: '2026-10-29', to: '2026-11-04' });
  assert.deepEqual(w.current, { from: '2026-10-26', to: '2026-10-28' });
});
test('edition windows: Wednesday has no current remainder', () => {
  const w = editionWindows(new Date('2026-10-28T07:00:00Z'));
  assert.deepEqual(w.next, { from: '2026-10-29', to: '2026-11-04' });
  assert.equal(w.current, null);
});
test('edition windows: Thursday → today’s edition window', () => {
  const w = editionWindows(new Date('2026-10-29T05:30:00Z'));
  assert.deepEqual(w.next, { from: '2026-10-29', to: '2026-11-04' });
  assert.equal(w.current, null);
  assert.equal(scanWindow(new Date('2026-10-29T05:30:00Z')).from, '2026-10-29', 'Thursday scan includes today');
  assert.equal(scanWindow(new Date('2026-10-25T07:00:00Z')).from, '2026-10-26', 'other days start tomorrow');
});
test('freeze: Thursday early scan allowed until 07:30, Wed evening frozen', () => {
  assert.equal(inFreezeWindow(new Date('2026-10-29T05:30:00Z')), false);
  assert.equal(inFreezeWindow(new Date('2026-10-29T07:29:00Z')), false);
  assert.equal(inFreezeWindow(new Date('2026-10-29T07:30:00Z')), true);
  assert.equal(inFreezeWindow(new Date('2026-10-29T12:00:00Z')), true);
  assert.equal(inFreezeWindow(new Date('2026-10-28T18:00:00Z')), true);
  assert.equal(inFreezeWindow(new Date('2026-10-28T07:00:00Z')), false);
});
test('discovery searches are bounded: ≤ 8 daily, 2 top-up', () => {
  const sun = new Date('2026-10-25T07:00:00Z');
  const daily = discoverySearches('daily', scanWindow(sun), sun);
  assert.equal(daily.length, 8);
  assert.equal(daily.filter((s) => s.scope === 'week').length, 5);
  assert.ok(daily.filter((s) => s.scope === 'week').every((s) => s.from === '2026-10-29' && s.to === '2026-11-04'));
  const wed = new Date('2026-10-28T07:00:00Z');
  assert.equal(discoverySearches('daily', scanWindow(wed), wed).length, 7);
  const thu = new Date('2026-10-29T05:30:00Z');
  const top = discoverySearches('topup', editionWindows(thu).next, thu);
  assert.equal(top.length, 2);
  assert.ok(top.every((s) => s.from === '2026-10-29' && s.to === '2026-11-04'));
});

// ------------------------------------------------------------- re-found events
test('re-found record: gaps filled, enrichment + identity kept', () => {
  const old = ev({ name: 'Fado Night', date: '2026-10-30', slug: 'fado-old', sourceEdition: 'october-22-28-2026',
    image: { url: 'https://i.imgur.com/x.jpg', credit: 'Photo: X' }, descriptionPt: 'Noite de fado.' });
  assert.equal(needsUpdate(old), true);
  const fresh = ev({ name: 'Fado Night (live)', date: '2026-10-30T21:30', slug: 'fado-new', externalLink: 'https://hardclubporto.com/e/1',
    longDescription: 'Long copy.', price: '€12', pickCandidate: true });
  const m = mergeVerified(old, fresh, new Date('2026-10-25T07:00:00Z'));
  assert.equal(m.slug, 'fado-old');
  assert.equal(m.name, 'Fado Night');
  assert.equal(m.date, '2026-10-30');
  assert.equal(m.sourceEdition, 'october-22-28-2026');
  assert.equal(m.externalLink, 'https://hardclubporto.com/e/1');
  assert.equal(m.longDescription, 'Long copy.');
  assert.equal(m.price, '€12');
  assert.equal(m.pickCandidate, true);
  assert.equal(m.descriptionPt, 'Noite de fado.');
  assert.equal(m.image?.url, 'https://i.imgur.com/x.jpg');
  assert.equal(m.lastSeenAt, '2026-10-25T07:00:00.000Z');
  assert.equal(needsUpdate(m), false);
});

// ------------------------------------------------------------- selection
const corpus: EventRecord[] = [
  ev({ name: 'Band A', date: '2026-10-29T21:00', pickCandidate: true, externalLink: 'https://hardclubporto.com/a' }),
  ev({ name: 'Band B', date: '2026-10-31', venue: 'Coliseu Porto' }),
  ev({ name: 'Halloween Party', date: '2026-10-31', category: 'nightlife', venue: 'Maus Hábitos', pickCandidate: true }),
  ev({ name: 'Kids Workshop', date: '2026-11-01', category: 'family', venue: 'Serralves' }),
  ev({ name: 'Wine Fair', date: '2026-11-02', endDate: '2026-11-04', category: 'food', venue: 'Alfândega do Porto' }),
  ev({ name: 'Old Pick Show', date: '2026-11-03', venue: 'Casa da Música' }),
  ev({ name: 'Fantasporto', date: '2026-11-01', venue: 'Rivoli' }),
  ev({ name: 'Long Expo', date: '2026-06-01', endDate: '2027-01-10', category: 'art', venue: 'Serralves' }),
  ev({ name: 'Expo Ending', date: '2026-09-01', endDate: '2026-11-02', category: 'art', venue: 'Galeria Municipal do Porto' }),
  ev({ name: 'Last Week Gig', date: '2026-10-25' }),
  ev({ name: 'Next Month Gig', date: '2026-11-20' }),
  ev({ name: 'No Copy', date: '2026-10-30', description: '' }),
  // duplicate record of Band A (newer) — must collapse to the oldest
  ev({ name: 'Band A', date: '2026-10-29', slug: 'band-a-dup', addedAt: '2026-10-20T00:00:00Z' }),
];

test('selection: window, blocklist, duplicates, short vs long runs', () => {
  const sel = selectEditionEvents(corpus, '2026-10-29', '2026-11-04', { blocked: ['Fantasporto 2026'], recentPicks: ['Old Pick Show'] });
  const names = (l: EventRecord[]) => l.map((e) => e.name);
  assert.deepEqual(names(sel.short), ['Band A', 'Band B', 'Halloween Party', 'Kids Workshop', 'Wine Fair', 'Old Pick Show']);
  assert.equal(sel.short[0].slug, 'band-a', 'canonical (oldest) duplicate kept');
  assert.deepEqual(names(sel.longRuns), ['Expo Ending', 'Long Expo'], 'long runs end-soonest first');
  assert.deepEqual(sel.blocked, ['Fantasporto']);
  assert.ok(!names(sel.pickPool).includes('Old Pick Show'), 'recent picks not pick-eligible');
  assert.deepEqual(names(sel.pickPool).slice(0, 2), ['Band A', 'Halloween Party'], 'pick candidates first');
});
test('compose decision: thresholds and fallback reason', () => {
  const sel = selectEditionEvents(corpus, '2026-10-29', '2026-11-04');
  assert.equal(composeDecision(sel).compose, false, '9 events < 10');
  assert.match(composeDecision(sel).reason, /only/);
  assert.equal(composeDecision(sel, { total: 8, short: 6 }).compose, true);
  const thin = selectEditionEvents(corpus.slice(0, 3), '2026-10-29', '2026-11-04');
  assert.equal(composeDecision(thin, { total: 1, short: 1 }).compose, false, 'needs 5 pick-eligible');
});
test('digest carries exact names, venues, links and pick flags', () => {
  const sel = selectEditionEvents(corpus, '2026-10-29', '2026-11-04');
  const d = eventDigest(sel);
  assert.match(d, /- name: Band A\n  venue: Hard Club\n  when: Thu 29 Oct 2026, 21:00/);
  assert.match(d, /link: https:\/\/hardclubporto\.com\/a\n  pick-eligible: yes \(strong candidate\)/);
  assert.match(d, /link: https:\/\/oportoweekly\.com\/event\/band-b/);
  assert.match(d, /LONG RUNS[\s\S]*- name: Long Expo[\s\S]*pick-eligible: no/);
  assert.equal(whenText({ date: '2026-11-02', endDate: '2026-11-04' }), 'Mon 2 Nov 2026 – Wed 4 Nov 2026');
});

// ------------------------------------------------------------- also on
test('also on: unfeatured long runs, placeholder or footer, escaped', () => {
  const longs = [ev({ name: 'A & B <Expo>', date: '2026-06-01', endDate: '2026-11-08', venue: 'Serralves', slug: 'ab' }), ev({ name: 'Featured', date: '2026-06-01', endDate: '2027-01-01', slug: 'f' })];
  const rest = longRunsNotFeatured(longs, [{ slug: 'f', name: 'Featured' }]);
  assert.deepEqual(rest.map((e) => e.slug), ['ab']);
  const block = renderAlsoOn(rest);
  assert.match(block, /href="https:\/\/oportoweekly\.com\/event\/ab"/);
  assert.match(block, /A &amp; B &lt;Expo&gt;/);
  assert.match(block, /until 8 Nov/);
  const withPh = `<body><p>tip</p>${ALSO_ON_PLACEHOLDER}<div>TIP</div></body>`;
  assert.equal(insertAlsoOn(withPh, block).includes(ALSO_ON_PLACEHOLDER), false);
  assert.ok(insertAlsoOn(withPh, block).indexOf('Also on') < insertAlsoOn(withPh, block).indexOf('TIP'));
  assert.equal(insertAlsoOn(withPh, ''), '<body><p>tip</p><div>TIP</div></body>', 'empty block removes placeholder');
  const footer = '<body><p>x</p><div style="background:#efe8da;padding:36px 28px;text-align:center;">Oporto Weekly</div></body>';
  const out = insertAlsoOn(footer, block);
  assert.ok(out.indexOf('Also on') < out.indexOf('background:#efe8da'));
  assert.equal(insertAlsoOn('<body>no footer</body>', block), '<body>no footer</body>', 'no safe spot → unchanged');
  assert.equal(renderAlsoOn([]), '');
});
// ------------------------------------------------------------- from the blog
test('from the blog: one guide per week, rotating, same for EN and PT', () => {
  const posts = listBlogPosts();
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2026, 9, 29 + 7 * i)).toISOString().slice(0, 10));
  const picks = weeks.map((w) => newsletterGuide(posts, w)!.slug);
  assert.equal(new Set(picks).size, picks.length, 'no repeat within 8 weeks');
  assert.equal(newsletterGuide(posts, '2026-10-29')!.slug, newsletterGuide(posts, '2026-10-29T05:30:00Z')!.slug, 'deterministic per week');
  assert.ok(picks.every((s) => posts.some((p) => p.slug === s)), 'only real slugs');
  assert.equal(newsletterGuide([], '2026-10-29'), undefined);
});
test('from the blog: one line, before the footer, PT swap', () => {
  const post: BlogPost = { slug: 'food-guide', title: 'Food \u2014 Porto', excerpt: '', author: '', publishedAt: '2026-10-01', heroImage: '', images: [], tags: [], titlePt: 'Comer no Porto' };
  const en = renderFromTheBlog(post, 'en');
  assert.match(en, /From the blog:<\/span> <a href="https:\/\/oportoweekly\.com\/blog\/food-guide"[^>]*>Food: Porto<\/a>/);
  assert.equal(en.includes('\u2014'), false, 'humanizer: no em dash');
  const footer = '<body><p>TIP</p><div style="background:#efe8da;padding:36px 28px;text-align:center;">Oporto Weekly</div></body>';
  const out = insertFromTheBlog(footer, en);
  assert.ok(out.indexOf('TIP') < out.indexOf('From the blog') && out.indexOf('From the blog') < out.indexOf('background:#efe8da'));
  assert.equal(insertFromTheBlog(out, en), out, 're-run does not double it');
  assert.equal(insertFromTheBlog('<body>no footer</body>', en), '<body>no footer</body>');
  const translated = out.replace('From the blog', 'Do blogue').replace('Food: Porto', 'Comida: Porto');
  const pt = localizeFromTheBlog(translated, [post]);
  assert.match(pt, /Do blog:<\/span> <a href="https:\/\/oportoweekly\.com\/pt\/blog\/food-guide"[^>]*>Comer no Porto<\/a>/);
  const noPt = localizeFromTheBlog(translated, [{ ...post, titlePt: undefined }]);
  assert.match(noPt, /href="https:\/\/oportoweekly\.com\/blog\/food-guide"[^>]*>Food: Porto</, 'no PT version: EN title + EN link');
  assert.equal(localizeFromTheBlog('<body>x</body>', [post]), '<body>x</body>');
});
test('event files: extracted win, top-up finds added once', () => {
  const extracted = [ev({ name: 'X', date: '2026-10-30', slug: 'x', sourceEdition: 'october-29-november-4-2026' })];
  const topup = [ev({ name: 'X', date: '2026-10-30', slug: 'x' }), ev({ name: 'Y', date: '2026-10-31', slug: 'y' })];
  const files = mergeEventFiles(extracted, topup);
  assert.deepEqual(files.map((e) => `${e.slug}:${e.sourceEdition}`), ['x:october-29-november-4-2026', 'y:forward-scan']);
});

// ------------------------------------------------------------- event store
test('gitBlobSha matches git hash-object', () => {
  const dir = path.join(process.cwd(), 'data', 'events');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.json'))!;
  const want = execFileSync('git', ['hash-object', path.join(dir, file)]).toString().trim();
  assert.equal(gitBlobSha(fs.readFileSync(path.join(dir, file))), want);
});

console.log(`test-compose: ${passed} passed`);
