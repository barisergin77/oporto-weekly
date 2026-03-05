import { listNewsletters } from '@/lib/archive';
import Link from 'next/link';

export const metadata = {
  title: 'Archive — Oporto Weekly',
  description: 'Browse all past editions of Oporto Weekly — your curated Porto events guide.',
};

export default function ArchivePage() {
  const newsletters = listNewsletters();

  return (
    <main style={{ background: '#f4f1ec', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '48px 24px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#c9a96e', marginBottom: 12 }}>
          Your weekly Porto guide
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, color: '#fff', marginBottom: 8 }}>Oporto Weekly</h1>
        <p style={{ fontSize: 14, color: '#9999bb' }}>Past Editions</p>
      </div>

      {/* Archive list */}
      <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px' }}>
        {newsletters.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No editions yet — first one coming Thursday!</p>
        ) : (
          newsletters.map((n) => {
            const date = new Date(n.sentAt);
            const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <Link key={n.slug} href={`/archive/${n.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: '#fff',
                  borderRadius: 4,
                  padding: '24px 28px',
                  marginBottom: 16,
                  boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                  borderLeft: '4px solid #c9a96e',
                  transition: 'box-shadow 0.2s',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#c9a96e', marginBottom: 6 }}>
                    {dateStr}
                  </div>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#1a1a2e', marginBottom: 8 }}>
                    {n.weekRange}
                  </h2>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
                    {n.description}
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#c9a96e', letterSpacing: 0.5 }}>
                    Read this edition →
                  </span>
                </div>
              </Link>
            );
          })
        )}

        {/* Subscribe CTA */}
        <div style={{ background: '#1a1a2e', borderRadius: 4, padding: '32px', textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#fff', marginBottom: 8 }}>Get it every Thursday</p>
          <p style={{ fontSize: 13, color: '#9999bb', marginBottom: 20 }}>Join readers who get the best of Porto in their inbox every week.</p>
          <Link href="/" style={{
            display: 'inline-block',
            background: '#c9a96e',
            color: '#1a1a2e',
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
    </main>
  );
}
