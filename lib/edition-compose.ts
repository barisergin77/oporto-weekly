/**
 * Weekly composition (owner decision 2026-10-25: "daily research + weekly
 * composition"). The daily scan (lib/forward-scan.ts) researches and verifies
 * events into data/events; on Thursday the newsletter is COMPOSED from the
 * events on during the edition's Thu–Wed window instead of being researched
 * from scratch. Pure helpers — no network — so they're testable
 * (scripts/test-compose.ts) and shared with scripts/compose-edition-dry-run.ts.
 *
 * Fallback: when the window has too few events (composeDecision), the route
 * runs the legacy research path unchanged.
 */

import { type EventRecord, isRealEventUrl, FORWARD_SOURCE } from './events';
import { compareNames, isSameEvent, nameTokens, pickCanonical } from './event-identity';
import { kebab } from './venues';

/** Below these the window is too thin to compose; the legacy research path runs. */
export const COMPOSE_MIN_TOTAL = 10;
export const COMPOSE_MIN_SHORT = 6;
/** Same cut as the day hubs (lib/event-days.ts): longer runs go under "Also on". */
export const LONG_RUN_DAYS = 7;
const MAX_ALSO_ON = 8;

const day = (iso: string) => iso.slice(0, 10);
export const spanDays = (e: Pick<EventRecord, 'date' | 'endDate'>) =>
  (Date.parse(day(e.endDate ?? e.date)) - Date.parse(day(e.date))) / 86_400_000;

/** Same event name, loosely ("Fantasporto 2026" ≈ "Fantasporto"). */
export function sameName(a: string, b: string): boolean {
  if (kebab(a) === kebab(b)) return true;
  const m = compareNames(nameTokens(a), nameTokens(b));
  return m === 'equal' || m === 'similar';
}

export interface EditionSelection {
  from: string;
  to: string;
  /** Runs of ≤ 7 days on during the window, by date: picks + category sections. */
  short: EventRecord[];
  /** Longer runs on during the window, ending soonest first: "Also on". */
  longRuns: EventRecord[];
  /** Short events eligible for an Editor's Pick, best first. */
  pickPool: EventRecord[];
  /** Names dropped because the pick-date blocklist proved them wrong-week. */
  blocked: string[];
}

/**
 * The events for one edition window. Drops records without a description,
 * blocklisted names, and duplicate records of one event (keeps the canonical,
 * oldest one, as findExistingEventByIdentity does).
 */
export function selectEditionEvents(
  events: EventRecord[],
  from: string,
  to: string,
  opts: { blocked?: string[]; recentPicks?: string[] } = {}
): EditionSelection {
  const blockedNames = opts.blocked ?? [];
  const recent = opts.recentPicks ?? [];
  const blocked: string[] = [];
  const inWindow = events.filter((e) =>
    e?.name && e.date && e.venue && e.description?.trim() &&
    day(e.date) <= to && day(e.endDate ?? e.date) >= from
  );

  const kept: EventRecord[] = [];
  for (const e of inWindow) {
    if (blockedNames.some((b) => sameName(b, e.name))) { blocked.push(e.name); continue; }
    const dupIdx = kept.findIndex((k) => isSameEvent(k, e));
    if (dupIdx >= 0) { kept[dupIdx] = pickCanonical([kept[dupIdx], e]); continue; }
    kept.push(e);
  }

  const short = kept.filter((e) => spanDays(e) <= LONG_RUN_DAYS)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const longRuns = kept.filter((e) => spanDays(e) > LONG_RUN_DAYS)
    .sort((a, b) => day(a.endDate ?? a.date).localeCompare(day(b.endDate ?? b.date)) || a.name.localeCompare(b.name));
  const score = (e: EventRecord) =>
    (e.pickCandidate ? 4 : 0) + (isRealEventUrl(e.externalLink) ? 2 : 0) + (e.image ? 1 : 0);
  const pickPool = short
    .filter((e) => !recent.some((r) => sameName(r, e.name)))
    .sort((a, b) => score(b) - score(a) || a.date.localeCompare(b.date));
  return { from, to, short, longRuns, pickPool, blocked };
}

export interface ComposeDecision {
  compose: boolean;
  reason: string;
}

