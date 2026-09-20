import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ConsentBanner } from './components/ConsentBanner';

// Google Tag Manager container (public client-side id, safe to commit).
const GTM_ID = 'GTM-KZ9GGM8W';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

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
      <head>
        {/* Consent Mode defaults — MUST execute before the GTM container, so
            this is beforeInteractive while GTM is afterInteractive. Analytics
            storage starts denied and is only granted by ConsentBanner; a
            default applied after GTM has fired would be too late to matter. */}
        <Script id="consent-default" strategy="beforeInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{'analytics_storage':'denied','ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','wait_for_update':500});`}
        </Script>
        {/* Google Tag Manager. `afterInteractive` rather than the raw inline
            snippet: it still loads on every route but after hydration, so the
            tag can't block first paint. GTM's own script is async either way. */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Georgia, serif' }}>
        {/* GTM noscript fallback — must be the first thing inside <body>. */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
