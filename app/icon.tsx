import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#c9a96e',
            lineHeight: 1,
            letterSpacing: -1,
          }}
        >
          OW
        </div>
      </div>
    ),
    size
  );
}
