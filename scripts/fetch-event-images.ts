/**
 * Fetches a press photo for each event that doesn't have one yet.
 *
 * The Thursday cron does this automatically via /api/cron/event-images
 * (runs right after newsletter send). This script is the manual / recovery
 * path for historical events or selective re-fetches.
 *
 * Usage:
 *   npm run fetch-event-images                    # all events missing images
 *   npm run fetch-event-images -- --slug=XYZ      # one specific event
 *   npm run fetch-event-images -- --force         # refetch even if imaged
 *   npm run fetch-event-images -- --dry-run       # log only
 */

import fs from 'fs';
import path from 'path';
import { isRealEventUrl, type EventRecord } from '../lib/events';
import { acquireEventImage } from '../lib/events-pipeline';

async function main() {
  if (!process.env.IMGUR_CLIENT_ID) throw new Error('IMGUR_CLIENT_ID not set');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const slugFilter = args.find((a) => a.startsWith('--slug='))?.split('=')[1];

  const dir = path.join(process.cwd(), 'data', 'events');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let events: EventRecord[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as EventRecord
  );
  if (slugFilter) events = events.filter((e) => e.slug === slugFilter);

  console.log(
    `Processing ${events.length} event${events.length === 1 ? '' : 's'}` +
    `${dryRun ? ' [dry-run]' : ''}${force ? ' [force]' : ''}`
  );

  const counts: Record<string, number> = {};
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    console.log(`\n[${i + 1}/${events.length}] ${ev.name} @ ${ev.venue}`);
    try {
      const result = await acquireEventImage(ev, { force });
      counts[result.status] = (counts[result.status] ?? 0) + 1;

      if (result.status === 'imaged') {
        if (dryRun) {
          console.log(`    [dry-run] source=${result.resolvedUrl}`);
        } else {
          // Persist: image + also overwrite the stale externalLink if we
          // discovered a real one via Gemini.
          const updated: EventRecord = {
            ...ev,
            image: result.image,
            externalLink: isRealEventUrl(ev.externalLink) ? ev.externalLink : result.resolvedUrl,
          };
          fs.writeFileSync(path.join(dir, `${ev.slug}.json`), JSON.stringify(updated, null, 2));
          console.log(`    → ${result.image.url} (${result.image.credit})`);
        }
      } else if (result.status === 'already') {
        console.log(`    (already imaged — use --force to refetch)`);
      } else {
        console.log(`    ⚠ ${result.status}`);
      }
    } catch (err) {
      counts.error = (counts.error ?? 0) + 1;
      console.error(`    ❌`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n--- Summary ---');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
