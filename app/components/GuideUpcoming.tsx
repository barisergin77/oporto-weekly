import Link from 'next/link';
import { CATEGORY_EMOJI, eventDisplay, listUpcomingEvents, type EventRecord } from '@/lib/events';
import { listEventMonths, monthOf, ptLabel, ptSlug } from '@/lib/event-months';
import { priceText, shortDates } from '@/lib/event-seo';
import { colors, typography } from '@/lib/design';

/**
 * "Coming up in Porto" block at the end of a guide (EN + PT).
 *
 * GSC (2026-10): guides are the top search landing pages (the two shopping
 * guides alone: 65 of 339 clicks / 28 days), yet they linked to no event and
 * no month hub — a reader finishing a guide had nowhere to go but back.
 * Guides are static, so "today" is the build date. Builds can be 2-3 days
 * apart (Tuesday guide, Thursday edition, occasional others), and event data
 * only reaches the current week — so list only events still running
 * STALE_BUFFER_DAYS after the build; otherwise the month-hub links remain.
 */

type Lang = 'en' | 'pt';
const SHOWN = 5;
const STALE_BUFFER_DAYS = 3;

function pickEvents(now: Date): EventRecord[] {
  const today = now.toISOString().slice(0, 10);
  const upcoming = listUpcomingEvents(new Date(now.getTime() + STALE_BUFFER_DAYS * 86_400_000));
  // Events starting today or later first; long runs that started earlier
  // (exhibitions open since September) only fill the gaps.
  const starting = upcoming.filter((e) => e.date.slice(0, 10) >= today);
  const ongoing = upcoming
    .filter((e) => e.date.slice(0, 10) < today)
    .sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date));
  return [...starting, ...ongoing].slice(0, SHOWN);
}

export function GuideUpcoming({ lang, now = new Date() }: { lang: Lang; now?: Date }) {
  const pt = lang === 'pt';
  const events = pickEvents(now);
  const hubs = new Set(listEventMonths().map((m) => m.slug));
  const months = [
    monthOf(now.getUTCFullYear(), now.getUTCMonth()),
    monthOf(now.getUTCFullYear(), now.getUTCMonth() + 1),
  ].filter((m) => hubs.has(m.slug));
  if (events.length === 0 && months.length === 0) return null;

  return (
    <section style={{ marginTop: 56 }}>
      <h2
        style={{
          fontFamily: typography.serif,
          fontSize: 24,
          color: colors.heading,
          margin: '0 0 8px',
          paddingBottom: 10,
          borderBottom: `2px solid ${colors.accent}`,
        }}
      >
        {pt ? 'Próximos eventos no Porto' : 'Coming up in Porto'}
      </h2>
      {events.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {events.map((e) => {
            const price = priceText(e.price, lang);
            return (
              <li key={e.slug} style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
                <Link
                  href={pt ? `/pt/event/${e.slug}` : `/event/${e.slug}`}
                  style={{ color: colors.heading, textDecoration: 'none', fontSize: 16, fontWeight: 600 }}
                >
                  {CATEGORY_EMOJI[e.category]} {eventDisplay(e, lang).name}
                </Link>
                <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>
                  {shortDates(e, lang, true)} · {e.venue}
                  {price ? ` · ${price}` : ''}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', margin: '16px 0 0', fontSize: 14 }}>
        {months.map((m) => (
          <Link
            key={m.slug}
            href={pt ? `/pt/eventos/${ptSlug(m)}` : `/porto-events/${m.slug}`}
            style={{ color: colors.heading, fontWeight: 600 }}
          >
            {pt ? `Agenda de ${ptLabel(m)} →` : `All Porto events in ${m.label} →`}
          </Link>
        ))}
        {!pt && (
          <Link href="/porto-events" style={{ color: colors.textSoft }}>
            All upcoming events
          </Link>
        )}
      </p>
    </section>
  );
}
