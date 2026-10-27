/**
 * GetYourGuide affiliate links for the blog guides (partner BC1P9XH, 8%,
 * approved 2026-10-27). Each guide gets 1–3 "Book it" targets picked by
 * keywords in its slug/title; guides with no good fit get none. Every target
 * URL was checked live on 2026-10-27 (Porto = location l151; l26 is Munich).
 * Links render with SPONSORED_REL and the AFFILIATE_NOTE (lib/fever.ts).
 * Never use these links in Facebook-group posts (fb-groups.md).
 */

export const GYG_PARTNER_ID = 'BC1P9XH';
export const MAX_GYG_TARGETS = 3;

const GYG = 'https://www.getyourguide.com';

export interface GygTarget {
  key: string;
  label: { en: string; pt: string };
  url: string;
}

export const GYG_TARGETS: Record<string, GygTarget> = {
  wine: { key: 'wine', url: `${GYG}/porto-l151/wine-tasting-winery-tours-tc104/`,
    label: { en: 'Port wine tastings', pt: 'Provas de vinho do Porto' } },
  cellars: { key: 'cellars', url: `${GYG}/porto-l151/cave-tours-tc166/`,
    label: { en: 'Port cellar tours in Gaia', pt: 'Visitas às caves em Gaia' } },
  boat: { key: 'boat', url: `${GYG}/porto-l151/cruises-boat-tours-tc48/`,
    label: { en: 'Douro river cruises', pt: 'Cruzeiros no Douro' } },
  daytrips: { key: 'daytrips', url: `${GYG}/porto-l151/day-trips-tc172/`,
    label: { en: 'Day trips from Porto', pt: 'Passeios de um dia a partir do Porto' } },
  walking: { key: 'walking', url: `${GYG}/porto-l151/walking-tours-tc3/`,
    label: { en: 'Porto walking tours', pt: 'Visitas a pé no Porto' } },
  lello: { key: 'lello', url: `${GYG}/porto-l151/literary-activities-tc160/`,
    label: { en: 'Livraria Lello & literary tours', pt: 'Livraria Lello e roteiros literários' } },
  food: { key: 'food', url: `${GYG}/porto-l151/local-food-tours-tc532/`,
    label: { en: 'Porto food tours', pt: 'Roteiros gastronómicos no Porto' } },
  family: { key: 'family', url: `${GYG}/porto-l151/family-friendly-activities-tc1094/`,
    label: { en: 'Family activities in Porto', pt: 'Atividades para famílias no Porto' } },
  streetart: { key: 'streetart', url: `${GYG}/porto-l151/graffiti-urban-art-tc30/`,
    label: { en: 'Street art tours', pt: 'Roteiros de arte urbana' } },
  culture: { key: 'culture', url: `${GYG}/porto-l151/culture-history-tc27/`,
    label: { en: 'Culture & history tours', pt: 'Visitas de cultura e história' } },
  surf: { key: 'surf', url: `${GYG}/s/?q=Porto%20surf%20lesson`,
    label: { en: 'Surf lessons near Porto', pt: 'Aulas de surf perto do Porto' } },
};

/** First matching rules win; targets are de-duplicated and capped at MAX_GYG_TARGETS.
 *  No rule for nightlife, shopping or budget/free guides (no good fit). */
const RULES: Array<[RegExp, string[]]> = [
  [/port-wine|wine-cellar|\bsip\b|cellars?\b/, ['cellars', 'wine', 'boat']],
  [/douro|day-trips?/, ['daytrips', 'wine']],
  [/kids|family/, ['family', 'boat']],
  [/food|foodie|dishes|eat|coffee|pastis|nata/, ['food']],
  [/street-art|art-lovers|art-culture|galleries/, ['streetart', 'culture']],
  [/walk|on-foot|historic/, ['walking', 'lello']],
  [/hidden-gems|secret/, ['walking', 'lello']],
  [/beach|surf/, ['surf']],
  [/views|rooftops|viewpoints/, ['boat']],
  [/neighbou?rhood|seasonal/, ['walking', 'boat']],
];

const SKIP = /nightlife|shopping|vintage|market|budget|free-activit/;

/** GYG targets for a blog guide, by slug (and title as a fallback). */
export function gygTargetsFor(slug: string, title = ''): GygTarget[] {
  const hay = `${slug} ${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (SKIP.test(slug)) return [];
  const keys: string[] = [];
  for (const [re, ks] of RULES) {
    if (!re.test(hay)) continue;
    for (const k of ks) if (!keys.includes(k)) keys.push(k);
  }
  return keys.slice(0, MAX_GYG_TARGETS).map((k) => GYG_TARGETS[k]);
}

/** Tracked GYG link: partner_id + cmp (the guide slug, for per-guide attribution in GYG's dashboard). */
export function gygLink(url: string, cmp: string): string {
  const u = new URL(url);
  u.searchParams.set('partner_id', GYG_PARTNER_ID);
  u.searchParams.set('cmp', cmp.slice(0, 60));
  return u.toString();
}
