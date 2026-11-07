import type { Metadata } from 'next';
import { listEvents } from './events';
import { toFilterItem } from './event-listing';
import { portoToday, addDays } from './event-filters';
import { colors, typography } from './design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { MyList } from '@/app/components/MyList';

/**
 * Shared by /my-list (EN) and /pt/minha-lista (PT), owner 2026-11-07. Ships a
 * compact index of events ending within the last 60 days or later; the saved
 * slugs come from the browser (lib/saved-events.ts). noindex: the page is
 * empty for crawlers and personal for everyone else.
 */
export function myListMetadata(lang: 'en' | 'pt'): Metadata {
  return {
    title: lang === 'en' ? 'My list · Oporto Weekly' : 'A minha lista · Oporto Weekly',
    robots: { index: false, follow: true },
    alternates: { languages: { en: '/my-list', pt: '/pt/minha-lista' } },
  };
}

export function MyListPage({ lang }: { lang: 'en' | 'pt' }) {
  const cutoff = addDays(portoToday(), -60);
  const items = listEvents()
    .filter((e) => (e.endDate ?? e.date).slice(0, 10) >= cutoff)
    .map((e) => {
      const { summary: _s, search: _q, image: _i, ...rest } = toFilterItem(e, lang, true);
      return rest;
    });
  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang={lang} />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 64px' }}>
        <MyList items={items as Parameters<typeof MyList>[0]['items']} lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  );
}
