import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORY_EMOJI, eventDisplay, type EventRecord } from '@/lib/events';
import { listEventMonths, ptLabel, ptSlug } from '@/lib/event-months';
import { DAY_HUB_PATHS, dayHubRange, eventsInRange, listingsPending, monthOfIso, type DayHubKind } from '@/lib/event-days';
import { priceText, shortDates } from '@/lib/event-seo';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { ShortcutChips } from '@/app/components/ShortcutChips';
import { GuidesStrip } from '@/app/components/RelatedGuide';
import { listBlogPosts } from '@/lib/blog';
import { guidesForHub } from '@/lib/related-guides';

/**
 * "Today" / "This weekend", shared by /porto-events/{today,this-weekend} (EN)
 * and /pt/eventos/{hoje,este-fim-de-semana} (PT). See lib/event-days.ts.
 * The route files set `revalidate` so the date rolls over without a deploy.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const WD = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
};
const parts = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return { wd: d.getUTCDay(), d: d.getUTCDate(), m: d.getUTCMonth() };
};

/** "Mon 19 Oct" / "seg, 19 out"; ranges "23–25 Oct" / "31 Oct – 2 Nov". */
function rangeLabel(from: string, to: string, lang: Lang): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return lang === 'pt' ? `${WD.pt[a.wd]}, ${a.d} ${MON.pt[a.m]}` : `${WD.en[a.wd]} ${a.d} ${MON.en[a.m]}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${MON[lang][a.m]}`;
  return `${a.d} ${MON[lang][a.m]} – ${b.d} ${MON[lang][b.m]}`;
}

const heading = (kind: DayHubKind, lang: Lang) =>
  kind === 'today'
    ? (lang === 'pt' ? 'O que fazer no Porto hoje' : 'Things to Do in Porto Today')
    : (lang === 'pt' ? 'O que fazer no Porto este fim de semana' : 'Things to Do in Porto This Weekend');

export function dayHubMetadata(kind: DayHubKind, lang: Lang): Metadata {
  const range = dayHubRange(kind);
  const { main, longRuns } = eventsInRange(range);
  const total = main.length + longRuns.length;
  const when = rangeLabel(range.from, range.to, lang);
  const title = `${heading(kind, lang)} · ${when}`;
  const description = lang === 'pt'
    ? `${kind === 'today' ? 'Hoje' : 'Este fim de semana'} no Porto (${when}): ${total ? `${total} eventos — ` : ''}concertos, exposições, mercados e festas, com horários, locais e preços. Escolhidos pela Oporto Weekly.`
    : `${kind === 'today' ? 'Today' : 'This weekend'} in Porto (${when}): ${total ? `${total} events — ` : ''}concerts, exhibitions, markets and parties, with venues and prices. Picked by Oporto Weekly.`;
  const p = DAY_HUB_PATHS[kind];
  const url = `${SITE}${lang === 'pt' ? p.pt : p.en}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${p.en}`, 'pt-PT': `${SITE}${p.pt}`, 'x-default': `${SITE}${p.en}` },
    },
    openGraph: { title, description, url, type: 'website', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
  };
}

const h2: React.CSSProperties = {
  fontFamily: typography.serif,
  fontSize: 24,
  color: colors.heading,
  margin: '40px 0 8px',
  paddingBottom: 10,
  borderBottom: `2px solid ${colors.accent}`,
};

