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
import { runForwardScan } from '../lib/forward-scan';

async function main() {
  const existing = listEvents();
  console.log(`${existing.length} existing events`);
  const r = await runForwardScan(existing, new Date(), Date.now() + 280_000, { enrich: false });
  console.log(JSON.stringify({ ...r, accepted: r.accepted.map((e) => ({ ...e, longDescription: e.longDescription?.slice(0, 160) + '…' })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
