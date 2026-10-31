/**
 * Porto Zoom, the daily "guess the Porto spot" game at /play and /pt/jogar
 * (owner 2026-10-31). Pure module (no fs, no DOM) so the pages, the client
 * game and scripts/test-play.ts share it.
 *
 * One puzzle a day, picked by the Lisbon calendar date: puzzle #1 is
 * LAUNCH_DATE and the list in data/play-puzzles.json is played in file order,
 * then loops. Append new puzzles at the END of the file: days that already
 * happened keep their puzzle (index = (n - 1) % count only changes for days
 * past the old count).
 *
 * Photos are Wikimedia Commons files (CC BY, CC BY-SA or public domain),
 * resized to 1200px webp under public/play/p/ with neutral file names so the
 * URL does not give the answer away. Attribution: lib credit fields, shown on
 * the reveal screen and on /play/credits.
 */

import puzzlesJson from '@/data/play-puzzles.json';

export interface PuzzleCredit {
  file: string;
  page: string;
  author: string;
  licence: string;
  licenceUrl: string;
}

export interface Puzzle {
  id: string;
  en: string;
  pt: string;
  aliases: string[];
  image: string;
  width: number;
  height: number;
  /** Crop focus, % of width / height. The zoomed views stay centred near it. */
  fx: number;
  fy: number;
  noteEn: string;
  notePt: string;
  /** Topic key in lib/related-guides.ts GUIDE_TOPICS. */
  guide: string;
  sourceUrl: string;
  credit: PuzzleCredit;
}

export type Lang = 'en' | 'pt';

/** What the client needs for autocomplete and choices: names only, no photos or notes. */
export type Place = Pick<Puzzle, 'id' | 'en' | 'pt' | 'aliases'>;

export function placeList(puzzles: Puzzle[] = PUZZLES): Place[] {
  return puzzles.map(({ id, en, pt, aliases }) => ({ id, en, pt, aliases }));
}

export const PUZZLES: Puzzle[] = puzzlesJson as Puzzle[];
export const GAME_NAME = 'Porto Zoom';
export const LAUNCH_DATE = '2026-11-01';
export const MAX_GUESSES = 5;
/** Image scale before guess 1..5. After the game ends the photo shows at 1. */
export const ZOOM_STEPS = [5, 3.4, 2.3, 1.55, 1.15] as const;
export const SKIP = '__skip';

export const PLAY_PATH: Record<Lang, string> = { en: '/play', pt: '/pt/jogar' };
export const CREDITS_PATH: Record<Lang, string> = { en: '/play/credits', pt: '/pt/jogar/creditos' };

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in Europe/Lisbon. */
export function lisbonDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Minutes until the next Lisbon midnight (when the next puzzle unlocks). */
export function minutesToNextPuzzle(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return 24 * 60 - (n('hour') * 60 + n('minute'));
}

const DAY_MS = 86_400_000;
const isoToUtc = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');

export function addDays(iso: string, k: number): string {
  return new Date(isoToUtc(iso) + k * DAY_MS).toISOString().slice(0, 10);
}

/** Puzzle number for a date: 1 on LAUNCH_DATE. Dates before launch play #1. */
export function dayNumber(iso: string): number {
  return Math.max(1, Math.round((isoToUtc(iso) - isoToUtc(LAUNCH_DATE)) / DAY_MS) + 1);
}

export function puzzleForNumber(n: number, puzzles: Puzzle[] = PUZZLES): Puzzle {
  const count = puzzles.length;
  return puzzles[(((n - 1) % count) + count) % count];
}

export function puzzleForDate(iso: string, puzzles: Puzzle[] = PUZZLES): { puzzle: Puzzle; number: number } {
  const number = dayNumber(iso);
  return { puzzle: puzzleForNumber(number, puzzles), number };
}

// ---------------------------------------------------------------------------
// Guessing
// ---------------------------------------------------------------------------

/** Lowercase, no accents, words separated by single spaces. */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function placeName(p: Pick<Puzzle, 'en' | 'pt'>, lang: Lang): string {
  return lang === 'pt' ? p.pt : p.en;
}

/** Puzzle id for a typed answer (EN name, PT name or alias), or undefined. */
export function matchPlace(input: string, puzzles: Place[] = PUZZLES): string | undefined {
  const q = normalise(input);
  if (!q) return undefined;
  return puzzles.find((p) => [p.en, p.pt, ...p.aliases].some((n) => normalise(n) === q))?.id;
}

