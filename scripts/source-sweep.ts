/**
 * Daily event source sweep (owner build 2026-11-01). Logic: lib/source-sweep.ts.
 * Server job: ~/oporto-sweep/run.sh (oporto-sweep.timer, 06:00 UTC), which
 * commits data/events as oporto-growth-bot (deferred files: deploy-flush
 * publishes them at 21:00 UTC) and posts the digest to #oporto-weekly.
 *
 *   npx tsx scripts/source-sweep.ts run [--write] [--days 60] [--sources coliseu,bol]
 *        [--weekly] [--state DIR] [--out summary.json] [--max-auto 250]
 *     Without --write it is a dry run: collects, filters, dedupes and runs the
 *     page check, prints counts and samples, writes nothing to data/events.
 *   npx tsx scripts/source-sweep.ts add <review.json> 1,3
 *     Publish review items the owner picked ("add 1,3" in Discord).
 *
 * Env: GEMINI_API_KEY (page check + PT), FIRECRAWL_API_KEY (Shotgun,
 * Serralves, Casa da Música), optional IMGUR_CLIENT_ID (press photo; without
 * it the event-images cron adds images later), SWEEP_FEVER_DESCRIPTIONS
 * (~/fever-sync/descriptions.json, Fever's own copy).
 *
 * Politeness: one honest user agent, robots.txt respected (Ticketline is
 * never read: it blocks bots), ≥1.5 s between requests to one host, detail
 * pages only for new candidates.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type EventRecord, canonicalVenueSlugFor, findExistingEventByIdentity, listEvents } from '../lib/events';
import { normalizeEventUrl, datesOverlap, nameTokens, nameVariants } from '../lib/event-identity';
import { type Candidate, type Page, type ScanUsage, findDuplicate, inFreezeWindow, pageFromHtml, recordFromFacts, verifyCandidate } from '../lib/forward-scan';
import { acquireEventImage, translateEventFields } from '../lib/events-pipeline';
import { humanizeText } from '../lib/humanizer';
import {
  type DigestItem, type SweepCandidate, type SweepCluster, type SweepSource,
  FINAL_REJECT, SOURCES, WEEKLY_SOURCES, addDays, collapseSessions, day, formatDigest, inWindow, lisbonToday,
  groupFestivalSessions, lisbonWallClock, mergeAcrossSources, noiseReason, normalizeVenue, portoAreaReason, routeCandidate,
} from '../lib/source-sweep';

const UA = 'OportoWeekly-SourceSweep/1.0 (+https://oportoweekly.com; growth@oportoweekly.com)';
const HOST_GAP_MS = 1_500;
const EVENTS_DIR = path.join(process.cwd(), 'data', 'events');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

// ---------------------------------------------------------------- state + cache
const STATE = opt('--state') ?? path.join(os.tmpdir(), 'oporto-sweep-state');
const ensureState = () => fs.mkdirSync(path.join(STATE, 'cache'), { recursive: true });
const readJson = <T>(f: string, d: T): T => { try { return JSON.parse(fs.readFileSync(f, 'utf-8')) as T; } catch { return d; } };
const writeJson = (f: string, v: unknown) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const cachePath = (key: string) => path.join(STATE, 'cache', crypto.createHash('sha1').update(key).digest('hex') + '.json');
function cacheGet<T>(key: string, maxAgeH: number): T | undefined {
  const p = cachePath(key);
  if (!fs.existsSync(p) || Date.now() - fs.statSync(p).mtimeMs > maxAgeH * 3_600_000) return undefined;
  return readJson<{ v: T }>(p, { v: undefined as T }).v;
}
const cacheSet = (key: string, v: unknown) => writeJson(cachePath(key), { key, v });

// ---------------------------------------------------------------- polite HTTP
const lastHit = new Map<string, number>();
const hostQueue = new Map<string, Promise<unknown>>();
let httpRequests = 0;
async function politeFetch(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<Response> {
  const host = new URL(url).hostname;
  const prev = hostQueue.get(host) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(async () => {
    const wait = (lastHit.get(host) ?? 0) + HOST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
    httpRequests++;
    return fetch(url, { ...init, headers: { 'User-Agent': UA, 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8', ...(init.headers ?? {}) }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  });
  hostQueue.set(host, run);
  return run;
}
async function getText(url: string, cacheH = 0): Promise<{ text: string; finalUrl: string }> {
  if (cacheH) { const c = cacheGet<{ text: string; finalUrl: string }>(`GET ${url}`, cacheH); if (c) return c; }
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const out = { text: await res.text(), finalUrl: res.url || url };
  if (cacheH) cacheSet(`GET ${url}`, out);
  return out;
}

let firecrawlCredits = 0;
async function firecrawl(url: string, cacheH: number): Promise<string> {
  const cached = cacheGet<string>(`FC ${url}`, cacheH);
  if (cached) return cached;
  if (!process.env.FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not set');
  firecrawlCredits++;
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false, waitFor: 3000, location: { country: 'PT', languages: ['pt-PT'] } }),
    signal: AbortSignal.timeout(90_000),
  });
  const d = await res.json() as { success?: boolean; data?: { markdown?: string }; error?: string };
  if (!d.success || !d.data?.markdown) throw new Error(`Firecrawl ${url}: ${d.error ?? res.status}`);
  cacheSet(`FC ${url}`, d.data.markdown);
  return d.data.markdown;
}

// ---------------------------------------------------------------- helpers
const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const stripHtml = (s: string) => decode((s ?? '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const euros = (n: number) => (n % 1 ? n.toFixed(2) : String(n));
/** Wall-clock "YYYY-MM-DDTHH:MM" (drops a midnight time, which sources use for "no time"). */
const wall = (s: string) => { const w = s.slice(0, 16); return w.endsWith('T00:00') ? w.slice(0, 10) : w; };
const MONTHS_PT: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const MONTHS_EN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
/** A day-month without a year → the next occurrence on or after (today − 7 days). */
function inferYear(m: number, d: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return iso >= addDays(today, -7) ? iso : `${y + 1}-${pad(m)}-${pad(d)}`;
}
function ldEventsRaw(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o['@type'] ?? []).map(String);
    if (types.some((t) => /Event$/.test(t)) && o.startDate) out.push(o);
    for (const k of ['@graph', 'itemListElement', 'item']) if (o[k]) walk(o[k]);
  };
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try { walk(JSON.parse(m[1])); } catch { try { walk(JSON.parse(decode(m[1]))); } catch { /* skip */ } }
  }
  return out;
}
const str = (v: unknown) => (typeof v === 'string' ? decode(v).trim() : typeof v === 'number' ? String(v) : '');

