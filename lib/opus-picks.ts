/**
 * Editor's Picks chosen by Claude Opus 5.5 (backlog #34, owner approved
 * 2026-10-29). Runs in compose mode BEFORE Gemini writes the edition: Opus
 * picks five from the week's verified events with the editor's rubric
 * (premieres first, then the week's occasion, uniqueness, expat appeal,
 * spread, at most one long run), and Gemini then writes the copy for exactly
 * those five.
 *
 * Never costs an edition: no key, an API error, a timeout, a refusal or an
 * answer with no valid pick → path 'gemini-fallback', and Gemini picks as
 * before. Picks are validated against the pool by exact slug; gaps are
 * filled from the old score order (sel.pickPool). The pool already carries
 * the MAX_FEVER_PER_EDITION cap, the Gomry and recent-pick exclusions.
 *
 * Tests: scripts/test-opus-picks.ts (no network; the client is injected).
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { EventRecord } from './events';
import { type EditionSelection, type PresetPick, sameName, spanDays, whenText } from './edition-compose';
import { isFeverEvent } from './fever';
import { isGomryEvent } from './gomry';

export const OPUS_PICK_MODEL = 'claude-opus-5-5';
/** Whole-step deadline (request + its one retry). The route has 300 s in all. */
export const OPUS_PICK_TIMEOUT_MS = 60_000;
export const PICK_COUNT = 5;
const MAX_LONG_RUN_PICKS = 1;

export type PickPath = 'opus' | 'gemini-fallback';

export interface ChosenPick {
  event: EventRecord;
  /** One-line reason from Opus; '' for a gap filled from the score order. */
  why: string;
  source: 'opus' | 'score';
}

export interface PickResult {
  path: PickPath;
  /** Exactly PICK_COUNT on path 'opus'; empty on 'gemini-fallback'. */
  picks: ChosenPick[];
  occasion: string;
  reason: string;
  /** Slugs Opus returned that were not in the pool (or broke a rule). */
  rejected: string[];
}

/** The minimal client surface we use, so tests can inject a fake. */
export interface PickClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: { signal?: AbortSignal; timeout?: number },
    ): Promise<Pick<Anthropic.Message, 'content' | 'stop_reason'>>;
  };
}

interface RawPicks {
  occasion?: unknown;
  picks?: unknown;
}

/**
 * Events Opus may choose from: the short pick pool plus long runs that pass
 * the same exclusions (Gomry, recent picks). Fever cap is already applied by
 * selectEditionEvents to both lists.
 */
export function pickCandidates(sel: EditionSelection, recentPicks: string[] = []): { short: EventRecord[]; long: EventRecord[] } {
  const long = sel.longRuns
    .filter((e) => !isGomryEvent(e))
    .filter((e) => !recentPicks.some((r) => sameName(r, e.name)));
  return { short: sel.pickPool, long };
}

const candidateJson = (e: EventRecord, kind: 'short' | 'long') => ({
  slug: e.slug,
  name: e.name,
  when: whenText(e),
  days: spanDays(e),
  kind,
  venue: e.venue,
  category: e.category,
  price: e.price ?? null,
  description: e.description.replace(/\s+/g, ' ').trim(),
  strongCandidate: !!e.pickCandidate,
  fever: isFeverEvent(e),
});

