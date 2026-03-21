import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1000,
          height: 1000,
          background: '#1a1a2e',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Top gold bar */}
        <div style={{ width: 80, height: 4, background: '#c9a96e', marginBottom: 48, display: 'flex' }} />

        {/* OW monogram */}
        <div
          style={{
            fontSize: 200,
            fontWeight: 900,
            color: '#c9a96e',
            letterSpacing: -8,
            lineHeight: 1,
            display: 'flex',
            marginBottom: 40,
          }}
        >
          OW
        </div>

        {/* Bottom gold bar */}
        <div style={{ width: 80, height: 4, background: '#c9a96e', marginBottom: 40, display: 'flex' }} />

        {/* Wordmark */}
        <div
          style={{
            fontSize: 52,
            color: '#ffffff',
            letterSpacing: 6,
            textTransform: 'uppercase',
            display: 'flex',
          }}
        >
          OPORTO WEEKLY
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#9999bb',
            marginTop: 16,
            letterSpacing: 2,
            display: 'flex',
          }}
        >
          Porto · Portugal
        </div>
      </div>
    ),
    { width: 1000, height: 1000 }
  );
}
