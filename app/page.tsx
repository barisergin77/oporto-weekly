import { listNewsletters, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
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
  const recentPosts = listBlogPosts().slice(0, 3);

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <Header lang="en" active="home" />

      {/* Main layout */}
      <div className="home-layout" style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>

        {/* Newsletter content — takes up most of the space */}
        <div className="newsletter-content" style={{ flex: 1, minWidth: 0 }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: colors.card, borderRadius: 4, padding: 48, textAlign: 'center', color: colors.textSoft, border: `1px solid ${colors.divider}` }}>
              First edition coming this Thursday!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div className="home-sidebar" style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}>
          {/* Subscribe card — light, editorial */}
          <div style={{
            background: colors.card,
            borderRadius: 8,
            padding: '28px 22px',
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
          }}>
            {/* Branding */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700 }}>
                Get it Thursdays
              </div>
              <h2 style={{
                fontFamily: typography.serif,
                fontSize: 20,
                color: colors.heading,
                margin: '0 0 6px',
                letterSpacing: -0.3,
              }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 32, height: 2, background: colors.accent, margin: '10px auto 12px' }} />
              <p style={{ fontSize: 13, color: colors.textSoft, margin: 0, lineHeight: 1.6 }}>
                The best of Porto, every Thursday morning.
              </p>
            </div>

            {/* Latest edition badge */}
            {latest && (
              <div style={{
                background: colors.bgSoft,
                border: `1px solid ${colors.divider}`,
                borderLeft: `3px solid ${colors.accent}`,
                padding: '10px 12px',
                marginBottom: 18,
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 3, fontWeight: 700 }}>
                  Latest edition
                </div>
                <div style={{ fontSize: 12, color: colors.text }}>{latest.weekRange}</div>
              </div>
            )}

            {/* Subscribe form */}
            <SubscribeForm />
          </div>

          {/* Archive link below card */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/archive" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none' }}>
              Archive →
            </Link>
          </div>

          {/* Recent blog posts */}
          {recentPosts.length > 0 && (
            <div style={{
              background: colors.card,
              borderRadius: 8,
              padding: '20px 18px',
              marginTop: 20,
              border: `1px solid ${colors.divider}`,
            }}>
              <h3 style={{
                fontFamily: typography.serif,
                fontSize: 16,
                color: colors.heading,
                margin: '0 0 14px',
                paddingBottom: 10,
                borderBottom: `2px solid ${colors.accent}`,
                letterSpacing: -0.2,
              }}>
                From the Blog
              </h3>
              {recentPosts.map((post, i) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    padding: '10px 0',
                    borderBottom: i < recentPosts.length - 1 ? `1px solid ${colors.divider}` : 'none',
                  }}
                >
                  <div style={{ fontSize: 13, color: colors.heading, fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>
                    {post.title}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textSoft }}>
                    {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </Link>
              ))}
              <Link
                href="/blog"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 12,
                  color: colors.accent,
                  textDecoration: 'none',
                  marginTop: 14,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                All articles →
              </Link>
            </div>
          )}
        </div>

      </div>

      <Footer lang="en" />

    </div>
  );
}
