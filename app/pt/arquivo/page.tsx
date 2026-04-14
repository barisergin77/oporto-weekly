import { listNewslettersPT } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
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
    <main style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang="pt" active="archive" />

      {/* Page title */}
      <div style={{ maxWidth: 640, margin: '48px auto 24px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
          Todas as edições
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 36, color: colors.heading, margin: 0, letterSpacing: -0.5 }}>
          Arquivo
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '14px auto 0' }} />
      </div>

      {/* Archive list */}
      <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 24px' }}>
        {newsletters.length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.textSoft }}>Ainda não há edições — a primeira sai quinta-feira!</p>
        ) : (
          newsletters.map((n) => {
            const date = new Date(n.sentAt);
            const dateStr = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <Link key={n.slug} href={`/pt/arquivo/${n.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: colors.card,
                  borderRadius: 6,
                  padding: '24px 28px',
                  marginBottom: 16,
                  border: `1px solid ${colors.divider}`,
                  borderLeft: `4px solid ${colors.accent}`,
                  boxShadow: '0 1px 3px rgba(26,26,46,0.04)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 8 }}>
                    {dateStr}
                  </div>
                  <h2 style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
                    {n.weekRange}
                  </h2>
                  <p style={{ fontSize: 14, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 12px' }}>
                    {n.description}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.heading, letterSpacing: 0.5, borderBottom: `1.5px solid ${colors.accent}`, paddingBottom: 2 }}>
                    Ler esta edição →
                  </span>
                </div>
              </Link>
            );
          })
        )}

        {/* CTA */}
        <div style={{
          background: colors.bgSoft,
          borderRadius: 8,
          padding: '36px 32px',
          textAlign: 'center',
          marginTop: 40,
          border: `1px solid ${colors.divider}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
            Junte-se à lista
          </div>
          <p style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
            Receba todas as quintas
          </p>
          <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 22px', lineHeight: 1.6 }}>
            Junte-se aos leitores que recebem o melhor do Porto todas as semanas.
          </p>
          <Link href="/pt" style={{
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
            Subscrever grátis →
          </Link>
        </div>
      </div>

      <Footer lang="pt" />
    </main>
  );
}
