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
        </p>
      </div>
    </main>
  );
}
