import { listBlogPostsPT, getBlogPost, getBlogPostHtmlPT, hasBlogPT, blogDisplay, splitForInlineCta } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { SubscribeCTA } from '../../../components/SubscribeCTA';
import { PortoFactsBox } from '../../../components/PortoFactsBox';
import { GuideUpcoming } from '../../../components/GuideUpcoming';
import { BookItBox } from '../../../components/BookItBox';

export function generateStaticParams() {
  return listBlogPostsPT().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post || !hasBlogPT(params.slug)) return { title: 'Não encontrado' };
  const disp = blogDisplay(post, 'pt');
  const url = `https://oportoweekly.com/pt/blog/${post.slug}`;
  const enUrl = `https://oportoweekly.com/blog/${post.slug}`;
  return {
    title: disp.title,
    description: disp.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author }],
    alternates: { canonical: url, languages: { en: enUrl, 'pt-PT': url, 'x-default': enUrl } },
    openGraph: {
      title: disp.title, description: disp.excerpt, url, type: 'article', locale: 'pt_PT',
      publishedTime: post.publishedAt, authors: [post.author],
      images: post.heroImage ? [{ url: `https://oportoweekly.com${post.heroImage}`, width: 1200, height: 675 }] : [],
    },
  };
}

const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function BlogPostPagePT({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();
  const html = getBlogPostHtmlPT(params.slug);
  if (!html) notFound();
  const split = splitForInlineCta(html);
  const bodyStyle = { fontSize: 17, lineHeight: 1.8, color: colors.text };

  const disp = blogDisplay(post, 'pt');
  const d = new Date(post.publishedAt);
  const publishedDate = `${d.getUTCDate()} de ${PT_MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    inLanguage: 'pt-PT',
    headline: disp.title,
    description: disp.excerpt,
    image: post.heroImage ? `https://oportoweekly.com${post.heroImage}` : undefined,
    datePublished: post.publishedAt,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'Oporto Weekly', url: 'https://oportoweekly.com' },
    mainEntityOfPage: `https://oportoweekly.com/pt/blog/${post.slug}`,
  };

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

      <Header lang="pt" active="blog" />

      {post.heroImage && (
        <div style={{ position: 'relative', width: '100%', height: 420, maxHeight: '52vh' }}>
          <Image src={post.heroImage} alt={disp.title} fill priority style={{ objectFit: 'cover' }} sizes="100vw" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(26,26,46,0.6) 100%)' }} />
        </div>
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 60px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent, background: colors.bgSoft, padding: '4px 10px', borderRadius: 3, fontWeight: 700 }}>{tag}</span>
          ))}
        </div>

        <h1 style={{ fontFamily: typography.serif, fontSize: 38, color: colors.heading, margin: '0 0 18px', lineHeight: 1.2, letterSpacing: -0.5 }}>
          {disp.title}
        </h1>

        <div style={{ fontSize: 14, color: colors.textSoft, marginBottom: 36, paddingBottom: 24, borderBottom: `1px solid ${colors.divider}` }}>
          Por <strong style={{ color: colors.heading }}>{post.author}</strong>
          <span style={{ color: colors.textMuted, margin: '0 8px' }}>·</span>
          {publishedDate}
        </div>

        {/* Subscribe box before the second section (#35) */}
        {split ? (
          <>
            <div className="blog-article" dangerouslySetInnerHTML={{ __html: split[0] }} style={bodyStyle} />
            <div style={{ margin: '12px 0 8px' }}><SubscribeCTA lang="pt" context="blog-inline" /></div>
            <div className="blog-article" dangerouslySetInnerHTML={{ __html: split[1] }} style={bodyStyle} />
          </>
        ) : (
          <div className="blog-article" dangerouslySetInnerHTML={{ __html: html }} style={bodyStyle} />
        )}

        <BookItBox slug={post.slug} title={post.title} lang="pt" />

        <GuideUpcoming lang="pt" />

        <div style={{ marginTop: 48 }}>
          <SubscribeCTA lang="pt" context="blog" />
          <div style={{ marginTop: 8 }}><PortoFactsBox lang="pt" compact /></div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link href="/pt/blog" style={{ fontSize: 13, color: colors.textSoft, textDecoration: 'none' }}>
            ← Voltar a todos os artigos
          </Link>
        </div>
      </div>

      <Footer lang="pt" />
    </div>
  );
}
