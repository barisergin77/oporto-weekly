import { ImageResponse } from 'next/og';
import { getEvent, listEvents, CATEGORY_EMOJI, CATEGORY_LABEL } from '@/lib/events';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return listEvents().map((e) => ({ slug: e.slug }));
}

/**
 * Per-event OG social card (1200×630).
 *
 * Three layers when a press photo exists:
 *   1. Full-bleed background image
 *   2. Dark gradient overlay (top ~transparent, bottom ~85% opaque) — keeps
 *      text legible over any photo
 *   3. Category eyebrow + event title + date/venue + brand strip
 *
 * Falls back to a navy + category-emoji composition when no image is
 * available, so every event URL always has a working social card.
 *
 * Note: next/og requires `display: 'flex' | 'none'` on every node. Any
 * element with children also needs an explicit flexDirection.
 */
export default function Image({ params }: { params: { slug: string } }) {
  const ev = getEvent(params.slug);
  if (!ev) {
    // Fall back to the site default OG so old/broken slugs don't error out.
    return new ImageResponse(
      (
        <div
          style={{
            background: '#1a1a2e',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c9a96e',
            fontSize: 48,
          }}
        >
          Oporto Weekly
        </div>
      ),
      size
    );
  }

  const dateStr = formatDateForCard(ev.date, ev.endDate);
  const categoryLabel = CATEGORY_LABEL[ev.category];
  const categoryEmoji = CATEGORY_EMOJI[ev.category];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#1a1a2e',
        }}
      >
        {/* Layer 1 — background image (when present) */}
        {ev.image && (
          <img
            src={ev.image.url}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'flex',
            }}
          />
        )}

        {/* Layer 2 — dark overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            background: ev.image
              ? 'linear-gradient(180deg, rgba(26,26,46,0.35) 0%, rgba(26,26,46,0.55) 45%, rgba(26,26,46,0.9) 100%)'
              : `linear-gradient(135deg, #1a1a2e 0%, #2b2b4e 100%)`,
          }}
        />

        {/* Layer 3 — huge emoji watermark when no real image (gives visual
             weight + subject cue without stock photos) */}
        {!ev.image && (
          <div
            style={{
              position: 'absolute',
              top: 80,
              right: 80,
              fontSize: 280,
              opacity: 0.25,
              display: 'flex',
            }}
          >
            {categoryEmoji}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '70px 80px 70px',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Category eyebrow */}
          <div
            style={{
              display: 'flex',
              color: '#c9a96e',
              fontSize: 20,
              letterSpacing: 5,
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            {categoryEmoji} &nbsp; {categoryLabel}
          </div>

          {/* Title — wraps if long; capped at ~4 lines by box height */}
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: titleSize(ev.name),
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1,
              marginBottom: 28,
              // Basic manual wrap hint — next/og's Satori supports word-wrap
              maxWidth: 1040,
            }}
          >
            {ev.name}
          </div>

          {/* Gold divider */}
          <div
            style={{
              display: 'flex',
              width: 80,
              height: 3,
              background: '#c9a96e',
              marginBottom: 22,
            }}
          />

          {/* Date · Venue — price on a second line if present */}
          <div
            style={{
              display: 'flex',
              color: '#f0ede0',
              fontSize: 24,
              lineHeight: 1.4,
              maxWidth: 1040,
            }}
          >
            {dateStr} · {ev.venue}
            {ev.price ? `  ·  ${ev.price}` : ''}
          </div>

          {/* Brand strip */}
          <div
            style={{
              position: 'absolute',
              bottom: 70,
              right: 80,
              display: 'flex',
              alignItems: 'center',
              color: '#c9a96e',
              fontSize: 16,
              letterSpacing: 3,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            oportoweekly.com
          </div>
        </div>
      </div>
    ),
    size
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scale the title font size so long names don't overflow the card. */
function titleSize(name: string): number {
  if (name.length <= 24) return 84;
  if (name.length <= 40) return 66;
  if (name.length <= 60) return 52;
  return 42;
}

function formatDateForCard(iso: string, endIso?: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const start = d.toLocaleDateString('en-GB', opts);
  if (endIso) {
    const end = new Date(endIso).toLocaleDateString('en-GB', opts);
    if (start !== end) return `${start} – ${end}`;
  }
  return start;
}
