import { listBlogPosts } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Porto Guide — Blog | Oporto Weekly',
  description: 'In-depth guides, tips, and articles about Porto — from hidden gems and rooftop bars to local food markets and cultural events.',
  keywords: ['Porto guide', 'Porto blog', 'things to do in Porto', 'Porto tips', 'Porto travel', 'Porto food', 'Porto culture'],
  alternates: { canonical: 'https://oportoweekly.com/blog' },
  openGraph: {
    title: 'Porto Guide — Blog | Oporto Weekly',
    description: 'In-depth guides and insider tips about Porto, Portugal.',
    url: 'https://oportoweekly.com/blog',
  },
};

export default function BlogIndex() {
  const posts = listBlogPosts();

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>

      <Header lang="en" active="blog" />

      {/* Page title — light, editorial */}
      <div className="blog-header" style={{ background: colors.bg, padding: '56px 32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 12 }}>
          In-depth guides
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 44, color: colors.heading, margin: '0 0 14px', letterSpacing: -0.5 }}>
          Porto Guide
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 16, color: colors.textSoft, margin: 0, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Hidden gems, food, culture, and insider tips from the city we love.
        </p>
      </div>

      {/* Blog grid */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 60px' }}>
        {posts.length === 0 ? (
          <div style={{ background: colors.card, borderRadius: 6, padding: 48, textAlign: 'center', color: colors.textSoft, border: `1px solid ${colors.divider}` }}>
            First articles coming soon — stay tuned!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 28 }}>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article style={{
                  background: colors.card,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${colors.divider}`,
                  boxShadow: '0 1px 3px rgba(26,26,46,0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {post.heroImage && (
                    <div style={{ position: 'relative', width: '100%', height: 200 }}>
                      <Image
                        src={post.heroImage}
                        alt={post.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 600px) 100vw, 280px"
                      />
                    </div>
                  )}
                  <div style={{ padding: '20px 22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {post.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{
                          fontSize: 10,
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                          color: colors.accent,
                          background: colors.bgSoft,
                          padding: '3px 10px',
                          borderRadius: 3,
                          fontWeight: 700,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2 style={{
                      fontFamily: typography.serif,
                      fontSize: 19,
                      color: colors.heading,
                      margin: '0 0 10px',
                      lineHeight: 1.3,
                      letterSpacing: -0.2,
                    }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: 14, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 14px', flex: 1 }}>
                      {post.excerpt}
                    </p>
                    <div style={{ fontSize: 11, color: colors.textMuted, borderTop: `1px solid ${colors.divider}`, paddingTop: 10 }}>
                      {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}
                      <span style={{ color: colors.textSoft }}>{post.author}</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer lang="en" />
    </div>
  );
}
