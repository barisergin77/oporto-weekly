import { listNewsletters } from '@/lib/archive';
import { colors, typography } from '@/lib/design';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Archive — All Porto Events Editions',
  description: 'Archive of all Oporto Weekly editions — your curated Porto events, culture, food, and weekend guide, published every Thursday.',
  alternates: { canonical: 'https://oportoweekly.com/archive' },
  openGraph: {
    title: 'Archive — Oporto Weekly',
    description: 'Archive of all Oporto Weekly editions — your curated Porto events guide.',
    url: 'https://oportoweekly.com/archive',
    type: 'website',
  },
};

export default function ArchivePage() {
  const newsletters = listNewsletters();

  return (
    <main style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang="en" active="archive" />

      {/* Page title */}
      <div style={{ maxWidth: 640, margin: '48px auto 24px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
          Every Edition · Since 2026
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 36, color: colors.heading, margin: 0, letterSpacing: -0.5 }}>
          Archive
        </h1>
        <div style={{ width: 40, height: 2, background: colors.accent, margin: '14px auto 0' }} />
      </div>

      {/* Archive list */}
      <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 24px' }}>
        {newsletters.length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.textSoft }}>No editions yet — first one coming Thursday!</p>
        ) : (
          newsletters.map((n) => {
            const date = new Date(n.sentAt);
            const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <Link key={n.slug} href={`/archive/${n.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: colors.card,
                  borderRadius: 6,
                  padding: '24px 28px',
                  marginBottom: 16,
                  border: `1px solid ${colors.divider}`,
                  borderLeft: `4px solid ${colors.accent}`,
                  boxShadow: '0 1px 3px rgba(26,26,46,0.04)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: 8 }}>
                    {dateStr}
                  </div>
                  <h2 style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
                    {n.weekRange}
                  </h2>
                  <p style={{ fontSize: 14, color: colors.textSoft, lineHeight: 1.6, margin: '0 0 12px' }}>
                    {n.description}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.heading, letterSpacing: 0.5, borderBottom: `1.5px solid ${colors.accent}`, paddingBottom: 2 }}>
                    Read this edition →
                  </span>
                </div>
              </Link>
            );
          })
        )}

        {/* Subscribe CTA — light themed */}
        <div style={{
          background: colors.bgSoft,
          borderRadius: 8,
          padding: '36px 32px',
          textAlign: 'center',
          marginTop: 40,
          border: `1px solid ${colors.divider}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 }}>
            Join the list
          </div>
          <p style={{ fontFamily: typography.serif, fontSize: 22, color: colors.heading, margin: '0 0 8px', letterSpacing: -0.3 }}>
            Get it every Thursday
          </p>
          <p style={{ fontSize: 14, color: colors.textSoft, margin: '0 0 22px', lineHeight: 1.6 }}>
            Join readers who get the best of Porto in their inbox every week.
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: colors.accent,
            color: colors.heading,
            padding: '12px 28px',
            borderRadius: 4,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.5,
          }}>
            Subscribe free →
          </Link>
        </div>

      </div>

      <Footer lang="en" />
    </main>
  );
}
