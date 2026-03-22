import { listNewsletters, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeForm } from './SubscribeForm';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

export async function generateMetadata(): Promise<Metadata> {
  const newsletters = listNewsletters();
  const latest = newsletters[0] ?? null;
  const title = latest
    ? `${latest.weekRange} — Porto Events Guide`
    : 'Porto Events & Culture Newsletter';
  const description = latest?.description
    ?? 'The best events, culture, food, and things to do in Porto — curated every Thursday morning.';

  return {
    title,
    description,
    alternates: { canonical: 'https://oportoweekly.com' },
    openGraph: {
      title,
      description,
      url: 'https://oportoweekly.com',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://oportoweekly.com/#organization',
      name: 'Oporto Weekly',
      url: 'https://oportoweekly.com',
      email: 'hello@oportoweekly.com',
      description: 'Curated Porto events and culture newsletter, published every Thursday.',
      areaServed: { '@type': 'City', name: 'Porto', addressCountry: 'PT' },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://oportoweekly.com/#website',
      url: 'https://oportoweekly.com',
      name: 'Oporto Weekly',
      publisher: { '@id': 'https://oportoweekly.com/#organization' },
      inLanguage: 'en',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://oportoweekly.com/archive?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function Home() {
  const newsletters = listNewsletters();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtml(latest.slug) : null;
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  const gold = '#c9a96e';
  const bg = '#1a1a2e';

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <Header lang="en" active="home" />

      {/* Main layout */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>

        {/* Newsletter content — takes up most of the space */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: '#fff', borderRadius: 4, padding: 48, textAlign: 'center', color: '#888' }}>
              First edition coming this Thursday!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}>
          <div style={{
            background: bg,
            borderRadius: 12,
            padding: '28px 22px',
            border: `1px solid ${gold}33`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}>
            {/* Branding */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>

              <h2 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                color: '#fff',
                margin: '0 0 6px',
              }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 40, height: 2, background: gold, margin: '8px auto 10px' }} />
              <p style={{ fontSize: 13, color: '#9999bb', margin: 0, lineHeight: 1.6 }}>
                The best of Porto, every Thursday morning.
              </p>
            </div>

            {/* What you're reading label */}
            {latest && (
              <div style={{
                background: `${gold}15`,
                border: `1px solid ${gold}33`,
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 18,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: gold, marginBottom: 3 }}>
                  Latest edition
                </div>
                <div style={{ fontSize: 12, color: '#ccd6f6' }}>{latest.weekRange}</div>
              </div>
            )}

            {/* Subscribe form */}
            <SubscribeForm />
          </div>

          {/* Archive link below card */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/archive" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
              Browse all past editions →
            </Link>
          </div>
        </div>

      </div>

      <Footer lang="en" />

    </div>
  );
}
