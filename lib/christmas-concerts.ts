/**
 * Christmas concerts in Porto (growth item G8, 2026-11-23): one dated list
 * for "concertos de natal porto" / "christmas concerts porto".
 *
 * Every row was read on its own source page on 2026-11-23 (SOURCES). The
 * Aliados rows come from lib/christmas-lights.ts. The city's release doesn't
 * say whether the Aliados or church concerts are free, so `price` stays empty
 * for them: never fill it in without a source. Rule 4: re-verify everything
 * before reusing this for another year.
 */

import { ALIADOS_SHOWS, CHRISTMAS_LIGHTS_PATHS } from './christmas-lights';

export const CHRISTMAS_CONCERTS_PATHS = {
  en: '/porto-events/christmas-concerts',
  pt: '/pt/eventos/concertos-de-natal',
} as const;

export const CONCERTS_YEAR = 2026;
/** Last day of the Bach oratorio cycle, the last concerts on this page. */
export const CONCERTS_END = '2027-01-06';

export const concertsInSeason = (now: Date = new Date()) => now.toISOString().slice(0, 10) <= CONCERTS_END;

export type ConcertKind = 'aliados' | 'ticketed' | 'church';

export interface ChristmasConcert {
  date: string;
  /** Start times as listed; empty when the source doesn't give one. */
  times: string[];
  kind: ConcertKind;
  en: string;
  pt: string;
  venue: string;
  price?: { en: string; pt: string };
  /** Our event page, when we have one. */
  slug?: string;
  /** Internal page for rows without an event record. */
  href?: { en: string; pt: string };
}

const CDM = 'Casa da Música, Sala Suggia';

const TICKETED: ChristmasConcert[] = [
  { date: '2026-12-12', times: ['18:00'], kind: 'ticketed', en: 'Melodias Célebres: Coro Casa da Música and Coro Infantil', pt: 'Melodias Célebres: Coro Casa da Música e Coro Infantil', venue: CDM, price: { en: '€22', pt: '22 €' }, slug: 'tempo-de-natal-casa-da-musica-dec-12-2026' },
  { date: '2026-12-13', times: ['21:30'], kind: 'ticketed', en: 'Glenn Miller Orchestra: In Christmas Mood', pt: 'Glenn Miller Orchestra: In Christmas Mood', venue: CDM, price: { en: '€35–€37.50', pt: '35 € a 37,50 €' }, slug: 'glenn-miller-orchestra-in-christmas-mood-casa-da-musica-dec-13-2026' },
  { date: '2026-12-18', times: ['21:00'], kind: 'ticketed', en: 'The Nutcracker: Orquestra Sinfónica do Porto, with live sand art by Kseniya Simonova', pt: 'O Quebra-Nozes: Orquestra Sinfónica do Porto, com desenho na areia ao vivo de Kseniya Simonova', venue: CDM, price: { en: '€36–€40', pt: '36 € a 40 €' }, slug: 'o-quebra-nozes-casa-da-musica-dec-18-2026' },
  { date: '2026-12-18', times: ['21:00'], kind: 'ticketed', en: 'Schubertíada: Pedro Burmester, Alexei Eremine, Pedro Meireles and Filipe Quaresma', pt: 'Schubertíada: Pedro Burmester, Alexei Eremine, Pedro Meireles e Filipe Quaresma', venue: 'Teatro Nacional São João', price: { en: 'from €10', pt: 'desde 10 €' }, slug: 'schubertiada-concerto-de-natal-teatro-nacional-sao-joao-dec-18-2026' },
  { date: '2026-12-19', times: ['18:00'], kind: 'ticketed', en: 'The Nutcracker: Orquestra Sinfónica do Porto, with live sand art by Kseniya Simonova', pt: 'O Quebra-Nozes: Orquestra Sinfónica do Porto, com desenho na areia ao vivo de Kseniya Simonova', venue: CDM, price: { en: '€36–€40', pt: '36 € a 40 €' }, slug: 'o-quebra-nozes-casa-da-musica-dec-18-2026' },
  { date: '2026-12-19', times: ['19:30', '22:00'], kind: 'ticketed', en: 'Candlelight: Christmas Classics (string quartet)', pt: 'Candlelight: Clássicos de Natal (quarteto de cordas)', venue: 'Palácio da Bolsa', price: { en: 'from €25.50', pt: 'desde 25,50 €' }, slug: 'candlelight-christmas-classics-palacio-da-bolsa-dec-19-2026' },
  { date: '2026-12-20', times: ['18:00'], kind: 'ticketed', en: 'Tempo de Natal: Handel, Charpentier and Bach, with Orquestra Barroca and Coro Casa da Música', pt: 'Tempo de Natal: Händel, Charpentier e Bach, com a Orquestra Barroca e o Coro Casa da Música', venue: CDM, price: { en: '€30–€34', pt: '30 € a 34 €' }, slug: 'tempo-de-natal-casa-da-musica-dec-12-2026' },
  { date: '2026-12-22', times: ['21:00'], kind: 'ticketed', en: 'Tempo de Natal: Handel, Charpentier and Bach, with Orquestra Barroca and Coro Casa da Música', pt: 'Tempo de Natal: Händel, Charpentier e Bach, com a Orquestra Barroca e o Coro Casa da Música', venue: CDM, price: { en: '€30–€34', pt: '30 € a 34 €' }, slug: 'tempo-de-natal-casa-da-musica-dec-12-2026' },
  { date: '2026-12-26', times: ['19:30', '21:30'], kind: 'ticketed', en: 'Candlelight: Christmas Classics (string quartet)', pt: 'Candlelight: Clássicos de Natal (quarteto de cordas)', venue: 'Hilton Porto Gaia', price: { en: 'from €18', pt: 'desde 18 €' }, slug: 'candlelight-christmas-classics-hilton-porto-gaia-dec-26-2026' },
];

