import { listNewsletters, getNewsletterMeta, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
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
  return {
    title: `${meta.weekRange} — Porto Events Guide`,
    description: meta.description,
    alternates: { canonical: url },
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

      {/* Newsletter HTML */}
      <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: html }} />

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