// ---------------------------------------------------------------- collectors
type Collector = (from: string, to: string, today: string) => Promise<SweepCandidate[]>;

/** Coliseu Porto Ageas: their public GraphQL (the site's own frontend uses it), one POST. */
const coliseu: Collector = async (from, to) => {
  const query = `{ events(paging:{limit:300}, filter:{startDate:{between:{lower:"${from}",upper:"${addDays(to, 1)}"}}}) { nodes { name startDate slug state isVisible description ticketsInfo minimumAge category { name } room { name } } } }`;
  const res = await politeFetch('https://nest.coliseu.pt/graph/', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`Coliseu GraphQL HTTP ${res.status}`);
  const d = await res.json() as { data?: { events?: { nodes?: Array<Record<string, any>> } }; errors?: unknown };
  const nodes = d.data?.events?.nodes;
  if (!nodes) throw new Error(`Coliseu GraphQL: ${JSON.stringify(d.errors ?? d).slice(0, 200)}`);
  return nodes.filter((n) => n.state === 'ACTIVE' && n.isVisible !== false).map((n) => {
    // Coliseu stores the local start time with a "Z" (21:30 shows as 21:30Z).
    const date = wall(String(n.startDate).replace(/\.\d+Z$|Z$/, ''));
    const url = `https://www.coliseu.pt/evento/${n.slug}`;
    const room = n.room?.name ? `${n.room.name}, ` : '';
    return {
      source: 'coliseu' as const, sourceId: n.slug, name: str(n.name), date, venue: 'Coliseu Porto Ageas', city: 'Porto', postalCode: '4000-249', url,
      tags: [n.category?.name].filter(Boolean),
      pageText: `Coliseu Porto Ageas event page (${url}). Event: ${str(n.name)}. Category: ${n.category?.name ?? ''}. Date and time: ${date.replace('T', ' ')} (${day(date)}). Venue: ${room}Coliseu Porto Ageas, Rua de Passos Manuel 137, Porto. ${n.minimumAge ? `Minimum age: ${stripHtml(n.minimumAge)}.` : ''}\nDescription: ${stripHtml(n.description)}\nTickets: ${stripHtml(n.ticketsInfo)}`,
    };
  });
};

/** Super Bock Arena: WordPress The Events Calendar REST API. */
const superbockarena: Collector = async (from, to) => {
  const out: SweepCandidate[] = [];
  for (let page = 1; page <= 5; page++) {
    const { text } = await getText(`https://www.superbockarena.pt/wp-json/tribe/events/v1/events?start_date=${from}&end_date=${to}&per_page=50&page=${page}`);
    const d = JSON.parse(text) as { events?: Array<Record<string, any>>; total_pages?: number };
    for (const e of d.events ?? []) {
      const date = wall(String(e.start_date).replace(' ', 'T'));
      const end = day(String(e.end_date));
      const cats = (e.categories ?? []).map((c: { name: string }) => c.name);
      out.push({
        source: 'superbockarena', sourceId: String(e.id), name: stripHtml(e.title), date, endDate: end > day(date) ? end : undefined,
        venue: 'Super Bock Arena', city: 'Porto', postalCode: '4050-597', url: e.url, price: e.cost ? stripHtml(e.cost) : undefined,
        priceFrom: Number(e.cost_details?.values?.[0]) || undefined, tags: cats,
        pageText: `Super Bock Arena event page (${e.url}). Event: ${stripHtml(e.title)}. Date: ${date.replace('T', ' ')} (${day(date)})${end > day(date) ? ` to ${end}` : ''}. Venue: Super Bock Arena - Pavilhão Rosa Mota, Porto. Price: ${e.cost ? stripHtml(e.cost) : 'not stated'}. Categories: ${cats.join(', ')}.\nDescription: ${stripHtml(e.description)}`,
      });
    }
    if (!d.total_pages || page >= d.total_pages) break;
  }
  return out;
};

