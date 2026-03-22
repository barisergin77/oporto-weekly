import { listBlogPosts } from '@/lib/blog';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

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

const gold = '#c9a96e';
const bg = '#1a1a2e';
const cardBg = '#16213e';

export default function BlogIndex() {
  const posts = listBlogPosts();

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>

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

      {/* Header */}
      <div style={{ background: bg, padding: '48px 32px 56px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#fff', margin: '0 0 12px' }}>
          Porto Guide
        </h1>
        <div style={{ width: 60, height: 2, background: gold, margin: '0 auto 16px' }} />
        <p style={{ fontSize: 15, color: '#9999bb', margin: 0, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          In-depth articles about Porto — hidden gems, food, culture, and insider tips from the city we love.
        </p>
      </div>

      {/* Blog grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 60px' }}>
        {posts.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 8, padding: 48, textAlign: 'center', color: '#888' }}>
            First articles coming soon — stay tuned!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article style={{
                  background: '#fff',
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}>
                  {post.heroImage && (
                    <div style={{ position: 'relative', width: '100%', height: 180 }}>
                      <Image
                        src={post.heroImage}
                        alt={post.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 600px) 100vw, 280px"
                      />
                    </div>
                  )}
                  <div style={{ padding: '18px 20px 22px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {post.tags.slice(0, 3).map(tag => (
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
                    <h2 style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: 17,
                      color: bg,
                      margin: '0 0 8px',
                      lineHeight: 1.4,
                    }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: '0 0 12px' }}>
                      {post.excerpt}
                    </p>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}
                      {post.author}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: bg, padding: '28px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: gold, marginBottom: 8 }}>Oporto Weekly</p>
        <p style={{ fontSize: 12, color: '#666899', lineHeight: 1.8, margin: 0 }}>
          Porto, Portugal<br />
          <Link href="/" style={{ color: gold, textDecoration: 'none' }}>Home</Link>
          {' · '}
          <Link href="/archive" style={{ color: '#666899', textDecoration: 'none' }}>Newsletter</Link>
          {' · '}
          <Link href="/pt" style={{ color: '#666899', textDecoration: 'none' }}>Português</Link>
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
