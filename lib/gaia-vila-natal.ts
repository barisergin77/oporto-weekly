/**
 * Gaia Vila Natal page (growth item G12, 2026-11-28): answers "gaia vila
 * natal (2026)" / "natal gaia 2026" searches, which today land on a shopping
 * guide that only mentions it (GSC pos 1–2, no page about the event itself).
 *
 * Every fact below comes from Câmara Municipal de Gaia: the event page and
 * the official programme PDF (both read 28 Nov 2026). Neither states prices,
 * whether entry is free, transport or parking, so the page doesn't either.
 * Rule 4: when the season changes, re-verify all of it before touching the
 * year. After SEASON_END the page asks not to be indexed.
 */

export const GAIA_VILA_NATAL_PATHS = {
  en: '/porto-events/gaia-vila-natal',
  pt: '/pt/eventos/gaia-vila-natal',
} as const;

export const GAIA_YEAR = 2026;
export const SEASON_START = '2026-12-01';
/** Closing day (3 Jan 2027, GoGospel at 18:00). */
export const SEASON_END = '2027-01-03';

export const gaiaInSeason = (now: Date = new Date()) => now.toISOString().slice(0, 10) <= SEASON_END;

/** Event record for the whole Vila Natal run (data/events). */
export const GAIA_EVENT_SLUG = 'gaia-vila-natal-vila-nova-de-gaia-dec-1-2026';

export const SOURCES = [
  {
    label: 'CM Gaia: Gaia Vila Natal regressa para celebrar a magia da época festiva',
    url: 'https://www.cm-gaia.pt/pt/eventos/gaia-vila-natal-regressa-para-celebrar-a-magia-da-epoca-festiva/',
  },
  {
    label: 'CM Gaia: Gaia Vila Natal 26, programa (PDF)',
    url: 'https://www.cm-gaia.pt/fotos/editor2/eventos/2026/programa_natal.pdf',
  },
] as const;

type Bi = { en: string; pt: string };

/** What is at each site (CM Gaia event page). */
export const SITES: { name: Bi; items: Bi }[] = [
  {
    name: { en: 'Centro Cívico de Gaia (the PraÇa)', pt: 'Centro Cívico de Gaia (PraÇa)' },
    items: {
      en: "Santa's House, an ice rink, a Parisian carousel, a rail train ride and a Christmas market with 20 stalls.",
      pt: 'Casa do Pai Natal, pista de gelo, carrossel parisiense, comboio em carril e um mercado de Natal com 20 casinhas.',
    },
  },
  {
    name: { en: 'Cais de Gaia (riverside)', pt: 'Cais de Gaia' },
    items: {
      en: 'A second Parisian carousel, a large Christmas house and a Christmas market with 15 stalls.',
      pt: 'Outro carrossel parisiense, uma mega Casa de Natal e um mercado de Natal com 15 casinhas.',
    },
  },
];

/** General opening hours (CM Gaia event page). */
export const HOURS: { when: Bi; hours: string }[] = [
  { when: { en: 'Monday to Thursday', pt: 'Segunda a quinta' }, hours: '13:00–20:00' },
  { when: { en: 'Friday', pt: 'Sexta' }, hours: '13:00–22:00' },
  { when: { en: 'Saturday and Sunday', pt: 'Sábado e domingo' }, hours: '11:00–22:00' },
  { when: { en: 'Holidays (1 and 8 December)', pt: 'Feriados (1 e 8 de dezembro)' }, hours: '11:00–20:00' },
  { when: { en: '24 December', pt: '24 de dezembro' }, hours: '11:00–16:00' },
  { when: { en: '25 December', pt: '25 de dezembro' }, hours: 'closed' },
  { when: { en: '31 December', pt: '31 de dezembro' }, hours: '11:00–20:00' },
  { when: { en: '1 January', pt: '1 de janeiro' }, hours: '14:00–22:00' },
];

/** Videomapping "A Luz que Acordou Gaia", 5–26 Dec except 24 + 25 (programme PDF). */
export const VIDEOMAPPING_HOURS: { when: Bi; hours: string }[] = [
  { when: { en: 'Monday to Thursday', pt: 'Segunda a quinta' }, hours: '18:00–20:00' },
  { when: { en: 'Friday, Saturday and Sunday', pt: 'Sexta, sábado e domingo' }, hours: '18:00–22:00' },
  { when: { en: '8 December', pt: '8 de dezembro' }, hours: '18:00–20:00' },
  { when: { en: '24 and 25 December', pt: '24 e 25 de dezembro' }, hours: 'closed' },
  { when: { en: '26 December', pt: '26 de dezembro' }, hours: '18:00–22:00' },
];

