/**
 * Local test of the forward event scan (lib/forward-scan.ts): discovery,
 * dedupe and page verification against the local data/events. Skips PT
 * translation + image (no Imgur uploads, no image generation) and writes
 * nothing. Production runs go through /api/cron/forward-scan (?dryRun=1 is
 * the same test on Vercel). Needs GEMINI_API_KEY in .env.local.
 *
 *   npx tsx --env-file=.env.local scripts/forward-scan.ts
 */

import { listEvents } from '../lib/events';
import fs from 'node:fs';
import { runForwardScan } from '../lib/forward-scan';
import { LEADS_PATH, parseLeadsFile } from '../lib/forward-leads';

async function main() {
  const existing = listEvents();
  console.log(`${existing.length} existing events`);
  // Local leads file, read-only here: outcomes are printed, never written back.
  const leads = parseLeadsFile(fs.existsSync(LEADS_PATH) ? fs.readFileSync(LEADS_PATH, 'utf-8') : null)?.leads;
  console.log(`${leads?.length ?? 0} leads`);
  const r = await runForwardScan(existing, new Date(), Date.now() + 280_000, { enrich: false, leads });
  console.log(JSON.stringify({ ...r, accepted: r.accepted.map((e) => ({ ...e, longDescription: e.longDescription?.slice(0, 160) + '…' })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