/** Autocomplete: places whose names contain every typed word, best first. */
export function suggestPlaces<P extends Place>(input: string, lang: Lang, puzzles: P[], limit = 6): P[] {
  const words = normalise(input).split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored: Array<[number, P]> = [];
  for (const p of puzzles) {
    const names = [placeName(p, lang), lang === 'pt' ? p.en : p.pt, ...p.aliases].map(normalise);
    let best = -1;
    for (const n of names) {
      if (!words.every((w) => n.includes(w))) continue;
      const score = n.startsWith(words[0]) ? 2 : n.split(' ').some((t) => t.startsWith(words[0])) ? 1 : 0;
      best = Math.max(best, score);
    }
    if (best >= 0) scored.push([best, p]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || placeName(a[1], lang).localeCompare(placeName(b[1], lang)))
    .slice(0, limit)
    .map(([, p]) => p);
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  status: GameStatus;
  /** Wrong guesses and skips so far. */
  misses: number;
  /** 1-based guess that hit, when won. */
  solvedAt?: number;
}

/** State after a list of guesses (puzzle ids or SKIP). Guesses after the end are ignored. */
export function gameState(guesses: string[], answerId: string): GameState {
  let misses = 0;
  for (let i = 0; i < guesses.length && i < MAX_GUESSES; i++) {
    if (guesses[i] === answerId) return { status: 'won', misses, solvedAt: i + 1 };
    misses++;
  }
  return { status: misses >= MAX_GUESSES ? 'lost' : 'playing', misses };
}

/** Image scale to show for a state. */
export function zoomFor(state: GameState): number {
  if (state.status !== 'playing') return 1;
  return ZOOM_STEPS[Math.min(state.misses, ZOOM_STEPS.length - 1)];
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The four multiple-choice options for a puzzle number: the answer + 3 others, same for everyone. */
export function choicesFor(n: number, puzzles: Puzzle[] = PUZZLES): string[] {
  const answer = puzzleForNumber(n, puzzles).id;
  const r = rng(n * 7919 + 17);
  const others = puzzles.map((p) => p.id).filter((id) => id !== answer);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const four = [answer, ...others.slice(0, 3)];
  for (let i = four.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [four[i], four[j]] = [four[j], four[i]];
  }
  return four;
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/** Spoiler-free result: name, number, score, one square per guess, URL. */
export function shareText(opts: {
  number: number;
  guesses: string[];
  answerId: string;
  lang: Lang;
  usedChoices?: boolean;
  origin?: string;
}): string {
  const st = gameState(opts.guesses, opts.answerId);
  const score = st.status === 'won' ? `${st.solvedAt}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const hint = opts.usedChoices ? (opts.lang === 'pt' ? ' (com 4 opções)' : ' (with 4 choices)') : '';
  let squares = '';
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (st.status === 'won' && i === (st.solvedAt ?? 0) - 1) squares += '\u{1F7E9}';
    else if (i < st.misses) squares += opts.guesses[i] === SKIP ? '⬛' : '\u{1F7E5}';
    else squares += '⬜';
  }
  const url = `${opts.origin ?? 'https://oportoweekly.com'}${PLAY_PATH[opts.lang]}`;
  return `${GAME_NAME} #${opts.number} ${score}${hint}\n${squares}\n${url}`;
}

// ---------------------------------------------------------------------------
// Stats (stored in localStorage by the client)
// ---------------------------------------------------------------------------

export interface DayResult {
  number: number;
  won: boolean;
  /** Guesses used (1-5). */
  guesses: number;
  choices?: boolean;
}

export interface Stats {
  played: number;
  wins: number;
  winPct: number;
  streak: number;
  maxStreak: number;
  /** distribution[i] = wins in i + 1 guesses. */
  distribution: number[];
}

/** history: Lisbon date -> result. The streak counts consecutive won days ending today (or yesterday). */
export function computeStats(history: Record<string, DayResult>, today: string): Stats {
  const dates = Object.keys(history).sort();
  const distribution = Array.from({ length: MAX_GUESSES }, () => 0);
  let wins = 0;
  let maxStreak = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of dates) {
    const r = history[d];
    if (r.won) {
      wins++;
      if (r.guesses >= 1 && r.guesses <= MAX_GUESSES) distribution[r.guesses - 1]++;
      run = prev && addDays(prev, 1) === d && history[prev].won ? run + 1 : 1;
      maxStreak = Math.max(maxStreak, run);
    } else {
      run = 0;
    }
    prev = d;
  }
  let streak = 0;
  let cursor = history[today] ? today : addDays(today, -1);
  while (history[cursor]?.won) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const played = dates.length;
  return { played, wins, winPct: played ? Math.round((wins / played) * 100) : 0, streak, maxStreak, distribution };
}