function Row({ e, lang }: { e: EventRecord; lang: Lang }) {
  const price = priceText(e.price, lang);
  return (
    <li style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
      <Link
        href={lang === 'pt' ? `/pt/event/${e.slug}` : `/event/${e.slug}`}
        style={{ color: colors.heading, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}
      >
        {CATEGORY_EMOJI[e.category]} {eventDisplay(e, lang).name}
      </Link>
      <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>
        {shortDates(e, lang, false)} · {e.venue}
        {price ? ` · ${price}` : ''}
      </div>
    </li>
  );
}

export function DayHub({ kind, lang }: { kind: DayHubKind; lang: Lang }) {
  const pt = lang === 'pt';
  const range = dayHubRange(kind);
  const { main, longRuns } = eventsInRange(range);
  const when = rangeLabel(range.from, range.to, lang);
  const guides = guidesForHub([...main, ...longRuns], Number(range.from.slice(5, 7)) - 1, listBlogPosts());
  const h1 = heading(kind, lang);

  const month = monthOfIso(range.from);
  const hasHub = listEventMonths().some((m) => m.slug === month.slug);
  const monthHref = hasHub ? (pt ? `/pt/eventos/${ptSlug(month)}` : `/porto-events/${month.slug}`) : (pt ? '/pt' : '/porto-events');
  const monthName = pt ? ptLabel(month) : month.label;

  const p = DAY_HUB_PATHS[kind];
  const url = `${SITE}${pt ? p.pt : p.en}`;
  const eventsHub = pt ? '/pt' : '/porto-events';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: `${h1} · ${when}`, url, inLanguage: pt ? 'pt-PT' : 'en', about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' } },
      {
        '@type': 'ItemList',
        itemListElement: [...main, ...longRuns].slice(0, 50).map((e, i) => ({
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
          { '@type': 'ListItem', position: 3, name: kind === 'today' ? (pt ? 'Hoje' : 'Today') : (pt ? 'Este fim de semana' : 'This weekend'), item: url },
        ],
      },
    ],
  };

  // Mon–Wed the weekend's listings usually aren't out yet (Thursday edition).
  const pending = main.length === 0 && listingsPending(range.from);
  const whenWord = kind === 'today' ? (pt ? 'hoje' : 'today') : (pt ? 'este fim de semana' : 'this weekend');
  const runs = pt
    ? `${longRuns.length} exposiç${longRuns.length === 1 ? 'ão ou evento longo' : 'ões e eventos longos'}`
    : `${longRuns.length} exhibition${longRuns.length === 1 ? '' : 's'} and longer run${longRuns.length === 1 ? '' : 's'}`;
  let intro = '';
  if (main.length > 0) {
    intro = pt
      ? `${main.length} evento${main.length === 1 ? '' : 's'} no Porto ${whenWord} (${when})${longRuns.length ? `, e ${runs} a decorrer` : ''}. Cada um com datas, local e preço.`
      : `${main.length} event${main.length === 1 ? '' : 's'} in Porto ${whenWord} (${when})${longRuns.length ? `, plus ${runs} you can still catch` : ''}. Each with dates, venue and price.`;
  } else if (longRuns.length > 0) {
    intro = pt
      ? `${runs} a decorrer no Porto ${whenWord} (${when}), listados abaixo com datas, local e preço.`
      : `${runs} on in Porto ${whenWord} (${when}), listed below with dates, venue and price.`;
  }

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang={lang} active="events" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href={pt ? '/pt' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Início' : 'Home'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href={eventsHub} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Agenda' : 'Porto Events'}</Link>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.5 }}>
          {h1}
        </h1>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, margin: '0 0 16px' }}>
          {when}
        </div>
        <ShortcutChips lang={lang} current={kind} />
        {intro && <p style={{ fontSize: 16, color: colors.textSoft, lineHeight: 1.6, margin: '20px 0 28px' }}>{intro}</p>}

        {main.length === 0 && (
          <div style={{ background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '20px 0 28px', fontSize: 15, lineHeight: 1.6 }}>
            {pending
              ? (pt
                  ? <>A seleção para {kind === 'today' ? 'hoje' : 'este fim de semana'} sai com a edição de quinta-feira. Entretanto, veja a <Link href={monthHref} style={{ color: colors.heading, fontWeight: 600 }}>agenda de {monthName}</Link> ou subscreva para a receber por email.</>
                  : <>The picks for {kind === 'today' ? 'today' : 'this weekend'} come out with Thursday&apos;s edition. Meanwhile, see <Link href={monthHref} style={{ color: colors.heading, fontWeight: 600 }}>all Porto events in {monthName}</Link>, or subscribe to get them by email.</>)
              : (pt
                  ? <>Não temos eventos novos listados para {kind === 'today' ? 'hoje' : 'este fim de semana'}. Veja a <Link href={monthHref} style={{ color: colors.heading, fontWeight: 600 }}>agenda de {monthName}</Link>.</>
                  : <>We have no new events listed for {kind === 'today' ? 'today' : 'this weekend'}. See <Link href={monthHref} style={{ color: colors.heading, fontWeight: 600 }}>all Porto events in {monthName}</Link>.</>)}
          </div>
        )}

        {main.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {main.map((e) => <Row key={e.slug} e={e} lang={lang} />)}
          </ul>
        )}

        <div style={{ marginTop: 32 }}>
          <SubscribeCTA lang={lang} context="event" />
        </div>

        {longRuns.length > 0 && (
          <section>
            <h2 style={h2}>{pt ? 'Também a decorrer' : 'Also on'}</h2>
            <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 4px' }}>
              {pt ? 'Exposições e eventos mais longos, por ordem de encerramento.' : 'Exhibitions and longer runs, closing soonest first.'}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {longRuns.map((e) => <Row key={e.slug} e={e} lang={lang} />)}
            </ul>
          </section>
        )}

        <GuidesStrip guides={guides} lang={lang} source="hub" />

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 48, fontSize: 14 }}>
          <Link href={monthHref} style={{ color: colors.heading }}>{pt ? `Agenda de ${monthName}` : `All events in ${monthName}`} →</Link>
          <Link href={eventsHub} style={{ color: colors.textSoft }}>{pt ? 'Agenda desta semana' : 'All upcoming events'}</Link>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
