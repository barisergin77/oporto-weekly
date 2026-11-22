/** npm run test:edition-picks — lib/edition-picks.ts pure parts (G3). */
import assert from 'node:assert/strict';
import { newestEditionPicks, shortDay } from '../lib/edition-picks';
import type { EventRecord } from '../lib/events';

const ev = (slug: string, date: string, sourceEdition?: string, editorPickRank?: number) =>
  ({ slug, name: slug, date, venue: 'v', venueSlug: 'v', category: 'music', description: '', sourceEdition, editorPickRank }) as unknown as EventRecord;

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${name}`); };

t('shortDay EN/PT', () => {
  assert.equal(shortDay('2026-11-19T21:15', 'en'), 'Thu 19 Nov');
  assert.equal(shortDay('2026-11-21', 'pt'), 'sáb 21 nov');
});

t('newest edition wins, sorted by rank, non-picks ignored', () => {
  const r = newestEditionPicks([
    ev('old1', '2026-11-12', 'nov-12', 1),
    ev('b', '2026-11-21', 'nov-19', 2),
    ev('a', '2026-11-19', 'nov-19', 1),
    ev('c', '2026-11-23', 'nov-19', 3),
    ev('x', '2026-11-25', 'nov-19'),
    ev('y', '2026-11-30'),
  ]);
  assert.equal(r?.editionSlug, 'nov-19');
  assert.deepEqual(r?.events.map((e) => e.slug), ['a', 'b', 'c']);
});

t('duplicate ranks kept once, max 5', () => {
  const r = newestEditionPicks([1, 1, 2, 3, 4, 5, 6].map((k, i) => ev(`e${i}`, `2026-11-2${i}`, 'w', k)));
  assert.deepEqual(r?.events.map((e) => e.editorPickRank), [1, 2, 3, 4, 5]);
});

t('no picks → null', () => {
  assert.equal(newestEditionPicks([ev('y', '2026-11-30')]), null);
});

console.log(`${n} passed`);
