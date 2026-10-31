import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_LABEL_PT, eventDisplay, type EventRecord } from '@/lib/events';
import { eventsInMonth, listEventMonths, ptLabel, ptSlug, type Month } from '@/lib/event-months';
import { priceText, shortDates } from '@/lib/event-seo';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { GuidesStrip } from '@/app/components/RelatedGuide';
import { listBlogPosts } from '@/lib/blog';
import { guidesForHub } from '@/lib/related-guides';

/**
 * Month hub, shared by /porto-events/<month> (EN) and /pt/eventos/<mes> (PT).
 * See lib/event-months.ts for why these pages exist.
 */

type Lang = 'en' | 'pt';
const SITE = 'https://oportoweekly.com';

export const hubUrl = (m: Month, lang: Lang) =>
  lang === 'pt' ? `${SITE}/pt/eventos/${ptSlug(m)}` : `${SITE}/porto-events/${m.slug}`;
const hubPath = (m: Month, lang: Lang) => hubUrl(m, lang).replace(SITE, '');
const label = (m: Month, lang: Lang) => (lang === 'pt' ? ptLabel(m) : m.label);

export function monthHubMetadata(m: Month, lang: Lang): Metadata {
  const { starting, ongoing } = eventsInMonth(m);
  const total = starting.length + ongoing.length;
  const l = label(m, lang);
  const title = lang === 'pt'
    ? `Eventos no Porto em ${l}: concertos, festivais e exposições`
    : `Porto Events in ${l}: Concerts, Festivals & Exhibitions`;
  const description = lang === 'pt'
    ? `Agenda do Porto para ${l}: ${total} eventos — concertos, festivais, exposições e mercados, com datas, locais e preços. Atualizada todas as quintas.`
    : `All ${total} events in Porto in ${l} — concerts, festivals, exhibitions and markets, with dates, venues and prices. Updated every Thursday.`;
  const url = hubUrl(m, lang);
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { en: hubUrl(m, 'en'), 'pt-PT': hubUrl(m, 'pt'), 'x-default': hubUrl(m, 'en') },
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
        {shortDates(e, lang, true)} · {e.venue}
        {price ? ` · ${price}` : ''}
      </div>
    </li>
  );
}

export function MonthHub({ m, lang }: { m: Month; lang: Lang }) {
  const { starting, ongoing } = eventsInMonth(m);
  const guides = guidesForHub([...starting, ...ongoing], m.month, listBlogPosts());
  const l = label(m, lang);
  const pt = lang === 'pt';

  const byDay = new Map<string, EventRecord[]>();
  for (const e of starting) {
    const k = e.date.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const counts = new Map<string, number>();
  for (const e of [...starting, ...ongoing]) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const catLabel = pt ? CATEGORY_LABEL_PT : CATEGORY_LABEL;
  const topCats = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, n]) => `${n} ${catLabel[c as EventRecord['category']].toLowerCase()}`);

  const months = listEventMonths();
  const idx = months.findIndex((x) => x.slug === m.slug);
  const prev = months[idx - 1];
  const next = months[idx + 1];
  // Portuguese dates are lower-case ("quinta-feira, 1 de outubro"); capitalise
  // only the first letter — CSS capitalize would also give "1 De Outubro".
  const dayLabel = (iso: string) => {
    const t = new Date(iso + 'T00:00:00Z').toLocaleDateString(pt ? 'pt-PT' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const url = hubUrl(m, lang);
  const eventsHub = pt ? '/pt' : '/porto-events';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: pt ? `Eventos no Porto em ${l}` : `Porto Events in ${l}`,
        url,
        inLanguage: pt ? 'pt-PT' : 'en',
        about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' },
      },
      {
        '@type': 'ItemList',
        itemListElement: starting.slice(0, 50).map((e, i) => ({
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
          { '@type': 'ListItem', position: 3, name: l, item: url },
        ],
      },
    ],
  };

  const intro = pt
    ? `${starting.length} eventos começam no Porto em ${l}${ongoing.length ? `, e mais ${ongoing.length} decorrem durante o mês` : ''}${topCats.length ? ` — incluindo ${topCats.join(', ')}` : ''}. Cada evento tem datas, local e preço, com ligação à página completa. Escolhidos pela Oporto Weekly e atualizados todas as quintas-feiras.`
    : `${starting.length} events start in Porto in ${l}${ongoing.length ? `, and ${ongoing.length} more run through the month` : ''}${topCats.length ? ` — including ${topCats.join(', ')}` : ''}. Every listing has dates, venue and price, and links to the full event page. Picked by Oporto Weekly and updated every Thursday.`;

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang={lang} active="archive" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href={pt ? '/pt' : '/'} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Início' : 'Home'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href={eventsHub} style={{ color: 'inherit', textDecoration: 'none' }}>{pt ? 'Agenda' : 'Porto Events'}</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>{l}</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 14px', letterSpacing: -0.5 }}>
          {pt ? `Eventos no Porto em ${l}` : `Porto Events in ${l}`}
        </h1>
        <p style={{ fontSize: 16, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 28px' }}>{intro}</p>

        <SubscribeCTA lang={lang} context="event" />

        {Array.from(byDay.entries()).map(([iso, evs]) => (
          <section key={iso}>
            <h2 style={h2}>{dayLabel(iso)}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {evs.map((e) => <Row key={e.slug} e={e} lang={lang} />)}
            </ul>
          </section>
        ))}

        {ongoing.length > 0 && (
          <section>
            <h2 style={h2}>{pt ? 'Durante todo o mês' : 'On all month'}</h2>
            <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 4px' }}>
              {pt
                ? `Exposições e eventos mais longos que começaram antes e continuam em ${l}.`
                : `Exhibitions and longer runs that started earlier and continue through ${l}.`}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ongoing.map((e) => <Row key={e.slug} e={e} lang={lang} />)}
            </ul>
          </section>
        )}

        <GuidesStrip guides={guides} lang={lang} source="hub" />

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 48, fontSize: 14 }}>
          <span>{prev && <Link href={hubPath(prev, lang)} style={{ color: colors.heading }}>← {label(prev, lang)}</Link>}</span>
          <Link href={eventsHub} style={{ color: colors.textSoft }}>{pt ? 'Agenda desta semana' : 'All upcoming events'}</Link>
          <span>{next && <Link href={hubPath(next, lang)} style={{ color: colors.heading }}>{label(next, lang)} →</Link>}</span>
        </nav>
      </div>

      <Footer lang={lang} />
    </div>
  );
}
