import { listNewslettersPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeFormPT } from '../SubscribeFormPT';

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

  const gold = '#c9a96e';
  const bg = '#1a1a2e';

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: bg, padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/pt" style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: gold, textDecoration: 'none' }}>
          Oporto Weekly
        </Link>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link href="/pt/arquivo" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', letterSpacing: 0.5 }}>
            Arquivo →
          </Link>
          <Link href="/" style={{ fontSize: 12, color: gold, textDecoration: 'none', letterSpacing: 0.5, fontWeight: 600 }}>
            EN
          </Link>
        </div>
      </div>

      {/* Main layout */}
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        gap: 32,
        alignItems: 'flex-start',
      }}>

        {/* Newsletter content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ background: '#fff', borderRadius: 4, padding: 48, textAlign: 'center', color: '#888' }}>
              Primeira edição a caminho esta quinta-feira!
            </div>
          )}
        </div>

        {/* Sticky subscribe sidebar */}
        <div style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}>
          <div style={{
            background: bg,
            borderRadius: 12,
            padding: '28px 22px',
            border: `1px solid ${gold}33`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                color: '#fff',
                margin: '0 0 6px',
              }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 40, height: 2, background: gold, margin: '8px auto 10px' }} />
              <p style={{ fontSize: 13, color: '#9999bb', margin: 0, lineHeight: 1.6 }}>
                O melhor do Porto, toda quinta-feira de manhã.
              </p>
            </div>

            {latest && (
              <div style={{
                background: `${gold}15`,
                border: `1px solid ${gold}33`,
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 18,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: gold, marginBottom: 3 }}>
                  Última edição
                </div>
                <div style={{ fontSize: 12, color: '#ccd6f6' }}>{latest.weekRange}</div>
              </div>
            )}

            <SubscribeFormPT />
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/pt/arquivo" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
              Ver todas as edições →
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ background: bg, padding: '28px 32px', textAlign: 'center', marginTop: 16 }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: gold, marginBottom: 8 }}>Oporto Weekly</p>
        <p style={{ fontSize: 12, color: '#666899', lineHeight: 1.8, margin: 0 }}>
          Curado toda quinta-feira · Porto, Portugal<br />
          <Link href="/pt/arquivo" style={{ color: gold, textDecoration: 'none' }}>Arquivo</Link>
          {' · '}
          <Link href="/" style={{ color: '#666899', textDecoration: 'none' }}>English</Link>
          {' · '}
          <a href="mailto:hello@oportoweekly.com" style={{ color: '#666899', textDecoration: 'none' }}>hello@oportoweekly.com</a>
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