/** BOL: the Porto-district search page carries JSON-LD for every session (one GET). */
const bol: Collector = async () => {
  const { text } = await getText('https://www.bol.pt/Comprar/pesquisa/0-0-13-0-0-0/porto');
  return ldEventsRaw(text).map((e) => {
    const loc = ([] as any[]).concat(e.location ?? [])[0] ?? {};
    const a = loc.address ?? {};
    const offer = ([] as any[]).concat(e.offers ?? [])[0] ?? {};
    const start = wall(str(e.startDate));
    const end = e.endDate ? day(str(e.endDate)) : undefined;
    const price = Number(offer.price);
    return {
      source: 'bol' as const, sourceId: String(e.productID ?? e.url), name: str(e.name).replace(/\s*\|\s*$/, ''), date: start,
      // The search lists a show's whole run (endDate) on each session: keep the session day, the detail page states the run.
      endDate: undefined, venue: normalizeVenue(str(loc.name)), address: [str(a.streetAddress), str(a.postalCode), str(a.addressLocality)].filter(Boolean).join(', '),
      postalCode: str(a.postalCode), city: str(a.addressLocality), url: str(e.url) || str(offer.url),
      price: price > 0 ? `From €${euros(price)}` : undefined, priceFrom: price > 0 ? price : undefined,
      tags: end && end !== day(start) ? [`run until ${end}`] : [],
    };
  }).filter((c) => c.url);
};

/** Agenda Porto (the city's agenda): server-rendered cards on the home and section pages. */
const AGENDA_PAGES = ['', 'calendario/', 'seccao/ao-fresco/', 'seccao/arte-e-exposicoes/', 'seccao/cinema/', 'seccao/conversas/', 'seccao/desporto-e-movimento/', 'seccao/familias/', 'seccao/musica-e-clubbing/', 'seccao/palcos/'];
function parseAgendaCards(html: string, today: string): SweepCandidate[] {
  const fields = new Map<string, string[]>();
  const re = /data-bl-name="[^"]+"[^>]*?data-content-id="([^"]+)"[^>]*>([^<]{1,300})</g;
  for (let m = re.exec(html); m; m = re.exec(html)) fields.set(m[1], [...(fields.get(m[1]) ?? []), decode(m[2]).trim()]);
  const hrefs = new Map<string, string>();
  const hr = /href="(evento\/[^"]+)"[^>]*data-content-id="([^"]+)"/g;
  for (let m = hr.exec(html); m; m = hr.exec(html)) hrefs.set(m[2], m[1]);
  const out: SweepCandidate[] = [];
  fields.forEach((f, id) => {
    const href = hrefs.get(id);
    if (!href || f.length < 3) return;
    const venue = f[0];
    let i = 1;
    const nums: string[] = [];
    while (i < f.length && (/^\d{1,2}$/.test(f[i]) || /^\d{4}$/.test(f[i]) || MONTHS_PT[f[i].toLowerCase().slice(0, 3)])) nums.push(f[i++]);
    const title = f[i];
    if (!title || nums.length < 2) return;
    const d1 = Number(nums[0]); const m1 = MONTHS_PT[nums[1].toLowerCase().slice(0, 3)];
    const d2 = nums.length >= 4 ? Number(nums[2]) : d1; const m2 = nums.length >= 4 ? MONTHS_PT[nums[3].toLowerCase().slice(0, 3)] : m1;
    const y2 = nums.find((n) => /^\d{4}$/.test(n));
    if (!m1 || !m2) return;
    const end = y2 ? `${y2}-${pad(m2)}-${pad(d2)}` : inferYear(m2, d2, today);
    const startYear = m1 <= m2 ? end.slice(0, 4) : String(Number(end.slice(0, 4)) - 1);
    const start = `${startYear}-${pad(m1)}-${pad(d1)}`;
    const url = `https://www.agenda-porto.pt/${href}`;
    out.push({ source: 'agendaporto', sourceId: href, name: title, date: start, endDate: end !== start ? end : undefined, venue: normalizeVenue(venue), url, tags: f.slice(i + 1, i + 8) });
  });
  return out;
}
const agendaporto: Collector = async (_from, _to, today) => {
  const all = new Map<string, SweepCandidate>();
  for (const p of AGENDA_PAGES) {
    const { text } = await getText(`https://www.agenda-porto.pt/${p}`);
    for (const c of parseAgendaCards(text, today)) if (!all.has(c.url)) all.set(c.url, c);
  }
  return Array.from(all.values());
};

/** Dice venue pages (no Porto city page): __NEXT_DATA__ event lists. */
const DICE_VENUES = ['plano-b-rrk5', 'lovers--lollypops-omaa', 'prola-negra-bb5ao', 'passos-manuel-oe2nr', 'm-odu-wwalp', 'the-barons-hall-92dwn', 'cais-das-pedras-ry575', 'super-bock-arena-mx69v'];
const dice: Collector = async () => {
  const out: SweepCandidate[] = [];
  for (const v of DICE_VENUES) {
    const { text } = await getText(`https://dice.fm/venue/${v}`);
    const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) continue;
    const prof = JSON.parse(m[1])?.props?.pageProps?.profile;
    for (const s of prof?.sections ?? []) {
      for (const e of s.events ?? []) {
        const vn = e.venues?.[0] ?? {};
        const pc = String(vn.address ?? '').match(/\b\d{4}-\d{3}\b/)?.[0];
        const cents = e.price?.amount_from ?? e.price?.amount;
        const start = lisbonWallClock(e.dates?.event_start_date);
        const endI = e.dates?.event_end_date ? lisbonWallClock(e.dates.event_end_date) : undefined;
        out.push({
          source: 'dice', sourceId: e.id, name: str(e.name), date: start,
          endDate: endI && e.dates?.is_multi_days_event && day(endI) > day(start) ? day(endI) : undefined,
          venue: normalizeVenue(str(vn.name)), address: str(vn.address), postalCode: pc, city: str(vn.city?.name),
          url: `https://dice.fm/event/${e.id}`, price: cents ? `From €${euros(cents / 100)}` : undefined, priceFrom: cents ? cents / 100 : undefined, tags: [],
        });
      }
    }
  }
  return out;
};

