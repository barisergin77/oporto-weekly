import { listNewslettersPT, getNewsletterMetaPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
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
    <main style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <Header lang="pt" active="archive" />

      {/* Newsletter HTML */}
      <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: html }} />

      {/* Prev / Next */}
      {(older || newer) && (
        <div style={{
          background: '#16213e', borderTop: '1px solid #c9a96e33',
          padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {older && (
              <Link href={`/pt/arquivo/${older.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9999bb', marginBottom: 4 }}>← Edição anterior</div>
                <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{older.weekRange}</div>
              </Link>
            )}
          </div>
          <Link href="/pt/arquivo" style={{ fontSize: 12, color: '#9999bb', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Todas as edições
          </Link>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            {newer && (
              <Link href={`/pt/arquivo/${newer.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9999bb', marginBottom: 4 }}>Edição seguinte →</div>
                <div style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{newer.weekRange}</div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Subscribe CTA */}
      <div style={{ background: '#1a1a2e', padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fff', marginBottom: 8 }}>
          Gostou do Oporto Weekly?
        </p>
        <p style={{ fontSize: 14, color: '#9999bb', marginBottom: 24 }}>
          Receba o melhor do Porto todas as quintas-feiras de manhã — grátis.
        </p>
        <Link href="/pt" style={{
          display: 'inline-block', background: '#c9a96e', color: '#1a1a2e',
          padding: '14px 32px', borderRadius: 4, textDecoration: 'none', fontWeight: 700, fontSize: 14,
        }}>
          Subscrever grátis →
        </Link>
      </div>

      <Footer lang="pt" />
    </main>
  );
}
