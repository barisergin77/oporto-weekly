'use client';

/**
 * Cookie consent banner wired to Google Consent Mode v2.
 *
 * GDPR/ePrivacy: analytics cookies may only be set after consent, and the
 * site's audience is largely in the EU. The default state (denied) is set in
 * app/layout.tsx BEFORE the GTM container loads — that ordering is the whole
 * point, since a default applied after GTM has already fired is too late.
 * Here we only record the visitor's answer and call gtag('consent','update').
 *
 * With analytics_storage denied, GA4 still sends cookieless pings, so traffic
 * is undercounted rather than absent. That is the intended trade-off.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { colors, typography } from '@/lib/design';

const STORAGE_KEY = 'ow-consent-v1';

type Choice = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function pushConsent(choice: Choice) {
  window.dataLayer = window.dataLayer || [];
  // Must push the `arguments` object, NOT a plain array: Google's consent API
  // only recognises the former, and a rest-parameter array is silently
  // ignored — the update appears in the dataLayer but never grants storage
  // (observed locally: no _ga cookie after Accept). Hence the old-style
  // function and eslint exception rather than (...args) => push(args).
  // eslint-disable-next-line prefer-rest-params
  const gtag = function (this: unknown, ..._a: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  gtag('consent', 'update', {
    analytics_storage: choice,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.dataLayer.push({ event: 'consent_choice', consent_choice: choice });
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  // One banner for the whole site; copy follows the section the visitor is in.
  const lang = usePathname()?.startsWith('/pt') ? 'pt' : 'en';

  useEffect(() => {
    // Render only for visitors who haven't answered yet. Reading localStorage
    // can throw (private mode, blocked site data) — treat that as "not asked"
    // rather than breaking the page.
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Choice | null;
      if (saved === 'granted' || saved === 'denied') {
        pushConsent(saved); // re-assert on every page load
        return;
      }
    } catch {
      /* storage unavailable — fall through and ask */
    }
    setVisible(true);
  }, []);

  function choose(choice: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* not fatal: the choice still applies for this page view */
    }
    pushConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  const t = lang === 'pt'
    ? {
        text: 'Usamos cookies de análise para perceber que conteúdos são úteis. Só os ativamos se concordar.',
        accept: 'Aceitar',
        decline: 'Recusar',
        aria: 'Aviso de cookies',
      }
    : {
        text: 'We use analytics cookies to understand which stories are useful. We only turn them on if you agree.',
        accept: 'Accept',
        decline: 'Decline',
        aria: 'Cookie notice',
      };

  return (
    <div
      role="dialog"
      aria-label={t.aria}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: colors.card,
        borderTop: `1px solid ${colors.divider}`,
        boxShadow: '0 -2px 16px rgba(26,26,46,0.08)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontFamily: typography.sans,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.5, maxWidth: 560 }}>
        {t.text}
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => choose('denied')}
          style={{
            background: 'transparent',
            color: colors.textSoft,
            border: `1px solid ${colors.divider}`,
            borderRadius: 4,
            padding: '9px 18px',
            fontSize: 13,
            fontFamily: typography.sans,
            cursor: 'pointer',
          }}
        >
          {t.decline}
        </button>
        <button
          onClick={() => choose('granted')}
          style={{
            background: colors.accent,
            color: colors.heading,
            border: 'none',
            borderRadius: 4,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: typography.sans,
            cursor: 'pointer',
          }}
        >
          {t.accept}
        </button>
      </div>
    </div>
  );
}