/**
 * Fever dated one-offs that ~/fever-sync does not publish: tier 4 (no
 * commission) concerts with ≤ 3 sessions. Tiers 1–3 already become events
 * there (scripts/fever-events.ts), so they are skipped here.
 */
const FEVER_NOT_EVENT = /cruise|cruzeiro|boat|barco|tour|visita|passeio|game|jogo|escape|crawl|admission|bilhete de entrada|ingresso|men[uú]|tasting|prova/i;
const fever: Collector = async () => {
  const data = readJson<{ items: Array<Record<string, any>> }>(path.join(process.cwd(), 'data', 'fever.json'), { items: [] });
  const desc = readJson<Record<string, string>>(process.env.SWEEP_FEVER_DESCRIPTIONS ?? '', {});
  const out: SweepCandidate[] = [];
  for (const i of data.items) {
    if (i.commissionable || !(i.sessionCount > 0 && i.sessionCount <= 3) || FEVER_NOT_EVENT.test(`${i.name} ${i.subCategory}`) || /halloween|gift/i.test(i.name)) continue;
    if (!/concert|music|festival/i.test(i.subCategory)) continue;
    // "MAX COOPER no Hard Club, Porto 2026" → "MAX COOPER"
    const name = String(i.name).replace(/\s+(no|na|em|at)\s+.+$/i, '').trim();
    for (const s of i.sessions as string[]) {
      out.push({
        source: 'fever', sourceId: `${i.id}@${day(s)}`, name, date: wall(s), venue: normalizeVenue(i.venue), city: i.city, url: i.feverUrl || i.url,
        price: i.price ? `From €${euros(i.price)}` : undefined, priceFrom: i.price || undefined, tags: [i.subCategory],
        pageText: `Fever event listing (${i.feverUrl || i.url}). Event: ${i.name}. Date and time: ${wall(s).replace('T', ' ')} (${day(s)}). Venue: ${i.venue}, ${i.city}. Price: ${i.price ? `from €${euros(i.price)}` : 'not stated'}.\nDescription: ${(desc[i.id] ?? '').replace(/\s+/g, ' ').slice(0, 3000)}`,
      });
    }
  }
  return out;
};

/** Shotgun city page via Firecrawl (their CDN rate-limits plain clients). ?page=N is cumulative (14 per page). */
function parseShotgun(md: string, today: string): SweepCandidate[] {
  const out: SweepCandidate[] = [];
  const re = /\[!\[[^\]]*\]\([^)]*\)((?:[^\]]|\](?!\())*?)\]\((https:\/\/shotgun\.live\/en\/(?:events|festivals)\/[^)\s]+)\)/g;
  for (let m = re.exec(md); m; m = re.exec(md)) {
    const parts = m[1].split(/\\\\?\n|\\$/).map((s) => s.replace(/\\/g, '').trim()).filter(Boolean);
    const [title, venue, md1, time] = parts;
    const dm = (md1 ?? '').match(/^([A-Z][a-z]{2})\s+(\d{1,2})/);
    if (!title || !venue || !dm || !MONTHS_EN[dm[1].toLowerCase()]) continue;
    const date = inferYear(MONTHS_EN[dm[1].toLowerCase()], Number(dm[2]), today);
    const tm = (time ?? '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let hhmm = '';
    if (tm) { let h = Number(tm[1]) % 12; if (/pm/i.test(tm[3])) h += 12; hhmm = `T${pad(h)}:${tm[2]}`; }
    const price = parts.find((p) => /^€\d/.test(p));
    out.push({
      source: 'shotgun', sourceId: m[2].split('/').pop()!, name: title, date: date + hhmm, venue: normalizeVenue(venue), url: m[2],
      price: price ? `From ${price.replace(/\.00$/, '')}` : undefined, priceFrom: price ? Number(price.slice(1)) : undefined,
      tags: parts.slice(4).filter((p) => !/^€|sold out|waiting list|^\+\d/i.test(p)),
    });
  }
  return out;
}
const shotgun: Collector = async (_f, _t, today) => {
  const md = await firecrawl('https://shotgun.live/en/cities/porto?page=7', 20);
  const out = parseShotgun(md, today);
  return Array.from(new Map(out.map((c) => [c.url, c])).values());
};

