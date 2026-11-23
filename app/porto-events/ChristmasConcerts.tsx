import Link from 'next/link';
import type { Metadata } from 'next';
import { LANDING_PATHS } from '@/lib/event-landings';
import { CHRISTMAS_LIGHTS_PATHS } from '@/lib/christmas-lights';
import {
  CHRISTMAS_CONCERTS_PATHS, CONCERTS_YEAR, CONCERT_SOURCES, concertsInSeason, upcomingConcerts, type ChristmasConcert,
} from '@/lib/christmas-concerts';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';

/**
 * /porto-events/christmas-concerts and /pt/eventos/concertos-de-natal (growth
 * item G8, 2026-11-23). Verified rows live in lib/christmas-concerts.ts.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

const COPY = {
  en: {
    title: `Christmas Concerts in Porto ${CONCERTS_YEAR}: Dates, Venues, Tickets`,
    h1: `Christmas Concerts in Porto ${CONCERTS_YEAR}`,
    crumb: 'Christmas concerts',
    desc: 'Every Christmas concert we could confirm in Porto for 2026, by date: Avenida dos Aliados, Casa da Música, The Nutcracker, Candlelight, churches and Bach, with times and ticket prices.',
  },
  pt: {
    title: `Concertos de Natal no Porto ${CONCERTS_YEAR}: datas, locais, bilhetes`,
    h1: `Concertos de Natal no Porto ${CONCERTS_YEAR}`,
    crumb: 'Concertos de Natal',
    desc: 'Os concertos de Natal confirmados no Porto em 2026, por data: Avenida dos Aliados, Casa da Música, O Quebra-Nozes, Candlelight, igrejas e Bach, com horários e preços dos bilhetes.',
  },
} as const;

const FAQ = {
  en: [
    { q: 'Where are the Christmas concerts in Porto in 2026?', a: 'On Avenida dos Aliados (28 November to 19 December), at Casa da Música (12 to 22 December), Teatro Nacional São João (18 December), Palácio da Bolsa (19 December), Hilton Porto Gaia (26 December) and in churches around the city.' },
    { q: 'Are the concerts on Avenida dos Aliados free?', a: "The city's announcement doesn't mention tickets or prices for them. They take place on the avenue, with Portuguese Sign Language interpretation." },
    { q: 'When is The Nutcracker at Casa da Música?', a: 'Friday 18 December at 21:00 and Saturday 19 December at 18:00 in Sala Suggia, played by the Orquestra Sinfónica do Porto with the Coro Infantil and live sand art by Kseniya Simonova. Tickets cost €36 to €40, ages 6 and up.' },
    { q: 'Are there concerts in Porto after Christmas?', a: "Yes. Candlelight plays Hilton Porto Gaia on 26 December, and Bach's Christmas Oratorio is performed in full across six churches in the historic centre between 25 December and 6 January. The city hasn't published the individual dates yet." },
  ],
  pt: [
    { q: 'Onde há concertos de Natal no Porto em 2026?', a: 'Na Avenida dos Aliados (28 de novembro a 19 de dezembro), na Casa da Música (12 a 22 de dezembro), no Teatro Nacional São João (18 de dezembro), no Palácio da Bolsa (19 de dezembro), no Hilton Porto Gaia (26 de dezembro) e em igrejas da cidade.' },
    { q: 'Os concertos na Avenida dos Aliados são gratuitos?', a: 'O comunicado da Câmara não refere bilhetes nem preços. Realizam-se na avenida, com interpretação em Língua Gestual Portuguesa.' },
    { q: 'Quando é O Quebra-Nozes na Casa da Música?', a: 'Sexta-feira, 18 de dezembro, às 21h, e sábado, 19 de dezembro, às 18h, na Sala Suggia, pela Orquestra Sinfónica do Porto com o Coro Infantil e desenho na areia ao vivo de Kseniya Simonova. Bilhetes de 36 € a 40 €, para maiores de 6 anos.' },
    { q: 'Há concertos no Porto depois do Natal?', a: 'Sim. O Candlelight passa pelo Hilton Porto Gaia a 26 de dezembro, e a Oratória de Natal de Bach é interpretada na íntegra em seis igrejas do Centro Histórico entre 25 de dezembro e 6 de janeiro. A Câmara ainda não publicou as datas de cada parte.' },
  ],
};

const WD = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] };
const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
function shortDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WD[lang][d.getUTCDay()]} ${d.getUTCDate()} ${MON[lang][d.getUTCMonth()]}`;
}
const timeLabel = (t: string, lang: Lang) => (lang === 'pt' ? t.replace(':00', 'h').replace(':', 'h') : t);

function rowHref(c: ChristmasConcert, lang: Lang): string | undefined {
  if (c.slug) return `${lang === 'pt' ? '/pt/event/' : '/event/'}${c.slug}`;
  return c.href?.[lang];
}

export function christmasConcertsMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_CONCERTS_PATHS[lang]}`;
  return {
    title: { absolute: c.title },
    description: c.desc,
    ...(concertsInSeason() ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${CHRISTMAS_CONCERTS_PATHS.en}`, 'pt-PT': `${SITE}${CHRISTMAS_CONCERTS_PATHS.pt}`, 'x-default': `${SITE}${CHRISTMAS_CONCERTS_PATHS.en}` },
    },
    openGraph: { title: c.title, description: c.desc, url, type: 'article', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

export function ChristmasConcerts({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_CONCERTS_PATHS[lang]}`;
  const hub = LANDING_PATHS.christmas[lang];
  const today = new Date().toISOString().slice(0, 10);
  const rows = upcomingConcerts(today);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: c.h1, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' } },
      { '@type': 'FAQPage', mainEntity: FAQ[lang].map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: pt ? 'Início' : 'Home', item: pt ? `${SITE}/pt` : SITE },
          { '@type': 'ListItem', position: 2, name: pt ? 'Natal' : 'Christmas', item: `${SITE}${hub}` },
          { '@type': 'ListItem', position: 3, name: c.crumb, item: url },
        ],
      },
    ],
  };

  const h2 = { fontFamily: typography.serif, fontSize: 26, color: colors.heading, margin: '36px 0 12px' } as const;
  const p = { fontSize: 16, lineHeight: 1.65, margin: '0 0 14px' } as const;
  const link = { color: colors.heading, fontWeight: 600 } as const;
  const box = { background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 8px', fontSize: 16, lineHeight: 1.6 } as const;

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang={lang} active="events" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href={pt ? '/pt' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Início' : 'Home'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href={hub} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Natal' : 'Christmas'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>{c.crumb}</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.5 }}>{c.h1}</h1>
        <div style={{ marginTop: 16 }}><ShortcutChips lang={lang} /></div>

        <div style={box}>
          {pt
            ? <><strong>{rows.length} concertos e espetáculos com data confirmada</strong>, dos Aliados à Casa da Música e às igrejas da cidade. Preços e horários lidos na página de cada organizador a 23 de novembro. Alguns lugares podem já estar esgotados, por isso confirme antes de ir.</>
            : <><strong>{rows.length} concerts and shows with confirmed dates</strong>, from Avenida dos Aliados to Casa da Música and the city&apos;s churches. Prices and times were read from each organiser&apos;s page on 23 November. Some seats may already be sold out, so check before you go.</>}
        </div>

        <h2 style={h2}>{pt ? 'Por data' : 'By date'}</h2>
        <ul style={{ padding: 0, listStyle: 'none', margin: '0 0 8px' }}>
          {rows.map((r) => {
            const href = rowHref(r, lang);
            const title = pt ? r.pt : r.en;
            return (
              <li key={`${r.date}-${r.venue}-${r.en}`} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 15, lineHeight: 1.5 }}>
                <span style={{ minWidth: 112, fontWeight: 700, color: colors.heading }}>
                  {shortDate(r.date, lang)}
                  {r.times.length > 0 && <div style={{ fontWeight: 400, color: colors.textSoft }}>{r.times.map((t) => timeLabel(t, lang)).join(pt ? ' e ' : ' and ')}</div>}
                </span>
                <span>
                  {href ? <Link href={href} style={link}>{title}</Link> : <strong style={{ color: colors.heading }}>{title}</strong>}
                  <div style={{ color: colors.textSoft, fontSize: 14 }}>{r.venue}{r.price ? ` · ${pt ? r.price.pt : r.price.en}` : ''}</div>
                </span>
              </li>
            );
          })}
        </ul>

        <div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>

        <h2 style={h2}>{pt ? 'Bach nas igrejas do Centro Histórico' : 'Bach in the historic centre'}</h2>
        <p style={p}>
          {pt
            ? 'A Oratória de Natal de Bach (BWV 248) é interpretada na íntegra em seis igrejas do Centro Histórico, entre 25 de dezembro de 2026 e 6 de janeiro de 2027, numa iniciativa do Município com a Irmandade da Lapa. A Câmara ainda não publicou as datas e as igrejas de cada parte. Juntamo-las aqui quando saírem.'
            : "Bach's Christmas Oratorio (BWV 248) is performed in full across six churches in the historic centre between 25 December 2026 and 6 January 2027, promoted by the city with the Irmandade da Lapa. The city hasn't published which part plays where and when. We'll add them here once it does."}
        </p>

        <h2 style={h2}>{pt ? 'Perguntas frequentes' : 'FAQ'}</h2>
        {FAQ[lang].map((f) => (
          <div key={f.q} style={{ margin: '0 0 16px' }}>
            <div style={{ fontWeight: 700, color: colors.heading, fontSize: 16 }}>{f.q}</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
          </div>
        ))}

        <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, marginTop: 28 }}>
          {pt ? 'Fontes (verificadas a 23 nov 2026):' : 'Sources (checked 23 Nov 2026):'}
          <ul style={{ paddingLeft: 18, margin: '6px 0 0' }}>
            {CONCERT_SOURCES.map((s) => (
              <li key={s.url}><a href={s.url} rel="noopener" style={{ color: 'inherit' }}>{s.label}</a></li>
            ))}
          </ul>
        </div>

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 40, fontSize: 14, flexWrap: 'wrap' }}>
          <Link href={hub} style={{ color: colors.heading }}>{pt ? 'Natal e Passagem de Ano no Porto' : 'Christmas and New Year in Porto'} →</Link>
          <Link href={CHRISTMAS_LIGHTS_PATHS[lang]} style={{ color: colors.heading }}>{pt ? 'Luzes de Natal' : 'Christmas lights'}</Link>
          <Link href={pt ? `/pt/eventos/dezembro-${CONCERTS_YEAR}` : `/porto-events/december-${CONCERTS_YEAR}`} style={{ color: colors.textSoft }}>
            {pt ? `Tudo em dezembro de ${CONCERTS_YEAR}` : `Everything in December ${CONCERTS_YEAR}`}
          </Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
