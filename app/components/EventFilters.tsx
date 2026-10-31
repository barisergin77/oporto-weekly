'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { colors, typography } from '@/lib/design';
import {
  activeCount, filtersToSearch, matchesFilters, parseFilters, PRICE_BANDS,
  type FilterItem, type Filters, type PriceBand,
} from '@/lib/event-filters';

/**
 * Search + filters over a server-rendered event list (lib/event-filters.ts).
 *
 * The first render shows every event, so the static HTML Google sees is the
 * full list; the query string is read after hydration (not useSearchParams,
 * which would push the whole list behind a Suspense fallback on static
 * pages). Changes go back into the URL with replaceState so the filtered
 * view can be shared.
 */

type Lang = 'en' | 'pt';
type Control = 'when' | 'price' | 'kids' | 'cat' | 'area';

export interface FilterGroup {
  key: string;
  title?: string;
  note?: string;
  items: FilterItem[];
}
interface Option { value: string; label: string; count: number }

const T = {
  en: {
    search: 'Search events, artists, venues',
    searchLabel: 'Search',
    free: 'Free',
    today: 'Today',
    weekend: 'This weekend',
    kids: 'Kids & family',
    anyCat: 'All categories',
    anyArea: 'Any area',
    anyPrice: 'Any price',
    cat: 'Category',
    area: 'Area',
    price: 'Price',
    clear: 'Clear filters',
    showing: (n: number, of: number) => `Showing ${n} of ${of} event${of === 1 ? '' : 's'}`,
    none: 'No events match these filters.',
    bands: { free: 'Free', 'under-15': 'Under €15', '15-30': '€15 to €30', 'over-30': 'Over €30' } as Record<PriceBand, string>,
    photoSoon: 'photo coming soon',
  },
  pt: {
    search: 'Procurar eventos, artistas, locais',
    searchLabel: 'Procurar',
    free: 'Grátis',
    today: 'Hoje',
    weekend: 'Este fim de semana',
    kids: 'Crianças e família',
    anyCat: 'Todas as categorias',
    anyArea: 'Qualquer zona',
    anyPrice: 'Qualquer preço',
    cat: 'Categoria',
    area: 'Zona',
    price: 'Preço',
    clear: 'Limpar filtros',
    showing: (n: number, of: number) => `${n} de ${of} evento${of === 1 ? '' : 's'}`,
    none: 'Nenhum evento corresponde a estes filtros.',
    bands: { free: 'Grátis', 'under-15': 'Menos de 15 €', '15-30': '15 € a 30 €', 'over-30': 'Mais de 30 €' } as Record<PriceBand, string>,
    photoSoon: 'foto em breve',
  },
};

const chip = (on: boolean): React.CSSProperties => ({
  background: on ? colors.heading : colors.card,
  color: on ? '#ffffff' : colors.heading,
  border: `1px solid ${on ? colors.heading : colors.divider}`,
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
});
const select: React.CSSProperties = {
  background: colors.card,
  color: colors.heading,
  border: `1px solid ${colors.divider}`,
  borderRadius: 4,
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  maxWidth: '100%',
};
const h2: React.CSSProperties = {
  fontFamily: typography.serif,
  fontSize: 24,
  color: colors.heading,
  margin: '40px 0 8px',
  paddingBottom: 10,
  borderBottom: `2px solid ${colors.accent}`,
};

