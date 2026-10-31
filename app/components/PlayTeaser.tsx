import Link from 'next/link';
import { colors, typography } from '@/lib/design';
import { GAME_NAME, PLAY_PATH, dayNumber, lisbonDate } from '@/lib/play';

/** Small home-page card for Porto Zoom (/play, /pt/jogar). No image, so it never spoils the day's photo. */

const COPY = {
  en: { eyebrow: 'Daily game', body: 'Guess the Porto street or landmark from a close-up. Each miss zooms out.', cta: 'Play today\'s puzzle' },
  pt: { eyebrow: 'Jogo diário', body: 'Adivinhe a rua ou o monumento do Porto a partir de um pormenor. Cada erro afasta a foto.', cta: 'Jogar o desafio de hoje' },
} as const;

export function PlayTeaser({ lang }: { lang: 'en' | 'pt' }) {
  const t = COPY[lang];
  const n = dayNumber(lisbonDate());
  return (
    <Link
      href={PLAY_PATH[lang]}
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit', background: colors.card,
        border: `1px solid ${colors.divider}`, borderLeft: `3px solid ${colors.accent}`, borderRadius: 8,
        padding: '18px 18px 16px', boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 6 }}>
        {t.eyebrow} · #{n}
      </div>
      <div style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, marginBottom: 6 }}>{GAME_NAME}</div>
      <p style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.55, margin: '0 0 10px' }}>{t.body}</p>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.heading }}>{t.cta} →</span>
    </Link>
  );
}
