import Link from 'next/link';
import type { Metadata } from 'next';
import { LANDING_PATHS } from '@/lib/event-landings';
import {
  GAIA_VILA_NATAL_PATHS, GAIA_EVENT_SLUG, HOURS, PROGRAMME, SITES, SOURCES, VIDEOMAPPING_HOURS,
  gaiaInSeason, upcomingProgramme,
} from '@/lib/gaia-vila-natal';
import { CHRISTMAS_LIGHTS_PATHS, lightsInSeason } from '@/lib/christmas-lights';
import { CHRISTMAS_KIDS_PATHS, christmasKidsIndexable } from '@/lib/christmas-kids';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';

/**
 * /porto-events/gaia-vila-natal and /pt/eventos/gaia-vila-natal (growth item
 * G12, 2026-11-28). Facts and the dated programme live in
 * lib/gaia-vila-natal.ts, all from Câmara Municipal de Gaia.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

const COPY = {
  en: {
    title: 'Gaia Vila Natal 2026: Dates, Hours, Ice Rink and Programme',
    h1: 'Gaia Vila Natal 2026',
    crumb: 'Gaia Vila Natal',
    desc: "Gaia Vila Natal runs from 1 December 2026 to 3 January 2027 at the Centro Cívico and Cais de Gaia: ice rink, carousels, Santa's House, markets and a videomapping show. Hours and the full programme.",
  },
  pt: {
    title: 'Gaia Vila Natal 2026: datas, horário, pista de gelo e programa',
    h1: 'Gaia Vila Natal 2026',
    crumb: 'Gaia Vila Natal',
    desc: 'A Gaia Vila Natal decorre de 1 de dezembro de 2026 a 3 de janeiro de 2027, no Centro Cívico e no Cais de Gaia: pista de gelo, carrosséis, Casa do Pai Natal, mercados e videomapping. Horários e programa completo.',
  },
} as const;

const FAQ = {
  en: [
    { q: 'When is Gaia Vila Natal 2026?', a: 'From Tuesday 1 December 2026 to Sunday 3 January 2027. It opens on 1 December at 18:00 with the Christmas lights switch-on and a parade.' },
    { q: 'Where is Gaia Vila Natal?', a: "In two places in Vila Nova de Gaia: the Centro Cívico (the PraÇa), with Santa's House, the ice rink, a carousel, a train ride and 20 market stalls, and Cais de Gaia by the river, with a carousel, a large Christmas house and 15 stalls." },
    { q: 'What are the opening hours?', a: 'Monday to Thursday 13:00–20:00, Friday 13:00–22:00, Saturday and Sunday 11:00–22:00. On 1 and 8 December 11:00–20:00, 24 December 11:00–16:00, closed on 25 December, 31 December 11:00–20:00 and 1 January 14:00–22:00.' },
    { q: 'Is there an ice rink at Gaia Vila Natal?', a: 'Yes, at the Centro Cívico. The council has not published prices for the rink or the rides.' },
    { q: 'When is the videomapping show?', a: '"A Luz que Acordou Gaia" runs from 5 to 26 December, except 24 and 25 December. Sessions start at 18:00, the last one at 21:30, followed by light painting.' },
    { q: 'When can children see Santa?', a: "At Santa's House at 11:30, 15:00 and 17:00 on the programme's weekend days and holidays (5, 6, 8, 12, 13, 19, 20, 26 and 27 December, 2 and 3 January)." },
  ],
  pt: [
    { q: 'Quando é a Gaia Vila Natal 2026?', a: 'De terça-feira, 1 de dezembro de 2026, a domingo, 3 de janeiro de 2027. Abre a 1 de dezembro às 18h, com a inauguração das luzes de Natal e uma parada.' },
    { q: 'Onde fica a Gaia Vila Natal?', a: 'Em dois sítios de Vila Nova de Gaia: o Centro Cívico (PraÇa), com a Casa do Pai Natal, a pista de gelo, um carrossel, o comboio em carril e 20 casinhas de mercado, e o Cais de Gaia, com um carrossel, uma mega Casa de Natal e 15 casinhas.' },
    { q: 'Qual é o horário da Gaia Vila Natal?', a: 'Segunda a quinta das 13h às 20h, sexta das 13h às 22h, sábado e domingo das 11h às 22h. A 1 e 8 de dezembro das 11h às 20h, a 24 de dezembro das 11h às 16h, encerrada a 25 de dezembro, a 31 de dezembro das 11h às 20h e a 1 de janeiro das 14h às 22h.' },
    { q: 'Há pista de gelo na Gaia Vila Natal?', a: 'Sim, no Centro Cívico. A Câmara não divulgou preços para a pista nem para as diversões.' },
    { q: 'Quando é o videomapping?', a: '"A Luz que Acordou Gaia" decorre de 5 a 26 de dezembro, exceto a 24 e 25. As sessões começam às 18h, a última às 21h30, seguida de light painting.' },
    { q: 'Quando está o Pai Natal na Casa do Pai Natal?', a: 'Às 11h30, 15h00 e 17h00 nos fins de semana e feriados do programa (5, 6, 8, 12, 13, 19, 20, 26 e 27 de dezembro, 2 e 3 de janeiro).' },
  ],
};

const WD = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], pt: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] };
const MON = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
function dayLabel(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return lang === 'pt'
    ? `${WD.pt[d.getUTCDay()]}, ${d.getUTCDate()} de ${MON.pt[d.getUTCMonth()]}`
    : `${WD.en[d.getUTCDay()]} ${d.getUTCDate()} ${MON.en[d.getUTCMonth()]}`;
}
const ptTime = (t: string) => t.replace(/(\d{2}):(\d{2})/g, (_, h, m) => (m === '00' ? `${h}h` : `${h}h${m}`));
const hoursText = (h: string, lang: Lang) => (h === 'closed' ? (lang === 'pt' ? 'encerrado' : 'closed') : lang === 'pt' ? ptTime(h).replace('–', ' às ') : h);

export function gaiaVilaNatalMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const url = `${SITE}${GAIA_VILA_NATAL_PATHS[lang]}`;
  return {
    title: { absolute: c.title },
    description: c.desc,
    ...(gaiaInSeason() ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${GAIA_VILA_NATAL_PATHS.en}`, 'pt-PT': `${SITE}${GAIA_VILA_NATAL_PATHS.pt}`, 'x-default': `${SITE}${GAIA_VILA_NATAL_PATHS.en}` },
    },
    openGraph: { title: c.title, description: c.desc, url, type: 'article', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

export function GaiaVilaNatal({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[lang];
  const url = `${SITE}${GAIA_VILA_NATAL_PATHS[lang]}`;
  const hub = LANDING_PATHS.christmas[lang];
  const days = upcomingProgramme();
  const eventUrl = `${pt ? '/pt/event/' : '/event/'}${GAIA_EVENT_SLUG}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Event',
        name: 'Gaia Vila Natal 2026',
        startDate: '2026-12-01T18:00:00+00:00',
        endDate: '2027-01-03T22:00:00+00:00',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        url,
        description: c.desc,
        location: [
          { '@type': 'Place', name: 'Centro Cívico de Gaia', address: { '@type': 'PostalAddress', addressLocality: 'Vila Nova de Gaia', addressCountry: 'PT' } },
          { '@type': 'Place', name: 'Cais de Gaia', address: { '@type': 'PostalAddress', addressLocality: 'Vila Nova de Gaia', addressCountry: 'PT' } },
        ],
        organizer: { '@type': 'Organization', name: 'Câmara Municipal de Vila Nova de Gaia', url: 'https://www.cm-gaia.pt' },
      },
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
  const h3 = { fontSize: 17, color: colors.heading, margin: '22px 0 6px' } as const;
  const p = { fontSize: 16, lineHeight: 1.65, margin: '0 0 14px' } as const;
  const link = { color: colors.heading, fontWeight: 600 } as const;
  const box = { background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 8px', fontSize: 16, lineHeight: 1.6 } as const;
  const row = { display: 'flex', gap: 14, padding: '8px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 15, lineHeight: 1.5 } as const;

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
          {pt ? (
            <><strong>De 1 de dezembro de 2026 a 3 de janeiro de 2027, no Centro Cívico e no Cais de Gaia.</strong> Abre na terça-feira, 1 de dezembro (feriado), às 18h, com a inauguração das luzes de Natal e a Parada de Natal. Gaia fica do outro lado do rio, à distância de uma travessia da Ponte Luís I.</>
          ) : (
            <><strong>1 December 2026 to 3 January 2027, at the Centro Cívico and Cais de Gaia.</strong> It opens on Tuesday 1 December (a public holiday) at 18:00 with the Christmas lights switch-on and a Christmas parade. Gaia is just across the river from Porto, over the Dom Luís I bridge.</>
          )}
        </div>

        <h2 style={h2}>{pt ? 'O que há em cada sítio' : "What's where"}</h2>
        <ul style={{ paddingLeft: 20, fontSize: 16, lineHeight: 1.65, margin: '0 0 8px' }}>
          {SITES.map((s) => (
            <li key={s.name.en}><strong>{s.name[lang]}</strong>: {s.items[lang]}</li>
          ))}
        </ul>
        <p style={p}>
          {pt
            ? 'A Câmara de Gaia não publicou preços para a pista de gelo, os carrosséis ou o comboio, nem diz se a entrada nos recintos é livre.'
            : "Gaia City Council hasn't published prices for the ice rink, carousels or train, and doesn't say whether entry to the sites is free."}
        </p>

        <h2 style={h2}>{pt ? 'Horário' : 'Opening hours'}</h2>
        <ul style={{ padding: 0, listStyle: 'none', margin: '0 0 8px' }}>
          {HOURS.map((h) => (
            <li key={h.when.en} style={row}>
              <span style={{ minWidth: 210, fontWeight: 700, color: colors.heading }}>{h.when[lang]}</span>
              <span>{hoursText(h.hours, lang)}</span>
            </li>
          ))}
        </ul>

        <h2 style={h2}>{pt ? 'Videomapping "A Luz que Acordou Gaia"' : 'Videomapping show "A Luz que Acordou Gaia"'}</h2>
        <p style={p}>
          {pt
            ? 'De 5 a 26 de dezembro, exceto 24 e 25. Sessões a partir das 18h; a última começa às 21h30 e é seguida de light painting.'
            : 'From 5 to 26 December, except 24 and 25 December. Sessions from 18:00; the last starts at 21:30 and is followed by light painting.'}
        </p>
        <ul style={{ padding: 0, listStyle: 'none', margin: '0 0 8px' }}>
          {VIDEOMAPPING_HOURS.map((h) => (
            <li key={h.when.en} style={row}>
              <span style={{ minWidth: 210, fontWeight: 700, color: colors.heading }}>{h.when[lang]}</span>
              <span>{hoursText(h.hours, lang)}</span>
            </li>
          ))}
        </ul>

        <h2 style={h2}>{pt ? 'Programa por dia' : 'Programme by day'}</h2>
        <p style={p}>
          {pt
            ? 'Espetáculos, concertos e animação nos fins de semana e feriados, segundo o programa oficial. Os concertos do Palco Varanda são na varanda dos Paços do Concelho.'
            : "Shows, concerts and street entertainment on weekends and holidays, from the official programme. Balcony-stage concerts are on the City Hall (Paços do Concelho) balcony."}
        </p>
        {days.map((d) => (
          <div key={d.date}>
            <h3 style={h3}>{dayLabel(d.date, lang)}{d.note ? ` · ${d.note[lang]}` : ''}</h3>
            <ul style={{ padding: 0, listStyle: 'none', margin: 0 }}>
              {d.slots.map((s) => (
                <li key={s.what.en + s.time} style={row}>
                  <span style={{ minWidth: 150, fontWeight: 700, color: colors.heading }}>{pt ? ptTime(s.time) : s.time}</span>
                  <span>{s.what[lang]}{s.where ? ` (${s.where[lang]})` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {days.length < PROGRAMME.length && days.length > 0 && (
          <p style={{ ...p, fontSize: 14, color: colors.textSoft, marginTop: 12 }}>{pt ? 'Os dias que já passaram foram retirados.' : 'Past days have been removed.'}</p>
        )}

        <div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>

        <h2 style={h2}>{pt ? 'Mais Natal no Porto' : 'More Christmas in Porto'}</h2>
        <ul style={{ paddingLeft: 20, fontSize: 16, lineHeight: 1.8, margin: '0 0 8px' }}>
          <li><Link href={eventUrl} style={link}>{pt ? 'Gaia Vila Natal na nossa agenda' : 'Gaia Vila Natal in our listings'}</Link></li>
          {lightsInSeason() && (
            <li><Link href={CHRISTMAS_LIGHTS_PATHS[lang]} style={link}>{pt ? 'Luzes de Natal do Porto e Matosinhos' : 'Porto Christmas lights and concerts on Aliados'}</Link></li>
          )}
          {christmasKidsIndexable() && (
            <li><Link href={CHRISTMAS_KIDS_PATHS[lang]} style={link}>{pt ? 'Natal com crianças no Porto' : 'Christmas with kids in Porto'}</Link></li>
          )}
          <li><Link href={hub} style={link}>{pt ? 'Natal e Passagem de Ano no Porto' : 'Christmas and New Year in Porto'}</Link></li>
        </ul>

        <h2 style={h2}>{pt ? 'Perguntas frequentes' : 'FAQ'}</h2>
        {FAQ[lang].map((f) => (
          <div key={f.q} style={{ margin: '0 0 16px' }}>
            <div style={{ fontWeight: 700, color: colors.heading, fontSize: 16 }}>{f.q}</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
          </div>
        ))}

        <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, marginTop: 28 }}>
          {pt ? 'Fontes (verificadas a 28 nov 2026):' : 'Sources (checked 28 Nov 2026):'}
          <ul style={{ paddingLeft: 18, margin: '6px 0 0' }}>
            {SOURCES.map((s) => (
              <li key={s.url}><a href={s.url} rel="noopener" style={{ color: 'inherit' }}>{s.label}</a></li>
            ))}
          </ul>
        </div>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
