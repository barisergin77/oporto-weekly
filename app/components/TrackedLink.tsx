'use client';

import type { AnchorHTMLAttributes } from 'react';

/** Push a GA4 event to the dataLayer (GTM forwards it), with the page path. */
export function pushGaEvent(event: string, params?: Record<string, string>) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params, page_path: window.location.pathname });
}

/**
 * An <a> that also pushes a GA4 event to the dataLayer on click (same
 * dataLayer pattern as the subscribe forms' `sign_up`). Used for affiliate
 * ticket buttons (`affiliate_ticket_click`), the Gomry organizer box
 * (`gomry_organizer_click`), owner 2026-10-27, and the event pages'
 * `add_to_calendar` / `share_event` links (app/components/EventActions.tsx).
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
        if (gaEvent) pushGaEvent(gaEvent, gaParams);
        onClick?.(e);
      }}
    />
  );
}
