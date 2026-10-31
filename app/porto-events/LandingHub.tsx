import Link from 'next/link';
import type { Metadata } from 'next';
import { eventDisplay, subcategoryOf, type EventRecord } from '@/lib/events';
import { SUBCATEGORY_LABEL, SUBCATEGORY_LABEL_PT } from '@/lib/event-categories';
import { DAY_HUB_PATHS, dayHubRange, listingsPending } from '@/lib/event-days';
import { LANDING_PATHS, MIN_INDEXABLE, landingEvents, type LandingKind } from '@/lib/event-landings';
import { filterOptions, toFilterItem } from '@/lib/event-listing';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';
import { EventFilters } from '@/app/components/EventFilters';

/**
 * Landing pages for high-intent filter combos (lib/event-landings.ts):
 * /porto-events/free, /porto-events/kids, /porto-events/this-weekend/free
 * and their PT twins under /pt/eventos. Hourly ISR like the day hubs.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
function weekendLabel(lang: Lang): string {
  const { from, to } = dayHubRange('weekend');
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  const m = MON[lang];
  if (from === to) return `${a.getUTCDate()} ${m[a.getUTCMonth()]}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${m[a.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${m[a.getUTCMonth()]} – ${b.getUTCDate()} ${m[b.getUTCMonth()]}`;
}

const COPY = {
  free: {
    en: {
      h1: 'Free Events in Porto',
      title: 'Free Things to Do in Porto: Free Events This Week',
      crumb: 'Free',
      desc: (n: number) => `${n ? `${n} free events` : 'Free events'} coming up in Porto, with dates, venues and times. No ticket needed. Picked by Oporto Weekly and updated every Thursday.`,
      empty: 'No free events are listed right now. New ones arrive with every Thursday edition.',
    },
    pt: {
      h1: 'Eventos grátis no Porto',
      title: 'Eventos grátis no Porto: o que fazer sem pagar',
      crumb: 'Grátis',
      desc: (n: number) => `${n ? `${n} eventos grátis` : 'Eventos grátis'} nos próximos dias no Porto, com datas, locais e horários. Sem bilhete. Escolhidos pela Oporto Weekly e atualizados todas as quintas.`,
      empty: 'Não há eventos grátis listados neste momento. Chegam novos com cada edição de quinta-feira.',
    },
  },
  kids: {
    en: {
      h1: 'Kids & Family Events in Porto',
      title: 'Porto with Kids: Family Events and Activities',
      crumb: 'Kids & family',
      desc: (n: number) => `${n ? `${n} upcoming` : 'Upcoming'} kids and family events in Porto, with dates, venues and prices. Picked by Oporto Weekly and updated every Thursday.`,
      empty: 'No kids or family events are listed right now. New ones arrive with every Thursday edition.',
    },
    pt: {
      h1: 'Eventos para crianças e famílias no Porto',
      title: 'Porto com crianças: eventos e atividades em família',
      crumb: 'Crianças e família',
      desc: (n: number) => `${n ? `${n} eventos` : 'Eventos'} para crianças e famílias no Porto, com datas, locais e preços. Escolhidos pela Oporto Weekly e atualizados todas as quintas.`,
      empty: 'Não há eventos para crianças listados neste momento. Chegam novos com cada edição de quinta-feira.',
    },
  },
  'weekend-free': {
    en: {
      h1: 'Free Things to Do in Porto This Weekend',
      title: 'Free Things to Do in Porto This Weekend',
      crumb: 'Free this weekend',
      desc: (n: number) => `${n ? `${n} free events` : 'Free events'} in Porto this weekend (${weekendLabel('en')}), with venues and times. No ticket needed. Picked by Oporto Weekly.`,
      empty: 'We have no free events listed for this weekend.',
    },
    pt: {
      h1: 'O que fazer de graça no Porto este fim de semana',
      title: 'O que fazer de graça no Porto este fim de semana',
      crumb: 'Grátis este fim de semana',
      desc: (n: number) => `${n ? `${n} eventos grátis` : 'Eventos grátis'} no Porto este fim de semana (${weekendLabel('pt')}), com locais e horários. Sem bilhete. Escolhidos pela Oporto Weekly.`,
      empty: 'Não temos eventos grátis listados para este fim de semana.',
    },
  },
};

export function landingMetadata(kind: LandingKind, lang: Lang): Metadata {
  const { main, longRuns } = landingEvents(kind);
  const total = main.length + longRuns.length;
  const c = COPY[kind][lang];
  const title = kind === 'weekend-free' ? `${c.title} · ${weekendLabel(lang)}` : c.title;
  const description = c.desc(total);
  const p = LANDING_PATHS[kind];
  const url = `${SITE}${lang === 'pt' ? p.pt : p.en}`;
  return {
    title: { absolute: title },
    description,
    // A thin week stays out of the index (and the sitemap) but keeps its links followed.
    ...(total < MIN_INDEXABLE ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${p.en}`, 'pt-PT': `${SITE}${p.pt}`, 'x-default': `${SITE}${p.en}` },
    },
    openGraph: { title, description, url, type: 'website', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

/** "including 3 concerts, 2 talks & workshops": the list's biggest named categories. */
function topCategories(events: EventRecord[], lang: Lang, skip: string[] = []): string {
  const n = new Map<string, number>();
  for (const e of events) {
    const s = subcategoryOf(e);
    if (s !== 'other' && !skip.includes(s)) n.set(s, (n.get(s) ?? 0) + 1);
  }
  const label = lang === 'pt' ? SUBCATEGORY_LABEL_PT : SUBCATEGORY_LABEL;
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([s, k]) => `${k} ${label[s as keyof typeof label].toLowerCase()}`).join(', ');
}

