/**
 * Gomry catalog → FC Porto HOME match events (owner 2026-10-27: "I like the
 * idea of listing Porto home game matches"). Nothing else from Gomry becomes
 * an event (their Porto inventory is dance classes, resale and networking).
 * Run on the server by ~/fever-sync/run.sh after the Gomry sync:
 *
 *   npx tsx scripts/gomry-events.ts [--days 42] [--dry-run]
 *
 * Facts are first-party from Gomry's catalog: opponent, kickoff (shown in
 * Lisbon time), venue and the resale "from" price exactly as listed. The
 * ticket button uses the tracked Gomry link (lib/gomry.ts). These events
 * never take an Editor's Pick slot (lib/edition-compose.ts).
 */

import fs from 'fs';
import path from 'path';
import { type EventRecord, FORWARD_SOURCE, composeEventSlug, findExistingEventByIdentity, listEvents } from '../lib/events';
import { isAdultContent } from '../lib/fever';
import { GOMRY_ITEMS, type GomryItem, isPortoHomeMatch, lisbonLocal } from '../lib/gomry';

const VENUE = 'Estádio do Dragão';
const VENUE_SLUG = 'estadio-do-dragao';
const day = (iso: string) => iso.slice(0, 10);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** "Porto vs Estoril Praia" → "Estoril Praia". */
export const opponent = (i: GomryItem) => i.name.replace(/^(fc\s+)?porto\s+vs\.?\s+/i, '').trim();

/**
 * Kickoff in Lisbon time, or null when the listing still carries the
 * league's placeholder slot (11:00 UTC, used before the real kickoff is set).
 */
export function kickoff(i: GomryItem): string | null {
  if (/T11:00:00(\.000)?Z$/.test(i.start)) return null;
  return lisbonLocal(i.start);
}

/** "From US$87.05" exactly as the catalog lists it (resale), or null. */
export function priceText(i: GomryItem): string | null {
  if (i.isFree) return 'Free';
  if (i.priceFrom == null) return null;
  const cur = i.currency === 'EUR' ? '€' : i.currency === 'USD' ? 'US$' : i.currency === 'GBP' ? '£' : `${i.currency} `;
  return `From ${cur}${i.priceFrom % 1 ? i.priceFrom.toFixed(2) : i.priceFrom}`;
}

const DATE_EN = (d: string) => new Date(`${day(d)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const DATE_PT = (d: string) => new Date(`${day(d)}T12:00:00Z`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function matchRecord(i: GomryItem, now = new Date().toISOString()): EventRecord {
  const opp = opponent(i);
  const ko = kickoff(i);
  const date = ko ?? day(lisbonLocal(i.start));
  const price = priceText(i);
  const name = `FC Porto vs ${opp}`;
  const when = ko ? `${DATE_EN(date)} at ${ko.slice(11)}` : `${DATE_EN(date)} (kickoff time to be confirmed)`;
  const whenPt = ko ? `${DATE_PT(date)}, às ${ko.slice(11)}` : `${DATE_PT(date)} (hora a confirmar)`;
  const priceEn = price ? ` Tickets via Gomry ${price.replace(/^From/, 'from')} (resale prices).` : ' Tickets via Gomry (resale).';
  const pricePt = price ? ` Bilhetes via Gomry desde ${price.replace(/^From /, '')} (preços de revenda).` : ' Bilhetes via Gomry (revenda).';
  return {
    slug: composeEventSlug(name, VENUE, date),
    name,
    date,
    venue: VENUE,
    venueSlug: VENUE_SLUG,
    price: price ? `${price} (resale)` : undefined,
    // JSON-LD Offer price (lib/events.ts toEventJsonLd): the listed resale "from" price in its own currency.
    priceFrom: !i.isFree && i.priceFrom != null ? i.priceFrom : undefined,
    currency: !i.isFree && i.priceFrom != null && i.currency ? i.currency : undefined,
    category: 'sports',
    description: `FC Porto host ${opp} at the Estádio do Dragão on ${when}.${priceEn}`,
    longDescription:
      `FC Porto play ${opp} at home at the Estádio do Dragão on ${when}. Kickoff times can still be moved by the league, so check before you go.\n\n` +
      `The stadium has its own metro stop, Estádio do Dragão (lines A, B, E and F).\n\n` +
      `Tickets are sold through Gomry, a resale platform.${price ? ` Listed prices start at ${price.replace(/^From /, '')}.` : ''}`,
    descriptionPt: `O FC Porto recebe o ${opp} no Estádio do Dragão, ${whenPt}.${pricePt}`,
    sourceEdition: FORWARD_SOURCE,
    externalLink: i.url,
    gomryId: i.id,
    pickCandidate: false,
    addedAt: now,
    lastSeenAt: now,
  } as EventRecord;
}

/** Already on the site: same Gomry id, or any FC Porto / Dragão sports event that day. */
export function alreadyListed(i: GomryItem, events: EventRecord[]): boolean {
  const d = day(lisbonLocal(i.start));
  if (events.some((e) => e.gomryId === i.id)) return true;
  if (events.some((e) => day(e.date) === d && (e.venueSlug === VENUE_SLUG || /\b(fc\s+)?porto\s+vs\b/i.test(e.name)) && e.category === 'sports')) return true;
  return Boolean(findExistingEventByIdentity(`FC Porto vs ${opponent(i)}`, VENUE, { date: d, url: i.url }, events));
}

export function homeMatchCandidates(items: GomryItem[], events: EventRecord[], from: string, to: string): GomryItem[] {
  return items.filter((i) => isPortoHomeMatch(i) && !isAdultContent(i.name, i.venue) &&
    day(lisbonLocal(i.start)) >= from && day(lisbonLocal(i.start)) <= to && !alreadyListed(i, events));
}

if (require.main === module) {
  const days = Number(arg('--days') ?? 42);
  const from = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const events = listEvents();
  const written: string[] = [];
  for (const i of homeMatchCandidates(GOMRY_ITEMS, events, from, to)) {
    const rec = matchRecord(i);
    const p = path.join(process.cwd(), 'data', 'events', `${rec.slug}.json`);
    if (fs.existsSync(p)) continue;
    if (!process.argv.includes('--dry-run')) fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
    events.push(rec);
    written.push(rec.slug);
  }
  process.stdout.write(JSON.stringify({ written }) + '\n');
}