export type Slot = { time: string; what: Bi; where?: Bi };
export type ProgrammeDay = { date: string; slots: Slot[]; note?: Bi };

const PRACA: Bi = { en: 'Praça stage', pt: 'Palco Praça' };
const VARANDA: Bi = { en: 'City Hall balcony stage', pt: 'Palco Varanda Paços do Concelho' };
const ROAMING: Bi = { en: 'roaming', pt: 'itinerante' };

const STORIES: Slot = { time: '11:00 + 14:30', what: { en: "Cont'Arte: Christmas story time for children", pt: "Cont'Arte: Horas do Conto" }, where: PRACA };
const SANTA: Slot = { time: '11:30, 15:00 + 17:00', what: { en: "Santa at Santa's House (photos)", pt: 'Presença do Pai Natal na Casa do Pai Natal' } };
const circus = (time: string): Slot => ({ time, what: { en: "Circu'ito: roaming circus acts", pt: "Circu'ito: animação circense" }, where: ROAMING });
const brass = (time: string): Slot => ({ time, what: { en: 'Ao Ritmo do Natal: roaming brass band', pt: 'Ao Ritmo do Natal: brass band' }, where: ROAMING });
const weekend = (extra: Slot[]): Slot[] => [STORIES, SANTA, ...extra];

/** Dated programme (official PDF "Gaia Vila Natal 26"). */
export const PROGRAMME: ProgrammeDay[] = [
  {
    date: '2026-12-01',
    note: { en: 'Opening day (public holiday)', pt: 'Abertura (feriado)' },
    slots: [
      brass('15:30'),
      { time: '18:00', what: { en: 'Christmas lights switch-on and opening of the Vila Natal, followed by the Christmas parade', pt: 'Inauguração das luzes de Natal e abertura da Vila Natal, seguida da Parada de Natal' } },
    ],
  },
  { date: '2026-12-05', slots: weekend([circus('13:00 + 15:00')]) },
  { date: '2026-12-06', slots: weekend([brass('13:00 + 15:00'), { time: '16:30', what: { en: 'ProVocal Ensemble (vocal concert)', pt: 'ProVocal Ensemble (concerto vocal)' }, where: VARANDA }]) },
  { date: '2026-12-08', note: { en: 'Public holiday', pt: 'Feriado' }, slots: weekend([circus('15:00 + 16:30')]) },
  { date: '2026-12-12', slots: weekend([brass('13:00 + 15:00'), { time: '16:30', what: { en: 'Onde Está o Natal? (interactive musical show)', pt: 'Onde Está o Natal? (espetáculo musical interativo)' }, where: PRACA }]) },
  { date: '2026-12-13', slots: weekend([circus('13:00 + 15:00'), { time: '16:30', what: { en: 'The Magic of Christmas: three opera singers, opera and Christmas classics', pt: 'The Magic of Christmas: três cantores de ópera, clássicos da ópera e do Natal' }, where: VARANDA }]) },
  { date: '2026-12-19', slots: weekend([circus('13:00 + 15:00'), { time: '16:30', what: { en: 'O Baú dos Presentes (musical theatre for children)', pt: 'O Baú dos Presentes (teatro musical infantil)' }, where: PRACA }]) },
  { date: '2026-12-20', slots: weekend([brass('13:00 + 15:00'), { time: '16:30', what: { en: 'Golden Strings (string concert)', pt: 'Golden Strings (concerto de cordas)' }, where: VARANDA }]) },
  { date: '2026-12-26', slots: weekend([brass('15:00 + 16:30')]) },
  { date: '2026-12-27', slots: weekend([circus('13:00 + 15:00'), { time: '16:30', what: { en: 'Uma Aventura de Natal (family musical theatre)', pt: 'Uma Aventura de Natal (teatro musical para a família)' }, where: PRACA }]) },
  { date: '2027-01-02', slots: weekend([brass('15:00 + 16:30')]) },
  {
    date: '2027-01-03',
    note: { en: 'Closing day', pt: 'Encerramento' },
    slots: weekend([circus('13:00 + 15:00'), { time: '18:00', what: { en: 'GoGospel (Christmas gospel concert)', pt: 'GoGospel (concerto gospel de Natal)' }, where: VARANDA }]),
  },
];

/** Programme days from today on (Europe/Lisbon date is close enough at day granularity with hourly ISR). */
export function upcomingProgramme(now: Date = new Date()): ProgrammeDay[] {
  const today = now.toISOString().slice(0, 10);
  return PROGRAMME.filter((d) => d.date >= today);
}
