import { listNewslettersPT, getNewsletterMetaPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeFormPT } from '../../../SubscribeFormPT';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export async function generateStaticParams() {
  return listNewslettersPT().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const meta = getNewsletterMetaPT(params.slug);
  if (!meta) return { title: 'Não encontrado' };
  const url = `https://oportoweekly.com/pt/arquivo/${meta.slug}`;
  // hreflang alternates — bidirectional counterpart to the EN archive page.
  // The EN edition always exists (PT is generated from it): PT slug is the
  // EN slug + "-pt", so strip the suffix to get the EN URL. x-default → EN.
  const enSlug = meta.slug.replace(/-pt$/, '');
  const enUrl = `https://oportoweekly.com/archive/${enSlug}`;
  const languages: Record<string, string> = {
    'pt-PT': url,
    en: enUrl,
    'x-default': enUrl,
  };
  return {
    title: `${meta.weekRange} — Guia de Eventos no Porto`,
    description: meta.description,
    alternates: { canonical: url, languages },
    openGraph: {
      title: `${meta.weekRange} — Guia de Eventos no Porto`,
      description: meta.description,
      type: 'article',
      url,
      locale: 'pt_PT',
      publishedTime: meta.sentAt,
      siteName: 'Oporto Weekly',
    },
  };
}

export default function EdicaoPTPage({ params }: { params: { slug: string } }) {
  const meta = getNewsletterMetaPT(params.slug);
  const rawHtml = getNewsletterHtmlPT(params.slug);
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

  if (!meta || !html) notFound();

  // Prev / next
  const all = listNewslettersPT();
  const idx = all.findIndex((n) => n.slug === params.slug);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <main style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang="pt" active="archive" />

      {/* Main layout — newsletter + sticky sidebar */}
      <div className="home-layout" style={{
        maxWidth: 1080, margin: '0 auto', padding: '40px 24px',
        display: 'flex', gap: 32, alignItems: 'flex-start',
      }}>
        <div className="newsletter-content" style={{ flex: 1, minWidth: 0 }} dangerouslySetInnerHTML={{ __html: html }} />

        <div className="home-sidebar" style={{
          width: 260, flexShrink: 0, position: 'sticky', top: 24, alignSelf: 'flex-start',
        }}>
          <div style={{
            background: colors.card, borderRadius: 8, padding: '28px 22px',
            border: `1px solid ${colors.divider}`, boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700 }}>
                Todas as quintas
              </div>
              <h2 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.3 }}>
                Oporto Weekly
              </h2>
              <div style={{ width: 32, height: 2, background: colors.accent, margin: '10px auto 12px' }} />
              <p style={{ fontSize: 13, color: colors.textSoft, margin: 0, lineHeight: 1.6 }}>
                O melhor do Porto, toda quinta-feira de manhã.
              </p>
            </div>
            <div style={{
              background: colors.bgSoft,
              border: `1px solid ${colors.divider}`,
              borderLeft: `3px solid ${colors.accent}`,
              padding: '10px 12px',
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 3, fontWeight: 700 }}>
                Está a ler
              </div>
              <div style={{ fontSize: 12, color: colors.text }}>{meta.weekRange}</div>
            </div>
            <SubscribeFormPT />
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/pt/arquivo" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none' }}>
              Todas as edições →
            </Link>
          </div>
        </div>
      </div>

      {/* Prev / Next */}
      {(older || newer) && (
        <div style={{
          background: colors.bgAlt, borderTop: `1px solid ${colors.divider}`,
          padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {older && (
              <Link href={`/pt/arquivo/${older.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 4, fontWeight: 700 }}>← Edição anterior</div>
                <div style={{ fontSize: 15, color: colors.heading, fontFamily: typography.serif }}>{older.weekRange}</div>
              </Link>
            )}
          </div>
          <Link href="/pt/arquivo" style={{ fontSize: 12, color: colors.textSoft, textDecoration: 'none', whiteSpace: 'nowrap', borderBottom: `1px solid ${colors.accent}`, paddingBottom: 1 }}>
            Todas as edições
          </Link>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            {newer && (
              <Link href={`/pt/arquivo/${newer.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 4, fontWeight: 700 }}>Edição seguinte →</div>
                <div style={{ fontSize: 15, color: colors.heading, fontFamily: typography.serif }}>{newer.weekRange}</div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Subscribe CTA */}
      <div style={{ background: colors.bgSoft, padding: '48px 24px', textAlign: 'center', borderTop: `1px solid ${colors.divider}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
          Não perca nenhuma edição
        </div>
        <p style={{ fontFamily: typography.serif, fontSize: 24, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
          Gostou do Oporto Weekly?
        </p>
        <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 24px', lineHeight: 1.6 }}>
          Receba o melhor do Porto todas as quintas-feiras de manhã — grátis.
        </p>
        <Link href="/pt" style={{
          display: 'inline-block', background: colors.accent, color: colors.heading,
          padding: '14px 32px', borderRadius: 4, textDecoration: 'none', fontWeight: 700, fontSize: 14,
        }}>
          Subscrever grátis →
        </Link>
      </div>

      <Footer lang="pt" />
    </main>
  );
}
