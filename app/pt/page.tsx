import { listNewslettersPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeFormPT } from '../SubscribeFormPT';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export async function generateMetadata(): Promise<Metadata> {
  const newsletters = listNewslettersPT();
  const latest = newsletters[0] ?? null;
  const title = latest
    ? `${latest.weekRange} — Guia de Eventos no Porto`
    : 'Oporto Weekly — Newsletter de Eventos no Porto';

  return {
    title,
    description:
      'Os melhores eventos, cultura, gastronomia e o que fazer no Porto — curado todas as quintas-feiras de manhã, entregue gratuitamente na sua caixa de entrada.',
    keywords: ['eventos Porto', 'o que fazer no Porto', 'guia Porto', 'newsletter Porto', 'eventos Oporto', 'cultura Porto', 'fim de semana Porto'],
    alternates: {
      canonical: 'https://oportoweekly.com/pt',
      languages: {
        'en': 'https://oportoweekly.com',
        'pt': 'https://oportoweekly.com/pt',
      },
    },
    openGraph: {
      title,
      description: 'Os melhores eventos, cultura e o que fazer no Porto — todas as quintas-feiras.',
      url: 'https://oportoweekly.com/pt',
      locale: 'pt_PT',
    },
  };
}

export default function HomePT() {
  const newsletters = listNewslettersPT();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtmlPT(latest.slug) : null;
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>

      <Header lang="pt" active="home" />

      {/* Main layout */}
      <div className="home-layout" style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>

        {/* Newsletter content */}
        <div className="newsletter-content" style={{ flex: 1, minWidth: 0 }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: colors.card, borderRadius: 4, padding: 48, textAlign: 'center', color: colors.textSoft, border: `1px solid ${colors.divider}` }}>
              Primeira edição a caminho esta quinta-feira!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div className="home-sidebar" style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}>
          <div style={{
            background: colors.card,
            borderRadius: 8,
            padding: '28px 22px',
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700 }}>
                Todas as quintas
              </div>
              <h2 style={{
                fontFamily: typography.serif,
                fontSize: 20,
                color: colors.heading,
                margin: '0 0 6px',
                letterSpacing: -0.3,
              }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 32, height: 2, background: colors.accent, margin: '10px auto 12px' }} />
              <p style={{ fontSize: 13, color: colors.textSoft, margin: 0, lineHeight: 1.6 }}>
                O melhor do Porto, toda quinta-feira de manhã.
              </p>
            </div>

            {latest && (
              <div style={{
                background: colors.bgSoft,
                border: `1px solid ${colors.divider}`,
                borderLeft: `3px solid ${colors.accent}`,
                padding: '10px 12px',
                marginBottom: 18,
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 3, fontWeight: 700 }}>
                  Última edição
                </div>
                <div style={{ fontSize: 12, color: colors.text }}>{latest.weekRange}</div>
              </div>
            )}

            <SubscribeFormPT />
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/pt/arquivo" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none' }}>
              Ver todas as edições →
            </Link>
          </div>
        </div>

      </div>

      <Footer lang="pt" />

    </div>
  );
}
