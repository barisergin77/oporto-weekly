import { listNewslettersPT, getNewsletterHtmlPT, stripEmailFooter, toEmbeddableHtml } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeFormPT } from '../SubscribeFormPT';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { listEventMonths, ptLabel, ptSlug } from '@/lib/event-months';

export async function generateMetadata(): Promise<Metadata> {
  const newsletters = listNewslettersPT();
  const latest = newsletters[0] ?? null;
  // /pt sat at position ~50-60 for "agenda cultural porto", "eventos porto",
  // "agenda porto", "hoje no porto" (GSC, 2026-10) while its title never said
  // "agenda" or "esta semana". Lead with the words people actually search.
  const title = latest
    ? `Agenda do Porto esta semana · ${latest.weekRange}`
    : 'Agenda do Porto esta semana · Oporto Weekly';
  const description = latest
    ? `Agenda cultural do Porto para esta semana (${latest.weekRange}): concertos, exposições, mercados e festivais, escolhidos todas as quintas. Grátis.`
    : 'Agenda cultural do Porto: concertos, exposições, mercados e festivais da semana, escolhidos todas as quintas-feiras. Newsletter gratuita.';

  return {
    title: { absolute: title },
    description,
    keywords: ['eventos Porto', 'o que fazer no Porto', 'guia Porto', 'newsletter Porto', 'eventos Oporto', 'cultura Porto', 'fim de semana Porto'],
    alternates: {
      canonical: 'https://oportoweekly.com/pt',
      languages: {
        en: 'https://oportoweekly.com',
        'pt-PT': 'https://oportoweekly.com/pt',
        'x-default': 'https://oportoweekly.com',
      },
    },
    openGraph: {
      title,
      description,
      url: 'https://oportoweekly.com/pt',
      locale: 'pt_PT',
    },
  };
}

export default function HomePT() {
  const newsletters = listNewslettersPT();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtmlPT(latest.slug) : null;
  const html = rawHtml ? toEmbeddableHtml(stripEmailFooter(rawHtml)) : null;

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

          {/* Month hubs — /pt has no events index of its own, so this is how
              readers and Google reach /pt/eventos/<mes>. */}
          <div style={{ marginTop: 20, fontSize: 12, color: colors.textSoft, textAlign: 'center', lineHeight: 1.9 }}>
            Agenda por mês:{' '}
            {listEventMonths().slice().reverse().map((m, i) => (
              <span key={m.slug}>
                {i > 0 && <span style={{ color: colors.divider }}> · </span>}
                <Link href={`/pt/eventos/${ptSlug(m)}`} style={{ color: colors.heading }}>{ptLabel(m)}</Link>
              </span>
            ))}
          </div>
        </div>

      </div>

      <Footer lang="pt" />

    </div>
  );
}