/** Serralves agenda cards (weekly, Firecrawl): exhibitions with date ranges, and dated activities. */
const SERRALVES_ROOM = /^(museu|parque|casa de serralves|ala [aá]lvaro si[sz]a|casa do cinema( manoel de oliveira)?|galeria contempor[aâ]nea do museu|biblioteca|audit[oó]rio( do museu)?|livraria|treetop walk|celeiro e lagar da quinta|parque de estacionamento do museu|casa e parque de serralves)$/i;
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
function parseSerralves(md: string): SweepCandidate[] {
  const out: SweepCandidate[] = [];
  const re = /\[!\[[^\]]*\]\([^)]*\)((?:[^\]]|\](?!\())*?)\]\((https:\/\/www\.serralves\.pt\/(?:ciclo|atividades)-serralves\/[^)\s]+)\)/g;
  const MON = '(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)';
  const range = new RegExp(`^(\\d{1,2})?\\s*${MON}\\.?(?:\\s+(\\d{4}))?\\s*[–—-]\\s*(\\d{1,2})?\\s*${MON}\\.?\\s+(\\d{4})$`, 'i');
  const single = new RegExp(`^(\\d{1,2})(?:\\s*(?:e|—|–|-)\\s*(\\d{1,2}))?\\s*${MON}\\.?\\s+(\\d{4})(?:\\s*\\|\\s*(\\d{1,2})[:h](\\d{2}))?`, 'i');
  for (let m = re.exec(md); m; m = re.exec(md)) {
    const parts = m[1].split(/\\\\?\n|\\$/).map((s) => s.replace(/\\|\*\*/g, '').trim()).filter((p) => p && !/^(saber mais|comprar)$/i.test(p));
    const di = parts.findIndex((p) => range.test(p) || single.test(p));
    if (di < 1) continue;
    let date: string | undefined; let end: string | undefined; let monthOnly = false;
    const r = parts[di].match(range);
    const sgl = parts[di].match(single);
    if (r) {
      const y2 = Number(r[6]);
      const m1 = MONTHS_PT[r[2].toLowerCase()]; const m2 = MONTHS_PT[r[5].toLowerCase()];
      const y1 = r[3] ? Number(r[3]) : (m1 <= m2 ? y2 : y2 - 1);
      // "MAR 2027" without a day: unknown end day, the detail page decides.
      if (r[1]) date = `${y1}-${pad(m1)}-${pad(Number(r[1]))}`;
      end = r[4] ? `${y2}-${pad(m2)}-${pad(Number(r[4]))}` : lastDayOf(y2, m2);
      if (!r[4]) monthOnly = true;
    } else if (sgl) {
      date = `${sgl[4]}-${pad(MONTHS_PT[sgl[3].toLowerCase()])}-${pad(Number(sgl[1]))}${sgl[5] ? `T${pad(Number(sgl[5]))}:${sgl[6]}` : ''}`;
      if (sgl[2]) end = `${sgl[4]}-${pad(MONTHS_PT[sgl[3].toLowerCase()])}-${pad(Number(sgl[2]))}`;
    }
    if (!date) continue;
    const place = di >= 2 ? parts[di - 1] : '';
    const atSerralves = !place || SERRALVES_ROOM.test(place);
    const titleParts = parts.slice(0, atSerralves && place ? di - 1 : di - (place ? 1 : 0));
    const name = (titleParts.length ? titleParts : [parts[0]]).join(': ').replace(/^PR[ÓO]XIMAS:\s*/i, '');
    out.push({
      source: 'serralves', sourceId: m[2], name, date, endDate: end, url: m[2], tags: [place, monthOnly ? 'end month only' : ''].filter(Boolean),
      ...(atSerralves ? { venue: 'Serralves', city: 'Porto', postalCode: '4150-417' } : { venue: normalizeVenue(place.split(',')[0]), city: place.split(',').slice(1).join(',').trim() || place }),
    });
  }
  return Array.from(new Map(out.map((c) => [c.url, c])).values());
}
const serralves: Collector = async () => parseSerralves(await firecrawl('https://www.serralves.pt/agenda/', 24 * 6));

/** Casa da Música agenda (weekly, Firecrawl): a backstop to the newsletter leads. */
function parseCdm(md: string): SweepCandidate[] {
  const out: SweepCandidate[] = [];
  const re = /(\d{2})\.(\d{2})\.(\d{4})\s+\S+,\s+(\d{2}:\d{2})\s*\n+([^\n]*)\n[\s\S]*?\n##\s+\[([^\]]+)\]\((https:\/\/casadamusica\.com\/event\/[^)\s?]+)[^)]*\)\s*\n+([^\n]*)/g;
  for (let m = re.exec(md); m; m = re.exec(md)) {
    out.push({
      source: 'casadamusica', sourceId: m[7], name: m[6].trim(), date: `${m[3]}-${m[2]}-${m[1]}T${m[4]}`, venue: 'Casa da Música', city: 'Porto', postalCode: '4149-071',
      url: m[7] + '/', tags: m[8].replace(/\*\*/g, '').split('·').map((s) => s.trim()).filter(Boolean).slice(0, 4),
    });
  }
  return out;
}
const casadamusica: Collector = async () => parseCdm(await firecrawl('https://casadamusica.com/agenda/', 24 * 6));

const COLLECTORS: Record<SweepSource, Collector> = { coliseu, superbockarena, bol, agendaporto, dice, fever, shotgun, serralves, casadamusica };

// ---------------------------------------------------------------- page for the check
async function pageFor(c: SweepCandidate): Promise<Page | { reason: string }> {
  if (c.pageText) return { text: c.pageText.replace(/\s+/g, ' ').trim().slice(0, 40_000), finalUrl: c.url, ld: [] };
  try {
    if (c.source === 'shotgun') {
      const md = await firecrawl(c.url, 24 * 7);
      return { text: md.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\s+/g, ' ').slice(0, 40_000), finalUrl: c.url, ld: [] };
    }
    const { text, finalUrl } = await getText(c.url, 24);
    return pageFromHtml(text, finalUrl);
  } catch (err) {
    return { reason: `page not fetchable: ${err instanceof Error ? err.message : err}` };
  }
}

// ---------------------------------------------------------------- dedupe
function existingMatch(c: SweepCandidate, existing: EventRecord[]): EventRecord | undefined {
  const probe = { name: c.name, venue: c.venue, date: day(c.date), endDate: c.endDate ? day(c.endDate) : undefined };
  const m = findExistingEventByIdentity(c.name, c.venue, { ...probe, url: c.url }, existing);
  // The exact (name, venue) tier ignores dates: a weekly night on another date is not this one.
  if (m && datesOverlap(m, probe)) return m;
  const dup = findDuplicate(probe, existing);
  if (dup && datesOverlap(dup, probe, 1)) return dup;
  const u = normalizeEventUrl(c.url);
  const byUrl = u ? existing.find((e) => normalizeEventUrl(e.externalLink) === u && datesOverlap(e, probe)) : undefined;
  if (byUrl) return byUrl;
  // One title inside the other at the same venue on the same days: "Moonspell"
  // (Agenda Porto) is our "Moonspell: Invicta Halloween" (identity needs 2 shared words).
  const slug = canonicalVenueSlugFor(c.venue);
  const tc = nameTokens(c.name, slug);
  return existing.find((e) => {
    if ((e.venueSlug ?? canonicalVenueSlugFor(e.venue)) !== slug || !datesOverlap(e, probe)) return false;
    return nameVariants(e).some((n) => {
      const te = nameTokens(n, slug);
      const [small, big] = tc.size <= te.size ? [tc, te] : [te, tc];
      const shared = Array.from(small).filter((t) => big.has(t));
      return small.size > 0 && shared.length === small.size && shared.join('').length >= 5;
    });
  });
}

