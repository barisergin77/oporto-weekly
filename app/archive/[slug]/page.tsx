import { listNewsletters, getNewsletterMeta, getNewsletterMetaPT, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeForm } from '../../SubscribeForm';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export async function generateStaticParams() {
  const newsletters = listNewsletters();
  return newsletters.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const meta = getNewsletterMeta(params.slug);
  if (!meta) return { title: 'Not Found' };
  const url = `https://oportoweekly.com/archive/${meta.slug}`;
  // hreflang: declare the EN↔PT editions as language alternates so Google
  // stops treating the PT archive as a duplicate of this EN page ("Duplicate
  // without user-selected canonical", GSC 2026-07-11). Only emit the PT
  // alternate if that edition actually exists — a broken hreflang is worse
  // than none. Must be bidirectional (the PT page points back here).
  const ptExists = Boolean(getNewsletterMetaPT(`${meta.slug}-pt`));
  const languages: Record<string, string> = { en: url, 'x-default': url };
  if (ptExists) languages['pt-PT'] = `https://oportoweekly.com/pt/arquivo/${meta.slug}-pt`;
  return {
    title: `${meta.weekRange} — Porto Events Guide`,
    description: meta.description,
    alternates: { canonical: url, languages },
    openGraph: {
      title: `${meta.weekRange} — Porto Events Guide`,
      description: meta.description,
      type: 'article',
      url,
      publishedTime: meta.sentAt,
      siteName: 'Oporto Weekly',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${meta.weekRange} — Porto Events Guide`,
      description: meta.description,
    },
  };
}

export default function EditionPage({ params }: { params: { slug: string } }) {
  const meta = getNewsletterMeta(params.slug);
  const rawHtml = getNewsletterHtml(params.slug);
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  if (!meta || !html) notFound();

  // Prev / next navigation (list is newest-first)
  const all = listNewsletters();
  const idx = all.findIndex((n) => n.slug === params.slug);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx < all.length - 1 ? all[idx + 1] : null;
  const recentPosts = listBlogPosts().slice(0, 3);

  const pageUrl = `https://oportoweekly.com/archive/${meta.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        headline: `${meta.weekRange} — Porto Events Guide`,
        description: meta.description,
        datePublished: meta.sentAt,
        dateModified: meta.sentAt,
        url: pageUrl,
        publisher: {
          '@type': 'Organization',
          name: 'Oporto Weekly',
          url: 'https://oportoweekly.com',
        },
        author: { '@type': 'Organization', name: 'Oporto Weekly' },
        isAccessibleForFree: true,
        inLanguage: 'en',
        about: { '@type': 'Place', name: 'Porto', addressCountry: 'PT' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://oportoweekly.com' },
          { '@type': 'ListItem', position: 2, name: 'Archive', item: 'https://oportoweekly.com/archive' },
          { '@type': 'ListItem', position: 3, name: meta.weekRange, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <main style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header lang="en" active="archive" />

      {/* Main layout — matches homepage (newsletter + sticky sidebar) */}
      <div className="home-layout" style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>

        {/* Newsletter content */}
        <div className="newsletter-content" style={{ flex: 1, minWidth: 0 }} dangerouslySetInnerHTML={{ __html: html }} />

        {/* Sticky sidebar */}
        <div className="home-sidebar" style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}>
          {/* Subscribe card */}
          <div style={{
            background: colors.card,
            borderRadius: 8,
            padding: '28px 22px',
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700 }}>
                Get it Thursdays
              </div>
              <h2 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.3 }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 32, height: 2, background: colors.accent, margin: '10px auto 12px' }} />
              <p style={{ fontSize: 13, color: colors.textSoft, margin: 0, lineHeight: 1.6 }}>
                The best of Porto, every Thursday morning.
              </p>
            </div>
            <div style={{
              background: colors.bgSoft,
              border: `1px solid ${colors.divider}`,
              borderLeft: `3px solid ${colors.accent}`,
              padding: '10px 12px',
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 3, fontWeight: 700 }}>
                You are reading
              </div>
              <div style={{ fontSize: 12, color: colors.text }}>{meta.weekRange}</div>
            </div>
            <SubscribeForm />
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/archive" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none' }}>
              All editions →
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

      {/* Prev / Next navigation — light themed */}
      <div style={{
        background: colors.bgAlt,
        borderTop: `1px solid ${colors.divider}`,
        padding: '28px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {older && (
            <Link href={`/archive/${older.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 4, fontWeight: 700 }}>← Older edition</div>
              <div style={{ fontSize: 15, color: colors.heading, fontFamily: typography.serif }}>{older.weekRange}</div>
            </Link>
          )}
        </div>
        <Link href="/archive" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none', whiteSpace: 'nowrap', borderBottom: `1px solid ${colors.accent}`, paddingBottom: 1 }}>
          All editions
        </Link>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          {newer && (
            <Link href={`/archive/${newer.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 4, fontWeight: 700 }}>Newer edition →</div>
              <div style={{ fontSize: 15, color: colors.heading, fontFamily: typography.serif }}>{newer.weekRange}</div>
            </Link>
          )}
        </div>
      </div>

      {/* Subscribe CTA — light themed */}
      <div style={{ background: colors.bgSoft, padding: '48px 24px', textAlign: 'center', borderTop: `1px solid ${colors.divider}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
          Never miss an edition
        </div>
        <p style={{ fontFamily: typography.serif, fontSize: 24, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
          Enjoying Oporto Weekly?
        </p>
        <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 24px', lineHeight: 1.6 }}>
          Get the best of Porto delivered every Thursday morning — free.
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          background: colors.accent,
          color: colors.heading,
          padding: '14px 32px',
          borderRadius: 4,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 14,
        }}>
          Subscribe free →
        </Link>
      </div>

      <Footer lang="en" />
    </main>
  );
}
