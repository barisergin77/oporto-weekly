/**
 * One-off: turn a weekly newsletter's HTML into structured event records.
 *
 * Used to bootstrap the event pages from editions we've already shipped.
 * Going forward the Thursday cron will emit events natively so we won't
 * need this. Kept in-tree as a recovery tool.
 *
 * Usage:
 *   npm run extract-events -- april-16-2026
 *   npm run extract-events -- april-16-2026 --dry-run
 *
 * Writes `data/events/<event-slug>.json` per event. Idempotent — overwrites
 * existing records from the same edition, leaves unrelated records alone.
 */

import fs from 'fs';
import path from 'path';
import {
  type EventRecord,
  type EventCategory,
  composeEventSlug,
  venueToSlug,
} from '../lib/events';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// Gemini extraction
// ---------------------------------------------------------------------------

interface RawEvent {
  name: string;
  date: string;
  endDate?: string;
  venue: string;
  price?: string;
  priceFrom?: number;
  currency?: string;
  category: EventCategory;
  description: string;
  externalLink?: string;
}

async function extractEventsFromHtml(html: string, sourceEdition: string): Promise<RawEvent[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  // Infer the year from the edition slug so Gemini produces proper ISO dates
  // even when the newsletter HTML only has "April 17" without a year.
  const yearMatch = sourceEdition.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const prompt = `Extract all real events from the Oporto Weekly newsletter HTML below into a structured JSON array.

Output ONLY a JSON array with this exact shape (no markdown, no prose, no wrapping object):

[
  {
    "name": "Event Name",
    "date": "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" if time is known,
    "endDate": "YYYY-MM-DD" (optional; only if the event runs multiple days with a clear end date),
    "venue": "Venue Name",
    "price": "€20-€40" or "Free" or "From €15" (display-as-is; omit if unknown),
    "priceFrom": 20 (numeric starting price; omit if unknown or free),
    "currency": "EUR" (only if priceFrom is set),
    "category": "music" | "art" | "food" | "family" | "nightlife" | "sports" | "other",
    "description": "1-2 factual sentences describing the event. No editorial adjectives.",
    "externalLink": "https://..." (if the newsletter links to an official ticket/event page; omit otherwise)
  }
]

RULES:
- Year is ${year}. If a date in the HTML says "April 17" or "Fri 17", output "${year}-04-17".
- SKIP: the editor's note, tip-of-the-week, hero section, footer, any promotional or editorial commentary.
- INCLUDE: everything under Editor's Picks (the numbered top 5) + every event inside the 5 category sections (🎵🎨🍷👨‍👩‍👧🌙).
- If the same event appears in both Editor's Picks and a category section, include it ONCE (prefer the category section's data since it's usually more detailed).
- Categorize based on which section the event appears in, NOT by guessing. Editor's Picks events: use the section topic from the surrounding context.
- Description should be FACTUAL. No "unmissable", "stunning", "vibrant". Just what it is.
- If a field isn't in the HTML, OMIT the field rather than inventing. Never write "TBA" or "check website".
- Do not wrap the array in any object or markdown fence. First character of your output must be "[".

Newsletter HTML:
${html}`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16000,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('Gemini returned empty output');

  // The prompt asks for bare JSON, but be defensive in case it wraps it.
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error(`Could not find JSON array in Gemini output:\n${text.slice(0, 500)}`);
  }
  const slice = text.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(slice) as RawEvent[];
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function toEventRecord(raw: RawEvent, sourceEdition: string): EventRecord {
  const slug = composeEventSlug(raw.name, raw.venue, raw.date);
  return {
    slug,
    name: raw.name,
    date: raw.date,
    endDate: raw.endDate,
    venue: raw.venue,
    venueSlug: venueToSlug(raw.venue),
    price: raw.price,
    priceFrom: raw.priceFrom,
    currency: raw.currency ?? (raw.priceFrom != null ? 'EUR' : undefined),
    category: raw.category,
    description: raw.description,
    sourceEdition,
    externalLink: raw.externalLink,
    addedAt: new Date().toISOString(),
  };
}

function writeEvent(ev: EventRecord, dryRun: boolean): 'written' | 'dry-run' | 'error' {
  const eventsDir = path.join(process.cwd(), 'data', 'events');
  if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
  const file = path.join(eventsDir, `${ev.slug}.json`);

  if (dryRun) {
    console.log(`  [dry-run] would write ${file}`);
    return 'dry-run';
  }
  try {
    fs.writeFileSync(file, JSON.stringify(ev, null, 2), 'utf-8');
    return 'written';
  } catch (err) {
    console.error(`  ❌ ${ev.slug}:`, err instanceof Error ? err.message : err);
    return 'error';
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const editionSlug = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!editionSlug) {
    console.error('Usage: npm run extract-events -- <edition-slug> [--dry-run]');
    console.error('Example: npm run extract-events -- april-16-2026');
    process.exit(1);
  }

  const htmlPath = path.join(process.cwd(), 'public', 'newsletters', `${editionSlug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.error(`Newsletter not found: ${htmlPath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`📥 Reading ${editionSlug}.html (${html.length} bytes)`);

  const rawEvents = await extractEventsFromHtml(html, editionSlug);
  console.log(`🤖 Gemini extracted ${rawEvents.length} events`);

  const records = rawEvents.map((r) => toEventRecord(r, editionSlug));

  // Quick de-dupe by slug in case Gemini returned the same event twice.
  const seen = new Set<string>();
  const deduped = records.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
  if (deduped.length < records.length) {
    console.log(`🔧 De-duped ${records.length - deduped.length} collisions`);
  }

  console.log(`💾 ${dryRun ? 'Would write' : 'Writing'} ${deduped.length} events...`);
  let written = 0;
  let errored = 0;
  for (const ev of deduped) {
    const result = writeEvent(ev, dryRun);
    if (result === 'written' || result === 'dry-run') written++;
    if (result === 'error') errored++;
    const d = ev.endDate ? `${ev.date}→${ev.endDate}` : ev.date;
    console.log(`  [${ev.category.padEnd(9)}] ${d} · ${ev.name} @ ${ev.venue}`);
  }

  console.log(`\n✅ Done. ${dryRun ? 'Would write' : 'Wrote'} ${written} records${errored ? ` (${errored} errors)` : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
