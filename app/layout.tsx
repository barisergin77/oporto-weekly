import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://oportoweekly.com'),
  title: {
    default: 'Oporto Weekly — Porto Events & Culture Newsletter',
    template: '%s | Oporto Weekly',
  },
  description:
    'The best events, culture, food, and things to do in Porto — curated every Thursday morning and delivered free to your inbox.',
  keywords: [
    'Porto events',
    'Porto guide',
    'Porto newsletter',
    'things to do in Porto',
    'Porto culture',
    'Oporto events',
    'Porto weekend',
    'Porto food',
    'Porto music',
    'what to do in Porto',
  ],
  openGraph: {
    siteName: 'Oporto Weekly',
    type: 'website',
    locale: 'en_GB',
    url: 'https://oportoweekly.com',
    title: 'Oporto Weekly — Porto Events & Culture Newsletter',
    description:
      'The best events, culture, food, and things to do in Porto — curated every Thursday morning and delivered free to your inbox.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Oporto Weekly — Porto Events & Culture Newsletter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oporto Weekly — Porto Events & Culture Newsletter',
    description:
      'The best events, culture, food, and things to do in Porto — curated every Thursday morning.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: 'https://oportoweekly.com',
    languages: {
      'en': 'https://oportoweekly.com',
      'pt': 'https://oportoweekly.com/pt',
    },
    types: {
      'application/rss+xml': 'https://oportoweekly.com/feed.xml',
    },
  },
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
