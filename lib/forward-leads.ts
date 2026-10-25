/**
 * Forward-scan leads queue — data/forward-leads.json.
 *
 * Leads are events someone pointed us at (a venue newsletter the owner
 * forwarded, a tip) that the daily forward scan should check BEFORE its own
 * discovery. A lead is never a source: each one goes through the same verify()
 * path as a discovered candidate (fetch the event's own page, BLOCKED_HOSTS,
 * listing-page rejection, quotes-on-page checks, identity dedupe), and every
 * fact on the published record comes from that page. `source` and `note` are
 * bookkeeping only — never shown, never cited.
 *
 * File format (JSON; the "_readme" lines repeat this):
 *   { "_readme": [...], "leads": [Lead, ...] }
 *   Lead = {
 *     name:     "Javier Perianes",                       // as the lead gives it
 *     date:     "2026-11-28",                            // ISO start date (time optional: "2026-11-28T18:00")
 *     endDate?: "2026-11-30",                            // ISO, for runs
 *     venue:    "Casa da Música",
 *     url?:     "https://www.casadamusica.com/pt/agenda/…" // the event's own page (organiser / venue / ticketing); omit if unknown → rescue search
 *     note?:    "free; Sala 2",                          // context for humans
 *     source:   "casa-da-musica-newsletter-2026-11",     // where the lead came from (never cited)
 *     addedAt:  "2026-10-25T12:00:00Z",
 *     // written by the scan — leave out when adding a lead:
 *     status?:  "pending" | "done" | "rejected",         // missing = pending
 *     attempts?: number, lastTriedAt?: ISO, reason?: string, eventSlug?: string, resolvedAt?: ISO
 *   }
 *
 * Lifecycle (each daily run, up to LEADS_PER_RUN leads, before discovery):
 *   - pending + already listed (identity match)  → done, eventSlug = that record
 *   - pending + verified and committed           → done, eventSlug = new record
 *   - pending + verification failed              → attempts++; rejected (with
 *     the last reason) after MAX_LEAD_ATTEMPTS failed runs
 *   - pending, starts after the scan window      → untouched until it's in range
 *   - any lead whose last date is in the past    → dropped from the file
 * The cron re-reads the file from GitHub just before committing and applies
 * these outcomes by lead key, so leads added meanwhile are never lost.
 */

import { venueToSlug } from './events';

export const LEADS_PATH = 'data/forward-leads.json';
/** Leads verified per daily run — their own budget, separate from discovery's. */
export const LEADS_PER_RUN = 8;
/** Failed runs before a lead is rejected (pages 404 for a day, readers time out). */
export const MAX_LEAD_ATTEMPTS = 3;

export type LeadStatus = 'pending' | 'done' | 'rejected';

export interface ForwardLead {
  name: string;
  date: string;
  endDate?: string;
  venue: string;
  url?: string;
  note?: string;
  source: string;
  addedAt: string;
  status?: LeadStatus;
  attempts?: number;
  lastTriedAt?: string;
  reason?: string;
  eventSlug?: string;
  resolvedAt?: string;
}

export interface LeadsFile {
  _readme?: string[];
  leads: ForwardLead[];
}

/** What one scan run decided about a lead (applied to the file by applyLeadOutcomes). */
export type LeadOutcome =
  | { key: string; kind: 'done'; slug: string; reason?: string }
  | { key: string; kind: 'failed'; reason: string }
  | { key: string; kind: 'rejected'; reason: string }
  | { key: string; kind: 'dropped'; reason: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/;

/** Stable identity of a lead across file edits: start day + name + venue. */
export function leadKey(l: Pick<ForwardLead, 'name' | 'date' | 'venue'>): string {
  return `${l.date.slice(0, 10)}|${venueToSlug(l.name)}|${venueToSlug(l.venue)}`;
}

/** A lead the scan can act on: has a name, venue and ISO date(s). */
export function isValidLead(l: unknown): l is ForwardLead {
  if (!l || typeof l !== 'object') return false;
  const o = l as Record<string, unknown>;
  return typeof o.name === 'string' && o.name.trim() !== '' &&
    typeof o.venue === 'string' && o.venue.trim() !== '' &&
    typeof o.date === 'string' && ISO_DAY.test(o.date) &&
    (o.endDate == null || (typeof o.endDate === 'string' && ISO_DAY.test(o.endDate))) &&
    (o.url == null || typeof o.url === 'string');
}

/** Parses the file; null if it isn't the expected shape (the scan then skips leads). */
export function parseLeadsFile(text: string | null): LeadsFile | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== 'object' || !Array.isArray((data as LeadsFile).leads)) return null;
    return data as LeadsFile;
  } catch {
    return null;
  }
}

export function serializeLeadsFile(file: LeadsFile): string {
  return JSON.stringify(file, null, 2) + '\n';
}

export const leadStatus = (l: ForwardLead): LeadStatus => l.status ?? 'pending';
const lastDay = (l: Pick<ForwardLead, 'date' | 'endDate'>) => (l.endDate || l.date).slice(0, 10);

export interface LeadSelection {
  /** Pending leads to check this run, earliest first, at most `cap`. */
  due: ForwardLead[];
  /** Leads whose last date has passed (any status). */
  expired: ForwardLead[];
}

/**
 * Pending leads that are on during the window (a run that started earlier but
 * is still on counts), earliest first, capped. Leads past their last date are
 * returned as expired; leads that start after the window wait for a later run.
 */
export function selectLeads(leads: unknown[], window: { from: string; to: string }, today: string, cap = LEADS_PER_RUN): LeadSelection {
  const valid = leads.filter(isValidLead);
  const expired = valid.filter((l) => lastDay(l) < today);
  const due = valid
    .filter((l) => leadStatus(l) === 'pending' && lastDay(l) >= today)
    .filter((l) => l.date.slice(0, 10) <= window.to && lastDay(l) >= window.from)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, cap));
  return { due, expired };
}

/**
 * Applies one run's outcomes to a (freshly read) leads file. Leads not named
 * in `outcomes` are kept as they are, so leads added since the scan started
 * survive. Invalid entries are kept untouched for a human to fix.
 */
export function applyLeadOutcomes(file: LeadsFile, outcomes: LeadOutcome[], now: Date = new Date()): LeadsFile {
  const at = now.toISOString();
  const byKey = new Map(outcomes.map((o) => [o.key, o]));
  const leads: ForwardLead[] = [];
  for (const l of file.leads) {
    if (!isValidLead(l)) { leads.push(l); continue; }
    const o = byKey.get(leadKey(l));
    if (!o) { leads.push(l); continue; }
    if (o.kind === 'dropped') continue;
    if (o.kind === 'done') {
      leads.push({ ...l, status: 'done', eventSlug: o.slug, reason: o.reason, lastTriedAt: at, resolvedAt: at });
      continue;
    }
    const attempts = (l.attempts ?? 0) + 1;
    if (o.kind === 'rejected' || attempts >= MAX_LEAD_ATTEMPTS) {
      leads.push({ ...l, status: 'rejected', attempts, reason: o.reason, lastTriedAt: at, resolvedAt: at });
    } else {
      leads.push({ ...l, status: 'pending', attempts, reason: o.reason, lastTriedAt: at });
    }
  }
  return { ...file, leads };
}

/** True when applying the outcomes would change the file. */
export function leadsChanged(before: LeadsFile, after: LeadsFile): boolean {
  return serializeLeadsFile(before) !== serializeLeadsFile(after);
}
