/**
 * Backfill `longDescription` on events that don't have one.
 *
 * The event-descriptions cron does this automatically every Thursday for new
 * editions. This script is the manual / recovery path — e.g. after improving
 * the generateLongDescription prompt and wanting to re-do every event.
 *
 * Usage:
 *   npm run enrich-event-descriptions                    # all events missing one
 *   npm run enrich-event-descriptions -- --slug=XYZ      # one specific event
 *   npm run enrich-event-descriptions -- --force         # regenerate even if present
 *   npm run enrich-event-descriptions -- --dry-run       # log only
 *
 * Idempotent — skips events that already have longDescription unless --force.
 */

import fs from 'fs';
import path from 'path';
import type { EventRecord } from '../lib/events';
import { generateLongDescription } from '../lib/events-pipeline';

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const slugFilter = args.find((a) => a.startsWith('--slug='))?.split('=')[1];

  const dir = path.join(process.cwd(), 'data', 'events');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let events: EventRecord[] = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as EventRecord
  );
  if (slugFilter) events = events.filter((e) => e.slug === slugFilter);
  if (!force) events = events.filter((e) => !e.longDescription);

  console.log(
    `Processing ${events.length} event${events.length === 1 ? '' : 's'}` +
    `${dryRun ? ' [dry-run]' : ''}${force ? ' [force]' : ''}`
  );

  const counts = { ok: 0, error: 0 };
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    console.log(`\n[${i + 1}/${events.length}] ${ev.name} @ ${ev.venue}`);
    try {
      const longDescription = await generateLongDescription(ev);
      counts.ok++;
      if (dryRun) {
        console.log(`    [dry-run] ${longDescription.length} chars, ${longDescription.split(/\n{2,}/).length} paragraphs`);
        console.log(`    preview: ${longDescription.slice(0, 140).replace(/\n/g, ' ')}…`);
      } else {
        const updated: EventRecord = { ...ev, longDescription };
        fs.writeFileSync(path.join(dir, `${ev.slug}.json`), JSON.stringify(updated, null, 2));
        console.log(`    → written (${longDescription.length} chars)`);
      }
    } catch (err) {
      counts.error++;
      console.error(`    ❌`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  ok:    ${counts.ok}`);
  console.log(`  error: ${counts.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
