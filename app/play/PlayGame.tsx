'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { colors, typography } from '@/lib/design';
import {
  GAME_NAME, MAX_GUESSES, SKIP, computeStats, gameState, lisbonDate, matchPlace, minutesToNextPuzzle,
  placeName, shareText, suggestPlaces, zoomFor, type DayResult, type Lang, type Place, type Puzzle, type Stats,
} from '@/lib/play';

/**
 * The Porto Zoom board (lib/play.ts has the rules). Server renders the
 * zoomed-in start state; this restores today's guesses and the player's
 * history from localStorage (key ow-play-v1, every access in try/catch, the
 * game works without it). GA4 via the dataLayer, like TrackedLink:
 * game_start, game_finish, game_share.
 */

const STORE_KEY = 'ow-play-v1';

interface Stored {
  history: Record<string, DayResult>;
  current?: { date: string; guesses: string[]; choices?: boolean };
}

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Stored;
      if (s && typeof s === 'object' && s.history && typeof s.history === 'object') return s;
    }
  } catch { /* private mode, blocked storage, bad JSON */ }
  return { history: {} };
}

function save(s: Stored) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function track(event: string, params: Record<string, string | number | boolean>) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params, page_path: window.location.pathname });
  } catch { /* analytics never breaks the game */ }
}

const COPY = {
  en: {
    intro: 'A close-up of a Porto street or landmark. Each wrong guess zooms out. You have five tries.',
    alt: 'Today\'s mystery photo of a Porto place',
    placeholder: 'Type a street or landmark',
    guess: 'Guess',
    skip: 'Skip',
    showChoices: 'Stuck? Show 4 choices',
    pickFromList: 'Pick a place from the list.',
    already: 'You already tried that one.',
    tries: (left: number) => `${left} ${left === 1 ? 'try' : 'tries'} left`,
    skipped: 'Skipped',
    won: (n: number) => (n === 1 ? 'First try!' : `Got it in ${n}.`),
    lost: 'Out of tries.',
    itWas: 'It was',
    readGuide: 'Read the guide',
    share: 'Share result',
    copied: 'Copied to clipboard',
    copyFail: 'Could not copy. Select the text below.',
    photo: 'Photo',
    via: 'via Wikimedia Commons',
    source: 'Source',
    next: (m: number) => `Next puzzle in ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m (Lisbon time).`,
    newPuzzle: 'A new puzzle is out.',
    reload: 'Load it',
    stats: 'Your stats',
    played: 'Played',
    winPct: 'Win %',
    streak: 'Streak',
    maxStreak: 'Best streak',
    distribution: 'Guesses',
  },
  pt: {
    intro: 'Uma foto muito de perto de uma rua ou monumento do Porto. Cada resposta errada afasta a imagem. Tem cinco tentativas.',
    alt: 'Foto mistério do dia, de um local do Porto',
    placeholder: 'Escreva uma rua ou monumento',
    guess: 'Responder',
    skip: 'Passar',
    showChoices: 'Sem ideias? Ver 4 opções',
    pickFromList: 'Escolha um local da lista.',
    already: 'Já tentou esse.',
    tries: (left: number) => `${left} ${left === 1 ? 'tentativa' : 'tentativas'}`,
    skipped: 'Passou',
    won: (n: number) => (n === 1 ? 'À primeira!' : `Acertou à ${n}.ª.`),
    lost: 'Acabaram as tentativas.',
    itWas: 'Era',
    readGuide: 'Ler o guia',
    share: 'Partilhar resultado',
    copied: 'Copiado',
    copyFail: 'Não foi possível copiar. Selecione o texto abaixo.',
    photo: 'Foto',
    via: 'via Wikimedia Commons',
    source: 'Fonte',
    next: (m: number) => `Próximo desafio daqui a ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m (hora de Lisboa).`,
    newPuzzle: 'Já há um desafio novo.',
    reload: 'Abrir',
    stats: 'As suas estatísticas',
    played: 'Jogos',
    winPct: '% vitórias',
    streak: 'Sequência',
    maxStreak: 'Melhor sequência',
    distribution: 'Tentativas',
  },
} as const;

export interface PlayGameProps {
  lang: Lang;
  date: string;
  number: number;
  puzzle: Puzzle;
  places: Place[];
  choices: string[];
  guide?: { href: string; title: string };
  /** Server-rendered subscribe box, shown once the game is over. */
  children?: ReactNode;
}

