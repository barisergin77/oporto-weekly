import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: '#c9a96e',
            lineHeight: 1,
            letterSpacing: -3,
          }}
        >
          OW
        </div>
      </div>
    ),
    size
  );
}
