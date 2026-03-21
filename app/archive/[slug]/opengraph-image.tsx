import { ImageResponse } from 'next/og';
import { getNewsletterMeta, listNewsletters } from '@/lib/archive';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return listNewsletters().map((n) => ({ slug: n.slug }));
}

export default function Image({ params }: { params: { slug: string } }) {
  const meta = getNewsletterMeta(params.slug);
  const weekRange = meta?.weekRange ?? 'Weekly Edition';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a1a2e',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 100px',
        }}
      >
        {/* Label */}
        <div
          style={{
            fontSize: 16,
            color: '#c9a96e',
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 28,
            display: 'flex',
          }}
        >
          OPORTO WEEKLY
        </div>

        {/* Gold divider */}
        <div style={{ width: 60, height: 2, background: '#c9a96e', marginBottom: 36, display: 'flex' }} />

        {/* Week range */}
        <div
          style={{
            fontSize: 60,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 1.15,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {weekRange}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: '#9999bb',
            textAlign: 'center',
            display: 'flex',
          }}
        >
          Porto Events &amp; Culture Guide
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 16,
            color: '#c9a96e',
            letterSpacing: 2,
            display: 'flex',
          }}
        >
          oportoweekly.com
        </div>
      </div>
    ),
    size
  );
}
