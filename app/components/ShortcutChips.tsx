import Link from 'next/link';
import { listEventMonths, ptSlug } from '@/lib/event-months';
import { DAY_HUB_PATHS, monthOfIso, portoToday, type DayHubKind } from '@/lib/event-days';
import { colors } from '@/lib/design';

/**
 * Today · This weekend · This month — quick ways into the listings
 * (lib/event-days.ts). On statically built pages "this month" is the build's
 * month; deploys run at least weekly, so it lags by a few days at most.
 */
export function ShortcutChips({ lang, current }: { lang: 'en' | 'pt'; current?: DayHubKind | 'month' }) {
  const pt = lang === 'pt';
  const month = monthOfIso(portoToday());
  const hasHub = listEventMonths().some((m) => m.slug === month.slug);
  const chips: { key: DayHubKind | 'month'; label: string; href: string }[] = [
    { key: 'today', label: pt ? 'Hoje' : 'Today', href: DAY_HUB_PATHS.today[lang] },
    { key: 'weekend', label: pt ? 'Este fim de semana' : 'This weekend', href: DAY_HUB_PATHS.weekend[lang] },
    {
      key: 'month',
      label: pt ? 'Este mês' : 'This month',
      href: hasHub ? (pt ? `/pt/eventos/${ptSlug(month)}` : `/porto-events/${month.slug}`) : (pt ? '/pt' : '/porto-events'),
    },
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
