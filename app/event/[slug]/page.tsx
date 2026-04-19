import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listEvents,
  getEvent,
  listEventsByVenue,
  toEventJsonLd,
  isRealEventUrl,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  type EventRecord,
} from '@/lib/events';
import { getNewsletterMeta } from '@/lib/archive';
import { colors, typography, spacing } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';

export function generateStaticParams() {
  return listEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const ev = getEvent(params.slug);
  if (!ev) return { title: 'Event not found' };

  const dateStr = formatLongDate(ev.date, ev.endDate);
  const title = `${ev.name} — ${ev.venue}, ${dateStr}`;
  const description = ev.description.slice(0, 155);
  const url = `https://oportoweekly.com/event/${ev.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: ev.image ? [{ url: ev.image.url, alt: ev.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ev.image ? [ev.image.url] : undefined,
    },
  };
}

export default function EventPage({ params }: { params: { slug: string } }) {
  const ev = getEvent(params.slug);
  if (!ev) notFound();

  const sourceEdition = getNewsletterMeta(ev.sourceEdition);
  const relatedAtVenue = ev.venueSlug
    ? listEventsByVenue(ev.venueSlug).filter((e) => e.slug !== ev.slug).slice(0, 4)
    : [];

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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(toEventJsonLd(ev)),
        }}
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
          <span style={{ color: colors.accent, fontWeight: 700 }}>
            {CATEGORY_EMOJI[ev.category]} {CATEGORY_LABEL[ev.category]}
          </span>
        </nav>

        {/* Title */}
        <h1
          style={{
            fontFamily: typography.serif,
            fontSize: 40,
            lineHeight: 1.15,
            color: colors.heading,
            margin: '0 0 20px',
            letterSpacing: -0.5,
          }}
        >
          {ev.name}
        </h1>

        {/* Hero image or placeholder */}
        <EventHero event={ev} />

        {/* Metadata row — Porto-Secreto style pins */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            margin: '24px 0 28px',
          }}
        >
          {ev.price && <MetaPin icon="🏷️" text={ev.price} />}
          <MetaPin icon="📍" text={ev.venue} href={ev.venueSlug ? `/venue/${ev.venueSlug}` : undefined} />
          <MetaPin icon="📅" text={formatLongDate(ev.date, ev.endDate)} />
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: colors.text,
            margin: '0 0 28px',
          }}
        >
          {ev.description}
        </p>

        {/* External link CTA — only for a real event page, never for a
            google.com/search fallback URL that occasionally slips through. */}
        {isRealEventUrl(ev.externalLink) && (
          <a
            href={ev.externalLink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{
              display: 'inline-block',
              background: colors.heading,
              color: '#ffffff',
              padding: '14px 28px',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              borderRadius: 2,
              margin: '0 0 40px',
            }}
          >
            Get tickets →
          </a>
        )}

        {/* Source edition */}
        {sourceEdition && (
          <div
            style={{
              background: colors.bgSoft,
              borderLeft: `3px solid ${colors.accent}`,
              padding: '14px 18px',
              margin: '0 0 40px',
              fontSize: 14,
              color: colors.textSoft,
            }}
          >
            Featured in{' '}
            <Link
              href={`/archive/${sourceEdition.slug}`}
              style={{ color: colors.heading, fontWeight: 600 }}
            >
              {sourceEdition.weekRange}
            </Link>{' '}
            — the weekly Oporto Weekly edition.
          </div>
        )}

        {/* Related events at the same venue */}
        {relatedAtVenue.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2
              style={{
                fontFamily: typography.serif,
                fontSize: 22,
                color: colors.heading,
                margin: '0 0 16px',
                paddingBottom: 10,
                borderBottom: `2px solid ${colors.accent}`,
              }}
            >
              More at {ev.venue}
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {relatedAtVenue.map((r) => (
                <li key={r.slug} style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
                  <Link
                    href={`/event/${r.slug}`}
                    style={{
                      color: colors.heading,
                      textDecoration: 'none',
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {r.name}
                  </Link>
                  <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>
                    {formatLongDate(r.date, r.endDate)}
                  </div>
                </li>
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

function EventHero({ event }: { event: EventRecord }) {
  if (event.image) {
    return (
      <figure style={{ margin: 0 }}>
        <img
          src={event.image.url}
          alt={event.name}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            display: 'block',
            borderRadius: 2,
          }}
        />
        {event.image.credit && (
          <figcaption
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: colors.textSoft,
              marginTop: 8,
            }}
          >
            📷{' '}
            {event.image.sourceUrl ? (
              <a
                href={event.image.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {event.image.credit}
              </a>
            ) : (
              event.image.credit
            )}
          </figcaption>
        )}
      </figure>
    );
  }

  // Placeholder: category emoji + label on a subtle cream gradient.
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        background: `linear-gradient(135deg, ${colors.bgSoft} 0%, ${colors.bgAlt} 100%)`,
        border: `1px solid ${colors.divider}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
      aria-label={`${CATEGORY_LABEL[event.category]} — photo coming soon`}
    >
      <div style={{ fontSize: 64 }}>{CATEGORY_EMOJI[event.category]}</div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: colors.accent,
          fontWeight: 700,
        }}
      >
        {CATEGORY_LABEL[event.category]}
      </div>
    </div>
  );
}

function MetaPin({
  icon,
  text,
  href,
}: {
  icon: string;
  text: string;
  href?: string;
}) {
  const inner = (
    <>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 14, color: colors.text }}>{text}</span>
    </>
  );
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: colors.card,
    border: `1px solid ${colors.divider}`,
    borderRadius: 2,
    padding: '8px 14px',
    textDecoration: 'none' as const,
  };

  if (href) {
    return (
      <Link href={href} style={base}>
        {inner}
      </Link>
    );
  }
  return <div style={base}>{inner}</div>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLongDate(iso: string, endIso?: string): string {
  const start = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const startStr = start.toLocaleDateString('en-GB', opts);

  // Time-of-day if present ("2026-04-17T21:30" → "· 21:30")
  const timeSuffix = iso.length > 10
    ? ` · ${iso.slice(11, 16)}`
    : '';

  if (endIso) {
    const end = new Date(endIso);
    const endStr = end.toLocaleDateString('en-GB', opts);
    if (startStr !== endStr) return `${startStr} – ${endStr}`;
  }

  return startStr + timeSuffix;
}
