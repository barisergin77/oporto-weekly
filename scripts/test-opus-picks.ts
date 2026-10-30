/**
 * Assertions for Editor's Picks by Claude Opus 5.5 (lib/opus-picks.ts, #34).
 * Plain node:assert under tsx, like test-compose.ts. No network: the
 * Anthropic client is a fake.
 *
 *   npm run test:picks
 */

import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import {
  choosePicks, validatePicks, refreshPicks, presetPicks, buildPickPrompt, pickLogLine,
  OPUS_PICK_MODEL, type PickClient,
} from '../lib/opus-picks';
import { selectEditionEvents, composeRules } from '../lib/edition-compose';
import { FORWARD_SOURCE, type EventRecord } from '../lib/events';

let passed = 0;
const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const ev = (p: Partial<EventRecord> & { name: string; date: string }): EventRecord => ({
  slug: p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  venue: 'Hard Club', category: 'music', description: 'A concert.', sourceEdition: FORWARD_SOURCE,
  addedAt: '2026-10-01T00:00:00Z', ...p,
});

const corpus: EventRecord[] = [
  ev({ name: 'Band A', date: '2026-11-05T21:00', pickCandidate: true, externalLink: 'https://hardclubporto.com/a' }),
  ev({ name: 'Band B', date: '2026-11-06', venue: 'Coliseu Porto' }),
  ev({ name: 'Magusto Party', date: '2026-11-11', category: 'food', venue: 'Mercado do Bolhão', price: 'Free' }),
  ev({ name: 'Kids Workshop', date: '2026-11-08', category: 'family', venue: 'Serralves' }),
  ev({ name: 'Orchestra Night', date: '2026-11-07', venue: 'Casa da Música' }),
  ev({ name: 'Old Pick Show', date: '2026-11-09', venue: 'Rivoli' }),
  ev({ name: 'FC Porto x Benfica', date: '2026-11-08', category: 'sports', venue: 'Estádio do Dragão', slug: 'fcp-benfica', gomryId: 'fcp-benfica' }),
  ev({ name: 'Expo Closing', date: '2026-09-01', endDate: '2026-11-08', category: 'art', venue: 'Galeria Municipal do Porto' }),
  ev({ name: 'Long Expo', date: '2026-06-01', endDate: '2027-01-10', category: 'art', venue: 'Serralves' }),
  ev({ name: 'Old Long Pick', date: '2026-06-01', endDate: '2027-01-10', category: 'art', venue: 'MAR Galeria' }),
];
const recentPicks = ['Old Pick Show', 'Old Long Pick'];
const sel = selectEditionEvents(corpus, '2026-11-05', '2026-11-11', { recentPicks });
const names = (l: Array<{ event: EventRecord }>) => l.map((p) => p.event.name);

/** A fake client that returns `text` (or throws / hangs) and records calls. */
function fake(reply: string | Error | 'hang', stop: Anthropic.Message['stop_reason'] = 'end_turn') {
  const calls: Array<{ body: Anthropic.MessageCreateParamsNonStreaming; options?: { signal?: AbortSignal } }> = [];
  const client: PickClient = {
    messages: {
      async create(body, options) {
        calls.push({ body, options });
        if (reply instanceof Error) throw reply;
        if (reply === 'hang') {
          return new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('Request was aborted.'))));
        }
        return { stop_reason: stop, content: [{ type: 'text', text: reply, citations: null }] as Anthropic.Message['content'] };
      },
    },
  };
  return { client, calls };
}
const answer = (slugs: string[], occasion = 'Magusto (11 Nov)') =>
  JSON.stringify({ occasion, picks: slugs.map((slug) => ({ slug, name: slug, why: `why ${slug}` })) });

// ------------------------------------------------------------- pool
test('pool: Gomry match and recent picks are never candidates', () => {
  const prompt = buildPickPrompt(sel, recentPicks);
  assert.ok(!prompt.includes('fcp-benfica'), 'Gomry match excluded');
  assert.ok(!prompt.includes('"old-pick-show"'), 'recent short pick excluded');
  assert.ok(!prompt.includes('"old-long-pick"'), 'recent long run excluded');
  assert.match(prompt, /"slug": "expo-closing"[\s\S]*"kind": "long"/);
  assert.match(prompt, /2026-11-05 to 2026-11-11/);
});

