import { colors, typography } from '@/lib/design';
import { blogDisplay, hasBlogPT, type BlogPost } from '@/lib/blog';
import { humanizeText } from '@/lib/humanizer';
import { TrackedLink } from './TrackedLink';

/**
 * Blog-guide promotion on the high-traffic pages (owner 2026-10-31): one
 * "Related guide" card on event and venue pages, a small "Guides" strip on
 * the events hubs and the home page. Which guide is lib/related-guides.ts.
 * PT pages link /pt/blog/ only when the guide has a PT version. Clicks go to
 * GA4 as `related_guide_click` with the guide slug and the source page type.
 */

type Lang = 'en' | 'pt';
export type GuideSource = 'event' | 'venue' | 'hub' | 'home';

function guideLink(p: BlogPost, lang: Lang) {
  const pt = lang === 'pt' && hasBlogPT(p.slug);
  const { title, excerpt } = blogDisplay(p, pt ? 'pt' : 'en');
  return {
    href: pt ? `/pt/blog/${p.slug}` : `/blog/${p.slug}`,
    title: humanizeText(title, { title: true }),
    excerpt: humanizeText(excerpt),
  };
}

const eyebrow: React.CSSProperties = {
  fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 6,
};

/** One guide, image left (when there is one), for event and venue pages. */
export function RelatedGuideCard({ guide, lang, source }: { guide?: BlogPost; lang: Lang; source: GuideSource }) {
  if (!guide) return null;
  const { href, title, excerpt } = guideLink(guide, lang);
  return (
    <aside style={{ margin: '0 0 40px' }}>
      <TrackedLink
        href={href}
        gaEvent="related_guide_click"
        gaParams={{ guide_slug: guide.slug, source, lang }}
        style={{
          display: 'flex', alignItems: 'stretch', textDecoration: 'none', color: 'inherit',
          background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `3px solid ${colors.accent}`,
          borderRadius: 4, overflow: 'hidden', flexWrap: 'wrap',
        }}
      >
        {guide.heroImage && (
          <img
            src={guide.heroImage}
            alt=""
            loading="lazy"
            style={{ width: 200, minHeight: 130, flex: '0 0 200px', objectFit: 'cover', display: 'block', maxWidth: '100%' }}
          />
        )}
        <div style={{ flex: '1 1 240px', padding: '16px 18px' }}>
          <div style={eyebrow}>{lang === 'en' ? 'Related guide' : 'Guia relacionado'}</div>
          <div style={{ fontFamily: typography.serif, fontSize: 19, lineHeight: 1.3, color: colors.heading, marginBottom: 6 }}>
            {title}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: colors.textSoft, margin: '0 0 10px' }}>{excerpt}</p>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.heading, borderBottom: `1.5px solid ${colors.accent}` }}>
            {lang === 'en' ? 'Read the guide' : 'Ler o guia'} →
          </span>
        </div>
      </TrackedLink>
    </aside>
  );
}

/** 2–4 guides as small image cards plus a link to the blog, for the hubs and the home page. */
export function GuidesStrip({ guides, lang, source }: { guides: BlogPost[]; lang: Lang; source: GuideSource }) {
  if (!guides.length) return null;
  const isEN = lang === 'en';
  return (
    <section style={{ margin: '40px 0 0' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
        borderBottom: `2px solid ${colors.accent}`, paddingBottom: 10, marginBottom: 16,
      }}>
        <h2 style={{ fontFamily: typography.serif, fontSize: 24, color: colors.heading, margin: 0 }}>
          {isEN ? 'Guides' : 'Guias'}
        </h2>
        <a href={isEN ? '/blog' : '/pt/blog'} style={{ fontSize: 13, color: colors.heading, fontWeight: 600, textDecoration: 'none' }}>
          {isEN ? 'All guides' : 'Todos os guias'} →
        </a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {guides.map((g) => {
          const { href, title } = guideLink(g, lang);
          return (
            <TrackedLink
              key={g.slug}
              href={href}
              gaEvent="related_guide_click"
              gaParams={{ guide_slug: g.slug, source, lang }}
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit', background: colors.card,
                border: `1px solid ${colors.divider}`, borderRadius: 4, overflow: 'hidden',
              }}
            >
              {g.heroImage ? (
                <img src={g.heroImage} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16 / 10', background: colors.bgSoft }} />
              )}
              <div style={{ padding: '10px 12px 12px', fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: colors.heading }}>
                {title}
              </div>
            </TrackedLink>
          );
        })}
      </div>
    </section>
  );
}
