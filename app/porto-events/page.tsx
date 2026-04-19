import { listNewsletters } from '@/lib/archive';
import {
  listUpcomingEvents,
  listEvents,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  type EventRecord,
} from '@/lib/events';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeForm } from '../SubscribeForm';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Porto Events This Week — Upcoming Things To Do in Porto',
  description:
    'A live, curated guide to upcoming Porto events — concerts, exhibitions, food markets, nightlife, and family activities. New events added every Thursday.',
  keywords: [
    'porto events this week',
    'things to do in porto',
    'porto weekend events',
    'upcoming porto events',
    'what to do in porto',
    'porto concerts',
    'porto art exhibitions',
    'porto food markets',
    'porto nightlife',
    'oporto events',
  ],
  alternates: { canonical: 'https://oportoweekly.com/porto-events' },
  openGraph: {
    title: 'Porto Events This Week — Upcoming Things To Do in Porto',
    description:
      'A live, curated guide to upcoming Porto events — concerts, exhibitions, food markets, nightlife, and family activities.',
    url: 'https://oportoweekly.com/porto-events',
    type: 'website',
  },
};

export default function PortoEventsPage() {
  const newsletters = listNewsletters();
  const latest = newsletters[0] ?? null;
  const upcoming = listUpcomingEvents();

  // For SEO when we have few/no upcoming, also pull recent past events.
  const recentPast = listEvents()
    .filter((e) => !upcoming.some((u) => u.slug === e.slug))
    .slice(0, 8);

  const displayEvents = upcoming.length > 0 ? upcoming : recentPast;
  const isShowingPast = upcoming.length === 0;

  // ItemList JSON-LD helps Google show this page as a structured event list.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://oportoweekly.com/porto-events',
        name: 'Porto Events This Week',
        description: 'Upcoming events in Porto, Portugal — updated weekly.',
        url: 'https://oportoweekly.com/porto-events',
        inLanguage: 'en',
        about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' },
        publisher: {
          '@type': 'Organization',
          name: 'Oporto Weekly',
          url: 'https://oportoweekly.com',
        },
      },
      {
        '@type': 'ItemList',
        name: 'Upcoming Porto events',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: upcoming.length,
        itemListElement: upcoming.slice(0, 30).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://oportoweekly.com/event/${e.slug}`,
          name: e.name,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What events are happening in Porto this week?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Porto runs a packed weekly cultural calendar — concerts at Casa da Música, art at Serralves and the Bonfim gallery district, food markets at Mercado do Bolhão, wine tastings in Vila Nova de Gaia, and nightlife in Ribeira. Every Thursday Oporto Weekly curates the best of it into one newsletter. Scroll above for the live list of upcoming events.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do I find out about events in Porto every week?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Subscribe to Oporto Weekly — a free newsletter delivered every Thursday morning with the best events in Porto, Portugal. You can also check this page any time.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is Oporto Weekly free?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, completely free. Subscribe with your email to receive the Porto events guide every Thursday morning.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://oportoweekly.com' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Porto Events This Week',
            item: 'https://oportoweekly.com/porto-events',
          },
        ],
      },
    ],
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

      <Header lang="en" active="events" />

      {/* Hero intro */}
      <div
        style={{
          background: colors.bg,
          borderBottom: `1px solid ${colors.divider}`,
          padding: '48px 32px 40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: colors.accent,
            marginBottom: 14,
          }}
        >
          Updated every Thursday
        </div>
        <h1
          style={{
            fontFamily: typography.serif,
            fontSize: 42,
            color: colors.heading,
            margin: '0 0 16px',
            lineHeight: 1.2,
            letterSpacing: -0.5,
          }}
        >
          Porto Events This Week
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '0 auto 22px' }} />
        <p
          style={{
            fontSize: 16,
            color: colors.textSoft,
            maxWidth: 580,
            margin: '0 auto 28px',
            lineHeight: 1.7,
          }}
        >
          Porto is one of Europe&apos;s most vibrant cities — every week brings concerts at Casa
          da Música, gallery openings in Rua Miguel Bombarda, rooftop parties in Foz, and food
          markets along the Douro. Here&apos;s what&apos;s on.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {(['music', 'art', 'food', 'family', 'nightlife'] as const).map((cat) => (
            <span
              key={cat}
              style={{
                background: colors.card,
                border: `1px solid ${colors.divider}`,
                color: colors.heading,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
            </span>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div
        className="home-layout"
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '40px 24px',
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        {/* Event grid */}
        <div className="newsletter-content" style={{ flex: 1, minWidth: 0 }}>
          {latest && (
            <div
              style={{
                background: colors.card,
                borderRadius: 6,
                padding: '12px 20px',
                marginBottom: 24,
                border: `1px solid ${colors.divider}`,
                borderLeft: `4px solid ${colors.accent}`,
                fontSize: 13,
                color: colors.textSoft,
              }}
            >
              📅 <strong style={{ color: colors.heading }}>Latest edition: {latest.weekRange}</strong>
              {' — '}
              <Link
                href={`/archive/${latest.slug}`}
                style={{
                  color: colors.heading,
                  textDecoration: 'none',
                  borderBottom: `1.5px solid ${colors.accent}`,
                  paddingBottom: 1,
                }}
              >
                Read full edition →
              </Link>
            </div>
          )}

          {displayEvents.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: colors.accent,
                  marginBottom: 8,
                }}
              >
                {isShowingPast
                  ? 'Recent editions'
                  : `${upcoming.length} upcoming event${upcoming.length === 1 ? '' : 's'}`}
              </div>
              <h2
                style={{
                  fontFamily: typography.serif,
                  fontSize: 28,
                  color: colors.heading,
                  margin: '0 0 24px',
                  letterSpacing: -0.3,
                }}
              >
                {isShowingPast ? 'Previously in Porto' : "What's on"}
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20,
                }}
              >
                {displayEvents.map((e) => (
                  <EventCard key={e.slug} event={e} />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                background: colors.card,
                borderRadius: 4,
                padding: 48,
                textAlign: 'center',
                color: colors.textSoft,
                border: `1px solid ${colors.divider}`,
              }}
            >
              First edition coming this Thursday!
            </div>
          )}

          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              padding: '28px 20px',
              background: colors.bgSoft,
              borderRadius: 6,
              border: `1px solid ${colors.divider}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
                color: colors.accent,
                marginBottom: 8,
              }}
            >
              This list grows every Thursday
            </div>
            <p style={{ fontSize: 15, color: colors.text, margin: '0 0 14px', lineHeight: 1.6 }}>
              Every Thursday morning, ~20 new events join this page, hand-curated from across
              Porto. Subscribe to get the weekly roundup straight to your inbox.
            </p>
            <Link
              href="/archive"
              style={{
                display: 'inline-block',
                padding: '8px 18px',
                background: colors.card,
                color: colors.heading,
                border: `1px solid ${colors.divider}`,
                borderRadius: 2,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              Browse archive →
            </Link>
          </div>
        </div>

        {/* Sticky subscribe sidebar */}
        <div
          className="home-sidebar"
          style={{
            width: 260,
            flexShrink: 0,
            position: 'sticky',
            top: 24,
            alignSelf: 'flex-start',
          }}
        >
          <div
            style={{
              background: colors.card,
              borderRadius: 8,
              padding: '28px 22px',
              border: `1px solid ${colors.divider}`,
              boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: colors.accent,
                  marginBottom: 8,
                  fontWeight: 700,
                }}
              >
                Weekly newsletter
              </div>
              <h2
                style={{
                  fontFamily: typography.serif,
                  fontSize: 20,
                  color: colors.heading,
                  margin: '0 0 6px',
                  letterSpacing: -0.3,
                }}
              >
                Never miss a week
              </h2>
              <div style={{ width: 32, height: 2, background: colors.accent, margin: '10px auto 12px' }} />
              <p style={{ fontSize: 13, color: colors.textSoft, margin: 0, lineHeight: 1.6 }}>
                Porto events guide delivered free every Thursday morning.
              </p>
            </div>
            <SubscribeForm />
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/archive" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none' }}>
              Archive →
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div
        style={{
          background: colors.bgAlt,
          padding: '64px 32px',
          marginTop: 16,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: colors.accent,
                marginBottom: 10,
              }}
            >
              FAQ
            </div>
            <h2
              style={{
                fontFamily: typography.serif,
                fontSize: 32,
                color: colors.heading,
                margin: 0,
                letterSpacing: -0.3,
              }}
            >
              About Porto Events
            </h2>
          </div>
          {[
            {
              q: 'What kinds of events happen in Porto every week?',
              a: "Porto has a packed cultural calendar year-round — live music and fado at intimate venues, contemporary art in the Bonfim gallery district, surf competitions in Matosinhos, wine tastings in the Port wine lodges of Vila Nova de Gaia, and street festivals in the historic centre. Every Thursday, Oporto Weekly curates the best of it all in one email.",
            },
            {
              q: 'Is Oporto Weekly free to subscribe?',
              a: "Yes, completely free. Enter your email above and you'll get the Porto events guide every Thursday morning. No spam, unsubscribe anytime.",
            },
            {
              q: 'Can I read past Porto events guides?',
              a: 'Yes — every edition is archived and available to read at oportoweekly.com/archive. Every individual event also has its own page you can share or bookmark.',
            },
          ].map(({ q, a }) => (
            <div
              key={q}
              style={{ marginBottom: 28, borderBottom: `1px solid ${colors.divider}`, paddingBottom: 28 }}
            >
              <h3
                style={{
                  fontFamily: typography.serif,
                  fontSize: 20,
                  color: colors.heading,
                  margin: '0 0 10px',
                  letterSpacing: -0.2,
                }}
              >
                {q}
              </h3>
              <p style={{ fontSize: 15, color: colors.textSoft, lineHeight: 1.8, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer lang="en" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event card — Porto-Secreto-style thumbnail with metadata pins
// ---------------------------------------------------------------------------

function EventCard({ event: e }: { event: EventRecord }) {
  return (
    <Link
      href={`/event/${e.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 4,
        textDecoration: 'none',
        color: 'inherit',
        overflow: 'hidden',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
    >
      {/* Hero image or placeholder */}
      {e.image ? (
        <img
          src={e.image.url}
          alt={e.name}
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            background: `linear-gradient(135deg, ${colors.bgSoft} 0%, ${colors.bgAlt} 100%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
          aria-label={`${CATEGORY_LABEL[e.category]} — photo coming soon`}
        >
          <div style={{ fontSize: 48 }}>{CATEGORY_EMOJI[e.category]}</div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.accent,
              fontWeight: 700,
            }}
          >
            {CATEGORY_LABEL[e.category]}
          </div>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: colors.accent,
            fontWeight: 700,
          }}
        >
          {CATEGORY_EMOJI[e.category]} {CATEGORY_LABEL[e.category]}
        </div>
        <h3
          style={{
            fontFamily: typography.serif,
            fontSize: 19,
            color: colors.heading,
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: -0.2,
          }}
        >
          {e.name}
        </h3>
        <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.5 }}>
          {formatCardDate(e.date, e.endDate)} · {e.venue}
        </div>
        {e.price && (
          <div style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>{e.price}</div>
        )}
      </div>
    </Link>
  );
}

function formatCardDate(iso: string, endIso?: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const start = d.toLocaleDateString('en-GB', opts);
  if (endIso) {
    const end = new Date(endIso).toLocaleDateString('en-GB', opts);
    if (start !== end) return `${start} – ${end}`;
  }
  return start;
}
