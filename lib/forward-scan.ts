/**
 * Forward event scan — publish notable Porto events from tomorrow to 10 weeks ahead.
 *
 * Owner priority (2026-10-18, backlog #20): event pages only appeared in the
 * week an event happened, but searches peak weeks before it. This runs
 * outside the Thursday pipeline (daily, see cron-forward-scan.yml):
 *
 * 2026-10-23 (owner): "almost a daily thing now" — the window starts tomorrow
 * (was: after the next edition's week), so events the Thursday edition missed
 * still reach the site. A third search covers the next two weeks only, using
 * what's-on guides (Porto Expats) as leads; those candidates are verified first.
 *
 *   1. Discover — three grounded Gemini searches list candidate events in the
 *      window, each with an official URL.
 *   2. Dedupe — against every event already in the repo (fuzzy name + date
 *      or venue), so long runs and Thursday-extracted events aren't repeated.
 *   3. Verify — fetch the page ourselves (the search's own grounding sources
 *      first, then the model-written URL) and let Gemini read ONLY that page,
 *      with its JSON-LD Event data up front. Accepted only if the page states
 *      name, date and venue: the quoted strings must literally occur in the
 *      fetched text, the date quote must carry the day of the month and agree
 *      with the JSON-LD. Social media / aggregators rejected. Copy that talks
 *      about the page or runs under 60 words is rejected as thin.
 *      Every fact on the record (price, description) comes from that page.
 *   4. Enrich fully before committing — long description (from the page),
 *      PT translation, image. An event that can't be fully enriched is
 *      dropped (retried next run), so the Thursday enrichment crons — which
 *      pick the latest-dated un-enriched events first, 3 images per pass —
 *      never get crowded by forward events.
 *
 * Writes only data/events/*.json (deferred; published by deploy-flush at
 * 21:00 UTC). sourceEdition is FORWARD_SOURCE, so the archive, Instagram and
 * pick-history code — all keyed on a real edition slug — ignore these.
 */

import {
  type EventRecord,
  type EventCategory,
  composeEventSlug,
  venueToSlug,
  isRealEventUrl,
  FORWARD_SOURCE,
} from './events';
import { acquireEventImage, translateEventFields } from './events-pipeline';
import { lookup } from 'node:dns/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const MAX_VERIFY = 12; // candidates fetched + read per run
const MAX_ACCEPT = 5;  // events enriched + committed per run
const CATEGORIES: EventCategory[] = ['music', 'art', 'food', 'family', 'nightlife', 'sports', 'other'];
const PORTO_AREA = /porto|gaia|matosinhos|maia|gondomar|le[cç]a|valongo|espinho/i;

// Not the organiser, a venue or a ticket seller — never a source of facts.
const BLOCKED_HOSTS = /(^|\.)(facebook|instagram|x|twitter|tiktok|youtube|wikipedia|tripadvisor|timeout|portosecreto|portoexpats|allevents|songkick|bandsintown|reddit|google|vertexaisearch\.cloud\.google)\.[a-z.]+$/i;

export interface ScanUsage {
  geminiCalls: number;
  promptTokens: number;
  outputTokens: number;
  imageGenerations: number;
}

/** Where candidate URLs came from (#22a): is the grounding search returning, resolving and matching pages? */
export interface SourceStats {
  /** Grounding chunks returned by the discovery searches. */
  returned: number;
  /** Of those, redirects resolved to a fetchable (non-blocked) page. */
  resolved: number;
  /** Candidates with at least one matching grounding source. */
  matched: number;
  /** Model URLs dropped as listing/search pages (#22c). */
  listingUrls: number;
  /** Model URLs dropped because the host doesn't resolve in DNS (#22d). */
  deadHosts: string[];
  /** Model URLs dropped as guesses: the search returned other pages on that host, not this one (#25b). */
  guessedUrls: number;
  /** Candidates that had no usable URL and got one from the rescue search (#22e). */
  rescued: number;
  /** #23: what each grounded call's metadata held (returned was 0 on 2026-10-23). */
  grounding: { calls: number; withMetadata: number; withQueries: number; withChunks: number; withSupports: number };
}

