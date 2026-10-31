/**
 * Server side of the listing filters: turns event records into the small,
 * display-ready rows app/components/EventFilters.tsx filters in the browser
 * (lib/event-filters.ts FilterItem), and the option lists for its selects.
 */

import { eventDisplay, isKidsEvent, subcategoryOf, type EventRecord } from './events';
import { SUBCATEGORIES, SUBCATEGORY_EMOJI, SUBCATEGORY_LABEL, SUBCATEGORY_LABEL_PT, SUBCATEGORY_PARENT } from './event-categories';
import { AREAS, AREA_LABEL, AREA_LABEL_PT, areaForVenue } from './event-areas';
import { normalize, priceBand, type FilterItem } from './event-filters';
import { priceText, shortDates } from './event-seo';

type Lang = 'en' | 'pt';
const day = (iso: string) => iso.slice(0, 10);

export function subcategoryLabel(e: EventRecord, lang: Lang): string {
  const s = subcategoryOf(e);
  return (lang === 'pt' ? SUBCATEGORY_LABEL_PT : SUBCATEGORY_LABEL)[s];
}
export const subcategoryEmoji = (e: EventRecord) => SUBCATEGORY_EMOJI[subcategoryOf(e)];

export function toFilterItem(e: EventRecord, lang: Lang, withYear = false): FilterItem {
  const disp = eventDisplay(e, lang);
  const sub = subcategoryOf(e);
  const price = priceText(e.price, lang);
  return {
    slug: e.slug,
    href: lang === 'pt' ? `/pt/event/${e.slug}` : `/event/${e.slug}`,
    name: disp.name,
    meta: [shortDates(e, lang, withYear), e.venue, price].filter(Boolean).join(' · '),
    emoji: SUBCATEGORY_EMOJI[sub],
    categoryLabel: (lang === 'pt' ? SUBCATEGORY_LABEL_PT : SUBCATEGORY_LABEL)[sub],
    sub,
    parent: SUBCATEGORY_PARENT[sub],
    area: areaForVenue(e.venue, e.venueSlug),
    band: priceBand(e.price, e.priceFrom),
    kids: isKidsEvent(e),
    start: day(e.date),
    end: day(e.endDate ?? e.date),
    search: normalize([e.name, e.namePt, e.venue, disp.description].filter(Boolean).join(' ')),
    ...(e.image?.url ? { image: e.image.url } : {}),
  };
}

export interface FilterOption { value: string; label: string; count: number }

/** Category + area options present in the list, in display order, with counts. */
export function filterOptions(items: FilterItem[], lang: Lang): { categories: FilterOption[]; areas: FilterOption[] } {
  const count = (key: 'sub' | 'area', v: string) => items.filter((i) => i[key] === v).length;
  const subLabel = lang === 'pt' ? SUBCATEGORY_LABEL_PT : SUBCATEGORY_LABEL;
  const areaLabel = lang === 'pt' ? AREA_LABEL_PT : AREA_LABEL;
  const categories: FilterOption[] = SUBCATEGORIES.map((s) => ({ value: s as string, label: subLabel[s], count: count('sub', s) })).filter((o) => o.count > 0);
  // "All music" (?cat=music, the old category) once music is split across 2+ kinds.
  const music = items.filter((i) => i.parent === 'music');
  if (new Set(music.map((i) => i.sub)).size > 1) {
    categories.unshift({ value: 'music', label: lang === 'pt' ? 'Toda a música' : 'All music', count: music.length });
  }
  return {
    categories,
    areas: AREAS.map((a) => ({ value: a, label: areaLabel[a], count: count('area', a) })).filter((o) => o.count > 0),
  };
}
