/**
 * FAQ for /venue/<slug> and /pt/venue/<slug>, built only from what the page
 * already shows: the venue's area (data/venue-areas.json or a place word in
 * its name), the upcoming events we list there and their listed prices.
 * Nothing is said that the event records don't back up: no addresses, hours
 * or prices beyond the stored price strings.
 */

import type { EventRecord } from './events';
import { eventDisplay } from './events';
import { areaForVenue, AREA_LABEL, AREA_LABEL_PT } from './event-areas';
import { isFreePrice } from './event-filters';
import { shortDates } from './event-seo';
import { humanizeText } from './humanizer';

export interface VenueFaqItem {
  q: string;
  a: string;
}

/**
 * `upcoming` must be sorted by start date (as the venue pages sort it);
 * `past` newest first.
 */
export function venueFaq(
  name: string,
  venueSlug: string,
  upcoming: EventRecord[],
  past: EventRecord[],
  lang: 'en' | 'pt',
  today: string = new Date().toISOString().slice(0, 10),
): VenueFaqItem[] {
  const pt = lang === 'pt';
  const items: VenueFaqItem[] = [];
  const evName = (e: EventRecord) => humanizeText(eventDisplay(e, lang).name.trim());

  // Area: only when the venue's location is certain (venue-areas.json or a
  // place word in the name); multi-venue / TBC venues get no area.
  const sample = upcoming[0] ?? past[0];
  const area = sample ? areaForVenue(sample.venue, venueSlug) : undefined;
  if (area) {
    items.push(pt
      ? { q: `Em que zona fica ${name}?`, a: `${name} fica na zona ${AREA_LABEL_PT[area]}.` }
      : { q: `What part of Porto is ${name} in?`, a: `${name} is in the ${AREA_LABEL[area].replace(/ \(.*\)$/, '')} area.` });
  }

  // What's on next.
  if (upcoming.length > 0) {
    const next = upcoming.find((e) => e.date.slice(0, 10) >= today) ?? upcoming[0];
    const running = next.date.slice(0, 10) < today && next.endDate;
    const until = running ? shortDates({ ...next, date: next.endDate!, endDate: undefined }, lang, true, true) : '';
    const when = running
      ? (pt ? `a decorrer até ${until}` : `on now, until ${until}`)
      : shortDates(next, lang, true, true);
    const n = upcoming.length;
    items.push(pt
      ? {
          q: `Que eventos há em ${name}?`,
          a: `${n === 1 ? 'Temos 1 evento' : `Temos ${n} eventos`} na agenda em ${name}. O próximo é ${evName(next)} (${when}).`,
        }
      : {
          q: `What's on at ${name}?`,
          a: `We list ${n} upcoming event${n === 1 ? '' : 's'} at ${name}. The next one is ${evName(next)} (${when}).`,
        });

    // Free or paid, from the listed price strings only.
    const free = upcoming.filter((e) => isFreePrice(e.price));
    let a: string;
    if (free.length === n) {
      a = pt
        ? (n === 1 ? 'Sim, o próximo evento na agenda é gratuito.' : `Sim, os ${n} eventos na agenda são gratuitos.`)
        : (n === 1 ? 'Yes, the upcoming event we list is free.' : `Yes, all ${n} upcoming events we list are free.`);
    } else if (free.length > 0) {
      const names = free.slice(0, 3).map(evName).join('; ');
      a = pt
        ? `${free.length} dos ${n} eventos na agenda ${free.length === 1 ? 'é gratuito' : 'são gratuitos'}: ${names}${free.length > 3 ? ' e outros' : ''}. Os restantes têm o preço indicado na lista.`
        : `${free.length} of the ${n} upcoming events we list ${free.length === 1 ? 'is' : 'are'} free: ${names}${free.length > 3 ? ' and more' : ''}. The price of the others is shown in the list.`;
    } else {
      a = pt
        ? `Nenhum dos eventos na agenda está marcado como gratuito. O preço de cada um, quando o temos, aparece na lista.`
        : `None of the upcoming events we list is marked as free. Where we have a price, it is shown next to each event.`;
    }
    items.push({ q: pt ? `Os eventos em ${name} são gratuitos?` : `Are events at ${name} free?`, a });
  } else if (past.length > 0) {
    const last = past[0];
    items.push(pt
      ? {
          q: `Que eventos há em ${name}?`,
          a: `De momento não temos nada anunciado em ${name}. O último evento na nossa agenda foi ${evName(last)} (${shortDates(last, 'pt', true, true)}).`,
        }
      : {
          q: `What's on at ${name}?`,
          a: `Nothing at ${name} is listed right now. The most recent event we listed was ${evName(last)} (${shortDates(last, 'en', true, true)}).`,
        });
  }

  return items;
}
