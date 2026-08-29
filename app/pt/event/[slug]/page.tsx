import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  listEvents,
  getEvent,
  listEventsByVenue,
  toEventJsonLd,
  isRealEventUrl,
  eventDisplay,
  CATEGORY_EMOJI,
  CATEGORY_LABEL_PT,
  type EventRecord,
} from '@/lib/events';
import { getNewsletterMetaPT } from '@/lib/archive';
import { colors, typography, spacing } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';

export function generateStaticParams() {
  return listEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const ev = getEvent(params.slug);
  if (!ev) return { title: 'Evento não encontrado' };

  const disp = eventDisplay(ev, 'pt');
  const dateStr = formatLongDatePT(ev.date, ev.endDate);
  const title = `${disp.name} — ${ev.venue}, ${dateStr}`;
  const description = disp.description.slice(0, 155);
  const url = `https://oportoweekly.com/pt/event/${ev.slug}`;
  const enUrl = `https://oportoweekly.com/event/${ev.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { en: enUrl, 'pt-PT': url, 'x-default': enUrl },
    },
    openGraph: { title, description, url, type: 'article', locale: 'pt_PT' },
  };
}

export default function EventPagePT({ params }: { params: { slug: string } }) {
  const ev = getEvent(params.slug);
  if (!ev) notFound();

  const disp = eventDisplay(ev, 'pt');
  // Source edition: the event's sourceEdition is the EN slug; the PT archive
  // lives under the same slug + "-pt".
  const sourceEdition = getNewsletterMetaPT(`${ev.sourceEdition}-pt`);
  const relatedAtVenue = ev.venueSlug
    ? listEventsByVenue(ev.venueSlug).filter((e) => e.slug !== ev.slug).slice(0, 4)
    : [];

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toEventJsonLd(ev, 'https://oportoweekly.com', 'pt')) }}
      />

      <Header lang="pt" active="archive" />

      <div style={{ maxWidth: spacing.contentMaxWidth, margin: '0 auto', padding: '40px 24px' }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSoft, marginBottom: 20 }}
        >
          <Link href="/pt" style={{ color: 'inherit', textDecoration: 'none' }}>
            Início
          </Link>
          <span style={{ margin: '0 8px', color: colors.divider }}>›</span>
          <span style={{ color: colors.accent, fontWeight: 700 }}>
            {CATEGORY_EMOJI[ev.category]} {CATEGORY_LABEL_PT[ev.category]}
          </span>
        </nav>

        {/* Title */}
        <h1 style={{ fontFamily: typography.serif, fontSize: 40, lineHeight: 1.15, color: colors.heading, margin: '0 0 20px', letterSpacing: -0.5 }}>
          {disp.name}
        </h1>

        <EventHero event={ev} />

        {/* Metadata pins — PT labels. Price CTA-strings without a link are
            dropped, same rule as EN. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0 28px' }}>
          {(() => {
            if (!ev.price) return null;
            const hasLink = isRealEventUrl(ev.externalLink);
            const isCta = /check\s*website|varies|ticket(ed|s? required)|see\s*venue/i.test(ev.price);
            if (isCta && !hasLink) return null;
            return <MetaPin icon="🏷️" text={priceLabelPT(ev.price)} href={hasLink ? ev.externalLink : undefined} />;
          })()}
          <MetaPin icon="📍" text={ev.venue} href={ev.venueSlug ? `/venue/${ev.venueSlug}` : undefined} />
          <MetaPin icon="📅" text={formatLongDatePT(ev.date, ev.endDate)} />
        </div>

        <EventDescription event={ev} />

        {isRealEventUrl(ev.externalLink) && (
          <a
            href={ev.externalLink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{ display: 'inline-block', background: colors.heading, color: '#ffffff', padding: '14px 28px', textDecoration: 'none', fontSize: 14, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', borderRadius: 2, margin: '0 0 40px' }}
          >
            Comprar bilhetes →
          </a>
        )}

        {sourceEdition && (
          <div style={{ background: colors.bgSoft, borderLeft: `3px solid ${colors.accent}`, padding: '14px 18px', margin: '0 0 40px', fontSize: 14, color: colors.textSoft }}>
            Destaque na edição{' '}
            <Link href={`/pt/arquivo/${sourceEdition.slug}`} style={{ color: colors.heading, fontWeight: 600 }}>
              {sourceEdition.weekRange}
            </Link>{' '}
            da Oporto Weekly.
          </div>
        )}

        {relatedAtVenue.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 16px', paddingBottom: 10, borderBottom: `2px solid ${colors.accent}` }}>
              Mais em {ev.venue}
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {relatedAtVenue.map((r) => (
                <li key={r.slug} style={{ borderBottom: `1px solid ${colors.divider}`, padding: '12px 0' }}>
                  <Link href={`/pt/event/${r.slug}`} style={{ color: colors.heading, textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>
                    {eventDisplay(r, 'pt').name}
                  </Link>
                  <div style={{ fontSize: 13, color: colors.textSoft, marginTop: 3 }}>
                    {formatLongDatePT(r.date, r.endDate)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Footer lang="pt" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function EventDescription({ event }: { event: EventRecord }) {
  const disp = eventDisplay(event, 'pt');
  const paragraphs = disp.longDescription
    ? disp.longDescription.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [disp.description];

  return (
    <div style={{ margin: '0 0 32px' }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: colors.text, margin: i === paragraphs.length - 1 ? 0 : '0 0 16px' }}>
          {p}
        </p>
      ))}
    </div>
  );
}

function EventHero({ event }: { event: EventRecord }) {
  const disp = eventDisplay(event, 'pt');
  if (event.image) {
    return (
      <figure style={{ margin: 0 }}>
        <img
          src={event.image.url}
          alt={disp.name}
          style={{ width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', borderRadius: 2 }}
        />
        {event.image.credit && (
          <figcaption style={{ textAlign: 'center', fontSize: 12, color: colors.textSoft, marginTop: 8 }}>
            📷{' '}
            {event.image.sourceUrl ? (
              <a href={event.image.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'inherit', textDecoration: 'underline' }}>
                {event.image.credit}
              </a>
            ) : (
              event.image.credit
            )}
          </figcaption>
        )}
      </figure>
    );
  }
  return (
    <div
      style={{ width: '100%', aspectRatio: '16 / 9', background: `linear-gradient(135deg, ${colors.bgSoft} 0%, ${colors.bgAlt} 100%)`, border: `1px solid ${colors.divider}`, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}
      aria-label={`${CATEGORY_LABEL_PT[event.category]} — foto em breve`}
    >
      <div style={{ fontSize: 64 }}>{CATEGORY_EMOJI[event.category]}</div>
      <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700 }}>
        {CATEGORY_LABEL_PT[event.category]}
      </div>
    </div>
  );
}

function MetaPin({ icon, text, href }: { icon: string; text: string; href?: string }) {
  const inner = (
    <>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 14, color: colors.text }}>{text}</span>
    </>
  );
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8, background: colors.card,
    border: `1px solid ${colors.divider}`, borderRadius: 2, padding: '8px 14px', textDecoration: 'none' as const,
  };
  if (!href) return <div style={base}>{inner}</div>;
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer nofollow" style={base}>{inner}</a>;
  }
  return <Link href={href} style={base}>{inner}</Link>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Common EN price strings → PT. Numeric prices (€20, From €15) pass through. */
function priceLabelPT(price: string): string {
  const map: Record<string, string> = {
    free: 'Gratuito',
    'free entry': 'Entrada gratuita',
    'free to explore': 'Entrada gratuita',
    ticketed: 'Com bilhete',
    'tickets required': 'Bilhetes necessários',
    varies: 'Preço variável',
    'price varies': 'Preço variável',
  };
  const pt = map[price.trim().toLowerCase()];
  if (pt) return pt;
  return price.replace(/^From\s+/i, 'A partir de ');
}

const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatLongDatePT(iso: string, endIso?: string): string {
  const fmt = (d: Date) => `${d.getUTCDate()} de ${PT_MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  const start = new Date(iso.length > 10 ? iso + 'Z' : iso + 'T00:00:00Z');
  const startStr = fmt(start);
  const timeSuffix = iso.length > 10 ? ` · ${iso.slice(11, 16)}` : '';
  if (endIso) {
    const end = new Date(endIso + 'T00:00:00Z');
    const endStr = fmt(end);
    if (startStr !== endStr) return `${startStr} – ${endStr}`;
  }
  return startStr + timeSuffix;
}
