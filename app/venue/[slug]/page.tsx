import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listEvents,
  listEventsByVenue,
  toEventJsonLd,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  type EventRecord,
} from '@/lib/events';
import { colors, typography, spacing } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';

/**
 * `/venue/<slug>` — aggregates every event we've indexed at a given venue.
 *
 * SEO rationale: these pages rank strongly for "<venue name> events"
 * queries because they're topically dense and naturally updated whenever
 * a new edition commits events at the venue. They're the second biggest
 * organic-search lever after individual event pages.
 */

// Build-time: enumerate every unique venue slug from the event corpus.
export function generateStaticParams() {
  const seen = new Set<string>();
  for (const e of listEvents()) {
    if (e.venueSlug) seen.add(e.venueSlug);
  }
  return Array.from(seen).map((slug) => ({ slug }));
}

// Pick the most common full venue name for a given slug (for display/SEO).
function resolveVenueDisplay(slug: string): { name: string; events: EventRecord[] } | null {
  const events = listEventsByVenue(slug);
  if (events.length === 0) return null;

  // Multiple events at same slug may have slightly different venue strings
  // ("Casa da Música" vs "Casa da Música, Sala 2"). Prefer the shortest one
  // since that's usually the canonical root name.
  const names = events.map((e) => e.venue);
  const root = names
    .slice()
    .sort((a, b) => a.length - b.length)[0]
    // Same cleanup the slug helper does, but for display.
    .split(/[,/]/)[0]
    .trim();
  return { name: root, events };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const resolved = resolveVenueDisplay(params.slug);
  if (!resolved) return { title: 'Venue not found' };

  const { name, events } = resolved;
  const count = events.length;
  const title = `${name} — Events & Tickets`;
  const description =
    `All upcoming and recent events at ${name} in Porto — ${count} event${count === 1 ? '' : 's'} indexed. Concerts, exhibitions, and more, curated weekly.`;
  const url = `https://oportoweekly.com/venue/${params.slug}`;
  const ptUrl = `https://oportoweekly.com/pt/venue/${params.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url, languages: { en: url, 'pt-PT': ptUrl, 'x-default': url } },
    openGraph: { title, description, url, type: 'website' },
  };
}

export default function VenuePage({ params }: { params: { slug: string } }) {
  const resolved = resolveVenueDisplay(params.slug);
  if (!resolved) notFound();

  const { name, events } = resolved;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = events
    .filter((e) => (e.endDate ?? e.date) < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  // schema.org Place for rich snippets on the venue page.
  // Nested events use toEventJsonLd() so they pass GSC validation — Google
  // checks each nested Event as a standalone Event and requires the full
  // field set (location, eventStatus, offers, organizer, image, etc.).
  // Previously we emitted a thin shape (name/startDate/endDate/url only)
  // which GSC flagged as "Missing field 'location'" on 2026-05-25. Stripping
  // @context because nested objects inherit it from the parent Place.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Porto',
      addressCountry: 'PT',
    },
    event: upcoming.slice(0, 20).map((e) => {
      const full = toEventJsonLd(e) as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { '@context': _ctx, ...rest } = full;
      return rest;
    }),
  };

  return (
    <div
      style={{
        background: colors.bg,
        minHeight: '100vh',
        fontFamily: typography.sans,
        color: colors.text,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header lang="en" active="archive" />

      <div style={{ maxWidth: spacing.contentMaxWidth, margin: '0 auto', padding: '40px 24px' }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: colors.textSoft,
            marginBottom: 20,
          }}
        >
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Home
          </Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>Venue</span>
        </nav>

        <h1
          style={{
            fontFamily: typography.serif,
            fontSize: 42,
            lineHeight: 1.1,
            color: colors.heading,
            margin: '0 0 12px',
            letterSpacing: -0.5,
          }}
        >
          {name}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: colors.textSoft,
            margin: '0 0 40px',
          }}
        >
          {events.length} event{events.length === 1 ? '' : 's'} indexed in Porto ·{' '}
          {upcoming.length} upcoming
        </p>

        {upcoming.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 style={sectionTitleStyle}>Upcoming</h2>
            <ul style={listStyle}>
              {upcoming.map((e) => (
                <EventRow key={e.slug} event={e} />
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 style={sectionTitleStyle}>Past events</h2>
            <ul style={listStyle}>
              {past.map((e) => (
                <EventRow key={e.slug} event={e} muted />
              ))}
            </ul>
          </section>
        )}
      </div>

      <Footer lang="en" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: typography.serif,
  fontSize: 22,
  color: colors.heading,
  margin: '0 0 16px',
  paddingBottom: 10,
  borderBottom: `2px solid ${colors.accent}`,
};

const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0 };

function EventRow({ event: e, muted = false }: { event: EventRecord; muted?: boolean }) {
  return (
    <li
      style={{
        borderBottom: `1px solid ${colors.divider}`,
        padding: '16px 0',
        opacity: muted ? 0.7 : 1,
      }}
    >
      <Link
        href={`/event/${e.slug}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 16, alignItems: 'flex-start' }}
      >
        <div style={{ fontSize: 24, lineHeight: 1, marginTop: 2 }}>
          {CATEGORY_EMOJI[e.category]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: colors.heading,
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {e.name}
          </div>
          <div style={{ fontSize: 13, color: colors.textSoft }}>
            {formatShortDate(e.date, e.endDate)} · {CATEGORY_LABEL[e.category]}
            {e.price && ` · ${e.price}`}
          </div>
        </div>
      </Link>
    </li>
  );
}

function formatShortDate(iso: string, endIso?: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const start = d.toLocaleDateString('en-GB', opts);
  if (endIso) {
    const end = new Date(endIso).toLocaleDateString('en-GB', opts);
    if (start !== end) return `${start} – ${end}`;
  }
  return start;
}
