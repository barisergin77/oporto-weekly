/**
 * Porto Christmas lights page (growth item G1, 2026-11-21): answers
 * "inauguração luzes natal porto 2026" / "luzes de natal porto 2026"
 * (GSC ~430 impressions in 28 days with no page to land on).
 *
 * Every fact below comes from an official or press source for the 2026
 * season, listed in SOURCES. Rule 4: when the season changes, re-verify all
 * of it before touching the year; don't swap 2026 for 2027 by hand.
 * After SEASON_END the page asks not to be indexed until it's refreshed.
 */

export const CHRISTMAS_LIGHTS_PATHS = {
  en: '/porto-events/christmas-lights',
  pt: '/pt/eventos/luzes-de-natal',
} as const;

export const LIGHTS_YEAR = 2026;
/** Last day of the city's Christmas programme (Praça da Fantasia closes the same day). */
export const SEASON_END = '2027-01-10';

export const lightsInSeason = (now: Date = new Date()) => now.toISOString().slice(0, 10) <= SEASON_END;

export const SOURCES = [
  {
    label: 'porto.pt: A magia das luzes de Natal chega às ruas da cidade a partir de 28 de novembro (6 Nov 2026)',
    url: 'https://www.porto.pt/pt/noticia/a-magia-das-luzes-de-natal-chega-as-ruas-da-cidade-a-partir-de-28-de-novembro',
  },
  {
    label: 'Cidade do Porto (CM Porto release): Inauguração das luzes e da Árvore de Natal regressa à Avenida dos Aliados (19 Nov 2026)',
    url: 'https://cidadedoporto.sapo.pt/noticias/inauguracao-das-luzes-e-da-arvore-de-natal-no-porto-regressa-a-avenida-dos-aliados-1795026425',
  },
  {
    label: 'Observador / Lusa: Programação de Natal arranca dia 28 e custa 765 mil euros (6 Nov 2026)',
    url: 'https://observador.pt/2026/11/06/natal-no-porto-arranca-a-28-de-novembro-com-765-mil-euros-em-iluminacoes/',
  },
  {
    label: 'Leça da Palmeira: Mercado de Natal de Matosinhos 2026 (17 Nov 2026)',
    url: 'https://www.leca-palmeira.com/fama-natal-feira-de-artesanato-de-matosinhos-ate-23-de-dezembro/',
  },
  {
    label: 'Porto Secreto: O Mercado de Natal de Matosinhos regressa ao Parque Basílio Teles a 27 de novembro (10 Nov 2026)',
    url: 'https://portosecreto.co/programa-mercado-de-natal-matosinhos-2026/',
  },
  {
    label: 'e-konomista: Mercados de Natal no Norte, as novidades de 2026 (19 Nov 2026)',
    url: 'https://www.e-konomista.pt/mercados-de-natal-no-norte-de-portugal/',
  },
  {
    label: 'CM Matosinhos: Natal em Matosinhos chega na sexta-feira (2025 season, for reference)',
    url: 'https://www.cm-matosinhos.pt/noticia/natal-em-matosinhos-chega-na-sexta-feira-42',
  },
] as const;

/** Anchor for the Matosinhos section (owner shares /pt/eventos/luzes-de-natal#matosinhos). */
export const MATOSINHOS_ANCHOR = 'matosinhos';

/** Open-air concerts on Avenida dos Aliados (CM Porto, 19 Nov 2026). */
export const ALIADOS_SHOWS: { date: string; time: string; en: string; pt: string }[] = [
  { date: '2026-11-28', time: '18:00', en: 'Switch-on show: Áurea, Ricardo Ribeiro, soprano Marina Pacheco, Orquestra Portuguesa de Guitarras e Bandolins, conductor Hélder Magalhães', pt: 'Inauguração: Áurea, Ricardo Ribeiro, a soprano Marina Pacheco, Orquestra Portuguesa de Guitarras e Bandolins e o maestro Hélder Magalhães' },
  { date: '2026-12-01', time: '18:00', en: 'Magician Mário Daniel with the group Nook (magic meets jazz)', pt: 'O mágico Mário Daniel com o grupo Nook (magia e jazz)' },
  { date: '2026-12-05', time: '18:00', en: 'NAPA, playing their third album "Semitrópico"', pt: 'NAPA, com o terceiro álbum "Semitrópico"' },
  { date: '2026-12-06', time: '18:00', en: 'Luís Trigacheiro', pt: 'Luís Trigacheiro' },
  { date: '2026-12-08', time: '18:00', en: 'Anabela with Orquestra Jovens do Porto (Christmas classics, 40 years on stage)', pt: 'Anabela com a Orquestra Jovens do Porto (clássicos de Natal, 40 anos de carreira)' },
  { date: '2026-12-12', time: '18:00', en: 'Samuel Úria, with Os 12 ao Todo and Milhanas', pt: 'Samuel Úria, com Os 12 ao Todo e Milhanas' },
  { date: '2026-12-13', time: '18:00', en: 'Sétima Legião', pt: 'Sétima Legião' },
  { date: '2026-12-19', time: '19:00', en: 'Bárbara Tinoco (last Aliados concert)', pt: 'Bárbara Tinoco (último concerto nos Aliados)' },
];
