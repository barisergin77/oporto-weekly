import { listNewslettersPT } from '@/lib/archive';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Arquivo — Todas as Edições',
  description: 'Veja todas as edições anteriores do Oporto Weekly — o seu guia curado de eventos no Porto.',
  alternates: { canonical: 'https://oportoweekly.com/pt/arquivo' },
  openGraph: {
    title: 'Arquivo — Oporto Weekly',
    description: 'Todas as edições do Oporto Weekly em português.',
    url: 'https://oportoweekly.com/pt/arquivo',
    locale: 'pt_PT',
  },
};

export default function ArquivoPT() {
  const newsletters = listNewslettersPT();

  return (
    <main style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '48px 24px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#c9a96e', marginBottom: 12 }}>
          O seu guia semanal do Porto
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, color: '#fff', marginBottom: 8 }}>Oporto Weekly</h1>
        <p style={{ fontSize: 14, color: '#9999bb' }}>Edições Anteriores</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
          <Link href="/pt" style={{ fontSize: 12, color: '#c9a96e', textDecoration: 'none' }}>← Início</Link>
          <Link href="/archive" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none' }}>English archive</Link>
        </div>
      </div>

      {/* Archive list */}
      <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px' }}>
        {newsletters.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Ainda não há edições — a primeira sai quinta-feira!</p>
        ) : (
          newsletters.map((n) => {
            const date = new Date(n.sentAt);
            const dateStr = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <Link key={n.slug} href={`/pt/arquivo/${n.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: '#fff',
                  borderRadius: 4,
                  padding: '24px 28px',
                  marginBottom: 16,
                  boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                  borderLeft: '4px solid #c9a96e',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#c9a96e', marginBottom: 6 }}>
                    {dateStr}
                  </div>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#1a1a2e', marginBottom: 8 }}>
                    {n.weekRange}
                  </h2>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
                    {n.description}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#c9a96e', letterSpacing: 0.5 }}>
                    Ler esta edição →
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#1a1a2e', padding: '28px 32px', textAlign: 'center', marginTop: 32 }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e', marginBottom: 8 }}>Oporto Weekly</p>
        <p style={{ fontSize: 12, color: '#666899', lineHeight: 1.8, margin: 0 }}>
          Curado toda quinta-feira · Porto, Portugal<br />
          <Link href="/pt" style={{ color: '#c9a96e', textDecoration: 'none' }}>Início</Link>
          {' · '}
          <Link href="/" style={{ color: '#666899', textDecoration: 'none' }}>English</Link>
          {' · '}
          <a href="https://www.instagram.com/oportoweekly/" target="_blank" rel="noopener noreferrer" style={{ color: '#666899', textDecoration: 'none', verticalAlign: 'middle' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 3 }}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </a>
        </p>
      </div>
    </main>
  );
}