export function LandingHub({ kind, lang }: { kind: LandingKind; lang: Lang }) {
  const pt = lang === 'pt';
  const c = COPY[kind][lang];
  const { main, longRuns } = landingEvents(kind);
  const all = [...main, ...longRuns];
  const items = all.map((e) => toFilterItem(e, lang));
  const p = LANDING_PATHS[kind];
  const url = `${SITE}${pt ? p.pt : p.en}`;
  const eventsHub = pt ? '/pt' : '/porto-events';
  const weekend = kind === 'weekend-free';
  const pending = weekend && main.length === 0 && listingsPending(dayHubRange('weekend').from);

  // On the kids page "5 family" says nothing; name what else is on.
  const top = topCategories(all, lang, kind === 'kids' ? ['family'] : []);
  const runs = longRuns.length;
  let intro = '';
  if (all.length) {
    if (kind === 'free') {
      intro = pt
        ? `${main.length} evento${main.length === 1 ? '' : 's'} grátis nos próximos dias${runs ? `, e ${runs} exposiç${runs === 1 ? 'ão ou evento longo' : 'ões e eventos longos'} de entrada livre` : ''}${top ? `, incluindo ${top}` : ''}. Alguns pedem inscrição: confirme na página de cada evento.`
        : `${main.length} free event${main.length === 1 ? '' : 's'} coming up${runs ? `, plus ${runs} free exhibition${runs === 1 ? '' : 's'} and longer run${runs === 1 ? '' : 's'}` : ''}${top ? `, including ${top}` : ''}. A few still ask you to register, so check the event page before you go.`;
    } else if (kind === 'kids') {
      intro = pt
        ? `${all.length} evento${all.length === 1 ? '' : 's'} para crianças e famílias no Porto${top ? `, incluindo ${top}` : ''}. Cada um com datas, local e preço.`
        : `${all.length} kids and family event${all.length === 1 ? '' : 's'} coming up in Porto${top ? `, including ${top}` : ''}. Each with dates, venue and price.`;
    } else {
      intro = pt
        ? `${all.length} evento${all.length === 1 ? '' : 's'} grátis no Porto este fim de semana (${weekendLabel('pt')})${top ? `, incluindo ${top}` : ''}.`
        : `${all.length} free event${all.length === 1 ? '' : 's'} in Porto this weekend (${weekendLabel('en')})${top ? `, including ${top}` : ''}.`;
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: c.h1, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' } },
      {
        '@type': 'ItemList',
        itemListElement: all.slice(0, 50).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE}${pt ? '/pt/event/' : '/event/'}${e.slug}`,
          name: eventDisplay(e, lang).name,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: pt ? 'Início' : 'Home', item: pt ? `${SITE}/pt` : SITE },
          { '@type': 'ListItem', position: 2, name: pt ? 'Agenda' : 'Porto Events', item: `${SITE}${eventsHub}` },
          { '@type': 'ListItem', position: 3, name: c.crumb, item: url },
        ],
      },
    ],
  };

  const longTitle = pt ? 'Também a decorrer' : 'Also on';
  const longNote = pt ? 'Exposições e eventos mais longos, por ordem de encerramento.' : 'Exhibitions and longer runs, closing soonest first.';
  const link = { color: colors.heading, fontWeight: 600 } as const;
  const sibling = kind === 'free'
    ? { href: pt ? LANDING_PATHS['weekend-free'].pt : LANDING_PATHS['weekend-free'].en, label: pt ? 'Grátis este fim de semana' : 'Free this weekend' }
    : { href: pt ? LANDING_PATHS.free.pt : LANDING_PATHS.free.en, label: pt ? 'Todos os eventos grátis' : 'All free events' };

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang={lang} active="events" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href={pt ? '/pt' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Início' : 'Home'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href={eventsHub} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Agenda' : 'Porto Events'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>{c.crumb}</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.5 }}>
          {c.h1}
        </h1>
        {weekend && (
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, margin: '0 0 16px' }}>
            {weekendLabel(lang)}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <ShortcutChips lang={lang} current={kind === 'kids' ? 'kids' : kind === 'free' ? 'free' : undefined} />
        </div>
        {intro && <p style={{ fontSize: 16, color: colors.textSoft, lineHeight: 1.6, margin: '20px 0 28px' }}>{intro}</p>}

        {all.length === 0 && (
          <div style={{ background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 28px', fontSize: 15, lineHeight: 1.6 }}>
            {pending
              ? (pt
                  ? <>A seleção para este fim de semana sai com a edição de quinta-feira. Entretanto, veja <Link href={LANDING_PATHS.free.pt} style={link}>todos os eventos grátis</Link>.</>
                  : <>This weekend&apos;s picks come out with Thursday&apos;s edition. Meanwhile, see <Link href={LANDING_PATHS.free.en} style={link}>all free events in Porto</Link>.</>)
              : c.empty}
          </div>
        )}

        {all.length > 0 && (
          <EventFilters
            lang={lang}
            options={filterOptions(items, lang)}
            hide={kind === 'kids' ? ['kids'] : weekend ? ['price', 'when'] : ['price']}
            groups={[
              { key: 'main', items: items.slice(0, main.length) },
              { key: 'long', title: longTitle, note: longNote, items: items.slice(main.length) },
            ]}
            afterFirst={<div style={{ marginTop: 32 }}><SubscribeCTA lang={lang} context="event" /></div>}
          />
        )}
        {all.length === 0 && <SubscribeCTA lang={lang} context="event" />}

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 48, fontSize: 14, flexWrap: 'wrap' }}>
          <Link href={sibling.href} style={{ color: colors.heading }}>{sibling.label} →</Link>
          <Link href={pt ? DAY_HUB_PATHS.weekend.pt : DAY_HUB_PATHS.weekend.en} style={{ color: colors.heading }}>
            {pt ? 'Tudo este fim de semana' : 'Everything this weekend'}
          </Link>
          <Link href={eventsHub} style={{ color: colors.textSoft }}>{pt ? 'Agenda desta semana' : 'All upcoming events'}</Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