export function EventFilters({
  lang,
  groups,
  options,
  variant = 'rows',
  hide = [],
  afterFirst,
}: {
  lang: Lang;
  groups: FilterGroup[];
  options: { categories: Option[]; areas: Option[] };
  variant?: 'rows' | 'cards';
  /** Controls a page has already decided (no "Today" chip on the today page). */
  hide?: Control[];
  /** Rendered after the first group (the day hubs' subscribe box). */
  afterFirst?: ReactNode;
}) {
  const t = T[lang];
  const [f, setF] = useState<Filters>({});
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const read = () => setF(parseFilters(window.location.search));
    read();
    setNow(new Date());
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    for (const k of Object.keys(next) as (keyof Filters)[]) if (!next[k]) delete next[k];
    setF(next);
    const { pathname, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${filtersToSearch(next)}${hash}`);
  };

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const shown = useMemo(
    () => groups.map((g) => ({ ...g, items: g.items.filter((i) => matchesFilters(i, f, now ?? new Date())) })),
    [groups, f, now],
  );
  const shownCount = shown.reduce((n, g) => n + g.items.length, 0);
  const active = activeCount(f) > 0;
  const has = (c: Control) => !hide.includes(c);

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        style={{
          background: colors.card,
          border: `1px solid ${colors.divider}`,
          borderRadius: 6,
          padding: '14px 16px',
          margin: '0 0 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <input
            type="search"
            aria-label={t.searchLabel}
            value={f.q ?? ''}
            placeholder={t.search}
            onChange={(e) => update({ q: e.target.value || undefined })}
            style={{ ...select, width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '9px 12px' }}
          />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {has('price') && (
            <button type="button" aria-pressed={f.price === 'free'} style={chip(f.price === 'free')}
              onClick={() => update({ price: f.price === 'free' ? undefined : 'free' })}>{t.free}</button>
          )}
          {has('when') && (['today', 'weekend'] as const).map((w) => (
            <button key={w} type="button" aria-pressed={f.when === w} style={chip(f.when === w)}
              onClick={() => update({ when: f.when === w ? undefined : w })}>{w === 'today' ? t.today : t.weekend}</button>
          ))}
          {has('kids') && (
            <button type="button" aria-pressed={Boolean(f.kids)} style={chip(Boolean(f.kids))}
              onClick={() => update({ kids: !f.kids || undefined })}>{t.kids}</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {has('cat') && options.categories.length > 1 && (
            <select aria-label={t.cat} value={f.cat ?? ''} style={select} onChange={(e) => update({ cat: e.target.value || undefined })}>
              <option value="">{t.anyCat}</option>
              {options.categories.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
            </select>
          )}
          {has('area') && options.areas.length > 1 && (
            <select aria-label={t.area} value={f.area ?? ''} style={select} onChange={(e) => update({ area: e.target.value || undefined })}>
              <option value="">{t.anyArea}</option>
              {options.areas.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
            </select>
          )}
          {has('price') && (
            <select aria-label={t.price} value={f.price ?? ''} style={select}
              onChange={(e) => update({ price: (e.target.value || undefined) as PriceBand | undefined })}>
              <option value="">{t.anyPrice}</option>
              {PRICE_BANDS.map((b) => <option key={b} value={b}>{t.bands[b]}</option>)}
            </select>
          )}
        </div>
      </form>

      <div aria-live="polite" style={{ fontSize: 13, color: colors.textSoft, minHeight: 20, margin: '0 0 8px' }}>
        {active && (
          <>
            {t.showing(shownCount, total)}
            {' · '}
            <button type="button" onClick={() => update({ q: undefined, cat: undefined, area: undefined, price: undefined, when: undefined, kids: undefined })}
              style={{ background: 'none', border: 'none', padding: 0, color: colors.heading, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              {t.clear}
            </button>
          </>
        )}
      </div>

      {active && shownCount === 0 && (
        <div style={{ background: colors.card, border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, padding: '16px 20px', margin: '12px 0 28px', fontSize: 15 }}>
          {t.none}
        </div>
      )}

      {shown.map((g, gi) => (
        <div key={g.key}>
          {g.items.length > 0 && (
            <section>
              {g.title && <h2 style={h2}>{g.title}</h2>}
              {g.note && <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 4px' }}>{g.note}</p>}
              {variant === 'cards' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {g.items.map((i) => <Card key={i.slug} i={i} soon={t.photoSoon} />)}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {g.items.map((i) => <Row key={i.slug} i={i} />)}
                </ul>
              )}
            </section>
          )}
          {gi === 0 && afterFirst}
        </div>
      ))}
    </div>
  );
}

function Row({ i }: { i: FilterItem }) {
  return (
    <li style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
      <Link href={i.href} style={{ color: colors.heading, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>
        {i.emoji} {i.name}
      </Link>
      <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>{i.meta}</div>
    </li>
  );
}

// Same look as the /porto-events grid card it replaces.
function Card({ i, soon }: { i: FilterItem; soon: string }) {
  const label: React.CSSProperties = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, fontWeight: 700 };
  return (
    <Link
      href={i.href}
      style={{
        display: 'flex', flexDirection: 'column', background: colors.card, border: `1px solid ${colors.divider}`,
        borderRadius: 4, textDecoration: 'none', color: 'inherit', overflow: 'hidden',
      }}
    >
      {i.image ? (
        <img src={i.image} alt={i.name} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div
          aria-label={`${i.categoryLabel}, ${soon}`}
          style={{
            width: '100%', aspectRatio: '16 / 10',
            background: `linear-gradient(135deg, ${colors.bgSoft} 0%, ${colors.bgAlt} 100%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <div style={{ fontSize: 48 }}>{i.emoji}</div>
          <div style={label}>{i.categoryLabel}</div>
        </div>
      )}
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={label}>{i.emoji} {i.categoryLabel}</div>
        <h3 style={{ fontFamily: typography.serif, fontSize: 19, color: colors.heading, margin: 0, lineHeight: 1.3, letterSpacing: -0.2 }}>
          {i.name}
        </h3>
        <div style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.5 }}>{i.meta}</div>
      </div>
    </Link>
  );
}
