import Link from 'next/link';
import type { Metadata } from 'next';
import { eventDisplay, getEvent, type EventRecord } from '@/lib/events';
import { priceText } from '@/lib/event-seo';
import { LANDING_PATHS } from '@/lib/event-landings';
import { CHRISTMAS_LIGHTS_PATHS, SEASON_END, SOURCES as LIGHTS_SOURCES } from '@/lib/christmas-lights';
import { CHRISTMAS_CONCERTS_PATHS } from '@/lib/christmas-concerts';
import {
  CHRISTMAS_KIDS_PATHS, KIDS_XMAS_YEAR, byWeek, christmasKidsEvents, christmasKidsIndexable,
} from '@/lib/christmas-kids';
import { portoToday } from '@/lib/event-filters';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';

/**
 * /porto-events/christmas-with-kids and /pt/eventos/natal-com-criancas
 * (growth item G11, 2026-11-27). Data: lib/christmas-kids.ts over our own
 * event records, plus the city's programme facts already sourced for the
 * lights page (porto.pt). Hourly ISR so past events drop off without a deploy.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

/** Records the FAQ answers come from; a question is skipped if its record is gone or over. */
const SANTA = 'casa-do-pai-natal-largo-do-amor-de-perdicao-nov-29-2026';
const CIRCUS = 'circo-coliseu-porto-ageas-2026-coliseu-porto-ageas-dec-11-2026';
const ZOO = 'luzes-selvagens-wild-lights-santo-inacio-zoo-oct-17-2026';

const COPY = {
  en: {
    title: `Christmas with Kids in Porto ${KIDS_XMAS_YEAR}: Santa, Circus, Shows and Family Events`,
    h1: `Christmas with Kids in Porto ${KIDS_XMAS_YEAR}`,
    crumb: 'Christmas with kids',
    desc: `What to do with children in Porto this Christmas: Santa's House, the Coliseu circus, an ice rink at Boavista, kids' shows, Christmas films and family concerts, week by week with dates, venues and prices.`,
  },
  pt: {
    title: `Natal com crianças no Porto ${KIDS_XMAS_YEAR}: Pai Natal, circo, espetáculos e programas para famílias`,
    h1: `Natal com crianças no Porto ${KIDS_XMAS_YEAR}`,
    crumb: 'Natal com crianças',
    desc: `O que fazer com crianças no Porto neste Natal: Casa do Pai Natal, circo do Coliseu, pista de gelo na Boavista, teatro infantil, filmes de Natal e concertos para famílias, semana a semana, com datas, locais e preços.`,
  },
} as const;

const MONTH = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const WD = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
};
const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const shortDate = (iso: string, lang: Lang) => `${d(iso).getUTCDate()} ${MON[lang][d(iso).getUTCMonth()]}`;
const longDate = (iso: string, lang: Lang) =>
  lang === 'pt' ? `${d(iso).getUTCDate()} de ${MONTH.pt[d(iso).getUTCMonth()]}` : `${d(iso).getUTCDate()} ${MONTH.en[d(iso).getUTCMonth()]}`;
