import Link from 'next/link';
import type { Metadata } from 'next';
import { eventDisplay, type EventRecord } from '@/lib/events';
import { priceText } from '@/lib/event-seo';
import { LANDING_PATHS } from '@/lib/event-landings';
import { CHRISTMAS_CONCERTS_PATHS } from '@/lib/christmas-concerts';
import {
  DECEMBER_HOLIDAYS_PATHS, HOLIDAYS_YEAR, holidaysInSeason, upcomingLongWeekends, weekendEvents, type LongWeekend,
} from '@/lib/december-holidays';
import { portoToday } from '@/lib/event-filters';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';

/**
 * /porto-events/december-long-weekends and /pt/eventos/feriados-de-dezembro
 * (growth item G10, 2026-11-25). Data: lib/december-holidays.ts over our own
 * event records. Hourly ISR so past days drop off without a deploy.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';
const MAX_LONG_RUNS = 8;

const COPY = {
  en: {
    title: `December Long Weekends in Porto ${HOLIDAYS_YEAR}: What's On 28 Nov–1 Dec and 5–8 Dec`,
    h1: `December Long Weekends in Porto ${HOLIDAYS_YEAR}`,
    crumb: 'December long weekends',
    desc: `1 and 8 December ${HOLIDAYS_YEAR} are public holidays on a Tuesday. Concerts, Christmas markets, theatre, football and family events in Porto for both long weekends, day by day, with venues and prices.`,
  },
  pt: {
    title: `Feriados de dezembro no Porto ${HOLIDAYS_YEAR}: o que fazer de 28 nov a 1 dez e de 5 a 8 dez`,
    h1: `Feriados de dezembro no Porto ${HOLIDAYS_YEAR}`,
    crumb: 'Feriados de dezembro',
    desc: `1 e 8 de dezembro de ${HOLIDAYS_YEAR} são feriados à terça-feira. Concertos, mercados de Natal, teatro, futebol e programas para famílias no Porto nos dois fins de semana prolongados, dia a dia, com locais e preços.`,
  },
} as const;

const FAQ = {
  en: [
    { q: `Is 1 December a public holiday in Portugal in ${HOLIDAYS_YEAR}?`, a: `Yes. 1 December, Restoration of Independence Day, is a national public holiday. In ${HOLIDAYS_YEAR} it falls on a Tuesday.` },
    { q: `Is 8 December a public holiday in Portugal in ${HOLIDAYS_YEAR}?`, a: `Yes. 8 December, the Feast of the Immaculate Conception, is a national public holiday. In ${HOLIDAYS_YEAR} it is also a Tuesday.` },
    { q: 'Is Monday a holiday too?', a: 'No. Monday 30 November and Monday 7 December are normal working days, but many people take them off to make a four-day weekend (a "ponte").' },
    { q: 'Are shops and museums open on the holidays?', a: 'Opening hours on public holidays vary from place to place. Check the venue page linked from each event before you go.' },
  ],
  pt: [
    { q: `O dia 1 de dezembro é feriado em ${HOLIDAYS_YEAR}?`, a: `Sim. O 1 de dezembro, Restauração da Independência, é feriado nacional. Em ${HOLIDAYS_YEAR} calha a uma terça-feira.` },
    { q: `O dia 8 de dezembro é feriado em ${HOLIDAYS_YEAR}?`, a: `Sim. O 8 de dezembro, dia da Imaculada Conceição, é feriado nacional. Em ${HOLIDAYS_YEAR} também calha a uma terça-feira.` },
    { q: 'A segunda-feira também é feriado?', a: 'Não. As segundas-feiras 30 de novembro e 7 de dezembro são dias úteis, mas muita gente faz ponte e fica com um fim de semana de quatro dias.' },
    { q: 'As lojas e os museus abrem nos feriados?', a: 'Os horários nos feriados variam de sítio para sítio. Confirme na página do local, a partir de cada evento, antes de ir.' },
  ],
};

const WD = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  pt: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
};
const MONTH = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const dayHeading = (iso: string, lang: Lang) => {
  const x = d(iso);
  return lang === 'pt'
    ? `${WD.pt[x.getUTCDay()]}, ${x.getUTCDate()} de ${MONTH.pt[x.getUTCMonth()]}`
    : `${WD.en[x.getUTCDay()]} ${x.getUTCDate()} ${MONTH.en[x.getUTCMonth()]}`;
};
const shortDate = (iso: string, lang: Lang) => `${d(iso).getUTCDate()} ${MON[lang][d(iso).getUTCMonth()]}`;
const weekendLabel = (w: LongWeekend, lang: Lang) => {
  const a = d(w.from);
  const b = d(w.to);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTH[lang][b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTH[lang][a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTH[lang][b.getUTCMonth()]}`;
};
const time = (e: EventRecord, lang: Lang) => {
  const t = e.date.slice(11, 16);
  if (!t) return '';
  return lang === 'pt' ? t.replace(':00', 'h').replace(':', 'h') : t;
};
const until = (e: EventRecord, lang: Lang) =>
  e.endDate && e.endDate.slice(0, 10) !== e.date.slice(0, 10) ? (lang === 'pt' ? `até ${shortDate(e.endDate, lang)}` : `until ${shortDate(e.endDate, lang)}`) : '';

export function decemberHolidaysMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const url = `${SITE}${DECEMBER_HOLIDAYS_PATHS[lang]}`;
  return {
    title: { absolute: c.title },
    description: c.desc,
    ...(holidaysInSeason() ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${DECEMBER_HOLIDAYS_PATHS.en}`, 'pt-PT': `${SITE}${DECEMBER_HOLIDAYS_PATHS.pt}`, 'x-default': `${SITE}${DECEMBER_HOLIDAYS_PATHS.en}` },
    },
    openGraph: { title: c.title, description: c.desc, url, type: 'website', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

function EventRow({ e, lang }: { e: EventRecord; lang: Lang }) {
  const pt = lang === 'pt';
  const meta = [time(e, lang), e.venue, until(e, lang), priceText(e.price, lang)].filter(Boolean).join(' · ');
  return (
    <li style={{ padding: '10px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 15, lineHeight: 1.5 }}>
      <Link href={`${pt ? '/pt/event/' : '/event/'}${e.slug}`} style={{ color: colors.heading, fontWeight: 600 }}>{eventDisplay(e, lang).name}</Link>
      <div style={{ color: colors.textSoft, fontSize: 14 }}>{meta}</div>
    </li>
  );
}

export function DecemberHolidays({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[lang];
  const url = `${SITE}${DECEMBER_HOLIDAYS_PATHS[lang]}`;
  const today = portoToday();
  const weekends = upcomingLongWeekends(today).map((w) => ({ w, ...weekendEvents(w, today) }));
  const monthHub = pt ? `/pt/eventos/dezembro-${HOLIDAYS_YEAR}` : `/porto-events/december-${HOLIDAYS_YEAR}`;
  const xmas = LANDING_PATHS.christmas[lang];

  const listed = weekends.flatMap((x) => [...Array.from(x.byDay.values()).flat(), ...x.longRuns.slice(0, MAX_LONG_RUNS)]);
  const seen = new Set<string>();
  const items = listed.filter((e) => (seen.has(e.slug) ? false : (seen.add(e.slug), true)));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: c.h1, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' } },
      {
        '@type': 'ItemList',
        itemListElement: items.slice(0, 50).map((e, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE}${pt ? '/pt/event/' : '/event/'}${e.slug}`, name: eventDisplay(e, lang).name,
        })),
      },
      { '@type': 'FAQPage', mainEntity: FAQ[lang].map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: pt ? 'Início' : 'Home', item: pt ? `${SITE}/pt` : SITE },
          { '@type': 'ListItem', position: 2, name: pt ? 'Agenda' : 'Porto Events', item: `${SITE}${pt ? '/pt' : '/porto-events'}` },
          { '@type': 'ListItem', position: 3, name: c.crumb, item: url },
        ],
      },
    ],
  };

  const h2 = { fontFamily: typography.serif, fontSize: 28, color: colors.heading, margin: '40px 0 4px' } as const;
  const h3 = { fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent, margin: '24px 0 4px' } as const;
  const ul = { padding: 0, listStyle: 'none', margin: 0 } as const;
  const box = { background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 8px', fontSize: 16, lineHeight: 1.6 } as const;

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang={lang} active="events" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href={pt ? '/pt' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Início' : 'Home'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href={pt ? '/pt' : '/porto-events'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Agenda' : 'Porto Events'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>{c.crumb}</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.5 }}>{c.h1}</h1>
        <div style={{ marginTop: 16 }}><ShortcutChips lang={lang} /></div>

        <div style={box}>
          {pt
            ? <>Em {HOLIDAYS_YEAR}, os dois feriados de dezembro calham a uma <strong>terça-feira</strong>: 1 de dezembro (Restauração da Independência) e 8 de dezembro (Imaculada Conceição). Com ponte à segunda, são dois fins de semana de quatro dias. Abaixo, o que há no Porto em cada dia, com local e preço.</>
            : <>In {HOLIDAYS_YEAR}, both December public holidays fall on a <strong>Tuesday</strong>: 1 December (Restoration of Independence) and 8 December (Immaculate Conception). Take the Monday off and you get two four-day weekends. Below is what&apos;s on in Porto each day, with venue and price.</>}
        </div>

        {weekends.length === 0 && (
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>
            {pt
              ? <>Os fins de semana prolongados de dezembro já passaram. Veja o <Link href={xmas} style={{ color: colors.heading, fontWeight: 600 }}>Natal e a Passagem de Ano no Porto</Link>.</>
              : <>December&apos;s long weekends are over. See <Link href={xmas} style={{ color: colors.heading, fontWeight: 600 }}>Christmas and New Year in Porto</Link>.</>}
          </p>
        )}

        {weekends.map(({ w, byDay, longRuns, total }, i) => (
          <section key={w.from}>
            <h2 style={h2}>{weekendLabel(w, lang)}: {pt ? w.holiday.pt : w.holiday.en}</h2>
            <p style={{ fontSize: 15, color: colors.textSoft, margin: '0 0 8px' }}>
              {pt
                ? `${total} evento${total === 1 ? '' : 's'}${longRuns.length ? `, e ${longRuns.length} exposições e eventos longos a decorrer` : ''}.`
                : `${total} event${total === 1 ? '' : 's'}${longRuns.length ? `, plus ${longRuns.length} exhibitions and longer runs` : ''}.`}
            </p>
            {Array.from(byDay.entries()).map(([dayIso, evs]) => (
              <div key={dayIso}>
                <h3 style={h3}>{dayHeading(dayIso, lang)}{dayIso === w.to ? (pt ? ' (feriado)' : ' (holiday)') : ''}</h3>
                {evs.length > 0
                  ? <ul style={ul}>{evs.map((e) => <EventRow key={e.slug} e={e} lang={lang} />)}</ul>
                  : <p style={{ fontSize: 15, color: colors.textSoft, margin: '4px 0' }}>{pt ? 'Ainda sem eventos listados para este dia.' : 'No events listed for this day yet.'}</p>}
              </div>
            ))}
            {longRuns.length > 0 && (
              <div>
                <h3 style={h3}>{pt ? 'Também a decorrer' : 'Also on'}</h3>
                <ul style={ul}>{longRuns.slice(0, MAX_LONG_RUNS).map((e) => <EventRow key={e.slug} e={e} lang={lang} />)}</ul>
                {longRuns.length > MAX_LONG_RUNS && (
                  <p style={{ fontSize: 14, margin: '8px 0 0' }}>
                    <Link href={monthHub} style={{ color: colors.heading }}>
                      {pt ? `Mais ${longRuns.length - MAX_LONG_RUNS} na agenda de dezembro` : `${longRuns.length - MAX_LONG_RUNS} more in the December listings`} →
                    </Link>
                  </p>
                )}
              </div>
            )}
            {i === 0 && <div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>}
          </section>
        ))}

        <h2 style={h2}>{pt ? 'Perguntas frequentes' : 'FAQ'}</h2>
        {FAQ[lang].map((f) => (
          <div key={f.q} style={{ margin: '12px 0 16px' }}>
            <div style={{ fontWeight: 700, color: colors.heading, fontSize: 16 }}>{f.q}</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
          </div>
        ))}

        <p style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, marginTop: 24 }}>
          {pt
            ? 'Cada evento vem da página do organizador ou do local, ligada na página do evento. Feriados: artigo 234.º do Código do Trabalho.'
            : "Every event comes from the organiser's or venue's page, linked on the event page. Holidays: article 234 of Portugal's Labour Code."}
        </p>

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 40, fontSize: 14, flexWrap: 'wrap' }}>
          <Link href={monthHub} style={{ color: colors.heading }}>{pt ? `Tudo em dezembro de ${HOLIDAYS_YEAR}` : `Everything in December ${HOLIDAYS_YEAR}`} →</Link>
          <Link href={CHRISTMAS_CONCERTS_PATHS[lang]} style={{ color: colors.heading }}>{pt ? 'Concertos de Natal' : 'Christmas concerts'}</Link>
          <Link href={xmas} style={{ color: colors.textSoft }}>{pt ? 'Natal e Passagem de Ano' : 'Christmas and New Year'}</Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
