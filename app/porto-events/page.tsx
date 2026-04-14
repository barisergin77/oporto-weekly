import { listNewsletters, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeForm } from '../SubscribeForm';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Porto Events This Week — Best Things To Do in Porto',
  description:
    'Discover the best events happening in Porto this week — concerts, art exhibitions, food markets, nightlife, and family activities. Updated every Thursday.',
  keywords: [
    'porto events this week',
    'things to do in porto',
    'porto weekend events',
    'what to do in porto',
    'porto concerts',
    'porto art exhibitions',
    'porto food markets',
    'porto nightlife',
    'porto family events',
    'oporto events',
  ],
  alternates: { canonical: 'https://oportoweekly.com/porto-events' },
  openGraph: {
    title: 'Porto Events This Week — Best Things To Do in Porto',
    description:
      'Discover the best events happening in Porto this week — concerts, art exhibitions, food markets, nightlife, and family activities.',
    url: 'https://oportoweekly.com/porto-events',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://oportoweekly.com/porto-events',
      name: 'Porto Events This Week',
      description: 'The best events happening in Porto this week, updated every Thursday.',
      url: 'https://oportoweekly.com/porto-events',
      inLanguage: 'en',
      about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' },
      publisher: { '@type': 'Organization', name: 'Oporto Weekly', url: 'https://oportoweekly.com' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What events are happening in Porto this week?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Porto has something for everyone every week — concerts at Casa da Música, art openings in Rua Miguel Bombarda, food markets at Mercado do Bolhão, riverside nightlife in Ribeira, and family activities across the city. Check the latest Oporto Weekly edition for this week\'s full guide.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I find out about events in Porto every week?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Subscribe to Oporto Weekly — a free newsletter delivered every Thursday morning with the best events, concerts, exhibitions, food markets, and nightlife in Porto, Portugal.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Oporto Weekly free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, Oporto Weekly is completely free. Subscribe with your email at oportoweekly.com to receive the Porto events guide every Thursday morning.',
          },
        },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://oportoweekly.com' },
        { '@type': 'ListItem', position: 2, name: 'Porto Events This Week', item: 'https://oportoweekly.com/porto-events' },
      ],
    },
  ],
};

export default function PortoEventsPage() {
  const newsletters = listNewsletters();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtml(latest.slug) : null;
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Header lang="en" active="events" />

      {/* Hero intro — light editorial */}
      <div style={{ background: colors.bg, borderBottom: `1px solid ${colors.divider}`, padding: '48px 32px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 14 }}>
          Updated every Thursday
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 42, color: colors.heading, margin: '0 0 16px', lineHeight: 1.2, letterSpacing: -0.5 }}>
          Porto Events This Week
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '0 auto 22px' }} />
        <p style={{ fontSize: 16, color: colors.textSoft, maxWidth: 580, margin: '0 auto 28px', lineHeight: 1.7 }}>
          Porto is one of Europe&apos;s most vibrant cities — every week brings concerts at
          Casa da Música, gallery openings in Rua Miguel Bombarda, rooftop parties in
          Foz, and food markets along the Douro. Here&apos;s what&apos;s on this week.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['🎵 Concerts', '🎨 Art', '🍷 Food & Wine', '👨‍👩‍👧 Family', '🌙 Nightlife'].map((tag) => (
            <span key={tag} style={{
              background: colors.card,
              border: `1px solid ${colors.divider}`,
              color: colors.heading,
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Newsletter content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {latest && (
            <div style={{
              background: colors.card,
              borderRadius: 6,
              padding: '12px 20px',
              marginBottom: 24,
              border: `1px solid ${colors.divider}`,
              borderLeft: `4px solid ${colors.accent}`,
              fontSize: 13,
              color: colors.textSoft,
            }}>
              📅 <strong style={{ color: colors.heading }}>Edition: {latest.weekRange}</strong>
              {' — '}
              <Link href={`/archive/${latest.slug}`} style={{ color: colors.heading, textDecoration: 'none', borderBottom: `1.5px solid ${colors.accent}`, paddingBottom: 1 }}>
                Permanent link →
              </Link>
            </div>
          )}
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: colors.card, borderRadius: 4, padding: 48, textAlign: 'center', color: colors.textSoft, border: `1px solid ${colors.divider}` }}>
              First edition coming this Thursday!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div style={{ width: 260, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
          <div style={{
            background: colors.card,
            borderRadius: 8,
            padding: '28px 22px',
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700 }}>
                Weekly newsletter
              </div>
              <h2 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.3 }}>
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

      {/* FAQ section — light */}
      <div style={{ background: colors.bgAlt, padding: '64px 32px', marginTop: 16, borderTop: `1px solid ${colors.divider}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
              FAQ
            </div>
            <h2 style={{ fontFamily: typography.serif, fontSize: 32, color: colors.heading, margin: 0, letterSpacing: -0.3 }}>
              About Porto Events
            </h2>
          </div>
          {[
            {
              q: 'What kinds of events happen in Porto every week?',
              a: 'Porto has a packed cultural calendar year-round — live music and fado at intimate venues, contemporary art in the Bonfim gallery district, surf competitions in Matosinhos, wine tastings in the Port wine lodges of Vila Nova de Gaia, and street festivals in the historic centre. Every Thursday, Oporto Weekly curates the best of it all in one email.'
            },
            {
              q: 'Is Oporto Weekly free to subscribe?',
              a: 'Yes, completely free. Enter your email above and you\'ll get the Porto events guide every Thursday morning. No spam, unsubscribe anytime.'
            },
            {
              q: 'Can I read past Porto events guides?',
              a: 'Yes — every edition is archived and available to read at oportoweekly.com/archive.'
            },
          ].map(({ q, a }) => (
            <div key={q} style={{ marginBottom: 28, borderBottom: `1px solid ${colors.divider}`, paddingBottom: 28 }}>
              <h3 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, margin: '0 0 10px', letterSpacing: -0.2 }}>{q}</h3>
              <p style={{ fontSize: 15, color: colors.textSoft, lineHeight: 1.8, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer lang="en" />
    </div>
  );
}
