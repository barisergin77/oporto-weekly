import { listNewsletters, getNewsletterMeta, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

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
      {/* Nav bar */}
      <div style={{ background: '#1a1a2e', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e', textDecoration: 'none' }}>
          Oporto Weekly
        </Link>
        <Link href="/archive" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', letterSpacing: 0.5 }}>
          ← All editions
        </Link>
      </div>

      {/* Newsletter HTML */}
      <div dangerouslySetInnerHTML={{ __html: html }} />

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
    </main>
  );
}