// ------------------------------------------------------------- validation
test('validation: exact slugs only; unknown, near-miss and duplicate slugs rejected; gaps filled by score', () => {
  const v = validatePicks({ occasion: 'x', picks: [
    { slug: 'magusto-party', why: 'Magusto' },
    { slug: 'Band B', why: 'name, not slug' },
    { slug: 'band-b-2026', why: 'near miss' },
    { slug: 'magusto-party', why: 'dup' },
    { slug: 'fcp-benfica', why: 'Gomry' },
    { slug: 'old-pick-show', why: 'recent' },
    { slug: 'orchestra-night', why: 'orchestra' },
  ] }, sel, recentPicks);
  assert.deepEqual(names(v.picks).slice(0, 2), ['Magusto Party', 'Orchestra Night']);
  assert.deepEqual(v.rejected, ['Band B', 'band-b-2026', 'magusto-party', 'fcp-benfica', 'old-pick-show']);
  assert.equal(v.picks.length, 5);
  assert.deepEqual(v.picks.slice(2).map((p) => p.source), ['score', 'score', 'score']);
  assert.equal(v.picks[2].event.name, 'Band A', 'fill follows the old score order (strong candidate first)');
  assert.equal(new Set(v.picks.map((p) => p.event.slug)).size, 5, 'no duplicates after fill');
  assert.equal(v.picks[0].why, 'Magusto');
});
test('validation: at most one long run; more than five returned → first five', () => {
  const v = validatePicks({ picks: ['expo-closing', 'long-expo', 'band-a', 'band-b', 'magusto-party', 'kids-workshop', 'orchestra-night'].map((slug) => ({ slug })) }, sel, recentPicks);
  assert.deepEqual(names(v.picks), ['Expo Closing', 'Band A', 'Band B', 'Magusto Party', 'Kids Workshop']);
  assert.deepEqual(v.rejected, ['long-expo']);
  assert.equal(v.occasion, 'none');
});
test('validation: garbage in → no picks (caller falls back)', () => {
  assert.equal(validatePicks({}, sel).picks.length, 0);
  assert.equal(validatePicks({ picks: 'nope' }, sel).picks.length, 0);
  assert.equal(validatePicks({ picks: [{ slug: 'nope' }, null, 3] }, sel).picks.length, 0);
});
test('Fever cap holds: a third Fever event never reaches the pool', () => {
  const fever = [1, 2, 3].map((i) => ev({ name: `Candlelight ${i}`, date: `2026-11-0${5 + i}`, venue: `Palácio ${i}`, feverId: String(900 + i) }));
  const s = selectEditionEvents([...corpus, ...fever], '2026-11-05', '2026-11-11', { recentPicks });
  const prompt = buildPickPrompt(s, recentPicks);
  const inPool = fever.filter((f) => prompt.includes(`"${f.slug}"`)).length;
  assert.ok(inPool <= 2, `at most MAX_FEVER_PER_EDITION Fever events offered (got ${inPool})`);
  const v = validatePicks({ picks: fever.map((f) => ({ slug: f.slug })) }, s, recentPicks);
  assert.ok(v.picks.filter((p) => p.source === 'opus').length <= 2);
});

// ------------------------------------------------------------- the call
test('opus path: request shape, picks in order, log line', async () => {
  const { client, calls } = fake(answer(['magusto-party', 'orchestra-night', 'band-b', 'kids-workshop', 'expo-closing']));
  const r = await choosePicks(sel, { client, recentPicks });
  assert.equal(r.path, 'opus');
  assert.deepEqual(names(r.picks), ['Magusto Party', 'Orchestra Night', 'Band B', 'Kids Workshop', 'Expo Closing']);
  assert.equal(r.occasion, 'Magusto (11 Nov)');
  const body = calls[0].body as Anthropic.MessageCreateParamsNonStreaming & { temperature?: number };
  assert.equal(body.model, OPUS_PICK_MODEL);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.output_config?.effort, 'medium');
  assert.equal(body.output_config?.format?.type, 'json_schema');
  assert.equal(body.temperature, undefined, 'no sampling params');
  assert.equal(body.thinking, undefined, 'thinking left to the model (always on for Opus 5.5)');
  assert.ok(calls[0].options?.signal, 'request carries a deadline');
  assert.match(pickLogLine(r), /picks path=opus .*1\. Magusto Party/);
  const preset = presetPicks(r)!;
  assert.equal(preset.length, 5);
  assert.equal(preset[0].why, 'why magusto-party');
  const rules = composeRules('5–11 November 2026', preset);
  assert.match(rules, /ALREADY CHOSEN[\s\S]*1\. Magusto Party — Mercado do Bolhão — Wed 11 Nov 2026 — editor's note: why magusto-party/);
  assert.ok(!rules.includes('choose five from the SHORT EVENTS'));
});
test('opus path with gaps: 2 valid picks → 3 filled from score order', async () => {
  const { client } = fake(answer(['magusto-party', 'made-up-event', 'kids-workshop']));
  const r = await choosePicks(sel, { client, recentPicks });
  assert.equal(r.path, 'opus');
  assert.equal(r.picks.length, 5);
  assert.deepEqual(r.picks.map((p) => p.source), ['opus', 'opus', 'score', 'score', 'score']);
  assert.match(r.reason, /3 filled from score order/);
  assert.match(r.reason, /rejected made-up-event/);
});

