/**
 * The "Get tickets" link for an event, across affiliate partners
 * (owner 2026-10-27). Precedence: Fever tracked link (commissionable tiers
 * 1–3) > Gomry tracked link (?ref) > Fever campaign deep link / plain
 * externalLink. Affiliate links render rel={SPONSORED_REL} with the
 * AFFILIATE_NOTE (lib/fever.ts).
 */

import type { EventRecord } from './events';
import { FEVER_ITEMS, type FeverItem, matchFever, ticketLink as feverTicketLink } from './fever';
import { GOMRY_ENABLED, GOMRY_ITEMS, type GomryItem, gomryTicket } from './gomry';

export type TicketProvider = 'fever' | 'gomry' | null;
export interface Ticket {
  href: string;
  affiliate: boolean;
  provider: TicketProvider;
}

type Ticketable = Pick<EventRecord, 'name' | 'venue' | 'date'> &
  Partial<Pick<EventRecord, 'venueSlug' | 'endDate' | 'externalLink' | 'feverId' | 'gomryId'>>;

export function ticketFor(ev: Ticketable, fever: FeverItem[] = FEVER_ITEMS, gomry: GomryItem[] = GOMRY_ENABLED ? GOMRY_ITEMS : []): Ticket | null {
  if (matchFever(ev, fever)?.commissionable) {
    const t = feverTicketLink(ev, fever)!;
    return { ...t, provider: 'fever' };
  }
  const g = gomryTicket(ev, gomry);
  if (g) return { href: g, affiliate: true, provider: 'gomry' };
  const t = feverTicketLink(ev, fever);
  if (!t) return null;
  return { ...t, provider: t.affiliate ? 'fever' : null };
}