export function PlayGame({ lang, date, number, puzzle, places, choices, guide, children }: PlayGameProps) {
  const t = COPY[lang];
  const [guesses, setGuesses] = useState<string[]>([]);
  const [usedChoices, setUsedChoices] = useState(false);
  const [history, setHistory] = useState<Record<string, DayResult>>({});
  const [input, setInput] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [stale, setStale] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const restored = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const state = gameState(guesses, puzzle.id);
  const done = state.status !== 'playing';
  const zoom = zoomFor(state);
  const suggestions = useMemo(
    () => suggestPlaces(input, lang, places).filter((p) => !guesses.includes(p.id)),
    [input, lang, places, guesses]
  );

  // Restore today's game + history once.
  useEffect(() => {
    const s = load();
    setHistory(s.history);
    if (s.current?.date === date && Array.isArray(s.current.guesses)) {
      setGuesses(s.current.guesses.filter((g) => g === SKIP || byId.has(g)).slice(0, MAX_GUESSES));
      setUsedChoices(!!s.current.choices);
    }
    restored.current = true;
    if (lisbonDate() > date) setStale(true);
    setMinutesLeft(minutesToNextPuzzle());
    const timer = window.setInterval(() => {
      setMinutesLeft(minutesToNextPuzzle());
      if (lisbonDate() > date) setStale(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [date, byId]);

  function commit(next: string[], choicesUsed = usedChoices) {
    if (done) return;
    if (guesses.length === 0) track('game_start', { game: 'porto_zoom', puzzle_number: number, lang });
    setGuesses(next);
    setError('');
    const st = gameState(next, puzzle.id);
    const stored = load();
    stored.current = { date, guesses: next, choices: choicesUsed };
    if (st.status !== 'playing') {
      const result: DayResult = { number, won: st.status === 'won', guesses: st.solvedAt ?? next.length, choices: choicesUsed };
      stored.history = { ...stored.history, [date]: result };
      setHistory(stored.history);
      track('game_finish', {
        game: 'porto_zoom', puzzle_number: number, lang,
        result: st.status === 'won' ? 'win' : 'loss', guesses: result.guesses, used_choices: choicesUsed,
      });
    }
    save(stored);
  }

  function guessId(id: string) {
    if (guesses.includes(id)) { setError(t.already); return; }
    commit([...guesses, id]);
    setInput('');
    setOpen(false);
    setActive(0);
  }

  function submitTyped() {
    const pick = open && suggestions[active] ? suggestions[active].id : matchPlace(input, places);
    if (!pick) { setError(t.pickFromList); return; }
    guessId(pick);
  }

  function showChoices() {
    setUsedChoices(true);
    const stored = load();
    stored.current = { date, guesses, choices: true };
    save(stored);
  }

  async function share() {
    const text = shareText({ number, guesses, answerId: puzzle.id, lang, usedChoices });
    let method = 'copy';
    try {
      if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        method = 'share';
        await navigator.share({ text });
        setShareMsg('');
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg(t.copied);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return; // closed the share sheet
      try {
        await navigator.clipboard.writeText(text);
        method = 'copy';
        setShareMsg(t.copied);
      } catch {
        setShareMsg(t.copyFail + '\n\n' + text);
      }
    }
    track('game_share', { game: 'porto_zoom', puzzle_number: number, lang, method });
  }

  const stats: Stats = computeStats(history, date);
  const left = MAX_GUESSES - guesses.length;
  const name = placeName(puzzle, lang);
  const note = lang === 'pt' ? puzzle.notePt : puzzle.noteEn;
  const ratio = Math.min(Math.max(puzzle.width / puzzle.height, 0.8), 1.5);

  return (
    <div>
      {stale && (
        <div role="status" style={{ background: colors.bgSoft, border: `1px solid ${colors.divider}`, padding: '10px 14px', marginBottom: 14, fontSize: 14 }}>
          {t.newPuzzle}{' '}
          <a href="" onClick={(e) => { e.preventDefault(); window.location.reload(); }} style={{ color: colors.heading, fontWeight: 600 }}>{t.reload}</a>
        </div>
      )}

      {!done && <p style={{ fontSize: 15, lineHeight: 1.6, color: colors.textSoft, margin: '0 0 16px' }}>{t.intro}</p>}

      {/* Photo */}
      <div
        className="play-frame"
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 6, background: colors.dark,
          aspectRatio: done ? `${puzzle.width} / ${puzzle.height}` : String(ratio),
          maxHeight: done ? '75vh' : undefined, margin: '0 auto',
          border: `1px solid ${colors.divider}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={puzzle.image}
          alt={done ? name : t.alt}
          width={puzzle.width}
          height={puzzle.height}
          draggable={false}
          onContextMenu={(e) => { if (!done) e.preventDefault(); }}
          style={{
            width: '100%', height: '100%', display: 'block',
            objectFit: done ? 'contain' : 'cover',
            objectPosition: `${puzzle.fx}% ${puzzle.fy}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${puzzle.fx}% ${puzzle.fy}%`,
            transition: 'transform 450ms ease',
            userSelect: 'none',
          }}
        />
        {!done && (
          <div aria-hidden style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(26,26,46,0.75)', color: '#fff', fontSize: 12, padding: '3px 8px', borderRadius: 3 }}>
            {zoom.toFixed(1)}x
          </div>
        )}
      </div>

      {/* Progress squares */}
      <div aria-hidden style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '14px 0 6px' }}>
        {Array.from({ length: MAX_GUESSES }, (_, i) => {
          const g = guesses[i];
          const bg = g === undefined ? colors.divider : g === puzzle.id ? '#3c8d5a' : g === SKIP ? '#555' : '#c0504d';
          return <span key={i} style={{ width: 22, height: 8, borderRadius: 2, background: bg }} />;
        })}
      </div>

      {!done && (
        <>
          <div style={{ textAlign: 'center', fontSize: 13, color: colors.textMuted, marginBottom: 14 }} aria-live="polite">
            {t.tries(left)}
          </div>

          {usedChoices ? (
            <div className="play-choices" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {choices.map((id) => {
                const p = byId.get(id)!;
                const tried = guesses.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={tried}
                    onClick={() => guessId(id)}
                    style={{
                      padding: '12px 10px', fontSize: 15, borderRadius: 4, cursor: tried ? 'default' : 'pointer',
                      border: `1px solid ${tried ? colors.divider : colors.accent}`, background: tried ? colors.bgSoft : colors.card,
                      color: tried ? colors.textMuted : colors.heading, textDecoration: tried ? 'line-through' : 'none',
                      fontFamily: typography.sans,
                    }}
                  >
                    {placeName(p, lang)}
                  </button>
                );
              })}
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); submitTyped(); }}
              style={{ position: 'relative' }}
              autoComplete="off"
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(0); setError(''); }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(suggestions.length - 1, 0))); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                    if (e.key === 'Escape') setOpen(false);
                  }}
                  placeholder={t.placeholder}
                  aria-label={t.placeholder}
                  role="combobox"
                  aria-expanded={open && suggestions.length > 0}
                  aria-controls="play-suggestions"
                  aria-autocomplete="list"
                  style={{
                    flex: 1, minWidth: 0, padding: '12px 12px', fontSize: 16, borderRadius: 4,
                    border: `1px solid ${colors.divider}`, background: colors.card, color: colors.text, fontFamily: typography.sans,
                  }}
                />
                <button type="submit" style={{
                  padding: '0 18px', fontSize: 15, fontWeight: 600, borderRadius: 4, border: 'none',
                  background: colors.heading, color: '#fff', cursor: 'pointer', fontFamily: typography.sans,
                }}>
                  {t.guess}
                </button>
              </div>
              {open && suggestions.length > 0 && (
                <ul id="play-suggestions" role="listbox" style={{
                  position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', margin: '4px 0 0', padding: 0, listStyle: 'none',
                  background: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 4, boxShadow: '0 6px 20px rgba(26,26,46,0.12)',
                }}>
                  {suggestions.map((p, i) => (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => { e.preventDefault(); guessId(p.id); }}
                      onMouseEnter={() => setActive(i)}
                      style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 15, background: i === active ? colors.bgSoft : 'transparent' }}
                    >
                      {placeName(p, lang)}
                      {placeName(p, lang === 'pt' ? 'en' : 'pt') !== placeName(p, lang) && (
                        <span style={{ color: colors.textMuted, fontSize: 13 }}> · {placeName(p, lang === 'pt' ? 'en' : 'pt')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}

          {error && <div role="alert" style={{ color: '#a33a37', fontSize: 14, marginTop: 8 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            {!usedChoices ? (
              <button type="button" onClick={showChoices} style={linkButton}>{t.showChoices}</button>
            ) : <span />}
            <button type="button" onClick={() => commit([...guesses, SKIP])} style={linkButton}>{t.skip} →</button>
          </div>

          {guesses.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', fontSize: 14, color: colors.textSoft }}>
              {guesses.map((g, i) => (
                <li key={i} style={{ padding: '4px 0' }}>
                  <span style={{ color: '#a33a37', marginRight: 6 }}>✗</span>
                  {g === SKIP ? t.skipped : placeName(byId.get(g)!, lang)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {done && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 6 }}>
            {GAME_NAME} #{number} · {state.status === 'won' ? t.won(state.solvedAt!) : t.lost}
          </div>
          <h2 style={{ fontFamily: typography.serif, fontSize: 26, color: colors.heading, margin: '0 0 10px', lineHeight: 1.2 }}>
            {state.status === 'lost' && <span style={{ fontSize: 18, color: colors.textSoft }}>{t.itWas} </span>}
            {name}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, margin: '0 0 8px', color: colors.text }}>{note}</p>
          <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 16px' }}>
            <a href={puzzle.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.textMuted }}>{t.source}</a>
          </p>

          {guide && (
            <a
              href={guide.href}
              onClick={() => track('related_guide_click', { guide_slug: guide.href.split('/').pop() ?? '', source: 'play', lang })}
              style={{
                display: 'block', textDecoration: 'none', color: 'inherit', background: colors.card,
                border: `1px solid ${colors.divider}`, borderLeft: `3px solid ${colors.accent}`, borderRadius: 4,
                padding: '14px 16px', marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 4 }}>{t.readGuide}</div>
              <div style={{ fontFamily: typography.serif, fontSize: 18, color: colors.heading, lineHeight: 1.3 }}>{guide.title} →</div>
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <button type="button" onClick={share} style={{
              padding: '12px 22px', fontSize: 15, fontWeight: 600, borderRadius: 4, border: 'none',
              background: colors.accent, color: colors.heading, cursor: 'pointer', fontFamily: typography.sans,
            }}>
              {t.share}
            </button>
            {minutesLeft !== null && <span style={{ fontSize: 13, color: colors.textSoft }}>{t.next(minutesLeft)}</span>}
          </div>
          {shareMsg && <div role="status" style={{ fontSize: 13, color: colors.textSoft, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{shareMsg}</div>}

          <p style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5, margin: '14px 0 22px' }}>
            {t.photo}: {puzzle.credit.author},{' '}
            {puzzle.credit.licenceUrl
              ? <a href={puzzle.credit.licenceUrl} target="_blank" rel="noopener noreferrer license" style={{ color: colors.textMuted }}>{puzzle.credit.licence}</a>
              : puzzle.credit.licence}
            ,{' '}
            <a href={puzzle.credit.page} target="_blank" rel="noopener noreferrer" style={{ color: colors.textMuted }}>{t.via}</a>
          </p>

          <StatsPanel stats={stats} lang={lang} highlight={state.status === 'won' ? state.solvedAt : undefined} />

          <div style={{ marginTop: 28 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

const linkButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: '6px 0', fontSize: 14, color: colors.textSoft,
  textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: typography.sans,
};

function StatsPanel({ stats, lang, highlight }: { stats: Stats; lang: Lang; highlight?: number }) {
  const t = COPY[lang];
  const max = Math.max(1, ...stats.distribution);
  const cells: Array<[string, number | string]> = [
    [t.played, stats.played], [t.winPct, stats.winPct], [t.streak, stats.streak], [t.maxStreak, stats.maxStreak],
  ];
  return (
    <section aria-label={t.stats} style={{ background: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 10 }}>{t.stats}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', marginBottom: 14 }}>
        {cells.map(([label, v]) => (
          <div key={label}>
            <div style={{ fontFamily: typography.serif, fontSize: 24, color: colors.heading }}>{v}</div>
            <div style={{ fontSize: 11, color: colors.textSoft }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: colors.textSoft, marginBottom: 6 }}>{t.distribution}</div>
      {stats.distribution.map((n, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
          <span style={{ width: 10 }}>{i + 1}</span>
          <span style={{
            display: 'inline-block', minWidth: 22, width: `${Math.max(8, (n / max) * 100)}%`, padding: '2px 6px', textAlign: 'right',
            background: highlight === i + 1 ? '#3c8d5a' : colors.divider, color: highlight === i + 1 ? '#fff' : colors.text, borderRadius: 2,
          }}>{n}</span>
        </div>
      ))}
    </section>
  );
}
