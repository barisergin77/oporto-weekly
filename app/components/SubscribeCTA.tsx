import { colors, typography } from '@/lib/design';
import { SubscribeForm } from '../SubscribeForm';
import { SubscribeFormPT } from '../SubscribeFormPT';

/**
 * Inline subscribe box for the pages search visitors actually land on.
 *
 * Added 2026-10-17: event, blog and venue pages had no way to subscribe —
 * only the homepage and archive did — while 11 of the top 12 search landing
 * pages were guides and event pages. Search clicks were up 73% in 28 days
 * but subscribers grew ~1.4/week, so the traffic had nowhere to convert.
 *
 * `context` only changes the copy; the signup source (page path) is recorded
 * by the form itself, so results can be compared per page type.
 */

type Context = 'event' | 'blog' | 'venue' | 'play';

const COPY: Record<'en' | 'pt', Record<Context, { eyebrow: string; title: string; body: string }>> = {
  en: {
    event: {
      eyebrow: 'Every Thursday',
      title: 'Never miss what’s on in Porto',
      body: 'The five best things to do in Porto each week, plus concerts, exhibitions and markets — in your inbox Thursday morning. Free.',
    },
    blog: {
      eyebrow: 'Enjoyed this guide?',
      title: 'Get Porto’s best events every Thursday',
      body: 'One short email a week with the concerts, exhibitions, markets and festivals worth your time. Free, and you can leave anytime.',
    },
    venue: {
      eyebrow: 'Every Thursday',
      title: 'Know what’s on before it sells out',
      body: 'A weekly pick of the best events across Porto’s venues, delivered Thursday morning. Free.',
    },
    play: {
      eyebrow: 'Know Porto this well?',
      title: 'Get the week in Porto every Thursday',
      body: 'One short email with the concerts, exhibitions and markets worth going to. Free, and you can leave anytime.',
    },
  },
  pt: {
    event: {
      eyebrow: 'Todas as quintas-feiras',
      title: 'Não perca o que acontece no Porto',
      body: 'As cinco melhores coisas para fazer no Porto em cada semana, mais concertos, exposições e mercados — na sua caixa de correio à quinta de manhã. Grátis.',
    },
    blog: {
      eyebrow: 'Gostou deste guia?',
      title: 'Receba os melhores eventos do Porto à quinta',
      body: 'Um email curto por semana com os concertos, exposições, mercados e festivais que valem a pena. Grátis, e pode sair quando quiser.',
    },
    venue: {
      eyebrow: 'Todas as quintas-feiras',
      title: 'Saiba o que há antes de esgotar',
      body: 'Uma seleção semanal dos melhores eventos nas salas do Porto, à quinta-feira de manhã. Grátis.',
    },
    play: {
      eyebrow: 'Conhece bem o Porto?',
      title: 'Receba a semana no Porto à quinta-feira',
      body: 'Um email curto com os concertos, exposições e mercados que valem a pena. Grátis, e pode sair quando quiser.',
    },
  },
};

export function SubscribeCTA({ lang, context }: { lang: 'en' | 'pt'; context: Context }) {
  const t = COPY[lang][context];
  return (
    <aside
      aria-label={lang === 'pt' ? 'Subscrever a newsletter' : 'Subscribe to the newsletter'}
      style={{
        background: colors.card,
        border: `1px solid ${colors.divider}`,
        borderTop: `3px solid ${colors.accent}`,
        borderRadius: 8,
        padding: '28px 24px',
        margin: '0 0 40px',
        boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: colors.accent,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {t.eyebrow}
      </div>
      <h2
        style={{
          fontFamily: typography.serif,
          fontSize: 22,
          color: colors.heading,
          margin: '0 0 8px',
          letterSpacing: -0.3,
          lineHeight: 1.25,
        }}
      >
        {t.title}
      </h2>
      <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 18px', lineHeight: 1.6 }}>
        {t.body}
      </p>
      <div style={{ maxWidth: 420 }}>
        {lang === 'pt' ? <SubscribeFormPT /> : <SubscribeForm />}
      </div>
    </aside>
  );
}