/** The rubric from ~/oporto-growth/opus-picks-test/pick-prompt.md, for one week. */
export function buildPickPrompt(sel: EditionSelection, recentPicks: string[] = []): string {
  const { short, long } = pickCandidates(sel, recentPicks);
  const list = [...short.map((e) => candidateJson(e, 'short')), ...long.map((e) => candidateJson(e, 'long'))];
  return `You are the editor of Oporto Weekly, a free weekly newsletter (EN + PT) about what's on in Porto, read mostly by expats, English speakers and curious locals. Each Thursday edition covers Thursday to Wednesday and has 5 "Editor's Picks".

Pick the 5 best events for the week ${sel.from} to ${sel.to} from the candidates below. Use only events in the list, and copy each pick's "slug" exactly.

How to judge (in priority order):
1. Premieres, one-off and genuinely important events come first (a debut, a major artist or orchestra programme, a festival's opening, a rare chance).
2. The week's occasion matters: if the week contains a holiday or a cultural moment, events tied to it get extra weight (e.g. Halloween 31 Oct, All Saints' Day 1 Nov — a public holiday in Portugal, Magusto/St Martin's 11 Nov, Christmas, São João). Still below rule 1.
3. Uniqueness to this week: prefer things you can only do this week. Recurring tourist products (nightly fado shows, Candlelight concert series, permanent tours) only if something about this week is special.
4. Appeal to the audience: works for non-Portuguese speakers or is visual/musical; good value; at least one free pick when a strong one exists.
5. Spread: different categories and different days; avoid two picks at the same venue.
6. LONG RUNS (kind "long": exhibitions/festivals over 7 days): at most ONE, and only if it opens, closes or has a "last chance" this week, or the week's occasion makes it the obvious thing to do.
Skip trade/professional events and sales pitches.

Return exactly 5 picks, best first, each with a one-short-line "why" for readers, and the week's occasion (or "none").

CANDIDATES (JSON):
${JSON.stringify(list, null, 1)}`;
}

