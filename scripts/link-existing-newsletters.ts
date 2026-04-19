/**
 * One-off: retrofit event-page links into already-archived newsletter HTML files.
 *
 * For every edition whose events have been extracted to data/events/, finds
 * the event names inside the edition's public/newsletters/<slug>.html, wraps
 * them in <a href="/event/<event-slug>"> anchors, and writes the file back.
 *
 * Future Thursday sends do this in the cron; this script just backfills.
 *
 * Idempotent — injectEventLinks() skips headings that already contain an <a>.
 *
 * Usage:
 *   npm run link-existing-newsletters                # all editions
 *   npm run link-existing-newsletters -- --dry-run   # show what would change
 *   npm run link-existing-newsletters -- <slug>      # one edition only
 */

import fs from 'fs';
import path from 'path';
import { listEvents, type EventRecord } from '../lib/events';
import { injectEventLinks } from '../lib/events-pipeline';

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const editionFilter = args.find((a) => !a.startsWith('--'));

  const newslettersDir = path.join(process.cwd(), 'public', 'newsletters');
  const allEvents = listEvents();

  // Group events by their source edition
  const byEdition = new Map<string, EventRecord[]>();
  for (const ev of allEvents) {
    const list = byEdition.get(ev.sourceEdition) ?? [];
    list.push(ev);
    byEdition.set(ev.sourceEdition, list);
  }

  let editions = Array.from(byEdition.keys()).sort();
  if (editionFilter) editions = editions.filter((e) => e === editionFilter);
  if (editions.length === 0) {
    console.error('No editions to process.');
    console.error('Available:', Array.from(byEdition.keys()).join(', ') || '(none)');
    process.exit(1);
  }

  console.log(`Processing ${editions.length} edition${editions.length === 1 ? '' : 's'}${dryRun ? ' [dry-run]' : ''}`);

  let totalLinked = 0;
  let totalRewritten = 0;
  let totalChanged = 0;
  for (const edition of editions) {
    const events = byEdition.get(edition) ?? [];
    const htmlPath = path.join(newslettersDir, `${edition}.html`);
    if (!fs.existsSync(htmlPath)) {
      console.log(`  [skip] ${edition}: HTML file not found`);
      continue;
    }
    const before = fs.readFileSync(htmlPath, 'utf-8');
    const { html: after, linked, moreInfoRewritten } = injectEventLinks(before, events);

    const changed = after !== before;
    console.log(
      `  ${changed ? '✓' : '·'} ${edition}: ${events.length} events · ${linked} title link${linked === 1 ? '' : 's'} · ${moreInfoRewritten} MORE INFO rewrite${moreInfoRewritten === 1 ? '' : 's'}` +
      (changed ? '' : ' (no changes)')
    );
    if (changed) {
      totalLinked += linked;
      totalRewritten += moreInfoRewritten;
      totalChanged++;
      if (!dryRun) fs.writeFileSync(htmlPath, after, 'utf-8');
    }
  }

  console.log(
    `\n${dryRun ? 'Would update' : 'Updated'} ${totalChanged} edition${totalChanged === 1 ? '' : 's'}: ` +
    `${totalLinked} title link${totalLinked === 1 ? '' : 's'}, ${totalRewritten} MORE INFO rewrite${totalRewritten === 1 ? '' : 's'}.`
  );
}

main();