// ---------------------------------------------------------------- run
async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

interface SourceStat { found: number; inWindow: number; filtered: number; dup: number; published: number; review: number; dropped: number; failed: number; error?: string }
const emptyStat = (): SourceStat => ({ found: 0, inWindow: 0, filtered: 0, dup: 0, published: 0, review: 0, dropped: 0, failed: 0 });

interface ReviewItem extends DigestItem { key: string; source: SweepSource; candidate: SweepCandidate }

async function verifyAndBuild(
  usage: ScanUsage, c: SweepCandidate, window: { from: string; to: string }, minLongWords: number
): Promise<{ rec: EventRecord } | { reason: string }> {
  const page = await pageFor(c);
  if ('reason' in page) return page;
  const cand: Candidate = { name: c.name, venue: c.venue, date: day(c.date), endDate: c.endDate, url: c.url, urls: [c.url] };
  const r = await verifyCandidate(usage, cand, window, { page, minLongWords, acceptListing: c.source === 'agendaporto' });
  if ('reason' in r) return r;
  const f = r.facts;
  // The page must agree with the listing's date (±1 day, or a run that covers it).
  const listed = day(c.date);
  const covers = f.date <= listed && (f.endDate ?? f.date) >= listed;
  if (!covers && Math.abs(Date.parse(f.date) - Date.parse(listed)) > 86_400_000) return { reason: `page date ${f.date} vs listing ${listed}` };
  // Listing facts the page reader may not repeat: session range, time, venue spelling.
  if (!f.endDate && c.endDate && c.endDate > f.date) f.endDate = day(c.endDate);
  if (!f.time && c.date.length > 10 && f.date === listed) f.time = c.date.slice(11, 16);
  const ours = normalizeVenue(c.venue);
  f.venue = ours && canonicalVenueSlugFor(ours) !== 'porto' ? ours : normalizeVenue(f.venue);
  if (!f.price && c.price) { f.price = c.price; f.priceFrom = c.priceFrom ?? null; }
  const url = c.source === 'dice' || c.source === 'shotgun' || c.source === 'fever' ? c.url : r.url;
  const rec = recordFromFacts(f, url);
  return { rec };
}

async function enrich(rec: EventRecord): Promise<EventRecord | { reason: string }> {
  let pt: Awaited<ReturnType<typeof translateEventFields>> | null = null;
  for (let i = 0; i < 2 && !pt; i++) pt = await translateEventFields(rec).catch(() => null);
  if (!pt) return { reason: 'PT translation failed' };
  let out: EventRecord = { ...rec, ...pt };
  if (process.env.IMGUR_CLIENT_ID) {
    const img = await acquireEventImage(out, { allowGenerated: false }).catch(() => null);
    if (img && img.status === 'imaged') out = { ...out, image: img.image };
  }
  out.description = humanizeText(out.description);
  return out;
}

function writeRecord(rec: EventRecord): boolean {
  const p = path.join(EVENTS_DIR, `${rec.slug}.json`);
  if (fs.existsSync(p)) return false;
  fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
  return true;
}