export interface ScanResult {
  window: { from: string; to: string };
  sources: SourceStats;
  discovered: number;
  duplicates: number;
  verified: number;
  rejected: Array<{ name: string; reason: string }>;
  accepted: EventRecord[];
  usage: ScanUsage;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Window: tomorrow to +70 days. Events the Thursday edition also picks up are
 * merged by identity (events-pipeline dedup pass 2), so overlap is harmless.
 */
export function scanWindow(now: Date = new Date()): { from: string; to: string } {
  const today = now.toISOString().slice(0, 10);
  return { from: addDays(today, 1), to: addDays(today, 70) };
}

/** Last day of the near-term search (the next two weeks). */
const NEAR_DAYS = 14;
export const nearEnd = (window: { from: string; to: string }) => {
  const end = addDays(window.from, NEAR_DAYS - 1);
  return end < window.to ? end : window.to;
};

/** Wed 18:00 → Thu 23:59 UTC: the newsletter's window. Never commit then. */
export function inFreezeWindow(now: Date = new Date()): boolean {
  const wd = now.getUTCDay();
  return wd === 4 || (wd === 3 && now.getUTCHours() >= 18);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function gemini(
  usage: ScanUsage,
  prompt: string,
  opts: { search?: boolean; json?: boolean; timeoutMs: number; sources?: string[]; grounding?: SourceStats['grounding'] }
): Promise<string> {
  usage.geminiCalls++;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(opts.search ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          temperature: 0,
          ...(opts.json ? { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  usage.promptTokens += data?.usageMetadata?.promptTokenCount ?? 0;
  usage.outputTokens += (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0);
  // Pages the search actually returned (redirect URIs; see resolveSources).
  const gm = data?.candidates?.[0]?.groundingMetadata;
  const g = opts.grounding;
  if (g) {
    g.calls++;
    if (gm) g.withMetadata++;
    if (gm?.webSearchQueries?.length) g.withQueries++;
    if (gm?.groundingChunks?.length) g.withChunks++;
    if (gm?.groundingSupports?.length) g.withSupports++;
  }
  for (const ch of gm?.groundingChunks ?? []) {
    if (typeof ch?.web?.uri === 'string') opts.sources?.push(ch.web.uri);
  }
  return (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
}

function parseJson<T>(text: string, open: '[' | '{'): T | null {
  const close = open === '[' ? ']' : '}';
  const a = text.indexOf(open);
  const b = text.lastIndexOf(close);
  if (a < 0 || b < a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Discover
// ---------------------------------------------------------------------------

interface Candidate {
  name: string;
  venue: string;
  date: string;
  endDate?: string;
  url: string;
  category?: string;
  /** Pages to try, best first: grounding sources matching this event, then the model's URL. */
  urls: string[];
  /** Host of a dropped listing-page URL: the rescue search looks there first. */
  hintHost?: string;
}

const DISCOVERY_FOCUS = [
  'concerts and music (Casa da Música, Coliseu Porto, Super Bock Arena, Hard Club, Teatro Sá da Bandeira, Casa das Artes and others), DJ / club nights with announced line-ups, and festivals',
  'exhibition openings (Serralves, Centro Português de Fotografia, Galeria Municipal, Casa Comum and galleries), theatre and dance (Teatro Nacional São João, Teatro Rivoli, Teatro Campo Alegre), family events, food and wine events, Christmas markets, sports events and races',
];

// Near-term search (next two weeks only). Guides are leads, never sources:
// the url must still be the event's own page, and verify() rejects anything else.
const NEAR_FOCUS = `anything notable in these two weeks — seasonal and holiday parties, quiz nights, community meetups, markets, club nights, concerts, theatre, family activities. Weekly what's-on guides such as the Porto Expats weekly guide (portoexpats.substack.com) and Porto Secreto's weekend and monthly round-ups (portosecreto.co) are good places to find candidates, but the "url" must be the event's own page, never the guide`;

const isFetchable = (url: string) => isRealEventUrl(url) && !BLOCKED_HOSTS.test(new URL(url).hostname) && !isListingUrl(url);

// Venue agendas and search results list many events, so the reader rejects
// them ("page does not confirm the event"); 2026-10-23 dry run: 7 of 12
// candidates pointed at hardclubporto.com/agenda or coliseu.pt/agenda.
const LISTING_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:agenda|eventos?|events?|programa(?:cao|ção)?|program(?:me)?|calend[aá]rio|calendar|bilheteira|tickets?|pesquisa|procurar|search|espetaculos|espectaculos|concertos|shows|whats-on|what-s-on)?\/?$/i;
const SEARCH_QUERY = /[?&](?:q|s|search|query|pesquisa|keyword)=/i;
// #25a: Fever's single events live at /m/<id>; anything else (/porto/candlelight)
// is a collection hub. 2026-10-24: a Candlelight concert got "verified" from one.
const isHubPage = (u: URL) => /(^|\.)feverup\.com$/i.test(u.hostname) && !/\/m\/\d+/.test(u.pathname);
export function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return LISTING_PATH.test(u.pathname) || /\/(?:pesquisa|search)(?:\/|$)/i.test(u.pathname) || SEARCH_QUERY.test(u.search) || isHubPage(u);
  } catch {
    return true;
  }
}

/** Hosts that don't resolve (#22d): the model invents domains (www.teatrosabandeira.com, 2026-10-21). */
async function deadHosts(urls: string[]): Promise<Set<string>> {
  const hosts = Array.from(new Set(urls.map((u) => { try { return new URL(u).hostname; } catch { return ''; } }).filter(Boolean)));
  const dead = new Set<string>();
  await Promise.all(hosts.map(async (h) => {
    try {
      await lookup(h);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOTFOUND' || code === 'ENODATA') dead.add(h);
    }
  }));
  return dead;
}
const bareHost = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, '');
const samePage = (a: string, b: string) => {
  const key = (u: string) => { const x = new URL(u); return bareHost(u) + x.pathname.replace(/\/+$/, '').toLowerCase(); };
  return key(a) === key(b);
};

/**
 * #25b: the search returned pages on this host but not this one, so the model
 * built the path itself (casadamusica.com/agenda/<slug>/<id>, hardclubporto.com
 * /event/<slug>/ all 404'd on 2026-10-24). Use the sources / rescue instead.
 */
export function isGuessed(url: string, sources: string[]): boolean {
  const host = bareHost(url);
  const onHost = sources.filter((s) => bareHost(s) === host);
  return onHost.length > 0 && !onHost.some((s) => samePage(s, url));
}

/**
 * Grounding chunks are vertexaisearch redirect URIs; read the Location header
 * to get the real page. Model-written URLs are often guessed paths (21 of 22
 * rejections on 2026-10-20 were unfetchable), the sources really exist.
 */
export async function resolveSources(uris: string[]): Promise<string[]> {
  const resolved = await Promise.all(Array.from(new Set(uris)).map(async (uri) => {
    try {
      const res = await fetch(uri, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      const loc = res.headers.get('location');
      return loc ? new URL(loc, uri).toString() : null;
    } catch {
      return null;
    }
  }));
  return Array.from(new Set(resolved.filter((u): u is string => !!u && isFetchable(u))));
}

/** Sources that look like this event's page (shares a name token in the path), same host first. */
export function urlsFor(c: { name: string; url: string }, sources: string[]): string[] {
  const tokens = Array.from(nameTokens(c.name)).filter((t) => t.length > 2);
  const modelOk = isRealEventUrl(c.url) && isFetchable(c.url);
  const scored = sources
    .map((s) => {
      let path = new URL(s).pathname;
      try { path = decodeURIComponent(path); } catch { /* keep encoded */ }
      path = venueToSlug(path.replace(/[/,]+/g, ' ')); // venueToSlug cuts at the first "/" or ","
      const hits = tokens.filter((t) => path.includes(t)).length;
      const sameHost = modelOk && bareHost(s) === bareHost(c.url);
      return { s, score: hits === 0 ? 0 : hits + (sameHost ? 10 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
  const urls = modelOk ? [...scored.filter((s) => s !== c.url), c.url] : scored;
  // The model's exact URL, when the search returned it too, is the best bet.
  if (modelOk && sources.includes(c.url)) urls.unshift(...urls.splice(urls.indexOf(c.url), 1));
  return urls.slice(0, 3);
}

async function discover(usage: ScanUsage, window: { from: string; to: string }, stats: SourceStats): Promise<Candidate[]> {
  const searches = [
    ...DISCOVERY_FOCUS.map((focus) => ({ focus, from: window.from, to: window.to })),
    { focus: NEAR_FOCUS, from: window.from, to: nearEnd(window) },
  ];
  const lists = await Promise.all(searches.map(async ({ focus, from, to }) => {
    // #23: plain sentences, not JSON. Gemini attaches grounding chunks (the
    // pages it actually found) to prose it can attribute; JSON-only replies
    // came back with none (2026-10-23), leaving only model-written URLs.
    const prompt = `Using web search, find notable public events in Porto, Portugal (including Vila Nova de Gaia and Matosinhos) that START between ${from} and ${to}.
Focus: ${focus}.

Only include an event if you found its official page: the organiser's or venue's own page for THAT ONE event, or its ticketing page (e.g. ticketline.pt, bol.pt, blueticket.pt, seetickets, feverup.com, casadamusica.com, coliseu.pt) — never a venue's agenda/programme page, a search page, a homepage, a news article, blog, listing site or social-media post. Up to 15 events.

For each event write one plain sentence, one per line, stating its name, venue, start date (and end date if it runs several days), what kind of event it is, and the address of its official page exactly as it appeared in your search results (never a guessed or constructed address). If you find none, write NONE.`;
    try {
      const raw: string[] = [];
      const found = await gemini(usage, prompt, { search: true, timeoutMs: 90_000, sources: raw, grounding: stats.grounding });
      const list = /^\s*NONE\s*$/i.test(found) ? [] : await structure(usage, found);
      const sources = await resolveSources(raw);
      stats.returned += raw.length;
      stats.resolved += sources.length;
      const valid = list.filter((c) => c && typeof c.name === 'string' && typeof c.venue === 'string');
      const modelUrls = valid.map((c) => (typeof c.url === 'string' && isRealEventUrl(c.url) ? c.url : '')).filter(Boolean);
      const dead = await deadHosts(modelUrls);
      return valid.map((c) => {
        let url = typeof c.url === 'string' ? c.url : '';
        let hintHost: string | undefined;
        if (url && isRealEventUrl(url)) {
          const host = new URL(url).hostname;
          if (dead.has(host)) { stats.deadHosts.push(host); url = ''; }
          else if (isListingUrl(url)) { stats.listingUrls++; hintHost = host.replace(/^www\./, ''); url = ''; }
          else if (isGuessed(url, sources)) { stats.guessedUrls++; hintHost = bareHost(url); url = ''; }
        }
        const urls = urlsFor({ name: c.name, url }, sources);
        if (urls.some((u) => u !== url)) stats.matched++;
        return { ...c, url, urls, hintHost };
      });
    } catch (err) {
      console.warn('[forward-scan] discovery failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }));
  // Candidates without a usable URL are kept for the rescue search.
  return lists.flat().filter((c) =>
    /^\d{4}-\d{2}-\d{2}$/.test(c.date ?? '') &&
    c.date >= window.from && c.date <= window.to
  );
}

/** Turns the search's sentences into candidates. No search: it may only copy what the text says. */
async function structure(usage: ScanUsage, text: string): Promise<Candidate[]> {
  const prompt = `Convert this list of events into JSON. Copy only what the text states: dates as YYYY-MM-DD, endDate null when not given, "url" exactly as written in the text or "" when none is given — never invent or fix one.

${text.slice(0, 12_000)}

Reply with a JSON array:
[{"name":"…","venue":"…","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","url":"https://… or empty","category":"music|art|food|family|nightlife|sports|other"}]`;
  return parseJson<Candidate[]>(await gemini(usage, prompt, { json: true, timeoutMs: 45_000 }), '[') ?? [];
}

/**
 * #22e: one grounded search for the events whose URL was a listing page, a
 * dead host or missing — "find this event's own page", preferring the host we
 * already know. Only grounding sources count (never a model-written URL), so
 * every URL here really came back from the search.
 */
async function rescueUrls(usage: ScanUsage, cands: Candidate[], grounding: SourceStats['grounding']): Promise<number> {
  if (cands.length === 0) return 0;
  const lines = cands.map((c, i) => {
    const host = c.hintHost;
    return `${i + 1}. "${c.name}" at ${c.venue}, Porto, ${c.date}${host ? ` (try site:${host})` : ''}`;
  }).join('\n');
  const prompt = `Using web search, find the official detail page (the organiser's, venue's or ticket seller's page for that ONE event — not an agenda, listing or search page) for each of these Porto events:
${lines}

For each event write one plain sentence naming it, its date and venue, and the page you found for it (or that you found none). The pages themselves are taken from your search results.`;
  const raw: string[] = [];
  try {
    await gemini(usage, prompt, { search: true, timeoutMs: 60_000, sources: raw, grounding });
  } catch (err) {
    console.warn('[forward-scan] rescue search failed:', err instanceof Error ? err.message : err);
    return 0;
  }
  const sources = await resolveSources(raw);
  let rescued = 0;
  for (const c of cands) {
    const urls = urlsFor({ name: c.name, url: '' }, sources);
    if (urls.length) { c.urls = urls; rescued++; }
  }
  return rescued;
}

// ---------------------------------------------------------------------------
// 2. Dedupe
// ---------------------------------------------------------------------------

const STOP = new Set(['the', 'a', 'and', 'of', 'in', 'at', 'porto', 'o', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'live', 'tour', 'festival', 'concert', 'concerto', 'exhibition', 'exposicao']);
function nameTokens(name: string): Set<string> {
  return new Set(venueToSlug(name).split('-').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d{4}$/.test(t)));
}
function similarNames(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return venueToSlug(a) === venueToSlug(b);
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  const small = Math.min(ta.size, tb.size);
  return inter / (ta.size + tb.size - inter) >= 0.6 || (inter === small && small >= 2) || (inter === small && ta.size === tb.size);
}
const day = (iso: string) => iso.slice(0, 10);
function overlaps(a: { date: string; endDate?: string | null }, b: { date: string; endDate?: string | null }, slackDays = 3): boolean {
  return day(a.date) <= addDays(day(b.endDate || b.date), slackDays) && day(b.date) <= addDays(day(a.endDate || a.date), slackDays);
}

/** True when `c` is already published (or already accepted this run). */
export function isDuplicate(c: { name: string; venue: string; date: string; endDate?: string | null }, existing: EventRecord[]): boolean {
  return existing.some((e) =>
    similarNames(c.name, e.name) &&
    (overlaps(c, e) || venueToSlug(c.venue) === e.venueSlug)
  );
}

// ---------------------------------------------------------------------------
// 3. Verify against the fetched page
// ---------------------------------------------------------------------------

interface LdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  city?: string;
  price?: string;
  description?: string;
}

/** schema.org Event objects (MusicEvent, TheaterEvent, …) from the page's JSON-LD. */
function ldEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? decodeEntities(v).trim() : typeof v === 'number' ? String(v) : undefined);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o['@type'] ?? []).map(String);
    if (types.some((t) => /Event$/.test(t)) && str(o.startDate)) {
      const loc = ([] as unknown[]).concat(o.location ?? [])[0] as Record<string, unknown> | undefined;
      const addr = loc?.address as Record<string, unknown> | string | undefined;
      const offer = ([] as unknown[]).concat(o.offers ?? [])[0] as Record<string, unknown> | undefined;
      out.push({
        name: str(o.name),
        startDate: str(o.startDate),
        endDate: str(o.endDate),
        venue: str(loc?.name),
        city: typeof addr === 'string' ? str(addr) : str(addr?.addressLocality),
        price: str(offer?.price ?? offer?.lowPrice),
        description: str(o.description)?.replace(/<[^>]+>/g, ' ').slice(0, 2_000),
      });
    }
    if (o['@graph']) walk(o['@graph']);
  };
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try { walk(JSON.parse(m[1])); } catch { /* malformed JSON-LD: ignore */ }
  }
  return out;
}

type Page = { text: string; finalUrl: string; ld: LdEvent[] };

export async function fetchPageText(url: string): Promise<Page | { reason: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { reason: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { reason: `not HTML (${type.split(';')[0] || 'no type'})` };
    const html = await res.text();
    const ld = ldEvents(html);
    // JSON-LD often carries the date on JS-rendered ticket pages: put it first,
    // as plain fields the reader can quote.
    const ldText = ld.map((e) =>
      `Event data: ${[['name', e.name], ['startDate', e.startDate], ['endDate', e.endDate], ['location', e.venue], ['city', e.city], ['price', e.price], ['description', e.description]]
        .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ')}.`);
    const body = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    const text = [...ldText, decodeEntities(body)].join(' ').replace(/\s+/g, ' ').trim().slice(0, 40_000);
    return text.length > 200 ? { text, finalUrl: res.url || url, ld } : { reason: `only ${text.length} chars of text` };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') return { reason: 'timeout' };
    // undici hides the real cause ("fetch failed"): ECONNRESET = likely a bot
    // block, ENOTFOUND = no such host, UND_ERR_* = TLS/socket problems.
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause?.code ?? cause?.message;
    return { reason: `fetch error (${err instanceof Error ? err.message : err}${detail ? `: ${detail}` : ''})` };
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

interface PageFacts {
  isEventPage: boolean;
  sourceType: 'organiser' | 'venue' | 'ticketing' | 'other';
  name: string;
  nameQuote: string;
  date: string;
  time?: string | null;
  endDate?: string | null;
  dateQuote: string;
  venue: string;
  venueQuote: string;
  city: string;
  price?: string | null;
  priceFrom?: number | null;
  category: EventCategory;
  description: string;
  longDescription: string;
}

const MIN_LONG_WORDS = 60;
export const META_COPY = /\b(?:the|this) (?:web ?)?(?:page|site|website|webpage|listing|text)\b|\bweb ?page\b|\b(?:is|are|was|were) not (?:mentioned|stated|specified|provided|given|listed)\b|\bno (?:further |other |more )?(?:details|information) (?:is |are )?(?:given|provided|available|stated)\b/i;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

async function verify(
  usage: ScanUsage,
  c: Candidate,
  window: { from: string; to: string }
): Promise<{ facts: PageFacts; url: string } | { reason: string }> {
  let page: Page | null = null;
  const failures: string[] = [];
  for (const url of c.urls) {
    const r = await fetchPageText(url);
    if ('reason' in r) { failures.push(`${url} → ${r.reason}`); continue; }
    if (BLOCKED_HOSTS.test(new URL(r.finalUrl).hostname)) { failures.push(`${url} → redirected to ${r.finalUrl}`); continue; }
    page = r;
    break;
  }
  if (!page) return { reason: `page not fetchable: ${failures.join(' | ')}` };

  const prompt = `Below is the text of one web page (${page.finalUrl}). We think it is the official page for "${c.name}" at ${c.venue}, Porto, on ${c.date}. Do NOT trust that — use ONLY what the page text says. No outside knowledge.

Reply with ONLY this JSON object:
{
  "isEventPage": true if the page is about this one event (not a list of many events, not a news article),
  "sourceType": "organiser" | "venue" | "ticketing" | "other",
  "name": event name as the page gives it,
  "nameQuote": the name copied EXACTLY from the page text,
  "date": "YYYY-MM-DD" first (or only) date per the page,
  "time": "HH:MM" start time if the page states it, else null,
  "endDate": "YYYY-MM-DD" if the page gives a multi-day run, else null,
  "dateQuote": the shortest passage copied EXACTLY from the page that states the date (e.g. "21 NOV 2026" or "Sábado, 21 de novembro"),
  "venue": venue name per the page,
  "venueQuote": the venue name copied EXACTLY from the page text,
  "city": city per the page or venue,
  "price": price as displayed on the page ("€25", "€15–€30", "Free"), else null,
  "priceFrom": lowest numeric price in EUR if stated, else null,
  "category": "music" | "art" | "food" | "family" | "nightlife" | "sports" | "other",
  "description": 1–2 factual English sentences on what the event is, only from the page. No adjectives like "unmissable", "vibrant", "stunning".,
  "longDescription": 2–3 short English paragraphs separated by a blank line, 120–220 words, neutral and factual, ONLY facts stated on the page (who performs or exhibits, the format, the date, venue, ticket details). If the page says little, write less. No invented history, transport tips or opinions.
}
Write about the event itself, never about the page, the website or what it does or does not mention.
If the page does not state the event's date and venue, set "isEventPage": false.

PAGE TEXT:
${page.text}`;

  let facts: PageFacts | null;
  try {
    facts = parseJson<PageFacts>(await gemini(usage, prompt, { json: true, timeoutMs: 40_000 }), '{');
  } catch (err) {
    return { reason: `reader failed: ${err instanceof Error ? err.message : err}` };
  }
  if (!facts || !facts.isEventPage) return { reason: `page does not confirm the event (${page.finalUrl})` };
  if (facts.sourceType === 'other') return { reason: `not an organiser/venue/ticketing page (${page.finalUrl})` };

  // Anti-hallucination: the quotes must really be on the page.
  const text = norm(page.text);
  for (const [k, q] of [['name', facts.nameQuote], ['date', facts.dateQuote], ['venue', facts.venueQuote]] as const) {
    if (!q || norm(q).length < 3 || !text.includes(norm(q))) return { reason: `${k} quote not on page` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(facts.date ?? '')) return { reason: 'no date' };
  const dom = String(Number(facts.date.slice(8, 10)));
  if (!new RegExp(`(^|\\D)0?${dom}(\\D|$)`).test(facts.dateQuote)) return { reason: 'date quote lacks the day' };
  if (facts.date < window.from || facts.date > window.to) return { reason: `date ${facts.date} outside window` };
  if (facts.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(facts.endDate) || facts.endDate < facts.date)) facts.endDate = null;
  if (!PORTO_AREA.test(`${facts.city} ${facts.venue}`)) return { reason: `not in the Porto area (${facts.city})` };
  if (!CATEGORIES.includes(facts.category)) facts.category = 'other';
  if (!facts.description?.trim() || !facts.longDescription?.trim()) return { reason: 'no description' };

  // Structured data is the page's own statement of the date: it must agree.
  const ld = page.ld.filter((e) => e.name && similarNames(e.name, facts!.name));
  if (ld.length === 1 && ld[0].startDate && day(ld[0].startDate) !== facts.date) {
    return { reason: `date ${facts.date} disagrees with JSON-LD ${day(ld[0].startDate)}` };
  }

  // JS-rendered pages leave the reader little to go on; it then describes the
  // page instead of the event ("The page is about an event named…", 2026-10-20).
  const copy = `${facts.description} ${facts.longDescription}`;
  if (META_COPY.test(copy)) return { reason: `meta copy: "${copy.match(META_COPY)![0]}"` };
  const words = facts.longDescription.split(/\s+/).filter(Boolean).length;
  if (words < MIN_LONG_WORDS) return { reason: `thin copy (${words} words)` };
  return { facts, url: page.finalUrl };
}

// ---------------------------------------------------------------------------
// 4. Enrich + assemble
// ---------------------------------------------------------------------------

async function toRecord(usage: ScanUsage, facts: PageFacts, url: string, enrich: boolean): Promise<EventRecord | { reason: string }> {
  const date = facts.time && /^\d{2}:\d{2}$/.test(facts.time) ? `${facts.date}T${facts.time}` : facts.date;
  const priceFrom = typeof facts.priceFrom === 'number' && facts.priceFrom > 0 ? facts.priceFrom : undefined;
  const base: EventRecord = {
    slug: composeEventSlug(facts.name, facts.venue, facts.date),
    name: facts.name.trim(),
    date,
    endDate: facts.endDate && facts.endDate !== facts.date ? facts.endDate : undefined,
    venue: facts.venue.trim(),
    venueSlug: venueToSlug(facts.venue),
    price: facts.price?.trim() || undefined,
    priceFrom,
    currency: priceFrom != null ? 'EUR' : undefined,
    category: facts.category,
    description: facts.description.trim(),
    longDescription: facts.longDescription.trim(),
    sourceEdition: FORWARD_SOURCE,
    externalLink: url,
    addedAt: new Date().toISOString(),
  };
  if (!enrich) return base; // local test only: skips PT + image (Imgur, image generation)

  const [pt, img] = await Promise.all([
    (async () => { usage.geminiCalls++; return translateEventFields(base); })().catch(() => null),
    acquireEventImage(base).catch(() => null),
  ]);
  if (!pt) return { reason: 'translation failed' };
  if (!img || (img.status !== 'imaged' && img.status !== 'generated')) return { reason: `no image (${img?.status ?? 'error'})` };
  if (img.status === 'generated') usage.imageGenerations++;
  return { ...base, ...pt, image: img.image };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export async function runForwardScan(
  existing: EventRecord[],
  now: Date = new Date(),
  deadline = Date.now() + 240_000,
  opts: { enrich?: boolean } = {}
): Promise<ScanResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const usage: ScanUsage = { geminiCalls: 0, promptTokens: 0, outputTokens: 0, imageGenerations: 0 };
  const window = scanWindow(now);
  const rejected: ScanResult['rejected'] = [];
  const sources: SourceStats = {
    returned: 0, resolved: 0, matched: 0, listingUrls: 0, deadHosts: [], guessedUrls: 0, rescued: 0,
    grounding: { calls: 0, withMetadata: 0, withQueries: 0, withChunks: 0, withSupports: 0 },
  };

  const discovered = await discover(usage, window, sources);
  const known = [...existing];
  const fresh: Candidate[] = [];
  let duplicates = 0;
  for (const c of discovered) {
    if (isDuplicate(c, known)) { duplicates++; continue; }
    fresh.push(c);
    // Count it as known so the second discovery list can't repeat it.
    known.push({ ...c, slug: '', venueSlug: venueToSlug(c.venue), category: 'other', description: '', sourceEdition: FORWARD_SOURCE, addedAt: '' });
  }

  // The next two weeks first: those pages can't wait for a later run.
  const near = nearEnd(window);
  fresh.sort((a, b) => Number(a.date > near) - Number(b.date > near));

  // Rescue URLs only for the candidates we'd actually check this run.
  const head = fresh.slice(0, MAX_VERIFY);
  const noUrl = head.filter((c) => c.urls.length === 0);
  sources.rescued = await rescueUrls(usage, noUrl, sources.grounding);
  for (const c of noUrl) if (c.urls.length === 0) rejected.push({ name: c.name, reason: 'no usable URL (listing page, dead host or none; rescue search found nothing)' });
  const toVerify = fresh.filter((c) => c.urls.length > 0).slice(0, MAX_VERIFY);
  const verified: Array<{ facts: PageFacts; url: string }> = [];
  for (let i = 0; i < toVerify.length && Date.now() < deadline - 90_000; i += 6) {
    const batch = await Promise.all(toVerify.slice(i, i + 6).map((c) => verify(usage, c, window)));
    batch.forEach((r, j) => {
      if ('reason' in r) rejected.push({ name: toVerify[i + j].name, reason: r.reason });
      else verified.push(r);
    });
  }

  // The page's own name/date can differ from discovery's: dedupe again.
  const keep: Array<{ facts: PageFacts; url: string }> = [];
  for (const v of verified) {
    if (isDuplicate(v.facts, existing) || keep.some((k) => similarNames(k.facts.name, v.facts.name) && overlaps(k.facts, v.facts))) {
      duplicates++;
      continue;
    }
    keep.push(v);
  }

  const accepted: EventRecord[] = [];
  if (Date.now() < deadline - 60_000) {
    const enrich = opts.enrich ?? true;
    const built = await Promise.all(keep.slice(0, MAX_ACCEPT).map((v) => toRecord(usage, v.facts, v.url, enrich)));
    built.forEach((r, j) => {
      if ('reason' in r) rejected.push({ name: keep[j].facts.name, reason: r.reason });
      else accepted.push(r);
    });
  }

  return { window, sources, discovered: discovered.length, duplicates, verified: verified.length, rejected, accepted, usage };
}
