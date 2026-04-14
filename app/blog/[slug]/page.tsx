import { listBlogPosts, getBlogPost, getBlogPostHtml } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return { title: 'Not Found' };

  return {
    title: post.title,
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
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .blog-article h2 { font-family: ${typography.serif}; font-size: 26px; color: ${colors.heading}; margin: 36px 0 14px; line-height: 1.3; letter-spacing: -0.3px; }
        .blog-article h3 { font-family: ${typography.serif}; font-size: 20px; color: ${colors.heading}; margin: 28px 0 10px; line-height: 1.3; }
        .blog-article p { margin: 0 0 18px; }
        .blog-article ul, .blog-article ol { margin: 0 0 18px; padding-left: 24px; }
        .blog-article li { margin-bottom: 8px; }
        .blog-article strong { color: ${colors.heading}; }
        .blog-article a { color: ${colors.heading}; border-bottom: 1.5px solid ${colors.accent}; text-decoration: none; padding-bottom: 1px; }
        .blog-article img { max-width: 100%; height: auto; border-radius: 6px; }
        .blog-article figure { margin: 28px 0; }
        .blog-article blockquote { border-left: 3px solid ${colors.accent}; margin: 24px 0; padding: 14px 22px; background: ${colors.bgSoft}; font-style: italic; color: ${colors.textSoft}; font-family: ${typography.serif}; font-size: 17px; line-height: 1.6; }
      `}} />

      <Header lang="en" active="blog" />

      {/* Hero image */}
      {post.heroImage && (
        <div style={{ position: 'relative', width: '100%', height: 420, maxHeight: '52vh' }}>
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
            background: 'linear-gradient(transparent 40%, rgba(26,26,46,0.6) 100%)',
          }} />
        </div>
      )}

      {/* Article */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 60px' }}>
        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: colors.accent,
              background: colors.bgSoft,
              padding: '4px 10px',
              borderRadius: 3,
              fontWeight: 700,
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: typography.serif,
          fontSize: 38,
          color: colors.heading,
          margin: '0 0 18px',
          lineHeight: 1.2,
          letterSpacing: -0.5,
        }}>
          {post.title}
        </h1>

        {/* Byline */}
        <div style={{
          fontSize: 14,
          color: colors.textSoft,
          marginBottom: 36,
          paddingBottom: 24,
          borderBottom: `1px solid ${colors.divider}`,
        }}>
          By <strong style={{ color: colors.heading }}>{post.author}</strong>
          <span style={{ color: colors.textMuted, margin: '0 8px' }}>·</span>
          {publishedDate}
        </div>

        {/* Article body */}
        <div
          className="blog-article"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            fontSize: 17,
            lineHeight: 1.8,
            color: colors.text,
          }}
        />

        {/* Author signature */}
        <div style={{
          marginTop: 56,
          paddingTop: 28,
          borderTop: `2px solid ${colors.accent}`,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: colors.bgSoft,
            border: `2px solid ${colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.accent,
            fontFamily: typography.serif,
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            BE
          </div>
          <div>
            <div style={{ fontWeight: 600, color: colors.heading, fontSize: 15 }}>{post.author}</div>
            <div style={{ fontSize: 13, color: colors.textSoft }}>Editor, Oporto Weekly — Porto, Portugal</div>
          </div>
        </div>

        {/* Subscribe CTA — light themed */}
        <div style={{
          background: colors.bgSoft,
          border: `1px solid ${colors.divider}`,
          borderRadius: 8,
          padding: '32px 28px',
          textAlign: 'center',
          marginTop: 48,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
            Weekly newsletter
          </div>
          <p style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
            Get Porto events in your inbox
          </p>
          <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 20px', lineHeight: 1.6 }}>
            Curated every Thursday morning — free, no spam.
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: colors.accent,
            color: colors.heading,
            padding: '12px 28px',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.5,
          }}>
            Subscribe free →
          </Link>
        </div>

        {/* Back to blog */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link href="/blog" style={{ fontSize: 13, color: colors.textSoft, textDecoration: 'none' }}>
            ← Back to all articles
          </Link>
        </div>
      </div>

      <Footer lang="en" />
    </div>
  );
}
