import Link from 'next/link';
import { listEventMonths, monthOf, ptSlug, MONTH_NAMES, MONTH_NAMES_PT } from '@/lib/event-months';
import { DAY_HUB_PATHS, monthOfIso, portoToday, type DayHubKind } from '@/lib/event-days';
import { LANDING_PATHS, landingIndexable } from '@/lib/event-landings';
import { colors } from '@/lib/design';

/**
 * Today · This weekend · This month · [next month] · [Christmas] · Free · Kids:
 * quick ways into the listings (lib/event-days.ts, lib/event-landings.ts). On
 * statically built pages the dates are the build's; deploys run daily (21:00
 * UTC flush), so they lag by a day at most.
 *
 * Seasonal chips (growth #40, 2026-11-10) put the hubs people search for ahead
 * of time in front of Google from every event page: next month's hub from the
 * 15th (if it has a page), and the Christmas hub from 1 November to 6 January
 * while it is indexable.
 */
type Key = DayHubKind | 'month' | 'next-month' | 'christmas' | 'free' | 'kids';

/** Seasonal chip inputs, computed once per Porto day (the chips render on ~2,000 pages per build). */
let seasonalCache: { day: string; christmas: boolean } | null = null;
function christmasChipOn(today: string): boolean {
  if (seasonalCache?.day === today) return seasonalCache.christmas;
  const md = today.slice(5, 10);
  const inSeason = md >= '11-01' || md <= '01-06';
  const christmas = inSeason && landingIndexable('christmas', new Date(`${today}T12:00:00Z`));
  seasonalCache = { day: today, christmas };
  return christmas;
}

export function ShortcutChips({ lang, current }: { lang: 'en' | 'pt'; current?: Key }) {
  const pt = lang === 'pt';
  const today = portoToday();
  const month = monthOfIso(today);
  const hubs = listEventMonths();
  const hasHub = hubs.some((m) => m.slug === month.slug);
  const next = monthOf(month.year, month.month + 1);
  const showNext = Number(today.slice(8, 10)) >= 15 && hubs.some((m) => m.slug === next.slug);
  const seasonal: { key: Key; label: string; href: string }[] = [];
  if (showNext) {
    seasonal.push({
      key: 'next-month',
      label: pt
        ? MONTH_NAMES_PT[next.month].charAt(0).toUpperCase() + MONTH_NAMES_PT[next.month].slice(1)
        : MONTH_NAMES[next.month],
      href: pt ? `/pt/eventos/${ptSlug(next)}` : `/porto-events/${next.slug}`,
    });
  }
  if (christmasChipOn(today)) {
    seasonal.push({ key: 'christmas', label: pt ? 'Natal' : 'Christmas', href: LANDING_PATHS.christmas[lang] });
  }
  const chips: { key: Key; label: string; href: string }[] = [
    { key: 'today', label: pt ? 'Hoje' : 'Today', href: DAY_HUB_PATHS.today[lang] },
    { key: 'weekend', label: pt ? 'Este fim de semana' : 'This weekend', href: DAY_HUB_PATHS.weekend[lang] },
    {
      key: 'month',
      label: pt ? 'Este mês' : 'This month',
      href: hasHub ? (pt ? `/pt/eventos/${ptSlug(month)}` : `/porto-events/${month.slug}`) : (pt ? '/pt' : '/porto-events'),
    },
    ...seasonal,
    { key: 'free', label: pt ? 'Grátis' : 'Free', href: LANDING_PATHS.free[lang] },
    { key: 'kids', label: pt ? 'Com crianças' : 'With kids', href: LANDING_PATHS.kids[lang] },
  ];
  return (
    <nav aria-label={pt ? 'Atalhos da agenda' : 'Event shortcuts'} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {chips.map((c) => {
        const on = c.key === current;
        return (
          <Link
            key={c.key}
            href={c.href}
            aria-current={on ? 'page' : undefined}
            style={{
              background: on ? colors.heading : colors.card,
              color: on ? '#ffffff' : colors.heading,
              border: `1px solid ${on ? colors.heading : colors.divider}`,
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