export function composeDecision(
  sel: EditionSelection,
  min: { total?: number; short?: number } = {}
): ComposeDecision {
  const minTotal = min.total ?? COMPOSE_MIN_TOTAL;
  const minShort = min.short ?? COMPOSE_MIN_SHORT;
  const total = sel.short.length + sel.longRuns.length;
  if (sel.short.length < minShort) return { compose: false, reason: `only ${sel.short.length} short-run events (< ${minShort})` };
  if (sel.pickPool.length < 5) return { compose: false, reason: `only ${sel.pickPool.length} pick-eligible events (< 5)` };
  if (total < minTotal) return { compose: false, reason: `only ${total} events in window (< ${minTotal})` };
  return { compose: true, reason: `${sel.short.length} short + ${sel.longRuns.length} long-run events, ${sel.pickPool.length} pick-eligible` };
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Thu 29 Oct 2026" — fixed format, independent of the runtime's ICU data. */
const fmtDay = (iso: string) => {
  const d = new Date(day(iso) + 'T00:00:00Z');
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const timeOf = (iso: string) => (/T(\d{2}:\d{2})/.exec(iso)?.[1] ?? '');

export function whenText(e: Pick<EventRecord, 'date' | 'endDate'>): string {
  const t = timeOf(e.date);
  if (e.endDate && day(e.endDate) > day(e.date)) return `${fmtDay(e.date)} – ${fmtDay(e.endDate)}${t ? ` (from ${t})` : ''}`;
  return `${fmtDay(e.date)}${t ? `, ${t}` : ''}`;
}

function digestEntry(e: EventRecord, pickEligible: boolean): string {
  return [
    `- name: ${e.name}`,
    `  venue: ${e.venue}`,
    `  when: ${whenText(e)}`,
    `  category: ${e.category}`,
    e.price ? `  price: ${e.price}` : '',
    `  description: ${e.description.replace(/\s+/g, ' ').trim()}`,
    `  link: ${isRealEventUrl(e.externalLink) ? e.externalLink : `https://oportoweekly.com/event/${e.slug}`}`,
    `  pick-eligible: ${pickEligible ? (e.pickCandidate ? 'yes (strong candidate)' : 'yes') : 'no'}`,
  ].filter(Boolean).join('\n');
}

/** The composition's "research data": the verified events, as structured text. */
export function eventDigest(sel: EditionSelection): string {
  const pool = new Set(sel.pickPool.map((e) => e.slug));
  const short = sel.short.map((e) => digestEntry(e, pool.has(e.slug))).join('\n');
  const long = sel.longRuns.map((e) => digestEntry(e, false)).join('\n');
  return `VERIFIED EVENTS FOR ${sel.from} → ${sel.to} (from our events database; each was checked against its official page)

SHORT EVENTS — use these for the Editor's Picks and the five category sections:
${short || '(none)'}

LONG RUNS — on all week (exhibitions, seasonal attractions):
${long || '(none)'}`;
}

export const ALSO_ON_PLACEHOLDER = '<!-- ALSO_ON -->';

/** Prompt block appended to the edition prompt in compose mode. */
export function composeRules(weekRange: string): string {
  return `
COMPOSITION RULES (this edition is composed from the VERIFIED EVENTS list above, not from web research):
- Use ONLY events from the list. Never add an event that is not in it, and never change an event's date, venue or price.
- Copy each event's "name" EXACTLY as listed into its heading, and its "venue" exactly into the meta line — we link headings to event pages by exact name.
- Editor's Picks: choose five from the SHORT EVENTS marked "pick-eligible: yes", preferring "strong candidate"; spread them across categories and days of ${weekRange} where possible. Never pick a LONG RUN.
- Category sections: fill each from SHORT EVENTS of that category (2-4 each). A section may borrow at most one LONG RUN when it would otherwise have fewer than two events. If the list has nothing at all for a section, drop that section rather than invent one.
- "More info" links: use the event's "link" exactly.
- Do NOT write an "Also on" or "still running" list yourself: put the literal HTML comment ${ALSO_ON_PLACEHOLDER} on its own line immediately before the TIP OF THE WEEK block. We insert the long-run list there.
- Tip of the Week: practical Porto advice; it may mention a listed event but must not introduce a new dated event.`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const untilText = (e: EventRecord) => {
  if (!e.endDate) return '';
  const d = new Date(day(e.endDate) + 'T00:00:00Z');
  return `until ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};

/** Long runs the edition didn't already feature (by slug or name). */
export function longRunsNotFeatured(longRuns: EventRecord[], featured: Array<Pick<EventRecord, 'slug' | 'name'>>): EventRecord[] {
  return longRuns.filter((e) => !featured.some((f) => f.slug === e.slug || sameName(f.name, e.name)));
}

/** Deterministic "Also on" block (exact /event/ slugs, no model involved). */
export function renderAlsoOn(longRuns: EventRecord[]): string {
  const items = longRuns.slice(0, MAX_ALSO_ON);
  if (items.length === 0) return '';
  const rows = items.map((e) =>
    `<p style="margin:0 0 12px 0;font-family:'Inter', Arial, sans-serif;font-size:14px;line-height:1.6;color:#3a3a3a;">` +
    `<a href="https://oportoweekly.com/event/${esc(e.slug)}" style="color:#1a1a2e;font-weight:600;text-decoration:none;border-bottom:1px solid #c9a96e;">${esc(e.name)}</a>` +
    ` <span style="color:#6b6b6b;">· ${esc(e.venue)}${untilText(e) ? ` · ${untilText(e)}` : ''}</span></p>`
  ).join('\n');
  return `<!-- ALSO ON -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#fffdf7;">
  <tr>
    <td style="padding:32px 28px 20px;">
      <p style="font-family:'Inter', Arial, sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a96e;margin:0 0 6px 0;">STILL RUNNING</p>
      <h2 style="font-family:Georgia,'Playfair Display',serif;font-size:28px;color:#1a1a2e;margin:0 0 16px 0;font-weight:700;">Also on</h2>
${rows}
    </td>
  </tr>
</table>
<!-- END ALSO ON -->`;
}

const FOOTER_MARKER = /<div[^>]*background:\s*#efe8da;\s*padding:\s*36px/i;

/** Put the block at the placeholder (else before the footer); always drop the placeholder. */
export function insertAlsoOn(html: string, block: string): string {
  if (html.includes(ALSO_ON_PLACEHOLDER)) {
    const [first, ...rest] = html.split(ALSO_ON_PLACEHOLDER);
    return first + block + rest.join('');
  }
  if (!block) return html;
  const m = FOOTER_MARKER.exec(html);
  if (!m) return html; // nowhere safe to put it — ship without
  return html.slice(0, m.index) + block + '\n' + html.slice(m.index);
}

/** Records to commit with the archive: extracted ones win; top-up finds are added. */
export function mergeEventFiles(extracted: EventRecord[], topup: EventRecord[]): EventRecord[] {
  const slugs = new Set(extracted.map((e) => e.slug));
  return [...extracted, ...topup.filter((e) => !slugs.has(e.slug) && e.sourceEdition === FORWARD_SOURCE)];
}
