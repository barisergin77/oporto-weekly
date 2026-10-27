/**
 * Fever catalog → event records (owner decision 2026-10-27, Fever affiliate).
 * Run on the server by ~/fever-sync/run.sh after the catalog sync:
 *
 *   npx tsx scripts/fever-events.ts candidates [--days 42] [--descriptions file.json]
 *     → JSON array of dated Fever occurrences (lib/fever.ts feverOccurrences)
 *       that aren't listed yet, with Fever's own catalog copy for the writer.
 *   npx tsx scripts/fever-events.ts write <copy.json>
 *     → writes data/events/<slug>.json for each { key, name, description,
 *       longDescription, category } in copy.json (EN copy written from the
 *       catalog facts only). PT + extras come from the enrichment crons.
 *
 * Facts (date, time, venue, price, link) are first-party from Fever's catalog.
 * The newsletter takes at most MAX_FEVER_PER_EDITION of these per edition.
 */

import fs from 'fs';
import path from 'path';
import {
  type EventCategory,
  type EventRecord,
  FORWARD_SOURCE,
  canonicalVenueSlugFor,
  composeEventSlug,
  findExistingEventByIdentity,
  listEvents,
} from '../lib/events';
import { datesOverlap } from '../lib/event-identity';
import { FEVER_ITEMS, type FeverOccurrence, feverOccurrences, matchFever } from '../lib/fever';

const day = (iso: string) => iso.slice(0, 10);
const CATEGORIES: EventCategory[] = ['music', 'art', 'food', 'family', 'nightlife', 'sports', 'other'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Already on the site: same Fever plan + day, or the identity / catalog match finds it. */
export function alreadyListed(o: FeverOccurrence, events: EventRecord[]): boolean {
  const d = day(o.date);
  if (events.some((e) => e.feverId === o.item.id && day(e.date) === d)) return true;
  // The identity lookup's exact (name, venue) branch ignores dates; a show
  // Fever runs on several days (Candlelight) is one record per day here.
  const m = findExistingEventByIdentity(o.item.name, o.item.venue, { date: o.date, url: o.item.feverUrl }, events);
  if (m && datesOverlap(m, { date: o.date })) return true;
  return events.some((e) => day(e.date) === d && matchFever(e, [o.item])?.id === o.item.id);
}

function candidates() {
  const days = Number(arg('--days') ?? 42);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const descFile = arg('--descriptions');
  const desc: Record<string, string> = descFile && fs.existsSync(descFile) ? JSON.parse(fs.readFileSync(descFile, 'utf-8')) : {};
  const events = listEvents();
  const out = feverOccurrences(tomorrow, until)
    .filter((o) => !alreadyListed(o, events))
    .map((o) => ({
      key: o.key,
      catalogName: o.item.name,
      venue: o.item.venue,
      date: day(o.date),
      times: o.times,
      price: o.item.price,
      currency: o.item.currency,
      subCategory: o.item.subCategory,
      feverUrl: o.item.feverUrl,
      fevercopy: (desc[o.item.id] ?? '').replace(/\s+/g, ' ').trim().slice(0, 2500),
    }));
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

interface Copy { key: string; name: string; description: string; longDescription?: string; category?: string }

function write(file: string) {
  const copies: Copy[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const events = listEvents();
  const now = new Date().toISOString();
  const written: string[] = [];
  for (const c of copies) {
    const [id, d] = c.key.split('@');
    const item = FEVER_ITEMS.find((i) => i.id === id);
    const occ = item && feverOccurrences(d, d, [item])[0];
    if (!item || !occ || !c.name?.trim() || !c.description?.trim()) continue;
    if (alreadyListed(occ, events)) continue;
    const price = item.price != null ? (item.price > 0 ? `From €${item.price % 1 ? item.price.toFixed(2) : item.price}` : 'Free') : undefined;
    const rec: EventRecord = {
      slug: composeEventSlug(c.name.trim(), item.venue, occ.date),
      name: c.name.trim(),
      date: occ.date,
      venue: item.venue,
      venueSlug: canonicalVenueSlugFor(item.venue),
      price,
      priceFrom: item.price ?? undefined,
      currency: item.price != null ? 'EUR' : undefined,
      category: (CATEGORIES.includes(c.category as EventCategory) ? c.category : 'music') as EventCategory,
      description: c.description.trim(),
      longDescription: c.longDescription?.trim() || undefined,
      sourceEdition: FORWARD_SOURCE,
      externalLink: item.feverUrl,
      feverId: item.id,
      pickCandidate: false,
      addedAt: now,
      lastSeenAt: now,
      // No image here: images are re-hosted, never hot-linked — the event-images cron fills it.
    } as EventRecord;
    const p = path.join(process.cwd(), 'data', 'events', `${rec.slug}.json`);
    if (fs.existsSync(p)) continue;
    fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
    events.push(rec);
    written.push(rec.slug);
  }
  process.stdout.write(JSON.stringify({ written }) + '\n');
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === 'candidates') candidates();
  else if (mode === 'write' && process.argv[3]) write(process.argv[3]);
  else { console.error('usage: fever-events.ts candidates [--days N] [--descriptions f] | write <copy.json>'); process.exit(2); }
}