async function run() {
  ensureState();
  const write = flag('--write');
  const days = Number(opt('--days') ?? 60);
  const maxAuto = Number(opt('--max-auto') ?? 250);
  const now = new Date();
  // Never commit in the newsletter freeze (Wed 18:00 → Thu 23:59 UTC, except Thu before 07:30), e.g. a late catch-up run.
  if (write && inFreezeWindow(now) && !flag('--ignore-freeze')) {
    console.log('newsletter freeze window: nothing written');
    const out = opt('--out');
    if (out) writeJson(out, { ranAt: now.toISOString(), skipped: 'freeze window', digest: [] });
    return;
  }
  const today = lisbonToday(now);
  const from = today;
  const to = addDays(today, days);
  const window = { from, to };
  const weeklyState = readJson<Record<string, string>>(path.join(STATE, 'weekly.json'), {});
  const wanted = (opt('--sources')?.split(',') as SweepSource[] | undefined) ?? SOURCES.filter((s) =>
    !WEEKLY_SOURCES.includes(s) || flag('--weekly') || !weeklyState[s] || weeklyState[s] <= addDays(today, -7));
  const usage: ScanUsage = { geminiCalls: 0, promptTokens: 0, outputTokens: 0, imageGenerations: 0 };
  const stats: Partial<Record<SweepSource, SourceStat>> = {};
  const st = (s: SweepSource) => (stats[s] ??= emptyStat());
  const log: string[] = [];

  // 1. Collect
  const collected: SweepCandidate[] = [];
  await Promise.all(wanted.map(async (s) => {
    try {
      const got = await COLLECTORS[s](from, to, today);
      st(s).found = got.length;
      collected.push(...got);
      if (WEEKLY_SOURCES.includes(s)) weeklyState[s] = today;
    } catch (err) {
      st(s).error = err instanceof Error ? err.message : String(err);
    }
  }));

  // 2. Window, area, editorial filter
  const existing = listEvents();
  const knownVenues = new Set(existing.map((e) => e.venueSlug ?? canonicalVenueSlugFor(e.venue)));
  ['coliseu-porto-ageas', 'super-bock-arena', 'rivoli-theatre', 'teatro-campo-alegre', 'teatro-nacional-sao-joao', 'mosteiro-de-sao-bento-da-vitoria', 'teatro-carlos-alberto', 'hard-club', 'maus-habitos', 'plano-b', 'perola-negra', 'passos-manuel', 'batalha-centro-de-cinema', 'teatro-municipal-constantino-nery', 'gare-porto', 'switch', 'maria-pistolas', 'lottus', 'm-ou-co', 'lovers-lollypops', 'teatro-sa-da-bandeira', 'auditorio-municipal-de-gaia', 'teatro-do-bolhao', 'forum-da-maia', 'porta-jazz', 'serralves', 'casa-da-musica'].forEach((v) => knownVenues.add(v));
  const kept: SweepCandidate[] = [];
  const filteredOut: Array<{ c: SweepCandidate; why: string }> = [];
  for (const c of collected) {
    if (!inWindow(c, from, to)) continue;
    st(c.source).inWindow++;
    const why = portoAreaReason(c, knownVenues) ?? noiseReason(c);
    if (why) { st(c.source).filtered++; filteredOut.push({ c, why }); continue; }
    kept.push(c);
  }

  // 3. Sessions → runs; 4. across sources; 5. against data/events
  const collapsed = groupFestivalSessions(collapseSessions(kept));
  for (const c of collapsed) {
    const why = noiseReason(c); // a collapsed run can now exceed 120 days
    if (why) { st(c.source).filtered++; filteredOut.push({ c, why }); }
  }
  const clusters = mergeAcrossSources(collapsed.filter((c) => !noiseReason(c)));
  const fresh: SweepCluster[] = [];
  const dupMatches: Array<{ c: SweepCandidate; slug: string }> = [];
  for (const k of clusters) {
    const m = k.members.map((c) => existingMatch(c, existing)).find(Boolean);
    if (m) { for (const c of k.members) st(c.source).dup++; dupMatches.push({ c: k.primary, slug: m.slug }); continue; }
    fresh.push(k);
  }

  // 6. Route
  const failedState = readJson<Record<string, { reason: string; at: string }>>(path.join(STATE, 'verify-failed.json'), {});
  const reviewSeen = readJson<Record<string, string>>(path.join(STATE, 'review-seen.json'), {});
  const auto: SweepCluster[] = [];
  const review: ReviewItem[] = [];
  const keyOf = (c: SweepCandidate) => `${c.source}:${c.sourceId}`;
  const toReview = (c: SweepCandidate, reason: string) => {
    st(c.source).review++;
    review.push({ key: keyOf(c), source: c.source, name: c.name, date: c.date, endDate: c.endDate, venue: c.venue, url: c.url, reason, candidate: c });
  };
  for (const k of fresh) {
    const r = routeCandidate(k.primary, knownVenues);
    if (r.route === 'review') { toReview(k.primary, r.reason); continue; }
    const f = failedState[keyOf(k.primary)];
    if (f && f.at > addDays(today, -7)) { toReview(k.primary, `page check failed earlier: ${f.reason}`); continue; }
    auto.push(k);
  }
  auto.sort((a, b) => a.primary.date.localeCompare(b.primary.date));
  const autoNow = auto.slice(0, maxAuto);
  for (const k of auto.slice(maxAuto)) log.push(`deferred (max-auto): ${k.primary.name}`);

  // 7. Page check (+ PT, write) for auto candidates
  const published: Array<{ slug: string; name: string; date: string; venue: string; source: SweepSource; url: string }> = [];
  const accepted: EventRecord[] = [];
  const minLongWords = 40;
  const noCheck = flag('--no-check'); // collection test: skip the page check, list what would be checked
  await pool(autoNow, 4, async (k) => {
    const c = k.primary;
    if (noCheck) { published.push({ slug: '(unchecked)', name: c.name, date: c.date, venue: c.venue, source: c.source, url: c.url }); return; }
    const r = await verifyAndBuild(usage, c, window, minLongWords);
    if ('reason' in r) {
      if (FINAL_REJECT.test(r.reason)) { st(c.source).dropped++; log.push(`dropped ${c.name}: ${r.reason}`); return; }
      failedState[keyOf(c)] = { reason: r.reason.slice(0, 160), at: today };
      st(c.source).failed++;
      toReview(c, `page check: ${r.reason.slice(0, 80)}`);
      return;
    }
    // Same event under the page's own name? (existing + accepted this run)
    const dup = existingMatch({ ...c, name: r.rec.name, date: r.rec.date, endDate: r.rec.endDate }, [...existing, ...accepted]);
    if (dup) { st(c.source).dup++; dupMatches.push({ c, slug: dup.slug }); return; }
    accepted.push(r.rec);
    if (!write) { st(c.source).published++; published.push({ slug: r.rec.slug, name: r.rec.name, date: r.rec.date, venue: r.rec.venue, source: c.source, url: r.rec.externalLink ?? c.url }); return; }
    const full = await enrich(r.rec);
    if ('reason' in full) { st(c.source).failed++; log.push(`not written ${r.rec.slug}: ${full.reason}`); return; }
    if (!writeRecord(full)) { st(c.source).dup++; log.push(`slug exists: ${full.slug}`); return; }
    st(c.source).published++;
    published.push({ slug: full.slug, name: full.name, date: full.date, venue: full.venue, source: c.source, url: full.externalLink ?? c.url });
  });

  // 8. Digest: only review items not shown before; the rest is in the log.
  review.sort((a, b) => a.date.localeCompare(b.date));
  const newReview = review.filter((r) => !reviewSeen[r.key]);
  const SHOW = 25;
  const shown = newReview.slice(0, SHOW);
  const bySource: Partial<Record<SweepSource, number>> = {};
  for (const p of published) bySource[p.source] = (bySource[p.source] ?? 0) + 1;
  const notes: string[] = [];
  const zeroState = readJson<Record<string, number>>(path.join(STATE, 'zero-runs.json'), {});
  for (const s of wanted) {
    const z = st(s).error || st(s).found === 0;
    zeroState[s] = z ? (zeroState[s] ?? 0) + 1 : 0;
    if (zeroState[s] >= 2) notes.push(`⚠️ ${s} returned nothing ${zeroState[s]} runs in a row${st(s).error ? ` (${st(s).error!.slice(0, 120)})` : ''}: site change?`);
    else if (st(s).error) notes.push(`⚠️ ${s} failed today: ${st(s).error!.slice(0, 120)}`);
  }
  const digest = formatDigest(bySource, shown.map(({ name, date, endDate, venue, url }) => ({ name, date, endDate, venue, url })), notes, Math.max(0, newReview.length - SHOW));

  const summary = {
    ranAt: now.toISOString(), today, window, write, sources: wanted, stats, usage, httpRequests, firecrawlCredits,
    published, review: shown.map((r, i) => ({ n: i + 1, ...r })), reviewAll: review.map((r) => ({ key: r.key, name: r.name, date: r.date, venue: r.venue, url: r.url, reason: r.reason })),
    dupMatches: dupMatches.map(({ c, slug }) => ({ source: c.source, name: c.name, date: c.date, venue: c.venue, slug })),
    filteredOut: filteredOut.map(({ c, why }) => ({ source: c.source, name: c.name, date: c.date, venue: c.venue, why })),
    log, digest,
  };
  const out = opt('--out');
  if (out) writeJson(out, summary);
  if (write) {
    for (const r of shown) reviewSeen[r.key] = today;
    writeJson(path.join(STATE, 'review-seen.json'), reviewSeen);
    writeJson(path.join(STATE, 'verify-failed.json'), failedState);
    writeJson(path.join(STATE, 'weekly.json'), weeklyState);
    writeJson(path.join(STATE, 'zero-runs.json'), zeroState);
  }

  // Console report
  console.log(`window ${from} → ${to}  write=${write}  sources=${wanted.join(',')}`);
  console.log('source          found  inWin  filt   dup  publ  review  fail  drop  error');
  for (const s of wanted) {
    const x = st(s);
    console.log(`${s.padEnd(15)} ${String(x.found).padStart(5)} ${String(x.inWindow).padStart(6)} ${String(x.filtered).padStart(5)} ${String(x.dup).padStart(5)} ${String(x.published).padStart(5)} ${String(x.review).padStart(7)} ${String(x.failed).padStart(5)} ${String(x.dropped).padStart(5)}  ${x.error ?? ''}`);
  }
  console.log(`auto ${auto.length} (checked ${autoNow.length}), review ${review.length} (${newReview.length} new), published ${published.length}; gemini ${usage.geminiCalls} calls, http ${httpRequests}, firecrawl ${firecrawlCredits}`);
  console.log('\nDIGEST:\n' + digest.join('\n---\n'));
}