const CHURCH: ChristmasConcert[] = [
  { date: '2026-12-11', times: ['21:30'], kind: 'church', en: 'Orfeão Universitário do Porto', pt: 'Orfeão Universitário do Porto', venue: 'Igreja do Santíssimo Sacramento' },
  { date: '2026-12-13', times: [], kind: 'church', en: 'Orquestra AMASING with Vox International Choir', pt: 'Orquestra AMASING com o Vox International Choir', venue: 'Igreja Nossa Senhora da Boavista' },
  { date: '2026-12-20', times: ['17:00'], kind: 'church', en: 'Orquestra XXI', pt: 'Orquestra XXI', venue: 'Igreja do Bonfim' },
];

const ALIADOS: ChristmasConcert[] = ALIADOS_SHOWS.map((s) => ({
  date: s.date,
  times: [s.time],
  kind: 'aliados',
  en: s.en,
  pt: s.pt,
  venue: 'Avenida dos Aliados',
  href: CHRISTMAS_LIGHTS_PATHS,
}));

export const CHRISTMAS_CONCERTS: ChristmasConcert[] = [...ALIADOS, ...TICKETED, ...CHURCH]
  .sort((a, b) => a.date.localeCompare(b.date) || (a.times[0] ?? '99').localeCompare(b.times[0] ?? '99'));

/** Rows from `today` on (YYYY-MM-DD). */
export function upcomingConcerts(today: string): ChristmasConcert[] {
  return CHRISTMAS_CONCERTS.filter((c) => c.date >= today);
}

export const CONCERT_SOURCES = [
  { label: 'Casa da Música: Tempo de Natal 2026', url: 'https://casadamusica.com/tempo-de-natal-2026/' },
  { label: 'Casa da Música: Glenn Miller Orchestra', url: 'https://casadamusica.com/event/glenn-miller-orchestra/' },
  { label: 'BOL: Schubertíada, Concerto de Natal', url: 'https://www.bol.pt/Comprar/Bilhetes/183002-schubertiada_concerto_de_natal-teatro_nacional_sao_joao/' },
  { label: 'Fever: Candlelight, Palácio da Bolsa', url: 'https://feverup.com/m/406015' },
  { label: 'Fever: Candlelight, Hilton Porto Gaia', url: 'https://feverup.com/m/706021' },
  { label: 'Cidade do Porto (CM Porto release, 19 Nov 2026): Aliados and church concerts', url: 'https://cidadedoporto.sapo.pt/noticias/inauguracao-das-luzes-e-da-arvore-de-natal-no-porto-regressa-a-avenida-dos-aliados-1795026425' },
] as const;
