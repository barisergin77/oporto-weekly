import { listBlogPostsPT, blogDisplay } from '@/lib/blog';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

export const metadata: Metadata = {
  title: 'Guia do Porto — Blog | Oporto Weekly',
  description: 'Guias detalhados, dicas e artigos sobre o Porto — de tesouros escondidos e bares de esplanada a mercados locais e eventos culturais.',
  keywords: ['guia Porto', 'blog Porto', 'o que fazer no Porto', 'dicas Porto', 'viagem Porto', 'gastronomia Porto', 'cultura Porto'],
  alternates: {
    canonical: 'https://oportoweekly.com/pt/blog',
    languages: { en: 'https://oportoweekly.com/blog', 'pt-PT': 'https://oportoweekly.com/pt/blog', 'x-default': 'https://oportoweekly.com/blog' },
  },
  openGraph: { title: 'Guia do Porto — Blog | Oporto Weekly', description: 'Guias detalhados e dicas de quem conhece o Porto.', url: 'https://oportoweekly.com/pt/blog', locale: 'pt_PT' },
};

const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function BlogIndexPT() {
  const posts = listBlogPostsPT();

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang="pt" active="blog" />

      <div className="blog-header" style={{ background: colors.bg, padding: '56px 32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 12 }}>
          Guias detalhados
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 44, color: colors.heading, margin: '0 0 14px', letterSpacing: -0.5 }}>
          Guia do Porto
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '0 auto 20px' }} />
        <p style={{ fontSize: 16, color: colors.textSoft, margin: 0, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Tesouros escondidos, gastronomia, cultura e dicas da cidade que adoramos.
        </p>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 60px' }}>
        {posts.length === 0 ? (
          <div style={{ background: colors.card, borderRadius: 6, padding: 48, textAlign: 'center', color: colors.textSoft, border: `1px solid ${colors.divider}` }}>
            Primeiros artigos em breve — fique atento!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 28 }}>
            {posts.map((post) => {
              const disp = blogDisplay(post, 'pt');
              const d = new Date(post.publishedAt);
              return (
                <Link key={post.slug} href={`/pt/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: colors.card, borderRadius: 6, overflow: 'hidden', border: `1px solid ${colors.divider}`, boxShadow: '0 1px 3px rgba(26,26,46,0.04)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {post.heroImage && (
                      <div style={{ position: 'relative', width: '100%', height: 200 }}>
                        <Image src={post.heroImage} alt={disp.title} fill style={{ objectFit: 'cover' }} sizes="(max-width: 600px) 100vw, 280px" />
                      </div>
                    )}
                    <div style={{ padding: '20px 22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {post.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent, background: colors.bgSoft, padding: '3px 10px', borderRadius: 3, fontWeight: 700 }}>{tag}</span>
                        ))}
                      </div>
                      <h2 style={{ fontFamily: typography.serif, fontSize: 19, color: colors.heading, margin: '0 0 10px', lineHeight: 1.3, letterSpacing: -0.2 }}>
                        {disp.title}
                      </h2>
                      <p style={{ fontSize: 14, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 14px', flex: 1 }}>
                        {disp.excerpt}
                      </p>
                      <div style={{ fontSize: 11, color: colors.textMuted, borderTop: `1px solid ${colors.divider}`, paddingTop: 10 }}>
                        {`${d.getUTCDate()} de ${PT_MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`}
                        {' · '}
                        <span style={{ color: colors.textSoft }}>{post.author}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer lang="pt" />
    </div>
  );
}
