import { listBlogPosts } from '@/lib/blog';
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

const gold = '#c9a96e';
const bg = '#1a1a2e';
const cardBg = '#16213e';

export default function BlogIndex() {
  const posts = listBlogPosts();

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>

      <Header lang="en" active="blog" />

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

      <Footer lang="en" />
    </div>
  );
}
