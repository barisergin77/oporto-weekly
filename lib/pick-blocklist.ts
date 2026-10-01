/**
 * Persistent memory of events the date fact-check proved are NOT in the
 * current week.
 *
 * 2026-10-01: verifyPickDates caught "Fantasporto Film Festival Opening"
 * (really 2026-02-27 → 03-08) as a pick for Oct 1-7, but only at 210s — past
 * the regeneration budget — so the run aborted with nothing archived. The
 * retry then repeated the same slow path on the same research data and could
 * pick the same event again: a loop that never ships an edition.
 *
 * Writing the verdict down breaks that loop. The next run feeds it to
 * generation as an upfront exclusion, so the bad pick never appears and no
 * regeneration is needed. Stored in the repo (committed like the run-ledger)
 * and read through the GitHub API, never from the deployed filesystem.
 */

import { getFileContent, commitFiles } from './github';

const PATH = 'data/pick-date-blocklist.json';
const RETAIN_DAYS = 120;

export interface BlockedPick {
  name: string;
  actualDate: string;
  actualEndDate?: string;
  source?: string;
  detectedAt: string;
}

/** Never throws: a blocklist failure must not stop an edition. */
export async function readPickBlocklist(): Promise<BlockedPick[]> {
  try {
    const raw = await getFileContent(PATH);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BlockedPick[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETAIN_DAYS * 86400000;
    return parsed.filter((e) => e?.name && new Date(e.detectedAt).getTime() > cutoff);
  } catch (err) {
    console.error('[pick-blocklist] read failed (continuing without):', err);
    return [];
  }
}

/** Merge new entries in by name (newest wins). Never throws. */
export async function addToPickBlocklist(entries: BlockedPick[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const current = await readPickBlocklist();
    const byName = new Map(current.map((e) => [e.name.toLowerCase(), e]));
    for (const e of entries) byName.set(e.name.toLowerCase(), e);
    const merged = Array.from(byName.values()).sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
    await commitFiles(
      [{ path: PATH, content: JSON.stringify(merged, null, 2) + '\n' }],
      `chore(picks): block ${entries.map((e) => e.name).join(', ')} — wrong week`
    );
    console.log(`[pick-blocklist] recorded ${entries.length}, total ${merged.length}`);
  } catch (err) {
    console.error('[pick-blocklist] write failed (non-fatal):', err);
  }
}

/** Prompt lines for generateNewsletter's corrections block. */
export function blocklistCorrections(entries: BlockedPick[]): string[] {
  return entries.map(
    (e) =>
      `"${e.name}" — actually ${e.actualDate}${e.actualEndDate ? ` to ${e.actualEndDate}` : ''}` +
      `, verified ${e.detectedAt.slice(0, 10)}. Not this week.`
  );
}
