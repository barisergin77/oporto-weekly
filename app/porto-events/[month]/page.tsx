import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORY_EMOJI, CATEGORY_LABEL, type EventRecord } from '@/lib/events';
import { eventsInMonth, listEventMonths, monthFromSlug, type Month } from '@/lib/event-months';
import { shortDates } from '@/lib/event-seo';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';

/** /porto-events/october-2026 — every event in Porto that month. See lib/event-months.ts. */

export function generateStaticParams() {
  return listEventMonths().map((m) => ({ month: m.slug }));
}
export const dynamicParams = false;

const SITE = 'https://oportoweekly.com';

function load(slug: string) {
  const m = monthFromSlug(slug);
  if (!m || !listEventMonths().some((x) => x.slug === m.slug)) return null;
  return { m, ...eventsInMonth(m) };
}

export async function generateMetadata({ params }: { params: { month: string } }): Promise<Metadata> {
  const d = load(params.month);
  if (!d) return { title: 'Not found' };
  const total = d.starting.length + d.ongoing.length;
  const title = `Porto Events in ${d.m.label}: Concerts, Festivals & Exhibitions`;
  const description = `All ${total} events in Porto in ${d.m.label} — concerts, festivals, exhibitions and markets, with dates, venues and prices. Updated every Thursday.`;
  const url = `${SITE}/porto-events/${d.m.slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  };
}

function Row({ e }: { e: EventRecord }) {
  return (
    <li style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
      <Link href={`/event/${e.slug}`} style={{ color: colors.heading, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>
        {CATEGORY_EMOJI[e.category]} {e.name}
      </Link>
      <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>
        {shortDates(e, 'en', true)} · {e.venue}
        {e.price ? ` · ${e.price}` : ''}
      </div>
    </li>
  );
}

const h2: React.CSSProperties = {
  fontFamily: typography.serif,
  fontSize: 24,
  color: colors.heading,
  margin: '40px 0 8px',
  paddingBottom: 10,
  borderBottom: `2px solid ${colors.accent}`,
};

export default function MonthPage({ params }: { params: { month: string } }) {
  const d = load(params.month);
  if (!d) notFound();
  const { m, starting, ongoing } = d;

  // Group by start date so the page reads like a calendar.
  const byDay = new Map<string, EventRecord[]>();
  for (const e of starting) {
    const k = e.date.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const counts = new Map<string, number>();
  for (const e of [...starting, ...ongoing]) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const topCats = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, n]) => `${n} ${CATEGORY_LABEL[c as EventRecord['category']].toLowerCase()}`);

  const months = listEventMonths();
  const idx = months.findIndex((x) => x.slug === m.slug);
  const prev: Month | undefined = months[idx - 1];
  const next: Month | undefined = months[idx + 1];
  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  const url = `${SITE}/porto-events/${m.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `Porto Events in ${m.label}`,
        url,
        inLanguage: 'en',
        about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' },
      },
      {
        '@type': 'ItemList',
        itemListElement: starting.slice(0, 50).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE}/event/${e.slug}`,
          name: e.name,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Porto Events', item: `${SITE}/porto-events` },
          { '@type': 'ListItem', position: 3, name: m.label, item: url },
        ],
      },
    ],
  };

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header lang="en" active="archive" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }}>
        <nav style={{ fontSize: 12, color: colors.textSoft, marginBottom: 20 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <Link href="/porto-events" style={{ color: 'inherit', textDecoration: 'none' }}>Porto Events</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>{m.label}</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.1, color: colors.heading, margin: '0 0 14px', letterSpacing: -0.5 }}>
          Porto Events in {m.label}
        </h1>
        <p style={{ fontSize: 16, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 28px' }}>
          {starting.length} events start in Porto in {m.label}
          {ongoing.length > 0 ? `, and ${ongoing.length} more run through the month` : ''}
          {topCats.length ? ` — including ${topCats.join(', ')}` : ''}. Every listing has dates, venue and price,
          and links to the full event page. Picked by Oporto Weekly and updated every Thursday.
        </p>

        <SubscribeCTA lang="en" context="event" />

        {Array.from(byDay.entries()).map(([iso, evs]) => (
          <section key={iso}>
            <h2 style={h2}>{dayLabel(iso)}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {evs.map((e) => <Row key={e.slug} e={e} />)}
            </ul>
          </section>
        ))}

        {ongoing.length > 0 && (
          <section>
            <h2 style={h2}>On all month</h2>
            <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 4px' }}>
              Exhibitions and longer runs that started earlier and continue through {m.label}.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ongoing.map((e) => <Row key={e.slug} e={e} />)}
            </ul>
          </section>
        )}

        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 48, fontSize: 14 }}>
          <span>{prev && <Link href={`/porto-events/${prev.slug}`} style={{ color: colors.heading }}>← {prev.label}</Link>}</span>
          <Link href="/porto-events" style={{ color: colors.textSoft }}>All upcoming events</Link>
          <span>{next && <Link href={`/porto-events/${next.slug}`} style={{ color: colors.heading }}>{next.label} →</Link>}</span>
        </nav>
      </div>

      <Footer lang="en" />
    </div>
  );
}

