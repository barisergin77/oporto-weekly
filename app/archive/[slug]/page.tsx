import { listNewsletters, getNewsletterMeta, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
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
    <main style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header lang="en" active="archive" />

      {/* Newsletter HTML */}
      <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: html }} />

      {/* Prev / Next navigation */}
      <div style={{
        background: '#16213e',
        borderTop: '1px solid #c9a96e33',
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
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9999bb', marginBottom: 4 }}>← Older edition</div>
              <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{older.weekRange}</div>
            </Link>
          )}
        </div>
        <Link href="/archive" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          All editions
        </Link>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          {newer && (
            <Link href={`/archive/${newer.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9999bb', marginBottom: 4 }}>Newer edition →</div>
              <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{newer.weekRange}</div>
            </Link>
          )}
        </div>
      </div>

      {/* Subscribe CTA */}
      <div style={{ background: '#1a1a2e', padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fff', marginBottom: 8 }}>
          Enjoying Oporto Weekly?
        </p>
        <p style={{ fontSize: 14, color: '#9999bb', marginBottom: 24 }}>
          Get the best of Porto delivered every Thursday morning — free.
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          background: '#c9a96e',
          color: '#1a1a2e',
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