const weekLabel = (monday: string, lang: Lang) => {
  const a = d(monday);
  const b = new Date(a.getTime() + 6 * 86_400_000);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTH[lang][b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTH[lang][a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTH[lang][b.getUTCMonth()]}`;
};
const when = (e: EventRecord, lang: Lang) => {
  const x = d(e.date);
  const t = e.date.slice(11, 16);
  const tt = t ? (lang === 'pt' ? t.replace(':00', 'h').replace(':', 'h') : t) : '';
  return [`${WD[lang][x.getUTCDay()]} ${shortDate(e.date, lang)}`, tt].filter(Boolean).join(', ');
};
const until = (e: EventRecord, lang: Lang) =>
  e.endDate && e.endDate.slice(0, 10) !== e.date.slice(0, 10) ? (lang === 'pt' ? `até ${shortDate(e.endDate, lang)}` : `until ${shortDate(e.endDate, lang)}`) : '';
const live = (slug: string, today: string) => {
  const e = getEvent(slug);
  return e && (e.endDate ?? e.date).slice(0, 10) >= today ? e : null;
};

function faq(lang: Lang, today: string): { q: string; a: string }[] {
  const pt = lang === 'pt';
  const out: { q: string; a: string }[] = [];
  const santa = live(SANTA, today);
  const circus = live(CIRCUS, today);
  const zoo = live(ZOO, today);
  if (santa && santa.endDate) {
    out.push(pt
      ? { q: 'Onde é que as crianças podem ver o Pai Natal no Porto?', a: `Na Casa do Pai Natal, no Largo do Amor de Perdição, de ${longDate(santa.date, lang)} a ${longDate(santa.endDate, lang)}. A entrada é livre.` }
      : { q: 'Where can kids meet Santa in Porto?', a: `At Santa's House (Casa do Pai Natal) on Largo do Amor de Perdição, from ${longDate(santa.date, lang)} to ${longDate(santa.endDate, lang)}. Entry is free.` });
  }
  if (today <= SEASON_END) {
    out.push(pt
      ? { q: 'Há pista de gelo no Porto neste Natal?', a: `Sim. A Praça da Fantasia, na Rotunda da Boavista (Praça de Mouzinho de Albuquerque), tem pista e rampa de gelo, carrosséis e um comboio de Natal, de 28 de novembro de ${KIDS_XMAS_YEAR} a 10 de janeiro de ${KIDS_XMAS_YEAR + 1}.` }
      : { q: 'Is there an ice rink in Porto this Christmas?', a: `Yes. Praça da Fantasia at the Boavista roundabout (Praça de Mouzinho de Albuquerque) has an ice rink and ice slide, carousels and a Christmas train, from 28 November ${KIDS_XMAS_YEAR} to 10 January ${KIDS_XMAS_YEAR + 1}.` });
  }
  if (circus && circus.endDate) {
    out.push(pt
      ? { q: 'Quando é o circo de Natal do Coliseu?', a: `O Circo Coliseu Porto Ageas ${KIDS_XMAS_YEAR} está em cena de ${longDate(circus.date, lang)} a ${longDate(circus.endDate, lang)}${circus.price ? `, com bilhetes de ${priceText(circus.price, lang)}` : ''}.` }
      : { q: 'When is the Coliseu Christmas circus?', a: `The Coliseu Porto Ageas circus runs from ${longDate(circus.date, lang)} to ${longDate(circus.endDate, lang)}${circus.price ? `, with tickets at ${priceText(circus.price, lang)}` : ''}.` });
  }
  if (zoo && zoo.endDate) {
    out.push(pt
      ? { q: 'O que é o Luzes Selvagens?', a: `Um percurso noturno com figuras de animais iluminadas no Zoo Santo Inácio, em Gaia, até ${longDate(zoo.endDate, lang)}. Abre aos fins de semana, feriados e férias escolares.` }
      : { q: 'What is Luzes Selvagens (Wild Lights)?', a: `A night-time trail of lit animal figures at Santo Inácio Zoo in Gaia, until ${longDate(zoo.endDate, lang)}. It opens on weekends, public holidays and school holidays.` });
  }
  return out;
}