// ---------------------------------------------------------------- add (owner picked review items)
async function add(file: string, picks: string) {
  ensureState();
  const s = readJson<{ review: Array<{ n: number; candidate: SweepCandidate }>; window: { from: string; to: string } }>(file, { review: [], window: { from: '', to: '' } });
  const nums = picks.split(/[ ,]+/).map(Number).filter(Boolean);
  const existing = listEvents();
  const usage: ScanUsage = { geminiCalls: 0, promptTokens: 0, outputTokens: 0, imageGenerations: 0 };
  const today = lisbonToday();
  const window = { from: today, to: addDays(today, 120) };
  const results: Array<{ n: number; slug?: string; reason?: string }> = [];
  for (const n of nums) {
    const item = s.review.find((r) => r.n === n);
    if (!item) { results.push({ n, reason: 'no such item' }); continue; }
    const c = item.candidate;
    const dup = existingMatch(c, existing);
    if (dup) { results.push({ n, reason: `already listed (${dup.slug})` }); continue; }
    const r = await verifyAndBuild(usage, c, { from: addDays(window.from, -400), to: window.to }, 25);
    if ('reason' in r) { results.push({ n, reason: r.reason }); continue; }
    const full = await enrich(r.rec);
    if ('reason' in full) { results.push({ n, reason: full.reason }); continue; }
    if (!writeRecord(full)) { results.push({ n, reason: `slug exists (${full.slug})` }); continue; }
    existing.push(full);
    results.push({ n, slug: full.slug });
  }
  console.log(JSON.stringify({ results }, null, 2));
}

if (require.main === module) {
  const mode = argv[0];
  const p = mode === 'run' ? run() : mode === 'add' && argv[1] && argv[2] ? add(argv[1], argv[2]) : null;
  if (!p) { console.error('usage: source-sweep.ts run [--write] [--days N] [--sources a,b] [--weekly] [--state DIR] [--out f.json] | add <summary.json> 1,3'); process.exit(2); }
  p.catch((err) => { console.error(err); process.exit(1); });
}

export { parseAgendaCards, parseShotgun, parseSerralves, parseCdm };
