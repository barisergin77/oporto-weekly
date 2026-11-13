/**
 * English subtitles under Portuguese event titles in the EN newsletter
 * (owner 2026-11-12). The site already shows `nameEn` in italics under the PT
 * name on event and venue pages; the email (and the homepage, which embeds
 * the archived edition) showed the PT title alone: "Floresta do Amazonas",
 * "The Immigrant, The Cure e Easy Street, de Charlie Chaplin".
 *
 * Deterministic: no model call. The gloss comes from the record's `nameEn`
 * (filled by the ~/oporto-name-en job, which runs before the Thursday freeze).
 * Pure string helpers, no network, tested by scripts/test-name-en-subtitles.ts.
 *
 * Each subtitle is wrapped in marker comments so it is
 *   - idempotent (a heading already followed by one is skipped), and
 *   - removable: the PT edition is translated FROM the archived EN HTML, so
 *     newsletter-pt strips these lines first (stripNameEnSubtitles).
 */

import type { EventRecord } from './events';

export const NAME_EN_OPEN = '<!--ow:name-en-->';
export const NAME_EN_CLOSE = '<!--/ow:name-en-->';

/** Same look as the event page's nameEn line, email-safe inline styles. */
const SUBTITLE_STYLE =
  "margin:2px 0 6px 0;font-family:Georgia,'Playfair Display',serif;font-size:15px;font-style:italic;color:#6b6b6b;line-height:1.4;";

const ALSO_ON_RE = /<!-- ALSO ON -->[\s\S]*?<!-- END ALSO ON -->/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', middot: '·',
};

/** Visible text of a heading's inner HTML, normalised for comparison. */
export function headingText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

const norm = (s: string) => headingText(s).toLowerCase();

/** The English gloss to show for `ev`, or null when there's nothing to add. */
export function subtitleFor(ev: Pick<EventRecord, 'name' | 'nameEn'>): string | null {
  const en = typeof ev.nameEn === 'string' ? ev.nameEn.trim() : '';
  if (!en || !ev.name) return null;
  return norm(en) === norm(ev.name) ? null : en;
}

export function renderNameEnSubtitle(text: string): string {
  return `${NAME_EN_OPEN}<p style="${SUBTITLE_STYLE}">${escapeHtml(text)}</p>${NAME_EN_CLOSE}`;
}

/**
 * Insert an italic English line directly after each event heading (Editor's
 * Picks and category sections) whose event has a `nameEn` that differs from
 * its name. `corpus` fills `nameEn` for extracted records that lack it (by
 * slug, then exact name). The "Also on" block is left alone.
 *
 * Headings are matched by their visible text, so all template variants work:
 * `<h3>Name</h3>`, `<h3><a href="…">Name</a></h3>` (our /event/ link or the
 * venue link Gemini wrote) and the older Georgia `<p>` titles.
 */
export function insertNameEnSubtitles(
  html: string,
  events: Array<Pick<EventRecord, 'name' | 'nameEn'> & { slug?: string }>,
  corpus: Array<Pick<EventRecord, 'slug' | 'name' | 'nameEn'>> = [],
): { html: string; added: number } {
  const bySlug = new Map(corpus.map((e) => [e.slug, e]));
  const byName = new Map(corpus.map((e) => [norm(e.name), e]));
  const subs = new Map<string, string>(); // normalised heading text → subtitle
  for (const ev of events) {
    if (!ev.name) continue;
    let sub = subtitleFor(ev);
    if (!sub && ev.nameEn === undefined) {
      const rec = (ev.slug && bySlug.get(ev.slug)) || byName.get(norm(ev.name));
      if (rec) sub = subtitleFor({ name: ev.name, nameEn: rec.nameEn });
    }
    if (sub) subs.set(norm(ev.name), sub);
  }
  if (subs.size === 0) return { html, added: 0 };

  // Protect "Also on" by swapping it out while we work.
  const parked: string[] = [];
  let out = html.replace(ALSO_ON_RE, (m) => `\u0000ALSO${parked.push(m) - 1}\u0000`);

  let added = 0;
  const headingRe = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*font-family:\s*Georgia[^>]*>([\s\S]*?)<\/p>/gi;
  out = out.replace(headingRe, (match, _tag, hInner, pInner, offset: number, whole: string) => {
    const sub = subs.get(norm(hInner ?? pInner ?? ''));
    if (!sub) return match;
    const rest = whole.slice(offset + match.length);
    if (rest.trimStart().startsWith(NAME_EN_OPEN)) return match; // already has one
    added++;
    return `${match}\n${renderNameEnSubtitle(sub)}`;
  });

  out = out.replace(/\u0000ALSO(\d+)\u0000/g, (_, i) => parked[Number(i)]);
  return { html: out, added };
}

/** Remove the subtitles again (PT translation input). */
export function stripNameEnSubtitles(html: string): string {
  return html.replace(/\n?<!--ow:name-en-->[\s\S]*?<!--\/ow:name-en-->/g, '');
}
