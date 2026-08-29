import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listEvents,
  listEventsByVenue,
  toEventJsonLd,
  eventDisplay,
  CATEGORY_EMOJI,
  CATEGORY_LABEL_PT,
  type EventRecord,
} from '@/lib/events';
import { colors, typography, spacing } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';

export function generateStaticParams() {
  const seen = new Set<string>();
  for (const e of listEvents()) if (e.venueSlug) seen.add(e.venueSlug);
  return Array.from(seen).map((slug) => ({ slug }));
}

function resolveVenueDisplay(slug: string): { name: string; events: EventRecord[] } | null {
  const events = listEventsByVenue(slug);
  if (events.length === 0) return null;
  const root = events.map((e) => e.venue).slice().sort((a, b) => a.length - b.length)[0].split(/[,/]/)[0].trim();
  return { name: root, events };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const resolved = resolveVenueDisplay(params.slug);
  if (!resolved) return { title: 'Local não encontrado' };
  const { name, events } = resolved;
  const count = events.length;
  const title = `${name} — Eventos e Bilhetes`;
  const description = `Todos os eventos próximos e recentes em ${name}, no Porto — ${count} evento${count === 1 ? '' : 's'} indexado${count === 1 ? '' : 's'}. Concertos, exposições e muito mais, com curadoria semanal.`;
  const url = `https://oportoweekly.com/pt/venue/${params.slug}`;
  const enUrl = `https://oportoweekly.com/venue/${params.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url, languages: { en: enUrl, 'pt-PT': url, 'x-default': enUrl } },
    openGraph: { title, description, url, type: 'website', locale: 'pt_PT' },
  };
}

const PT_MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function VenuePagePT({ params }: { params: { slug: string } }) {
  const resolved = resolveVenueDisplay(params.slug);
  if (!resolved) notFound();

  const { name, events } = resolved;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => (e.endDate ?? e.date) < today).sort((a, b) => b.date.localeCompare(a.date));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name,
    address: { '@type': 'PostalAddress', addressLocality: 'Porto', addressCountry: 'PT' },
    event: upcoming.slice(0, 20).map((e) => {
      const full = toEventJsonLd(e, 'https://oportoweekly.com', 'pt') as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { '@context': _ctx, ...rest } = full;
      return rest;
    }),
  };

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Header lang="pt" active="archive" />

      <div style={{ maxWidth: spacing.contentMaxWidth, margin: '0 auto', padding: '40px 24px' }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSoft, marginBottom: 20 }}>
          <Link href="/pt" style={{ color: 'inherit', textDecoration: 'none' }}>Início</Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>Local</span>
        </nav>

        <h1 style={{ fontFamily: typography.serif, fontSize: 42, lineHeight: 1.1, color: colors.heading, margin: '0 0 12px', letterSpacing: -0.5 }}>
          {name}
        </h1>
        <p style={{ fontSize: 15, color: colors.textSoft, margin: '0 0 40px' }}>
          {events.length} evento{events.length === 1 ? '' : 's'} no Porto · {upcoming.length} próximo{upcoming.length === 1 ? '' : 's'}
        </p>

        {upcoming.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={sectionTitleStyle}>Próximos</h2>
            <ul style={listStyle}>{upcoming.map((e) => <EventRow key={e.slug} event={e} />)}</ul>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 style={sectionTitleStyle}>Eventos passados</h2>
            <ul style={listStyle}>{past.map((e) => <EventRow key={e.slug} event={e} muted />)}</ul>
          </section>
        )}
      </div>

      <Footer lang="pt" />
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 16px', paddingBottom: 10, borderBottom: `2px solid ${colors.accent}`,
};
const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0 };

function EventRow({ event: e, muted = false }: { event: EventRecord; muted?: boolean }) {
  const disp = eventDisplay(e, 'pt');
  return (
    <li style={{ borderBottom: `1px solid ${colors.divider}`, padding: '16px 0', opacity: muted ? 0.7 : 1 }}>
      <Link href={`/pt/event/${e.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 24, lineHeight: 1, marginTop: 2 }}>{CATEGORY_EMOJI[e.category]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: colors.heading, marginBottom: 4, lineHeight: 1.3 }}>
            {disp.name}
          </div>
          <div style={{ fontSize: 13, color: colors.textSoft }}>
            {formatShortDatePT(e.date, e.endDate)} · {CATEGORY_LABEL_PT[e.category]}{e.price && ` · ${e.price}`}
          </div>
        </div>
      </Link>
    </li>
  );
}

function formatShortDatePT(iso: string, endIso?: string): string {
  const fmt = (d: Date) => `${d.getUTCDate()} ${PT_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const start = fmt(new Date(iso.slice(0, 10) + 'T00:00:00Z'));
  if (endIso) {
    const end = fmt(new Date(endIso.slice(0, 10) + 'T00:00:00Z'));
    if (start !== end) return `${start} – ${end}`;
  }
  return start;
}
