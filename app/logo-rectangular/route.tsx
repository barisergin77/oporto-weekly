import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 600,
          height: 120,
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 40px',
          gap: 24,
        }}
      >
        {/* Left gold accent */}
        <div style={{ width: 4, height: 56, background: '#c9a96e', flexShrink: 0, display: 'flex' }} />

        {/* Text stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#c9a96e',
              letterSpacing: -1,
              lineHeight: 1,
              display: 'flex',
            }}
          >
            Oporto Weekly
          </div>
          <div
            style={{
              fontSize: 16,
              color: '#9999bb',
              letterSpacing: 3,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Porto Events &amp; Culture
          </div>
        </div>
      </div>
    ),
    { width: 600, height: 120 }
  );
}