export function christmasKidsMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_KIDS_PATHS[lang]}`;
  return {
    title: { absolute: c.title },
    description: c.desc,
    ...(christmasKidsIndexable() ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${CHRISTMAS_KIDS_PATHS.en}`, 'pt-PT': `${SITE}${CHRISTMAS_KIDS_PATHS.pt}`, 'x-default': `${SITE}${CHRISTMAS_KIDS_PATHS.en}` },
    },
    openGraph: { title: c.title, description: c.desc, url, type: 'website', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

function EventRow({ e, lang, run }: { e: EventRecord; lang: Lang; run?: boolean }) {
  const pt = lang === 'pt';
  const meta = [run ? until(e, lang) : when(e, lang), e.venue, run ? '' : until(e, lang), priceText(e.price, lang)].filter(Boolean).join(' · ');
  return (
    <li style={{ padding: '10px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 15, lineHeight: 1.5 }}>
      <Link href={`${pt ? '/pt/event/' : '/event/'}${e.slug}`} style={{ color: colors.heading, fontWeight: 600 }}>{eventDisplay(e, lang).name}</Link>
      <div style={{ color: colors.textSoft, fontSize: 14 }}>{meta}</div>
    </li>
  );
}

export function ChristmasKids({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_KIDS_PATHS[lang]}`;
  const today = portoToday();
  const { main, longRuns } = christmasKidsEvents();
  const weeks = Array.from(byWeek(main, today).entries());
  const free = [...main, ...longRuns].filter((e) => /^(free|gr[aá]tis|gratuito|entrada livre)/i.test(e.price ?? '')).length;
  const total = main.length + longRuns.length;
  const kids = LANDING_PATHS.kids[lang];
  const xmas = LANDING_PATHS.christmas[lang];
  const questions = faq(lang, today);
  const cityProgramme = LIGHTS_SOURCES[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: c.h1, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' } },
      {
        '@type': 'ItemList',
        itemListElement: [...longRuns, ...main].slice(0, 50).map((e, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE}${pt ? '/pt/event/' : '/event/'}${e.slug}`, name: eventDisplay(e, lang).name,
        })),
      },
      ...(questions.length ? [{ '@type': 'FAQPage', mainEntity: questions.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
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
  const ul = { padding: 0, listStyle: 'none', margin: 0 } as const;
  const box = { background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 8px', fontSize: 16, lineHeight: 1.6 } as const;
  const link = { color: colors.heading, fontWeight: 600 } as const;

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

        {total > 0 && (
          <p style={{ fontSize: 16, color: colors.textSoft, lineHeight: 1.6, margin: '20px 0 0' }}>
            {pt
              ? `${total} programas para crianças e famílias no Porto até 10 de janeiro${free ? `, ${free} de entrada livre` : ''}. Cada um vem da página do organizador ou do local, com datas, local e preço.`
              : `${total} things to do with kids in Porto until 10 January${free ? `, ${free} of them free` : ''}. Each one comes from the organiser's or venue's page, with dates, venue and price.`}
          </p>
        )}

        {today <= SEASON_END && (
          <div style={box}>
            {pt ? (
              <>
                <strong>Programa da cidade:</strong> a <strong>Praça da Fantasia</strong>, na Rotunda da Boavista, tem pista e rampa de gelo, carrosséis e comboio de Natal, de 28 de novembro a 10 de janeiro. No <strong>Largo do Amor de Perdição</strong> há a Casa do Pai Natal, oficinas para todas as idades e, pela primeira vez, uma Sala de Regulação Sensorial e um playground de acesso livre. <a href={cityProgramme.url} style={link} rel="noopener" target="_blank">Fonte: porto.pt</a>
              </>
            ) : (
              <>
                <strong>The city&apos;s programme:</strong> <strong>Praça da Fantasia</strong> at the Boavista roundabout has an ice rink and ice slide, carousels and a Christmas train, 28 November to 10 January. <strong>Largo do Amor de Perdição</strong> has Santa&apos;s House, workshops for all ages and, new this year, a sensory regulation room and a playground, both free to enter. <a href={cityProgramme.url} style={link} rel="noopener" target="_blank">Source: porto.pt (in Portuguese)</a>
              </>
            )}
          </div>
        )}

        {total === 0 && (
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>
            {pt
              ? <>O Natal deste ano já passou. Veja os <Link href={kids} style={link}>eventos para crianças no Porto</Link>.</>
              : <>This year&apos;s Christmas season is over. See <Link href={kids} style={link}>kids and family events in Porto</Link>.</>}
          </p>
        )}

        {longRuns.length > 0 && (
          <section>
            <h2 style={h2}>{pt ? 'Durante a época' : 'On all season'}</h2>
            <p style={{ fontSize: 15, color: colors.textSoft, margin: '0 0 8px' }}>
              {pt ? 'Programas que duram semanas, por ordem de fecho.' : 'Running for weeks, closing soonest first.'}
            </p>
            <ul style={ul}>{longRuns.map((e) => <EventRow key={e.slug} e={e} lang={lang} run />)}</ul>
          </section>
        )}

        {weeks.map(([monday, evs], i) => (
          <section key={monday}>
            <h2 style={h2}>{pt ? `Semana de ${weekLabel(monday, lang)}` : `Week of ${weekLabel(monday, lang)}`}</h2>
            <ul style={ul}>{evs.map((e) => <EventRow key={e.slug} e={e} lang={lang} />)}</ul>
            {i === 0 && <div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>}
          </section>
        ))}

        {questions.length > 0 && (
          <>
            <h2 style={h2}>{pt ? 'Perguntas frequentes' : 'FAQ'}</h2>
            {questions.map((f) => (
              <div key={f.q} style={{ margin: '12px 0 16px' }}>
                <div style={{ fontWeight: 700, color: colors.heading, fontSize: 16 }}>{f.q}</div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
              </div>
            ))}
          </>
        )}

        <p style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, marginTop: 24 }}>
          {pt
            ? 'Horários e idades mínimas variam: confirme na página do evento antes de ir. Juntamos novos programas à medida que os locais os anunciam.'
            : 'Times and minimum ages vary, so check the event page before you go. We add new events as venues announce them.'}
        </p>

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 40, fontSize: 14, flexWrap: 'wrap' }}>
          <Link href={kids} style={{ color: colors.heading }}>{pt ? 'Todos os eventos para crianças' : 'All kids and family events'} →</Link>
          <Link href={CHRISTMAS_LIGHTS_PATHS[lang]} style={{ color: colors.heading }}>{pt ? 'Luzes de Natal' : 'Christmas lights'}</Link>
          <Link href={CHRISTMAS_CONCERTS_PATHS[lang]} style={{ color: colors.heading }}>{pt ? 'Concertos de Natal' : 'Christmas concerts'}</Link>
          <Link href={xmas} style={{ color: colors.textSoft }}>{pt ? 'Natal e Passagem de Ano' : 'Christmas and New Year'}</Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
