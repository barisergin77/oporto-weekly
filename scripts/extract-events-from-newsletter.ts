/**
 * One-off: turn a weekly newsletter's HTML into structured event records.
 *
 * Used to bootstrap event pages from already-shipped editions. The Thursday
 * cron writes events natively now, so this is only needed for historical
 * editions or recovery.
 *
 * Usage:
 *   npm run extract-events -- april-16-2026
 *   npm run extract-events -- april-16-2026 --dry-run
 */

import fs from 'fs';
import path from 'path';
import { extractEventsFromHtml } from '../lib/events-pipeline';

async function main() {
  const args = process.argv.slice(2);
  const editionSlug = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!editionSlug) {
    console.error('Usage: npm run extract-events -- <edition-slug> [--dry-run]');
    process.exit(1);
  }

  const htmlPath = path.join(process.cwd(), 'public', 'newsletters', `${editionSlug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.error(`Newsletter not found: ${htmlPath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`📥 Reading ${editionSlug}.html (${html.length} bytes)`);

  const events = await extractEventsFromHtml(html, editionSlug);
  console.log(`🤖 Gemini extracted ${events.length} events`);

  const eventsDir = path.join(process.cwd(), 'data', 'events');
  if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });

  console.log(`💾 ${dryRun ? 'Would write' : 'Writing'} ${events.length} events...`);
  for (const ev of events) {
    const file = path.join(eventsDir, `${ev.slug}.json`);
    if (!dryRun) fs.writeFileSync(file, JSON.stringify(ev, null, 2), 'utf-8');
    const d = ev.endDate ? `${ev.date}→${ev.endDate}` : ev.date;
    console.log(`  [${ev.category.padEnd(9)}] ${d} · ${ev.name} @ ${ev.venue}`);
  }
  console.log(`\n✅ ${dryRun ? 'Would write' : 'Wrote'} ${events.length} records`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
