/**
 * The latest edition's Editor's Picks, for the signup box on event pages
 * (growth item G3, 2026-11-22). Showing the real picks tells a visitor what
 * arrives on Thursday, which the generic "never miss what's on" copy didn't.
 *
 * Read-only over data/events (editorPickRank + sourceEdition, written by the
 * Thursday pipeline) and data/newsletters*.json. Nothing in the send path.
 */
import { listEvents, eventDisplay, type EventRecord } from './events';
import { getNewsletterMeta, getNewsletterMetaPT } from './archive';

export interface EditionPick {
  slug: string;
  name: string;
  /** "Thu 19 Nov" / "qui 19 nov" */
  when: string;
  rank: number;
}

export interface EditionPicks {
  editionSlug: string;
  /** Archive URL of the edition in this language. */
  archiveHref: string;
  /** "November 19–25, 2026" / PT week range. */
  weekRange: string;
  picks: EditionPick[];
}

/** An edition older than this (by send date) is no longer "this week". */
const MAX_AGE_DAYS = 10;

const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MO_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function shortDay(iso: string, lang: 'en' | 'pt'): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return lang === 'pt' ? `${WD_PT[wd]} ${d} ${MO_PT[m - 1]}` : `${WD_EN[wd]} ${d} ${MO_EN[m - 1]}`;
}

/**
 * Pure core: from a list of events, the picks of the newest edition that has
 * any (ranked 1..5). Edition recency is checked by the caller.
 */
export function newestEditionPicks(events: EventRecord[]): { editionSlug: string; events: EventRecord[] } | null {
  const picked = events.filter((e) => typeof e.editorPickRank === 'number' && e.sourceEdition);
  if (!picked.length) return null;
  // Newest edition = the one whose picks start latest.
  const newest = picked.reduce((a, b) => (b.date > a.date ? b : a));
  const editionSlug = newest.sourceEdition as string;
  const inEdition = picked
    .filter((e) => e.sourceEdition === editionSlug)
    .sort((a, b) => (a.editorPickRank as number) - (b.editorPickRank as number));
  // One record per rank (a merged duplicate can leave two with the same rank).
  const seen = new Set<number>();
  const unique = inEdition.filter((e) => !seen.has(e.editorPickRank as number) && seen.add(e.editorPickRank as number));
  return { editionSlug, events: unique.slice(0, 5) };
}

let cache: { en: EditionPicks | null; pt: EditionPicks | null } | null = null;

export function latestEditionPicks(lang: 'en' | 'pt', now: Date = new Date()): EditionPicks | null {
  if (!cache) {
    const core = newestEditionPicks(listEvents());
    const build = (l: 'en' | 'pt'): EditionPicks | null => {
      if (!core || core.events.length < 3) return null;
      const meta = l === 'pt' ? getNewsletterMetaPT(`${core.editionSlug}-pt`) : getNewsletterMeta(core.editionSlug);
      if (!meta) return null;
      const ageDays = (now.getTime() - new Date(meta.sentAt).getTime()) / 86400000;
      if (!(ageDays >= -1 && ageDays <= MAX_AGE_DAYS)) return null;
      return {
        editionSlug: core.editionSlug,
        archiveHref: l === 'pt' ? `/pt/arquivo/${meta.slug}` : `/archive/${meta.slug}`,
        weekRange: meta.weekRange,
        picks: core.events.map((e) => ({
          slug: e.slug,
          name: eventDisplay(e, l).name,
          when: shortDay(e.date, l),
          rank: e.editorPickRank as number,
        })),
      };
    };
    cache = { en: build('en'), pt: build('pt') };
  }
  return cache[lang];
}
