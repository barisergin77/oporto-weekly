import { listBlogPosts, getBlogPost, getBlogPostHtml } from '@/lib/blog';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return { title: 'Not Found' };

  return {
    title: `${post.title} | Oporto Weekly`,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author }],
    alternates: { canonical: `https://oportoweekly.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://oportoweekly.com/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: post.heroImage ? [{ url: `https://oportoweekly.com${post.heroImage}`, width: 1200, height: 675 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.heroImage ? [`https://oportoweekly.com${post.heroImage}`] : [],
    },
  };
}

const gold = '#c9a96e';
const bg = '#1a1a2e';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const html = getBlogPostHtml(params.slug);
  if (!html) notFound();

  const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.heroImage ? `https://oportoweekly.com${post.heroImage}` : undefined,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Oporto Weekly',
      url: 'https://oportoweekly.com',
    },
    mainEntityOfPage: `https://oportoweekly.com/blog/${post.slug}`,
  };

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .blog-article h2 { font-family: Georgia, serif; font-size: 24px; color: #1a1a2e; margin: 32px 0 12px; line-height: 1.3; }
        .blog-article h3 { font-family: Georgia, serif; font-size: 19px; color: #1a1a2e; margin: 24px 0 8px; line-height: 1.3; }
        .blog-article p { margin: 0 0 16px; }
        .blog-article ul, .blog-article ol { margin: 0 0 16px; padding-left: 24px; }
        .blog-article li { margin-bottom: 6px; }
        .blog-article strong { color: #1a1a2e; }
        .blog-article a { color: #c9a96e; text-decoration: underline; }
        .blog-article img { max-width: 100%; height: auto; border-radius: 8px; }
        .blog-article figure { margin: 24px 0; }
        .blog-article blockquote { border-left: 3px solid #c9a96e; margin: 20px 0; padding: 12px 20px; background: #f9f7f2; font-style: italic; color: #555; }
      `}} />

      {/* Top bar */}
      <div style={{ background: bg, padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: gold, textDecoration: 'none' }}>
          Oporto Weekly
        </Link>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link href="/blog" style={{ fontSize: 12, color: '#fff', textDecoration: 'none', letterSpacing: 0.5, fontWeight: 600 }}>
            Blog
          </Link>
          <Link href="/archive" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', letterSpacing: 0.5 }}>
            Newsletter
          </Link>
          <Link href="/pt" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', letterSpacing: 0.5 }}>
            PT
          </Link>
        </div>
      </div>

      {/* Hero image */}
      {post.heroImage && (
        <div style={{ position: 'relative', width: '100%', height: 400, maxHeight: '50vh' }}>
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            priority
            style={{ objectFit: 'cover' }}
            sizes="100vw"
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(transparent 40%, rgba(26,26,46,0.85) 100%)',
          }} />
        </div>
      )}

      {/* Article */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 60px' }}>
        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: gold,
              background: `${gold}15`,
              padding: '3px 8px',
              borderRadius: 3,
              fontWeight: 600,
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 34,
          color: bg,
          margin: '0 0 16px',
          lineHeight: 1.25,
        }}>
          {post.title}
        </h1>

        {/* Byline */}
        <div style={{
          fontSize: 13,
          color: '#888',
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: '1px solid #ddd',
        }}>
          By <strong style={{ color: '#555' }}>{post.author}</strong> · {publishedDate}
        </div>

        {/* Article body */}
        <div
          className="blog-article"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: '#333',
          }}
        />

        {/* Author signature */}
        <div style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `2px solid ${gold}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: gold,
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            BE
          </div>
          <div>
            <div style={{ fontWeight: 600, color: bg, fontSize: 14 }}>{post.author}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Editor, Oporto Weekly — Porto, Portugal</div>
          </div>
        </div>

        {/* Subscribe CTA */}
        <div style={{
          background: bg,
          borderRadius: 12,
          padding: '28px 24px',
          textAlign: 'center',
          marginTop: 40,
        }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#fff', margin: '0 0 8px' }}>
            Get Porto events in your inbox
          </p>
          <p style={{ fontSize: 13, color: '#9999bb', margin: '0 0 16px' }}>
            Curated every Thursday morning — free, no spam.
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: gold,
            color: bg,
            padding: '12px 28px',
            borderRadius: 6,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
          }}>
            Subscribe free →
          </Link>
        </div>

        {/* Back to blog */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/blog" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>
            ← Back to all articles
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: bg, padding: '28px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: gold, marginBottom: 8 }}>Oporto Weekly</p>
        <p style={{ fontSize: 12, color: '#666899', lineHeight: 1.8, margin: 0 }}>
          Porto, Portugal<br />
          <Link href="/" style={{ color: gold, textDecoration: 'none' }}>Home</Link>
          {' · '}
          <Link href="/blog" style={{ color: '#666899', textDecoration: 'none' }}>Blog</Link>
          {' · '}
          <Link href="/archive" style={{ color: '#666899', textDecoration: 'none' }}>Newsletter</Link>
          {' · '}
          <a href="https://www.instagram.com/oportoweekly/" target="_blank" rel="noopener noreferrer" style={{ color: '#666899', textDecoration: 'none', verticalAlign: 'middle' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 3 }}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </a>
        </p>
      </div>
    </div>
  );
}