// ------------------------------------------------------------- fallback
const expectFallback = async (client: PickClient | undefined, why: RegExp, extra: { timeoutMs?: number; apiKey?: string } = {}) => {
  const r = await choosePicks(sel, { client, recentPicks, ...extra });
  assert.equal(r.path, 'gemini-fallback');
  assert.equal(r.picks.length, 0);
  assert.match(r.reason, why);
  assert.equal(presetPicks(r), undefined, 'Gemini picks');
  assert.match(pickLogLine(r), /picks path=gemini-fallback/);
  assert.match(composeRules('5–11 November 2026', presetPicks(r)), /choose five from the SHORT EVENTS/);
};
test('fallback: no ANTHROPIC_API_KEY → no call, Gemini picks', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try { await expectFallback(undefined, /ANTHROPIC_API_KEY not set/); } finally { if (saved) process.env.ANTHROPIC_API_KEY = saved; }
});
test('fallback: API error', async () => {
  await expectFallback(fake(new Error('529 overloaded')).client, /529 overloaded/);
});
test('fallback: timeout', async () => {
  const t0 = Date.now();
  await expectFallback(fake('hang').client, /aborted|timeout/i, { timeoutMs: 200 });
  assert.ok(Date.now() - t0 < 2000, 'gives up at the deadline');
});
test('fallback: refusal, max_tokens, non-JSON, no valid slugs', async () => {
  await expectFallback(fake(answer(['band-a']), 'refusal').client, /refused/);
  await expectFallback(fake('', 'max_tokens').client, /max_tokens/);
  await expectFallback(fake('Here are my picks: …').client, /not JSON/);
  await expectFallback(fake(answer(['nope-1', 'nope-2'])).client, /no valid picks/);
});
test('fallback: thin pool → no call', async () => {
  const thin = selectEditionEvents(corpus.slice(0, 3), '2026-11-05', '2026-11-11');
  const { client, calls } = fake(answer(['band-a']));
  const r = await choosePicks(thin, { client });
  assert.equal(r.path, 'gemini-fallback');
  assert.equal(calls.length, 0);
});

// ------------------------------------------------------------- re-check
test('refresh after the pick-date check: wrong-week pick dropped and refilled, no new call', async () => {
  const { client, calls } = fake(answer(['magusto-party', 'orchestra-night', 'band-b', 'kids-workshop', 'expo-closing']));
  const r = await choosePicks(sel, { client, recentPicks });
  const sel2 = selectEditionEvents(corpus, '2026-11-05', '2026-11-11', { recentPicks, blocked: ['Orchestra Night'] });
  const r2 = refreshPicks(r, sel2, recentPicks);
  assert.equal(calls.length, 1);
  assert.equal(r2.path, 'opus');
  assert.ok(!names(r2.picks).includes('Orchestra Night'));
  assert.deepEqual(names(r2.picks).slice(0, 4), ['Magusto Party', 'Band B', 'Kids Workshop', 'Expo Closing']);
  assert.equal(r2.picks[4].source, 'score');
  const fb = refreshPicks({ path: 'gemini-fallback', picks: [], occasion: 'none', reason: 'x', rejected: [] }, sel2);
  assert.equal(fb.path, 'gemini-fallback');
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
  }
  console.log(`test-opus-picks: ${passed} passed`);
})().catch((err) => { console.error(err); process.exit(1); });
