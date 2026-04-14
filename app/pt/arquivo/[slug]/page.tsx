import { listNewslettersPT, getNewsletterMetaPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

export async function generateStaticParams() {
  return listNewslettersPT().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const meta = getNewsletterMetaPT(params.slug);
  if (!meta) return { title: 'Não encontrado' };
  const url = `https://oportoweekly.com/pt/arquivo/${meta.slug}`;
  return {
    title: `${meta.weekRange} — Guia de Eventos no Porto`,
    description: meta.description,
    alternates: { canonical: url },
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

      {/* Newsletter HTML — constrained width */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: html }} />
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