const PICK_SCHEMA = {
  type: 'object',
  properties: {
    occasion: { type: 'string' },
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          name: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['slug', 'name', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['occasion', 'picks'],
  additionalProperties: false,
} as const;

/**
 * Keep Opus's picks that are in the pool by exact slug (no duplicates, at
 * most one long run), up to five; fill the rest from the old score order.
 */
export function validatePicks(raw: RawPicks, sel: EditionSelection, recentPicks: string[] = []): Omit<PickResult, 'path' | 'reason'> {
  const { short, long } = pickCandidates(sel, recentPicks);
  const bySlug = new Map<string, { e: EventRecord; long: boolean }>();
  for (const e of short) bySlug.set(e.slug, { e, long: false });
  for (const e of long) bySlug.set(e.slug, { e, long: true });

  const picks: ChosenPick[] = [];
  const rejected: string[] = [];
  let longCount = 0;
  const items = Array.isArray(raw.picks) ? raw.picks : [];
  for (const it of items) {
    if (picks.length >= PICK_COUNT) break;
    const slug = typeof (it as { slug?: unknown })?.slug === 'string' ? (it as { slug: string }).slug : '';
    const hit = bySlug.get(slug);
    if (!hit || picks.some((p) => p.event.slug === slug)) { rejected.push(slug || '(no slug)'); continue; }
    if (hit.long && longCount >= MAX_LONG_RUN_PICKS) { rejected.push(slug); continue; }
    if (hit.long) longCount++;
    const why = typeof (it as { why?: unknown }).why === 'string' ? (it as { why: string }).why.trim() : '';
    picks.push({ event: hit.e, why, source: 'opus' });
  }
  const fromOpus = picks.length;
  if (fromOpus > 0) {
    for (const e of sel.pickPool) {
      if (picks.length >= PICK_COUNT) break;
      if (!picks.some((p) => p.event.slug === e.slug)) picks.push({ event: e, why: '', source: 'score' });
    }
  }
  const occasion = typeof raw.occasion === 'string' && raw.occasion.trim() ? raw.occasion.trim() : 'none';
  return { picks, occasion, rejected };
}

/**
 * Re-check earlier picks against a new selection (after the pick-date check
 * dropped wrong-week events): no new model call, same validation + fill.
 */
export function refreshPicks(prev: PickResult, sel: EditionSelection, recentPicks: string[] = []): PickResult {
  if (prev.path !== 'opus') return prev;
  const v = validatePicks(
    { occasion: prev.occasion, picks: prev.picks.filter((p) => p.source === 'opus').map((p) => ({ slug: p.event.slug, why: p.why })) },
    sel, recentPicks,
  );
  if (v.picks.length < PICK_COUNT) return fallback(`only ${v.picks.length} picks left after re-check`);
  return { path: 'opus', reason: `${prev.reason}; re-checked`, ...v };
}

const fallback = (reason: string): PickResult => ({ path: 'gemini-fallback', picks: [], occasion: 'none', reason, rejected: [] });

/**
 * Ask Opus for the week's five picks. Never throws: any failure returns
 * path 'gemini-fallback' with the reason.
 */
export async function choosePicks(
  sel: EditionSelection,
  opts: { recentPicks?: string[]; client?: PickClient; timeoutMs?: number; apiKey?: string } = {},
): Promise<PickResult> {
  const recentPicks = opts.recentPicks ?? [];
  const timeoutMs = opts.timeoutMs ?? OPUS_PICK_TIMEOUT_MS;
  const { short, long } = pickCandidates(sel, recentPicks);
  if (short.length + long.length < PICK_COUNT) return fallback(`only ${short.length + long.length} candidates`);
  let client = opts.client;
  if (!client) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fallback('ANTHROPIC_API_KEY not set');
    // Imported here so builds and tests never need the key or the network.
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    client = new AnthropicSDK({ apiKey, maxRetries: 1, timeout: timeoutMs }) as unknown as PickClient;
  }
  const started = Date.now();
  // Hard deadline for the whole step (SDK retry included), even if the
  // client ignored the abort signal.
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ac.abort();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([
      client.messages.create(
        {
          model: OPUS_PICK_MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: PICK_SCHEMA } },
          messages: [{ role: 'user', content: buildPickPrompt(sel, recentPicks) }],
        },
        { signal: ac.signal, timeout: timeoutMs },
      ),
      deadline,
    ]);
    if (res.stop_reason === 'refusal') return fallback('model refused');
    if (res.stop_reason === 'max_tokens') return fallback('hit max_tokens');
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    let raw: RawPicks;
    try {
      raw = JSON.parse(text) as RawPicks;
    } catch {
      return fallback('response was not JSON');
    }
    const v = validatePicks(raw, sel, recentPicks);
    if (v.picks.length === 0) return fallback(`no valid picks (rejected: ${v.rejected.join(', ') || 'none returned'})`);
    if (v.picks.length < PICK_COUNT) return fallback(`only ${v.picks.length} picks after fill`);
    const filled = v.picks.filter((p) => p.source === 'score').length;
    return {
      path: 'opus',
      reason: `${OPUS_PICK_MODEL} in ${Math.round((Date.now() - started) / 1000)}s${filled ? `, ${filled} filled from score order` : ''}${v.rejected.length ? `, rejected ${v.rejected.join(', ')}` : ''}`,
      ...v,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    const msg = err instanceof Error ? err.message : String(err);
    return fallback(`${name}: ${msg.slice(0, 200)} after ${Math.round((Date.now() - started) / 1000)}s`);
  } finally {
    clearTimeout(timer);
  }
}

/** One log line for the run log. */
export function pickLogLine(r: PickResult): string {
  const names = r.picks.map((p, i) => `${i + 1}. ${p.event.name}${p.source === 'score' ? ' (fill)' : ''}`).join(' | ');
  return `[cron/newsletter] picks path=${r.path} — ${r.reason}${r.path === 'opus' ? ` — occasion: ${r.occasion} — ${names}` : ''}`;
}

/** The picks as the edition prompt takes them; undefined → Gemini picks. */
export function presetPicks(r: PickResult | null): PresetPick[] | undefined {
  if (!r || r.path !== 'opus' || r.picks.length === 0) return undefined;
  return r.picks.map((p) => ({ name: p.event.name, venue: p.event.venue, when: whenText(p.event), why: p.why }));
}
