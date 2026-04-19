/**
 * HEAD-checks every event's `externalLink`, clears broken ones, and tries
 * to find a replacement via Gemini Search.
 *
 * Why: Gemini's extraction step occasionally emits URLs it "thinks" should
 * exist — e.g. casadamusica.com/en/agenda/tito-paris-2026/ looks plausible
 * but 404s. Those URLs end up as the "Get tickets" CTA on the detail page
 * and send visitors to a dead end.
 *
 * For each event with an externalLink:
 *   1. HEAD the URL (follows redirects, 15s timeout).
 *   2. If 2xx → keep it.
 *   3. If 4xx/5xx/timeout → try Gemini Search for a better URL. Verify THAT
 *      returns 2xx too. If yes, replace. If no, clear the field.
 *
 * Idempotent — re-running is safe. Status: 2xx links are untouched.
 *
 * Usage:
 *   npm run validate-event-links                 # all events with a link
 *   npm run validate-event-links -- --slug=XYZ   # one specific event
 *   npm run validate-event-links -- --dry-run    # log only, no writes
 */

import fs from 'fs';
import path from 'path';
import { isRealEventUrl, type EventRecord } from '../lib/events';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function headCheck(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    // Some sites (Cloudflare, Akamai) reject HEAD but allow GET; try HEAD
    // first, fall back to GET on 405/403 so we don't spuriously flag them.
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
    }
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function findReplacementUrl(ev: EventRecord): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const query = `Find the official event page for "${ev.name}" at ${ev.venue} in Porto on ${ev.date}. Return ONLY the single best URL — a ticketing page, venue event page, or official press release — and nothing else. No explanation, no markdown, just the raw URL. If you can't find an authoritative page, return the word NONE.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('\n') ?? ''
    ).trim();
    if (!text || text.toUpperCase().includes('NONE')) return null;

    const match = text.match(/https?:\/\/[^\s<>"'\]]+/);
    if (!match) return null;
    const candidate = match[0].replace(/[.,;)]+$/, '');
    return isRealEventUrl(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const slugFilter = args.find((a) => a.startsWith('--slug='))?.split('=')[1];

  const dir = path.join(process.cwd(), 'data', 'events');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  let events: EventRecord[] = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as EventRecord
  );
  if (slugFilter) events = events.filter((e) => e.slug === slugFilter);
  events = events.filter((e) => e.externalLink); // nothing to validate otherwise

  console.log(`Validating ${events.length} externalLink${events.length === 1 ? '' : 's'}${dryRun ? ' [dry-run]' : ''}`);

  const counts = { ok: 0, replaced: 0, cleared: 0, error: 0 };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const current = ev.externalLink!;
    console.log(`\n[${i + 1}/${events.length}] ${ev.name}`);
    console.log(`    current: ${current}`);

    try {
      const check = await headCheck(current);
      if (check.ok) {
        console.log(`    → ok (HTTP ${check.status})`);
        counts.ok++;
        continue;
      }

      console.log(`    ✗ broken (HTTP ${check.status || 'timeout'}), searching for replacement…`);
      const replacement = await findReplacementUrl(ev);
      if (replacement) {
        const replacementCheck = await headCheck(replacement);
        if (replacementCheck.ok) {
          console.log(`    → replaced: ${replacement}`);
          if (!dryRun) {
            const updated: EventRecord = { ...ev, externalLink: replacement };
            fs.writeFileSync(path.join(dir, `${ev.slug}.json`), JSON.stringify(updated, null, 2));
          }
          counts.replaced++;
          continue;
        }
        console.log(`    · replacement also broken (HTTP ${replacementCheck.status})`);
      } else {
        console.log(`    · no replacement found`);
      }

      // Gave up — clear the field so the CTA stops showing
      console.log(`    → cleared`);
      if (!dryRun) {
        const updated: EventRecord = { ...ev };
        delete updated.externalLink;
        fs.writeFileSync(path.join(dir, `${ev.slug}.json`), JSON.stringify(updated, null, 2));
      }
      counts.cleared++;
    } catch (err) {
      counts.error++;
      console.error(`    ❌ error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n--- Summary ---');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
