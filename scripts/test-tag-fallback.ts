// Dry run of the carousel userTags safety net with a fake scheduler: nothing reaches Buffer.
import { scheduleWithTagFallback, type InstagramExtras } from '../lib/buffer';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('FAIL', m); } };
const urls = ['https://i.imgur.com/a.jpg', 'https://i.imgur.com/b.jpg'];
const cap = '🎶 Moonspell · Hard Club @hardclubporto · Sat 31 Oct';
const tags: InstagramExtras = { userTags: [[], [{ handle: 'hardclubporto', x: 0.5, y: 0.3 }]], altTexts: ['a', 'b'] };
const fake = (errOnTags: string | null) => {
  const calls: { caption: string; extras?: InstagramExtras }[] = [];
  const fn = async (_u: string | string[], caption: string, _d?: string, extras?: InstagramExtras) => {
    calls.push({ caption, extras });
    if (errOnTags && extras?.userTags?.some((t) => t.length)) throw new Error(errOnTags);
    return { id: 'fake' + calls.length, status: 'scheduled', dueAt: 'x' };
  };
  return { calls, fn };
};

(async () => {
  let f = fake(null);
  let r = await scheduleWithTagFallback(urls, cap, 'x', tags, f.fn);
  ok(!r.tagsDropped && f.calls.length === 1, 'success path: one call, tags kept');

  f = fake('Buffer scheduling failed: Invalid user tag handle');
  r = await scheduleWithTagFallback(urls, cap, 'x', tags, f.fn);
  ok(r.tagsDropped && !r.mentionsDropped && f.calls.length === 2, 'tag error: retried once');
  ok(!f.calls[1].extras?.userTags && f.calls[1].caption === cap, 'tag error: no tags, caption kept');

  f = fake('Buffer scheduling failed: cannot mention @hardclubporto');
  r = await scheduleWithTagFallback(urls, cap, 'x', tags, f.fn);
  ok(r.mentionsDropped && !f.calls[1].caption.includes('@'), 'mention error: @handles stripped');
  ok(f.calls[1].caption === '🎶 Moonspell · Hard Club · Sat 31 Oct', 'mention error: caption intact otherwise');

  f = fake(null);
  const always = async () => { throw new Error('boom'); };
  let threw = false;
  try { await scheduleWithTagFallback(urls, cap, 'x', {}, always); } catch { threw = true; }
  ok(threw, 'no tags: error propagates, no retry');

  let n = 0;
  const twice = async () => { n++; throw new Error('Invalid user tag'); };
  threw = false;
  try { await scheduleWithTagFallback(urls, cap, 'x', tags, twice); } catch { threw = true; }
  ok(threw && n === 2, 'retry fails too: exactly one retry, then error');

  console.log(fails ? `test-tag-fallback: ${fails} failed` : 'test-tag-fallback: 7 passed');
  process.exit(fails ? 1 : 0);
})();
