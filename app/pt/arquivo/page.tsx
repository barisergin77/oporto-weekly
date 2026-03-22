import { listNewslettersPT } from '@/lib/archive';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

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
      <Header lang="pt" active="archive" />

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

      <Footer lang="pt" />
    </main>
  );
}
