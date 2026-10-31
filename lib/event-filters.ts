/**
 * Search + filters on the events listings (owner 2026-10-31): text search,
 * free, today, this weekend, kids & family, category, area and price band.
 *
 * Filtering runs in the browser (app/components/EventFilters.tsx) over the
 * list the server already rendered, so every hub stays a complete, indexable
 * page. State lives in the query string (?q=fado&area=ribeira&price=free) so
 * a filtered view is a shareable link; the canonical tags keep pointing at
 * the unfiltered page.
 *
 * Pure module with no imports: it is bundled client-side. The Porto date
 * helpers live here for the same reason (lib/event-days.ts re-exports them).
 * Tests: npm run test:filters.
 */

// ---------------------------------------------------------------------------
// Porto dates
// ---------------------------------------------------------------------------

export type DayHubKind = 'today' | 'weekend';

/** ISO date (YYYY-MM-DD) in Porto. */
export function portoToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(now);
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = Sun

/**
 * Date range a page covers. The weekend is Fri–Sun: the coming one Mon–Thu,
 * the current one from today on Fri–Sun (Saturday shows Sat–Sun).
 */
export function dayHubRange(kind: DayHubKind, now: Date = new Date()): { from: string; to: string } {
  const today = portoToday(now);
  if (kind === 'today') return { from: today, to: today };
  const wd = weekday(today);
  if (wd === 0) return { from: today, to: today };
  if (wd >= 5) return { from: today, to: addDays(today, 7 - wd) };
  return { from: addDays(today, 5 - wd), to: addDays(today, 7 - wd) };
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export type PriceBand = 'free' | 'under-15' | '15-30' | 'over-30';
export const PRICE_BANDS: PriceBand[] = ['free', 'under-15', '15-30', 'over-30'];

/** "Free", "Free entry", "Entrada livre", "Gratuito"; not "Mostly free" or "Free with ticket". */
export function isFreePrice(price: string | undefined): boolean {
  if (!price) return false;
  const p = price.trim().toLowerCase();
  if (/^free\s*(with|&)/.test(p)) return false;
  return /^(free|entrada (livre|gratuita)|gr[aá]tis|gratuit[oa])/.test(p);
}

/**
 * Lowest euro amount in a price: priceFrom when the record has it, else the
 * first number in the text ("€22,00 – €26,00" → 22, "20€ – 60€" → 20,
 * "35 - 100 EUR" → 35). Null for "Ticketed", "Varies" and other non-prices.
 */
export function lowestPrice(price: string | undefined, priceFrom?: number): number | null {
  if (priceFrom != null && Number.isFinite(priceFrom)) return priceFrom;
  if (!price) return null;
  if (/US\$|\$|£/.test(price)) return null; // not euros; don't band it
  const m = /(\d+(?:[.,]\d{1,2})?)/.exec(price);
  if (!m || !/€|eur/i.test(price)) return null;
  return Number(m[1].replace(',', '.'));
}

export function priceBand(price: string | undefined, priceFrom?: number): PriceBand | undefined {
  if (isFreePrice(price)) return 'free';
  const n = lowestPrice(price, priceFrom);
  if (n == null) return undefined;
  if (n === 0) return 'free';
  if (n < 15) return 'under-15';
  if (n <= 30) return '15-30';
  return 'over-30';
}

// ---------------------------------------------------------------------------
// Items + filters
// ---------------------------------------------------------------------------

/**
 * One listing row, serialised by the server (lib/event-listing.ts) with its
 * display strings already in the page's language.
 */
export interface FilterItem {
  slug: string;
  href: string;
  name: string;
  /** Second line: dates · venue · price. */
  meta: string;
  emoji: string;
  categoryLabel: string;
  /** EventSubcategory and its legacy parent ("music" for concerts, fado…). */
  sub: string;
  parent: string;
  area?: string;
  band?: PriceBand;
  kids: boolean;
  /** YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
  /** normalize()d name (EN + PT), venue and short description. */
  search: string;
  image?: string;
}

export interface Filters {
  q?: string;
  cat?: string;
  area?: string;
  price?: PriceBand;
  when?: DayHubKind;
  kids?: boolean;
}

/** Lowercase, no diacritics, single spaces: "Música" and "musica" match. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9€]+/g, ' ')
    .trim();
}

export function parseFilters(search: string | URLSearchParams): Filters {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const f: Filters = {};
  const q = p.get('q')?.trim();
  if (q) f.q = q.slice(0, 80);
  const cat = p.get('cat');
  if (cat && /^[a-z-]{2,20}$/.test(cat)) f.cat = cat;
  const area = p.get('area');
  if (area && /^[a-z-]{2,20}$/.test(area)) f.area = area;
  const price = p.get('price');
  if (price && (PRICE_BANDS as string[]).includes(price)) f.price = price as PriceBand;
  // ?free=1 is the short form the "Free" chip used to share.
  if (!f.price && p.get('free') === '1') f.price = 'free';
  const when = p.get('when');
  if (when === 'today' || when === 'weekend') f.when = when;
  if (p.get('kids') === '1') f.kids = true;
  return f;
}

/** Query string for the filters, stable key order, "" when none are set. */
export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.when) p.set('when', f.when);
  if (f.price) p.set('price', f.price);
  if (f.kids) p.set('kids', '1');
  if (f.cat) p.set('cat', f.cat);
  if (f.area) p.set('area', f.area);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const activeCount = (f: Filters) =>
  [f.q, f.cat, f.area, f.price, f.when, f.kids].filter(Boolean).length;

export function matchesFilters(item: FilterItem, f: Filters, now: Date = new Date()): boolean {
  if (f.cat && item.sub !== f.cat && !(f.cat === item.parent && f.cat === 'music')) return false;
  if (f.area && item.area !== f.area) return false;
  if (f.price && item.band !== f.price) return false;
  if (f.kids && !item.kids) return false;
  if (f.when) {
    const r = dayHubRange(f.when, now);
    if (item.start > r.to || item.end < r.from) return false;
  }
  if (f.q) {
    // Every word must appear somewhere: "fado ribeira" narrows, not widens.
    const terms = normalize(f.q).split(' ').filter(Boolean);
    if (!terms.every((t) => item.search.includes(t))) return false;
  }
  return true;
}
