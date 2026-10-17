/**
 * Search-result title + description for event pages (EN and PT).
 *
 * 2026-10-17: "iberanime porto 2026" earned 2,099 impressions but 5 clicks
 * (0.2% CTR) at position 7.8. The title was ~95 characters — Google shows
 * about 60, so the dates searchers want were cut off — and the description
 * was the first 155 characters of editorial copy, cut mid-word, with no
 * dates, price or venue. Facts first now, sized to what Google displays.
 */

import type { EventRecord } from './events';
import { eventDisplay } from './events';

const TITLE_MAX = 62;
const DESC_MAX = 155;

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const MONTHS_LONG = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};

const toDate = (iso: string) => new Date(iso.length > 10 ? iso.slice(0, 10) + 'T00:00:00Z' : iso + 'T00:00:00Z');

/** "10–11 Oct 2026", "29 Sep – 2 Oct 2026", "3 Oct 2026"; year omitted when the name has it. */
export function shortDates(ev: EventRecord, lang: 'en' | 'pt', withYear: boolean, long = false): string {
  const m = long ? MONTHS_LONG[lang] : MONTHS[lang];
  const s = toDate(ev.date);
  const e = ev.endDate ? toDate(ev.endDate) : null;
  // Portuguese long form puts "de" before the year: "10 de outubro de 2026".
  const y = (d: Date) => (withYear ? (lang === 'pt' && long ? ` de ${d.getUTCFullYear()}` : ` ${d.getUTCFullYear()}`) : '');
  const dm = (d: Date) => (lang === 'pt' && long ? `${d.getUTCDate()} de ${m[d.getUTCMonth()]}` : `${d.getUTCDate()} ${m[d.getUTCMonth()]}`);
  if (!e || e.getTime() === s.getTime()) return `${dm(s)}${y(s)}`;
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${dm(s)}${y(s)} – ${dm(e)}${y(e)}`;
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return lang === 'pt' && long
      ? `${s.getUTCDate()}–${e.getUTCDate()} de ${m[s.getUTCMonth()]}${y(e)}`
      : `${s.getUTCDate()}–${e.getUTCDate()} ${m[s.getUTCMonth()]}${y(e)}`;
  }
  return `${dm(s)} – ${dm(e)}${y(e)}`;
}

const venueRoot = (venue: string) => venue.split(/[,/]/)[0].trim();

function priceText(price: string | undefined, lang: 'en' | 'pt'): string {
  if (!price) return '';
  const p = price.trim();
  if (lang === 'en') return /^tickets?$/i.test(p) ? 'Ticketed' : p;
  const map: Record<string, string> = {
    free: 'Gratuito', 'free entry': 'Entrada gratuita', 'free to explore': 'Entrada gratuita',
    ticketed: 'Com bilhete', tickets: 'Com bilhete', ticket: 'Com bilhete', 'tickets required': 'Com bilhete', varies: 'Preço variável',
    'price varies': 'Preço variável', 'spectators free': 'Gratuito para espectadores',
  };
  return map[p.toLowerCase()] ?? p.replace(/^From\s+/i, 'A partir de ');
}

/** Trim to max on a word boundary, ending with an ellipsis only if cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:—–-]+$/, '') + '…';
}

export function eventSeo(ev: EventRecord, lang: 'en' | 'pt', now: Date = new Date()) {
  const disp = eventDisplay(ev, lang);
  const name = disp.name.trim();
  const nameHasYear = /\b20\d{2}\b/.test(name);
  const dates = shortDates(ev, lang, !nameHasYear);
  const venue = venueRoot(ev.venue);
  const upcoming = (ev.endDate ?? ev.date).slice(0, 10) >= now.toISOString().slice(0, 10);

  // Title: name — dates, venue · Tickets & Info — adding each part only while
  // it still fits what Google shows. "Tickets & Info" mirrors how people
  // search for an upcoming event, so it's left off once the event is over.
  let title = `${name} — ${dates}`;
  const withVenue = `${title}, ${venue}`;
  if (withVenue.length <= TITLE_MAX && !name.toLowerCase().includes(venue.toLowerCase())) title = withVenue;
  const suffix = lang === 'pt' ? ' · Bilhetes e Info' : ' · Tickets & Info';
  if (upcoming && (title + suffix).length <= TITLE_MAX) title += suffix;
  if (title.length > TITLE_MAX + 15) title = clip(title, TITLE_MAX + 15);

  // Description: the facts a searcher compares results on, then the hook.
  const longDates = shortDates(ev, lang, true, true);
  const at = lang === 'pt' ? `${longDates}, ${ev.venue}` : `${longDates} at ${ev.venue}`;
  const price = priceText(ev.price, lang);
  const firstSentence = (disp.description || '').split(/(?<=[.!?])\s/)[0] ?? '';
  const description = clip([`${at}.`, price ? `${price}.` : '', firstSentence].filter(Boolean).join(' '), DESC_MAX);

  return { title, description };
}
