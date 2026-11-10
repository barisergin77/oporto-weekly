import { colors, typography } from '@/lib/design';

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * schema.org FAQPage for a list of Q&As. Google only accepts FAQ markup when
 * the same questions and answers are visible on the page, so always pair it
 * with <FaqSection> fed the same items.
 */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/** Visible FAQ block plus its FAQPage JSON-LD. Renders nothing without items. */
export function FaqSection({ items, title, lang }: { items: FaqItem[]; title: string; lang: 'en' | 'pt' }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 48 }} aria-label={lang === 'pt' ? 'Perguntas frequentes' : 'Frequently asked questions'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(items)) }} />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: colors.accent,
          marginBottom: 8,
        }}
      >
        FAQ
      </div>
      <h2
        style={{
          fontFamily: typography.serif,
          fontSize: 26,
          color: colors.heading,
          margin: '0 0 20px',
          paddingBottom: 10,
          borderBottom: `2px solid ${colors.accent}`,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h2>
      {items.map(({ q, a }) => (
        <div key={q} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${colors.divider}` }}>
          <h3
            style={{
              fontFamily: typography.serif,
              fontSize: 19,
              color: colors.heading,
              margin: '0 0 8px',
              lineHeight: 1.35,
            }}
          >
            {q}
          </h3>
          <p style={{ fontSize: 15, color: colors.textSoft, lineHeight: 1.75, margin: 0 }}>{a}</p>
        </div>
      ))}
    </section>
  );
}
