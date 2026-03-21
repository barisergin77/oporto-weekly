import { listNewslettersPT, getNewsletterHtmlPT, stripEmailFooter } from '@/lib/archive';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubscribeForm } from '../SubscribeForm';

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

const gold = '#c9a96e';
const bg = '#1a1a2e';

export default function HomePT() {
  const newsletters = listNewslettersPT();
  const latest = newsletters[0] ?? null;
  const rawHtml = latest ? getNewsletterHtmlPT(latest.slug) : null;
  const html = rawHtml ? stripEmailFooter(rawHtml) : null;

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

      {/* Hero */}
      <div style={{ background: bg, borderBottom: `1px solid ${gold}33`, padding: '64px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: gold, marginBottom: 16 }}>
          Todas as quintas-feiras · Gratuito
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 44, color: '#fff', margin: '0 0 20px', lineHeight: 1.2 }}>
          O melhor do Porto, toda semana
        </h1>
        <p style={{ fontSize: 17, color: '#9999bb', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>
          Concertos, exposições, mercados, vida noturna e atividades para toda a família —
          tudo curado e entregue na sua caixa de entrada todas as quintas-feiras de manhã.
        </p>
        <div style={{ maxWidth: 320, margin: '0 auto' }}>
          <SubscribeForm />
        </div>
      </div>

      {/* Latest PT newsletter content */}
      {html && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{
            background: '#fff', borderRadius: 4, padding: '12px 20px', marginBottom: 24,
            borderLeft: '4px solid #c9a96e', fontSize: 13, color: '#555',
          }}>
            📅 <strong style={{ color: '#1a1a2e' }}>Edição: {latest?.weekRange}</strong>
            {' — '}
            <Link href={`/pt/arquivo/${latest?.slug}`} style={{ color: '#c9a96e', textDecoration: 'none' }}>
              Link permanente →
            </Link>
          </div>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}

      {/* What you get */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1a1a2e', textAlign: 'center', marginBottom: 40 }}>
          O que vai receber
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
          {[
            { icon: '🎵', title: 'Música & Concertos', desc: 'Fado, jazz, rock e música eletrónica — os melhores palcos do Porto.' },
            { icon: '🎨', title: 'Arte & Exposições', desc: 'Galerias na Rua Miguel Bombarda, Serralves, e muito mais.' },
            { icon: '🍷', title: 'Gastronomia & Vinho', desc: 'Mercados, feiras gastronómicas e provas de vinho do Porto.' },
            { icon: '👨‍👩‍👧', title: 'Família', desc: 'Atividades e eventos para crianças e toda a família.' },
            { icon: '🌙', title: 'Vida Noturna', desc: 'Bares, festas e eventos noturnos na Ribeira e Galerias.' },
            { icon: '💡', title: 'Dica da Semana', desc: 'Uma dica prática de quem conhece bem a cidade.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: '#fff',
              borderRadius: 8,
              padding: '24px 20px',
              width: 230,
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
              borderTop: `3px solid ${gold}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#1a1a2e', marginBottom: 6 }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Latest edition link */}
      {latest && (
        <div style={{ background: '#fff', borderTop: '1px solid #e0dcd6', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: gold, marginBottom: 12 }}>
            Última edição
          </p>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#1a1a2e', marginBottom: 12 }}>
            {latest.weekRange}
          </h3>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>{latest.description}</p>
          <Link href={`/archive/${latest.slug}`} style={{
            display: 'inline-block',
            background: gold,
            color: bg,
            padding: '12px 28px',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
          }}>
            Ler edição →
          </Link>
        </div>
      )}

      {/* How it works */}
      <div style={{ background: bg, padding: '56px 32px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#fff', marginBottom: 40 }}>
          Como funciona
        </h2>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 720, margin: '0 auto' }}>
          {[
            { step: '1', title: 'Subscreva gratuitamente', desc: 'Insira o seu email acima — leva 5 segundos.' },
            { step: '2', title: 'Receba toda quinta-feira', desc: 'O guia semanal chega na sua caixa de entrada de manhã cedo.' },
            { step: '3', title: 'Descubra o Porto', desc: 'Explore os melhores eventos, lugares e experiências da cidade.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ width: 200 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: `${gold}22`, border: `2px solid ${gold}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: gold, margin: '0 auto 16px',
              }}>{step}</div>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#fff', marginBottom: 6 }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#9999bb', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1a1a2e', textAlign: 'center', marginBottom: 40 }}>
          Perguntas frequentes
        </h2>
        {[
          { q: 'A newsletter é gratuita?', a: 'Sim, completamente gratuita. Basta inserir o seu email para começar a receber.' },
          { q: 'Com que frequência é publicada?', a: 'Todas as quintas-feiras de manhã, para que possa planear o seu fim de semana.' },
          { q: 'O conteúdo é em inglês ou português?', a: 'A newsletter é escrita em inglês para servir tanto a comunidade local como os expatriados e visitantes do Porto. Este site está disponível em ambos os idiomas.' },
          { q: 'Posso ler edições anteriores?', a: 'Sim, todas as edições estão disponíveis no nosso arquivo em oportoweekly.com/archive.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 28, borderBottom: '1px solid #e0dcd6', paddingBottom: 28 }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#1a1a2e', marginBottom: 8 }}>{q}</h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, margin: 0 }}>{a}</p>
          </div>
        ))}
      </div>

      {/* Bottom subscribe CTA */}
      <div style={{ background: bg, padding: '48px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#fff', marginBottom: 8 }}>
          Pronto para descobrir o Porto?
        </p>
        <p style={{ fontSize: 14, color: '#9999bb', marginBottom: 28 }}>
          Subscreva agora e receba o guia semanal na sua caixa de entrada.
        </p>
        <div style={{ maxWidth: 320, margin: '0 auto' }}>
          <SubscribeForm />
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#0f0f1a', padding: '28px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: gold, marginBottom: 8 }}>Oporto Weekly</p>
        <p style={{ fontSize: 12, color: '#666899', lineHeight: 1.8, margin: 0 }}>
          Curado toda quinta-feira · Porto, Portugal<br />
          <Link href="/pt/arquivo" style={{ color: gold, textDecoration: 'none' }}>Arquivo</Link>
          {' · '}
          <Link href="/" style={{ color: '#666899', textDecoration: 'none' }}>English</Link>
          {' · '}
          <a href="mailto:hello@oportoweekly.com" style={{ color: '#666899', textDecoration: 'none' }}>hello@oportoweekly.com</a>
        </p>
      </div>
    </div>
  );
}
