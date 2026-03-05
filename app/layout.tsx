import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oporto Weekly',
  description: 'The best of Porto, every Thursday morning.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'Georgia, serif' }}>
        {children}
      </body>
    </html>
  );
}
