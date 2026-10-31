'use client';

import { useState } from 'react';
import { colors } from '@/lib/design';
import { TrackedLink, pushGaEvent } from './TrackedLink';

/**
 * "Add to calendar" + "Share" on every event page (owner 2026-10-31).
 * Calendar: a Google Calendar template link and the prerendered .ics
 * (lib/event-calendar.ts). Share: the Web Share API where the browser has
 * it (phones), else copy the link; plus a WhatsApp link, the way most
 * people here pass a plan around. GA4 events: add_to_calendar and
 * share_event, each with a `method` and the event slug.
 */

const T = {
  en: {
    calendar: 'Add to calendar',
    google: 'Google Calendar',
    ics: 'Apple / Outlook (.ics)',
    share: 'Share',
    copied: 'Link copied',
    whatsapp: 'WhatsApp',
  },
  pt: {
    calendar: 'Adicionar ao calendário',
    google: 'Google Calendar',
    ics: 'Apple / Outlook (.ics)',
    share: 'Partilhar',
    copied: 'Link copiado',
    whatsapp: 'WhatsApp',
  },
};

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: colors.card,
  color: colors.heading,
  border: `1px solid ${colors.divider}`,
  borderRadius: 2,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export function EventActions({
  lang,
  slug,
  title,
  url,
  googleUrl,
  icsHref,
}: {
  lang: 'en' | 'pt';
  slug: string;
  title: string;
  /** Absolute page URL (what gets shared). */
  url: string;
  googleUrl: string;
  icsHref: string;
}) {
  const t = T[lang];
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, url });
        pushGaEvent('share_event', { method: 'native', event_slug: slug });
      } catch {
        // Closing the share sheet rejects too; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t.share, url);
    }
    pushGaEvent('share_event', { method: 'copy', event_slug: slug });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, margin: '0 0 32px' }}>
      <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSoft, fontWeight: 700 }}>
        📆 {t.calendar}
      </span>
      <TrackedLink
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        style={btn}
        gaEvent="add_to_calendar"
        gaParams={{ method: 'google', event_slug: slug }}
      >
        {t.google}
      </TrackedLink>
      <TrackedLink
        href={icsHref}
        download={`${slug}.ics`}
        rel="nofollow"
        style={btn}
        gaEvent="add_to_calendar"
        gaParams={{ method: 'ics', event_slug: slug }}
      >
        {t.ics}
      </TrackedLink>
      <span style={{ width: 1, height: 22, background: colors.divider, margin: '0 4px' }} aria-hidden="true" />
      <button type="button" onClick={share} style={btn} aria-live="polite">
        🔗 {copied ? t.copied : t.share}
      </button>
      <TrackedLink
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        style={btn}
        gaEvent="share_event"
        gaParams={{ method: 'whatsapp', event_slug: slug }}
      >
        💬 {t.whatsapp}
      </TrackedLink>
    </div>
  );
}
