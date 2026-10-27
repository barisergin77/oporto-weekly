import { colors, typography } from '@/lib/design';
import { AFFILIATE_NOTE, SPONSORED_REL } from '@/lib/fever';
import { gygLink, gygTargetsFor } from '@/lib/getyourguide';
import { TrackedLink } from './TrackedLink';

/**
 * "Book it" box for a blog guide: 1–3 GetYourGuide affiliate links matched to
 * the guide's topic (lib/getyourguide.ts), with the affiliate disclosure.
 * Renders nothing for guides with no good match. Owner 2026-10-27.
 */
export function BookItBox({ slug, title, lang }: { slug: string; title: string; lang: 'en' | 'pt' }) {
  const targets = gygTargetsFor(slug, title);
  if (!targets.length) return null;
  const isEN = lang === 'en';
  return (
    <aside style={{
      marginTop: 40, padding: '20px 22px', background: colors.bgSoft,
      borderLeft: `3px solid ${colors.accent}`, borderRadius: 4,
    }}>
      <div style={{ fontFamily: typography.serif, fontSize: 19, color: colors.heading, marginBottom: 12 }}>
        {isEN ? 'Book it' : 'Reserve'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {targets.map((t) => (
          <TrackedLink
            key={t.key}
            href={gygLink(t.url, slug)}
            target="_blank"
            rel={SPONSORED_REL}
            gaEvent="affiliate_ticket_click"
            gaParams={{ provider: 'getyourguide', placement: 'blog_book_it', target: t.key, lang }}
            style={{
              color: colors.heading, fontSize: 15, fontWeight: 600, textDecoration: 'none',
              borderBottom: `1.5px solid ${colors.accent}`, alignSelf: 'flex-start', paddingBottom: 1,
            }}
          >
            {t.label[lang]} {isEN ? 'on GetYourGuide' : 'no GetYourGuide'} →
          </TrackedLink>
        ))}
      </div>
      <p style={{ fontSize: 11, color: colors.textMuted, margin: '14px 0 0' }}>{AFFILIATE_NOTE[lang]}</p>
    </aside>
  );
}
