'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { colors, typography } from '@/lib/design';
import type { FilterItem } from '@/lib/event-filters';
import { readSaved, useSaved, writeSaved } from '@/lib/saved-events';
import { SaveButton } from './SaveButton';
import { pushGaEvent } from './TrackedLink';

/**
 * "My list" page body (owner 2026-11-07). `items` is every recent/upcoming
 * event, pre-rendered for this language; the list itself lives in the
 * browser (lib/saved-events.ts). ?e=slug,slug shows a list someone shared,
 * with "Save all". GA4: my_list_share {method}, my_list_import.
 */

const T = {
  en: {
    title: 'My list',
    intro: 'Events you saved with ☆ on this device. Share the list to plan with friends or to open it on another phone.',
    shared: (n: number) => `A list someone shared with you · ${n} event${n === 1 ? '' : 's'}`,
    saveAll: 'Save all to my list',
    savedAll: 'Saved to your list',
    viewMine: 'View my list',
    empty: 'Nothing saved yet. Tap ☆ next to any event to add it here.',
    browse: [['Today', '/porto-events/today'], ['This weekend', '/porto-events/this-weekend'], ['All events', '/porto-events']],
    share: 'Share list',
    copied: 'Link copied',
    whatsapp: 'WhatsApp',
    clear: 'Clear list',
    clearConfirm: 'Tap again to clear',
    past: 'Already happened',
    gone: (n: number) => `${n} saved event${n === 1 ? ' is' : 's are'} no longer listed.`,
    shareTitle: 'My Porto plans · Oporto Weekly',
    base: '/my-list',
  },
  pt: {
    title: 'A minha lista',
    intro: 'Eventos que guardou com ☆ neste dispositivo. Partilhe a lista para combinar com amigos ou abri-la noutro telemóvel.',
    shared: (n: number) => `Uma lista partilhada consigo · ${n} evento${n === 1 ? '' : 's'}`,
    saveAll: 'Guardar todos na minha lista',
    savedAll: 'Guardados na sua lista',
    viewMine: 'Ver a minha lista',
    empty: 'Ainda não guardou nada. Toque em ☆ junto a qualquer evento para o juntar aqui.',
    browse: [['Hoje', '/pt/eventos/hoje'], ['Este fim de semana', '/pt/eventos/este-fim-de-semana'], ['Todos os eventos', '/pt/eventos']],
    share: 'Partilhar lista',
    copied: 'Link copiado',
    whatsapp: 'WhatsApp',
    clear: 'Limpar lista',
    clearConfirm: 'Toque de novo para limpar',
    past: 'Já aconteceu',
    gone: (n: number) => `${n} evento${n === 1 ? '' : 's'} guardado${n === 1 ? ' já não está' : 's já não estão'} listado${n === 1 ? '' : 's'}.`,
    shareTitle: 'Os meus planos no Porto · Oporto Weekly',
    base: '/pt/minha-lista',
  },
};

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: colors.card, color: colors.heading,
  border: `1px solid ${colors.divider}`, borderRadius: 2, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit',
};

function todayLisbon(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}

export function MyList({ items, lang }: { items: FilterItem[]; lang: 'en' | 'pt' }) {
  const t = T[lang];
  const saved = useSaved();
  const [shared, setShared] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [armClear, setArmClear] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('e');
    if (e) setShared(e.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100));
  }, []);

  const bySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items]);
  const slugs = shared ?? saved;
  const today = todayLisbon();
  const found = slugs.map((s) => bySlug.get(s)).filter((i): i is FilterItem => !!i);
  const missing = slugs.length - found.length;
  const upcoming = found.filter((i) => i.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  const past = found.filter((i) => i.end < today).sort((a, b) => b.start.localeCompare(a.start));

  const shareUrl = () => `${window.location.origin}${t.base}?e=${upcoming.map((i) => i.slug).join(',')}`;
  const onShare = async () => {
    const url = shareUrl();
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: t.shareTitle, url }); pushGaEvent('my_list_share', { method: 'native' }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ }
    pushGaEvent('my_list_share', { method: 'copy' });
  };

  return (
    <div>
      <h1 style={{ fontFamily: typography.serif, fontSize: 36, color: colors.heading, margin: '0 0 8px' }}>
        {shared ? t.shared(found.length) : t.title}
      </h1>
      {!shared && <p style={{ color: colors.textSoft, fontSize: 15, lineHeight: 1.5, margin: '0 0 20px' }}>{t.intro}</p>}

      {shared && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 20px' }}>
          <button
            type="button"
            style={{ ...btn, background: colors.heading, color: colors.bg, borderColor: colors.heading }}
            onClick={() => { writeSaved([...readSaved(), ...shared]); setImported(true); pushGaEvent('my_list_import', { count: String(shared.length) }); }}
          >
            {imported ? `★ ${t.savedAll}` : `☆ ${t.saveAll}`}
          </button>
          <Link href={t.base} style={btn}>{t.viewMine}</Link>
        </div>
      )}

      {!shared && upcoming.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 20px' }}>
          <button type="button" style={btn} onClick={onShare}>↗ {copied ? t.copied : t.share}</button>
          <a
            style={btn}
            href={`https://wa.me/?text=${encodeURIComponent(t.shareTitle)}`}
            onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${t.shareTitle}\n${shareUrl()}`)}`; pushGaEvent('my_list_share', { method: 'whatsapp' }); }}
            target="_blank"
            rel="noopener"
          >
            {t.whatsapp}
          </a>
        </div>
      )}

      {found.length === 0 && (
        <div style={{ padding: '24px 0', color: colors.text }}>
          <p style={{ margin: '0 0 12px' }}>{t.empty}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {t.browse.map(([label, href]) => <Link key={href} href={href} style={btn}>{label}</Link>)}
          </div>
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {upcoming.map((i) => <Row key={i.slug} i={i} lang={lang} />)}
      </ul>

      {past.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSoft, margin: '28px 0 4px' }}>{t.past}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.55 }}>
            {past.map((i) => <Row key={i.slug} i={i} lang={lang} />)}
          </ul>
        </>
      )}

      {missing > 0 && <p style={{ fontSize: 13, color: colors.textSoft, marginTop: 16 }}>{t.gone(missing)}</p>}

      {!shared && found.length > 0 && (
        <button
          type="button"
          style={{ ...btn, marginTop: 28, color: colors.textSoft }}
          onClick={() => { if (armClear) { writeSaved([]); setArmClear(false); } else { setArmClear(true); setTimeout(() => setArmClear(false), 4000); } }}
        >
          {armClear ? t.clearConfirm : t.clear}
        </button>
      )}
    </div>
  );
}

function Row({ i, lang }: { i: FilterItem; lang: 'en' | 'pt' }) {
  return (
    <li style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={i.href} style={{ color: colors.heading, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}>
          {i.emoji} {i.name}
        </Link>
        {i.subtitle && <div style={{ fontSize: 14, fontStyle: 'italic', color: colors.textSoft, marginTop: 2 }}>{i.subtitle}</div>}
        <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>{i.meta}</div>
      </div>
      <SaveButton slug={i.slug} lang={lang} compact />
    </li>
  );
}
