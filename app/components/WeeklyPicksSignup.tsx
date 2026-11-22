import Link from 'next/link';
import { colors, typography } from '@/lib/design';
import { latestEditionPicks } from '@/lib/edition-picks';
import { SubscribeForm } from '../SubscribeForm';
import { SubscribeFormPT } from '../SubscribeFormPT';
import { SubscribeCTA } from './SubscribeCTA';

/**
 * Signup box for event pages that shows the latest edition's real Editor's
 * Picks above the form (growth item G3, 2026-11-22). Sits right after the
 * ticket button instead of below five other blocks. Falls back to the plain
 * SubscribeCTA when there is no recent edition with picks.
 */
const COPY = {
  en: {
    eyebrow: 'This week’s picks',
    title: 'Our picks for this week in Porto',
    intro: (w: string) => `From the ${w} edition. A new list lands in your inbox every Thursday morning. Free.`,
    isPick: 'This event is one of this week’s picks.',
    full: 'Read the full edition →',
    aria: 'Subscribe to the newsletter',
  },
  pt: {
    eyebrow: 'Escolhas da semana',
    title: 'As nossas escolhas desta semana no Porto',
    intro: (w: string) => `Da edição de ${w}. Todas as quintas de manhã chega uma lista nova ao seu email. Grátis.`,
    isPick: 'Este evento é uma das escolhas da semana.',
    full: 'Ler a edição completa →',
    aria: 'Subscrever a newsletter',
  },
} as const;

export function WeeklyPicksSignup({ lang, currentSlug }: { lang: 'en' | 'pt'; currentSlug: string }) {
  const data = latestEditionPicks(lang);
  if (!data) return <SubscribeCTA lang={lang} context="event" />;
  const t = COPY[lang];
  const base = lang === 'pt' ? '/pt/event/' : '/event/';
  const isPick = data.picks.some((p) => p.slug === currentSlug);

  return (
    <aside
      aria-label={t.aria}
      data-signup-box="weekly-picks"
      style={{
        background: colors.card,
        border: `1px solid ${colors.divider}`,
        borderTop: `3px solid ${colors.accent}`,
        borderRadius: 8,
        padding: '24px 24px 26px',
        margin: '0 0 40px',
        boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 8 }}>
        {t.eyebrow}
      </div>
      <h2 style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 6px', letterSpacing: -0.3, lineHeight: 1.25 }}>
        {t.title}
      </h2>
      <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 14px', lineHeight: 1.6 }}>{t.intro(data.weekRange)}</p>
      {isPick && (
        <p style={{ fontSize: 13, color: colors.heading, fontWeight: 600, margin: '0 0 10px' }}>⭐ {t.isPick}</p>
      )}
      <ol style={{ margin: '0 0 18px', padding: '0 0 0 20px', fontSize: 15, lineHeight: 1.5 }}>
        {data.picks.map((p) => (
          <li key={p.slug} style={{ margin: '0 0 6px' }}>
            {p.slug === currentSlug ? (
              <span style={{ color: colors.heading, fontWeight: 600 }}>{p.name}</span>
            ) : (
              <Link href={`${base}${p.slug}`} style={{ color: colors.heading, fontWeight: 600, textDecoration: 'none' }}>
                {p.name}
              </Link>
            )}
            <span style={{ color: colors.textSoft, fontSize: 13 }}> · {p.when}</span>
          </li>
        ))}
      </ol>
      <div style={{ maxWidth: 420 }}>{lang === 'pt' ? <SubscribeFormPT /> : <SubscribeForm />}</div>
      <p style={{ fontSize: 13, margin: '14px 0 0' }}>
        <Link href={data.archiveHref} style={{ color: colors.heading }}>
          {t.full}
        </Link>
      </p>
    </aside>
  );
}
