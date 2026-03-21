import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Oporto Weekly — Porto Events & Culture Newsletter';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
        {/* Top gold bar */}
        <div style={{ width: 80, height: 3, background: '#c9a96e', marginBottom: 40, display: 'flex' }} />

        {/* Title */}
        <div
          style={{
            fontSize: 86,
            color: '#ffffff',
            fontWeight: 700,
            letterSpacing: -2,
            marginBottom: 28,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          Oporto Weekly
        </div>

        {/* Bottom gold bar */}
        <div style={{ width: 80, height: 3, background: '#c9a96e', marginBottom: 36, display: 'flex' }} />

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#9999bb',
            textAlign: 'center',
            letterSpacing: 1,
            display: 'flex',
          }}
        >
          Porto&apos;s best events &amp; culture — every Thursday
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
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
