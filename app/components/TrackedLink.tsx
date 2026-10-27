'use client';

import type { AnchorHTMLAttributes } from 'react';

/**
 * An <a> that also pushes a GA4 event to the dataLayer on click (same
 * dataLayer pattern as the subscribe forms' `sign_up`). Used for affiliate
 * ticket buttons (`affiliate_ticket_click`) and the Gomry organizer box
 * (`gomry_organizer_click`), owner 2026-10-27.
 */
export function TrackedLink({
  gaEvent,
  gaParams,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { gaEvent?: string; gaParams?: Record<string, string> }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        if (gaEvent) {
          const w = window as unknown as { dataLayer?: unknown[] };
          w.dataLayer = w.dataLayer || [];
          w.dataLayer.push({ event: gaEvent, ...gaParams, page_path: window.location.pathname });
        }
        onClick?.(e);
      }}
    />
  );
}
