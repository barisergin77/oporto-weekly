'use client';

import { useState } from 'react';
import { colors, typography } from '@/lib/design';

/**
 * Small "Porto fact" box with an "Another fact" button (lib/porto-facts.ts).
 * The server passes today's fact index so the first paint is final; an
 * invisible copy of the longest fact reserves the height, so clicking never
 * moves the page.
 */

type Fact = { text: string; sourceUrl: string };

const COPY = {
  en: { eyebrow: 'Porto fact', another: 'Another fact', source: 'Source' },
  pt: { eyebrow: 'Curiosidade do Porto', another: 'Outra curiosidade', source: 'Fonte' },
} as const;

export function PortoFacts({ lang, facts, initialIndex, compact = false }: {
  lang: 'en' | 'pt';
  facts: Fact[];
  initialIndex: number;
  compact?: boolean;
}) {
  const t = COPY[lang];
  const [i, setI] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(facts.length - 1, 0)));
  if (!facts.length) return null;
  const fact = facts[i];
  const longest = facts.reduce((a, b) => (b.text.length > a.text.length ? b : a), facts[0]);

  function another() {
    if (facts.length < 2) return;
    let next = i;
    while (next === i) next = Math.floor(Math.random() * facts.length);
    setI(next);
    try {
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'porto_fact_next', lang, page_path: window.location.pathname });
    } catch { /* ignore */ }
  }

  const textStyle: React.CSSProperties = {
    gridArea: '1 / 1', margin: 0, fontFamily: typography.serif,
    fontSize: compact ? 15 : 17, lineHeight: 1.5, color: colors.heading,
  };

  return (
    <aside
      aria-label={t.eyebrow}
      style={{
        background: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 8,
        padding: compact ? '18px 18px 14px' : '22px 24px 16px', boxShadow: '0 2px 16px rgba(26,26,46,0.05)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 8 }}>
        {t.eyebrow}
      </div>
      <div style={{ display: 'grid' }}>
        <p aria-hidden style={{ ...textStyle, visibility: 'hidden' }}>{longest.text}</p>
        <p aria-live="polite" style={textStyle}>{fact.text}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 }}>
        <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.textMuted }}>
          {t.source}
        </a>
        <button
          type="button"
          onClick={another}
          style={{
            background: 'none', border: `1px solid ${colors.accent}`, borderRadius: 4, padding: '6px 12px',
            fontSize: 13, color: colors.heading, cursor: 'pointer', fontFamily: typography.sans,
          }}
        >
          {t.another} →
        </button>
      </div>
    </aside>
  );
}
