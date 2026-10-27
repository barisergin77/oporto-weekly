import { colors } from '@/lib/design';
import { GOMRY_ORGANIZER_URL, ORGANIZER_CTA } from '@/lib/gomry';
import { TrackedLink } from './TrackedLink';

/**
 * "Organising this event?" box (Gomry organizer referral, owner 2026-10-27).
 * Render only when lib/gomry.ts organizerCtaEligible() is true.
 */
export function OrganizerCta({ lang, slug }: { lang: 'en' | 'pt'; slug: string }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: colors.textSoft,
        border: `1px solid ${colors.divider}`,
        borderRadius: 4,
        padding: '10px 14px',
        margin: '0 0 32px',
      }}
    >
      <TrackedLink
        href={GOMRY_ORGANIZER_URL}
        target="_blank"
        rel="sponsored noopener"
        gaEvent="gomry_organizer_click"
        gaParams={{ event_slug: slug, lang }}
        style={{ color: colors.textSoft }}
      >
        {ORGANIZER_CTA[lang]}
      </TrackedLink>
    </p>
  );
}
