import { listNewsletters, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
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

const gold = '#c9a96e';
const bg = '#1a1a2e';

export default function PortoEventsPage() {
  const newsletters = listNewsletters();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtml(latest.slug) : null;
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Header lang="en" active="events" />

      {/* Hero intro — unique evergreen content for SEO */}
      <div style={{ background: bg, borderBottom: `1px solid ${gold}33`, padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: gold, marginBottom: 12 }}>
          Updated every Thursday
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 38, color: '#fff', margin: '0 0 16px', lineHeight: 1.25 }}>
          Porto Events This Week
        </h1>
        <p style={{ fontSize: 16, color: '#9999bb', maxWidth: 560, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Porto is one of Europe&apos;s most vibrant cities — every week brings concerts at
          Casa da Música, gallery openings in Rua Miguel Bombarda, rooftop parties in
          Foz, and food markets along the Douro. Here&apos;s what&apos;s on this week.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['🎵 Concerts', '🎨 Art', '🍷 Food & Wine', '👨‍👩‍👧 Family', '🌙 Nightlife'].map((tag) => (
            <span key={tag} style={{
              background: `${gold}20`,
              border: `1px solid ${gold}40`,
              color: gold,
              padding: '4px 14px',
              borderRadius: 20,
              fontSize: 13,
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
              background: '#fff',
              borderRadius: 4,
              padding: '12px 20px',
              marginBottom: 24,
              borderLeft: `4px solid ${gold}`,
              fontSize: 13,
              color: '#555',
            }}>
              📅 <strong style={{ color: '#1a1a2e' }}>Edition: {latest.weekRange}</strong>
              {' — '}
              <Link href={`/archive/${latest.slug}`} style={{ color: gold, textDecoration: 'none' }}>
                Permanent link →
              </Link>
            </div>
          )}
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: '#fff', borderRadius: 4, padding: 48, textAlign: 'center', color: '#888' }}>
              First edition coming this Thursday!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div style={{ width: 260, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
          <div style={{
            background: bg, borderRadius: 12, padding: '28px 22px',
            border: `1px solid ${gold}33`, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#fff', margin: '0 0 6px' }}>
                Never miss a week
              </h2>
              <div style={{ width: 40, height: 2, background: gold, margin: '8px auto 10px' }} />
              <p style={{ fontSize: 13, color: '#9999bb', margin: 0, lineHeight: 1.6 }}>
                Porto events guide delivered free every Thursday morning.
              </p>
            </div>
            <SubscribeForm />
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/archive" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
              Browse all past editions →
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ section */}
      <div style={{ background: bg, padding: '56px 32px', marginTop: 16 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#fff', textAlign: 'center', marginBottom: 40 }}>
            About Porto Events
          </h2>
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
            <div key={q} style={{ marginBottom: 32, borderBottom: `1px solid ${gold}22`, paddingBottom: 32 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: gold, marginBottom: 10 }}>{q}</h3>
              <p style={{ fontSize: 14, color: '#9999bb', lineHeight: 1.8, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer lang="en" />
    </div>
  );
}
