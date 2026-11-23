import Link from 'next/link';
import type { Metadata } from 'next';
import { eventDisplay } from '@/lib/events';
import { LANDING_PATHS, christmasSeason, landingEvents } from '@/lib/event-landings';
import { CHRISTMAS_LIGHTS_PATHS, ALIADOS_SHOWS, SOURCES, MATOSINHOS_ANCHOR, lightsInSeason } from '@/lib/christmas-lights';
import { CHRISTMAS_CONCERTS_PATHS, concertsInSeason } from '@/lib/christmas-concerts';
import { filterOptions, toFilterItem } from '@/lib/event-listing';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';
import { EventFilters } from '@/app/components/EventFilters';
import { InlineGuideCard } from '@/app/components/RelatedGuide';
import { listBlogPosts, listBlogPostsPT } from '@/lib/blog';
import { guideForList } from '@/lib/related-guides';

/**
 * /porto-events/christmas-lights and /pt/eventos/luzes-de-natal (growth item
 * G1, 2026-11-21). Verified facts for the 2026 switch-on live in
 * lib/christmas-lights.ts; the event list below is the Christmas hub's.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

const COPY = {
  en: {
    title: 'Porto Christmas Lights 2026: Switch-On Date, Tree and Concerts',
    h1: 'Porto Christmas Lights 2026',
    crumb: 'Christmas lights',
    desc: "Porto switches on its Christmas lights on Saturday 28 November 2026 at 18:00 on Avenida dos Aliados, with the tree lighting and a show. Concerts, what's on until 10 January, and Matosinhos.",
  },
  pt: {
    title: 'Luzes de Natal Porto e Matosinhos 2026: inauguração e árvore',
    h1: 'Luzes de Natal no Porto 2026',
    crumb: 'Luzes de Natal',
    desc: 'A inauguração das luzes de Natal do Porto é no sábado, 28 de novembro de 2026, às 18h, na Avenida dos Aliados, com a árvore e um espetáculo. Concertos, programação até 10 de janeiro e o Mercado de Natal de Matosinhos.',
  },
} as const;

const FAQ = {
  en: [
    { q: 'When are the Christmas lights switched on in Porto in 2026?', a: 'On Saturday 28 November 2026 at 18:00, on Avenida dos Aliados. The Christmas tree in Praça do General Humberto Delgado is lit at the same time.' },
    { q: 'Who performs at the Porto Christmas lights switch-on?', a: 'Áurea, Ricardo Ribeiro and soprano Marina Pacheco, with the Orquestra Portuguesa de Guitarras e Bandolins and conductor Hélder Magalhães. The show mixes music, dance, light and fireworks.' },
    { q: "How long does Porto's Christmas programme run?", a: "From 28 November 2026 to 10 January 2027. The city hasn't published the date the street lights go off." },
    { q: 'When is the Matosinhos Christmas market in 2026?', a: 'From 27 November to 23 December 2026 in Parque Basílio Teles, opposite Matosinhos City Hall. Entry is free.' },
    { q: 'When is the Christmas tree lit in Matosinhos in 2026?', a: "Matosinhos City Council hasn't announced the 2026 date yet (checked 21 November). In 2025 its Christmas season started on Friday 28 November." },
  ],
  pt: [
    { q: 'Quando é a inauguração das luzes de Natal no Porto em 2026?', a: 'No sábado, 28 de novembro de 2026, às 18h, na Avenida dos Aliados. A Árvore de Natal na Praça do General Humberto Delgado acende-se no mesmo momento.' },
    { q: 'Quem atua na inauguração das luzes de Natal do Porto?', a: 'Áurea, Ricardo Ribeiro e a soprano Marina Pacheco, com a Orquestra Portuguesa de Guitarras e Bandolins e o maestro Hélder Magalhães. O espetáculo junta música, dança, luz e pirotecnia.' },
    { q: 'Até quando dura a programação de Natal no Porto?', a: 'De 28 de novembro de 2026 a 10 de janeiro de 2027. A Câmara ainda não divulgou a data em que as iluminações se desligam.' },
    { q: 'Quando é o Mercado de Natal de Matosinhos 2026?', a: 'De 27 de novembro a 23 de dezembro de 2026, no Parque Basílio Teles, em frente à Câmara Municipal de Matosinhos. A entrada é livre.' },
    { q: 'Quando se acende a árvore de Natal em Matosinhos em 2026?', a: 'A Câmara de Matosinhos ainda não anunciou a data de 2026 (verificado a 21 de novembro). Em 2025, o Natal em Matosinhos arrancou na sexta-feira, 28 de novembro.' },
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

export function christmasLightsMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_LIGHTS_PATHS[lang]}`;
  return {
    title: { absolute: c.title },
    description: c.desc,
    ...(lightsInSeason() ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${CHRISTMAS_LIGHTS_PATHS.en}`, 'pt-PT': `${SITE}${CHRISTMAS_LIGHTS_PATHS.pt}`, 'x-default': `${SITE}${CHRISTMAS_LIGHTS_PATHS.en}` },
    },
    openGraph: { title: c.title, description: c.desc, url, type: 'article', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

export function ChristmasLights({ lang }: { lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[lang];
  const url = `${SITE}${CHRISTMAS_LIGHTS_PATHS[lang]}`;
  const eventsHub = pt ? '/pt' : '/porto-events';
  const hub = LANDING_PATHS.christmas[lang];
  const { main, longRuns } = landingEvents('christmas');
  const all = [...main, ...longRuns];
  const listGuide = guideForList({ kind: 'christmas' }, pt ? listBlogPostsPT() : listBlogPosts());
  const items = all.map((e) => toFilterItem(e, lang));
  const year = christmasSeason().year;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: c.h1, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Avenida dos Aliados, Porto', addressCountry: 'PT' } },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ[lang].map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      ...(all.length ? [{
        '@type': 'ItemList',
        itemListElement: all.slice(0, 30).map((e, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE}${pt ? '/pt/event/' : '/event/'}${e.slug}`, name: eventDisplay(e, lang).name,
        })),
      }] : []),
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
          {pt ? (
            <><strong>Inauguração: sábado, 28 de novembro de 2026, às 18h, na Avenida dos Aliados.</strong> Acendem-se as luzes de Natal da cidade e a Árvore de Natal na Praça do General Humberto Delgado, em frente à Câmara, com um espetáculo de música, dança, luz e pirotecnia.</>
          ) : (
            <><strong>Switch-on: Saturday 28 November 2026, 18:00, Avenida dos Aliados.</strong> The city&apos;s Christmas lights and the Christmas tree in Praça do General Humberto Delgado, in front of City Hall, go on together, with a show of music, dance, light and fireworks.</>
          )}
        </div>

        <h2 style={h2}>{pt ? 'A inauguração' : 'The switch-on night'}</h2>
        <p style={p}>
          {pt
            ? 'Atuam Áurea, Ricardo Ribeiro e a soprano Marina Pacheco, com a Orquestra Portuguesa de Guitarras e Bandolins e o maestro Hélder Magalhães. A Câmara promete ainda surpresas para esse fim de tarde. Os concertos nos Aliados têm interpretação em Língua Gestual Portuguesa e rampas de acesso.'
            : 'Áurea, Ricardo Ribeiro and soprano Marina Pacheco perform with the Orquestra Portuguesa de Guitarras e Bandolins and conductor Hélder Magalhães, and the city says there will be a few surprises. Concerts on Aliados have Portuguese Sign Language interpretation and ramp access.'}
        </p>
        <p style={p}>
          {pt
            ? 'As iluminações resultam de uma parceria entre a Câmara Municipal do Porto e a Associação dos Comerciantes do Porto, com uma comparticipação máxima da Câmara de 765 mil euros. Este ano a prioridade é o centro da cidade, sem deixar de fora as outras zonas do concelho.'
            : 'The lights are a partnership between Porto City Council and the Associação dos Comerciantes do Porto (the city traders’ association), with the council paying up to €765,000 this year. The focus is the city centre, with lights in the rest of the city too.'}
        </p>

        <h2 style={h2}>{pt ? 'Até quando' : 'How long it lasts'}</h2>
        <p style={p}>
          {pt
            ? 'A programação de Natal do Porto vai de 28 de novembro de 2026 a 10 de janeiro de 2027. A Câmara ainda não divulgou a data em que as luzes se desligam.'
            : "Porto's Christmas programme runs from 28 November 2026 to 10 January 2027. The city hasn't announced the date the lights go off."}
        </p>

        <h2 style={h2}>{pt ? 'Concertos nos Aliados' : 'Concerts on Avenida dos Aliados'}</h2>
        <ul style={{ padding: 0, listStyle: 'none', margin: '0 0 8px' }}>
          {ALIADOS_SHOWS.map((s) => (
            <li key={s.date} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 15, lineHeight: 1.5 }}>
              <span style={{ minWidth: 112, fontWeight: 700, color: colors.heading }}>{shortDate(s.date, lang)}, {pt ? s.time.replace(':00', 'h') : s.time}</span>
              <span>{pt ? s.pt : s.en}</span>
            </li>
          ))}
        </ul>
        {concertsInSeason() && (
          <p style={{ ...p, marginTop: 14 }}>
            <Link href={CHRISTMAS_CONCERTS_PATHS[lang]} style={link}>
              {pt ? 'Todos os concertos de Natal no Porto, por data' : 'All Christmas concerts in Porto, by date'} →
            </Link>
          </p>
        )}

        <h2 style={h2}>{pt ? 'Natal pela cidade' : 'Christmas around the city'}</h2>
        <ul style={{ paddingLeft: 20, fontSize: 16, lineHeight: 1.65, margin: '0 0 8px' }}>
          {pt ? (
            <>
              <li><strong>Praça da Fantasia</strong>, na Rotunda da Boavista (Praça de Mouzinho de Albuquerque), de 28 de novembro a 10 de janeiro: pista e rampa de gelo, carrosséis, comboio de Natal e bancas de artesanato e produtos regionais.</li>
              <li><strong>Largo do Amor de Perdição</strong>: espetáculos de escolas artísticas e coletivos da cidade, oficinas para todas as idades, a Casa do Pai Natal e uma Rádio de Natal. Pela primeira vez há uma Sala de Regulação Sensorial e um playground da associação SIRCULOS, de acesso livre.</li>
              <li><strong>Corrida de São Silvestre</strong>: domingo, 20 de dezembro.</li>
              <li><strong>Oratória de Natal de Bach</strong> (BWV 248), na íntegra, em seis igrejas do Centro Histórico, de 25 de dezembro a 6 de janeiro.</li>
              <li>Coros e orquestras nas igrejas, por exemplo o Orfeão Universitário do Porto (Igreja do Santíssimo Sacramento, 11 de dezembro, 21h30) e a Orquestra XXI (Igreja do Bonfim, 20 de dezembro, 17h).</li>
            </>
          ) : (
            <>
              <li><strong>Praça da Fantasia</strong> at the Boavista roundabout (Praça de Mouzinho de Albuquerque), 28 November to 10 January: an ice rink and ice slide, carousels, a Christmas train, and craft and regional food stalls.</li>
              <li><strong>Largo do Amor de Perdição</strong>: shows by the city&apos;s arts schools and groups, workshops for all ages, Santa&apos;s House and a Christmas radio. New this year: a sensory regulation room and a playground run by the SIRCULOS association, both free to enter.</li>
              <li><strong>São Silvestre race</strong>: Sunday 20 December.</li>
              <li><strong>Bach&apos;s Christmas Oratorio</strong> (BWV 248), performed in full across six churches in the historic centre, 25 December to 6 January.</li>
              <li>Choirs and orchestras in churches, for example the Orfeão Universitário do Porto (Igreja do Santíssimo Sacramento, 11 December, 21:30) and Orquestra XXI (Igreja do Bonfim, 20 December, 17:00).</li>
            </>
          )}
        </ul>

        <h2 id={MATOSINHOS_ANCHOR} style={{ ...h2, scrollMarginTop: 80 }}>{pt ? 'Natal em Matosinhos' : 'Christmas in Matosinhos 2026'}</h2>
        {pt ? (
          <>
            <p style={p}>
              <strong>Árvore e luzes de Natal:</strong> a Câmara de Matosinhos ainda não anunciou a data do acendimento de 2026 (verificado a 21 de novembro). Atualizamos esta secção assim que for publicada. Para referência, em 2025 o Natal em Matosinhos arrancou na sexta-feira, 28 de novembro.
            </p>
            <ul style={{ paddingLeft: 20, fontSize: 16, lineHeight: 1.65, margin: '0 0 8px' }}>
              <li><strong>Mercado de Natal de Matosinhos</strong> (20.ª edição): de 27 de novembro a 23 de dezembro, no Parque Basílio Teles, em frente à Câmara Municipal. Entrada livre. Cerca de 80 artesãos de todo o país, com queijos, doces, enchidos, joalharia, roupa e brinquedos. Aberto de domingo a quinta, das 12h às 20h; sextas, sábados e vésperas de feriado, das 12h às 23h. Organização da associação Andarte, com o apoio da Câmara.</li>
              <li><strong>ArchiMarket</strong>, o mercado de design da Casa da Arquitectura, também é apontado para esta época, mas ainda sem datas.</li>
            </ul>
          </>
        ) : (
          <>
            <div style={box}>
              <strong>Matosinhos Christmas market: 27 November to 23 December 2026, Parque Basílio Teles</strong> (opposite Matosinhos City Hall). Free entry. Open Sunday to Thursday 12:00 to 20:00; Friday, Saturday and the eve of public holidays 12:00 to 23:00.
            </div>
            <ul style={{ paddingLeft: 20, fontSize: 16, lineHeight: 1.65, margin: '12px 0 8px' }}>
              <li><strong>What&apos;s there:</strong> the 20th edition of the Mercado de Natal, with about 80 artisans from around Portugal selling cheese, sweets, cured meats, jewellery, clothes and toys. Run by the Andarte association with council support.</li>
              <li><strong>Tree and lights:</strong> Matosinhos City Council hasn&apos;t announced the 2026 switch-on date yet (checked 21 November). We&apos;ll add it here as soon as it&apos;s out. For reference, the 2025 season started on Friday 28 November.</li>
              <li><strong>ArchiMarket</strong>, the design market at Casa da Arquitectura, is also expected this season, with no dates announced yet.</li>
              <li><strong>Porto&apos;s big switch-on</strong> is close by: Saturday 28 November, 18:00, Avenida dos Aliados (see the top of this page).</li>
            </ul>
          </>
        )}

        <h2 style={h2}>{pt ? `Eventos de Natal no Porto ${year}` : `Christmas events in Porto ${year}`}</h2>
        <p style={p}>
          {pt
            ? <>Concertos, espetáculos e festas de fim de ano que já estão na nossa agenda. A lista completa está em <Link href={hub} style={link}>Natal e Passagem de Ano no Porto</Link>.</>
            : <>Concerts, shows and New Year&apos;s Eve parties already in our listings. The full list is on <Link href={hub} style={link}>Christmas and New Year in Porto</Link>.</>}
        </p>
        {all.length > 0 ? (
          <EventFilters
            lang={lang}
            options={filterOptions(items, lang)}
            hide={['price', 'when']}
            groups={[
              { key: 'main', items: items.slice(0, main.length) },
              { key: 'long', title: pt ? 'Também a decorrer' : 'Also on', note: pt ? 'Exposições e eventos mais longos.' : 'Exhibitions and longer runs.', items: items.slice(main.length) },
            ]}
            afterFirst={<div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>}
            inline={<InlineGuideCard guide={listGuide} lang={lang} />}
          />
        ) : (
          <SubscribeCTA lang={lang} context="event" />
        )}

        <h2 style={h2}>{pt ? 'Perguntas frequentes' : 'FAQ'}</h2>
        {FAQ[lang].map((f) => (
          <div key={f.q} style={{ margin: '0 0 16px' }}>
            <div style={{ fontWeight: 700, color: colors.heading, fontSize: 16 }}>{f.q}</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
          </div>
        ))}

        <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.6, marginTop: 28 }}>
          {pt ? 'Fontes (verificadas a 21 nov 2026):' : 'Sources (checked 21 Nov 2026):'}
          <ul style={{ paddingLeft: 18, margin: '6px 0 0' }}>
            {SOURCES.map((s) => (
              <li key={s.url}><a href={s.url} rel="noopener" style={{ color: 'inherit' }}>{s.label}</a></li>
            ))}
          </ul>
        </div>

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 40, fontSize: 14, flexWrap: 'wrap' }}>
          <Link href={hub} style={{ color: colors.heading }}>{pt ? 'Natal e Passagem de Ano no Porto' : 'Christmas and New Year in Porto'} →</Link>
          <Link href={pt ? `/pt/eventos/dezembro-${year}` : `/porto-events/december-${year}`} style={{ color: colors.heading }}>
            {pt ? `Tudo em dezembro de ${year}` : `Everything in December ${year}`}
          </Link>
          <Link href={eventsHub} style={{ color: colors.textSoft }}>{pt ? 'Agenda desta semana' : 'All upcoming events'}</Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
