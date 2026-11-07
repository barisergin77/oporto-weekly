'use client';

import { colors } from '@/lib/design';
import { toggleSaved, useSaved } from '@/lib/saved-events';
import { pushGaEvent } from './TrackedLink';

const T = {
  en: { save: 'Save', saved: 'Saved', add: 'Save to my list', remove: 'Remove from my list' },
  pt: { save: 'Guardar', saved: 'Guardado', add: 'Guardar na minha lista', remove: 'Tirar da minha lista' },
};

/**
 * ☆ Save / ★ Saved toggle for "My list" (lib/saved-events.ts). `compact` is the
 * icon-only version for list rows and cards. GA4: event_saved / event_unsaved.
 */
export function SaveButton({ slug, lang = 'en', compact = false }: { slug: string; lang?: 'en' | 'pt'; compact?: boolean }) {
  const on = useSaved().includes(slug);
  const t = T[lang];
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t.remove : t.add}
      title={on ? t.remove : t.add}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggleSaved(slug);
        pushGaEvent(now ? 'event_saved' : 'event_unsaved', { event_slug: slug });
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: compact ? 'transparent' : on ? colors.heading : colors.card,
        color: compact ? (on ? colors.accent : colors.textSoft) : on ? colors.bg : colors.heading,
        border: compact ? 'none' : `1px solid ${on ? colors.heading : colors.divider}`,
        borderRadius: 2,
        padding: compact ? '2px 4px' : '8px 14px',
        fontSize: compact ? 20 : 13,
        lineHeight: 1,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      <span aria-hidden>{on ? '★' : '☆'}</span>
      {!compact && <span>{on ? t.saved : t.save}</span>}
    </button>
  );
}
