/**
 * Humanizer rules for every LLM call that writes reader-facing text
 * (owner 2026-10-31: "make sure to use a humanizer skill when creating
 * articles/texts"). Condensed from the humanizer skill (Wikipedia "Signs of AI
 * writing", ~/.claude/skills/humanizer/SKILL.md v2.5.1) for a Porto events and
 * culture publication, EN and PT-PT.
 *
 * Append HUMANIZER_RULES to the prompt of a call that writes prose (newsletter,
 * blog, captions, event descriptions, translations). Do NOT add it to pure
 * extraction / classification / slug-picking / image-prompt calls.
 *
 * humanizeText / humanizeHtml are the cheap deterministic post-pass: em dashes
 * out, curly quotes straightened. They never touch tags, attributes, URLs or
 * <style>/<script> blocks. Tests: npm run test:humanizer.
 */

export const HUMANIZER_RULES = `
HUMAN WRITING RULES (apply to every reader-facing word, in English and in European Portuguese):
The text must read like a person from Porto wrote it, not a language model. The task's own rules above (format, tone, length, emojis, CTAs) still apply and win if they conflict with these.

Punctuation
- NO em dashes (—) at all, in either language. Use a comma, a colon, a full stop or parentheses. If a sentence "needs" an em dash, it usually wants to be two sentences.
- Straight quotes only (" and '), never curly ones.
- Emojis only where the task above asks for them. Never as decoration on every line.

Words to avoid (EN): delve, tapestry, testament, pivotal, crucial, vibrant, nestled, seamless, elevate, unlock, leverage, foster, robust, comprehensive, game-changer, cutting-edge, navigate (figurative), realm, landscape (figurative), underscore, showcase, boasts, breathtaking, stunning, unmissable, must-see, hidden gem, immerse yourself, experience the magic, in today's world, when it comes to.
Words to avoid (PT-PT): vibrante, imperdível, deslumbrante, mágico/a, autêntica joia, mergulhe em, não perca, uma experiência única, rico/a tapeçaria, no coração de (as filler), sem dúvida.

Sentence patterns to avoid
- Negative parallelism: "It's not just a concert, it's an experience" / "Não é apenas um mercado, é...". Say the thing.
- Rule-of-three padding: "music, food and good vibes" when the idea has one or two parts. Use the number of items the facts have.
- Superficial -ing tails: "...on the riverfront, offering stunning views of Gaia" / "..., proporcionando uma experiência...". Cut them or make a real sentence.
- Copula avoidance: write "is"/"é", not "serves as", "stands as", "funciona como".
- Significance inflation: no "a testament to Porto's cultural heritage", "marks a pivotal moment", "reflects the city's soul".
- Vague attributions: no "experts say", "many consider", "é considerado por muitos". Name the source or drop it.
- Hedging stacks ("could potentially perhaps"), filler openings ("It is important to note that", "In order to", "Vale a pena referir que"), signposting ("Let's dive in", "Here's what you need to know").
- Generic upbeat wrap-ups ("Whatever your taste, Porto has something for everyone"). End on a concrete fact or tip.

Voice
- Concrete beats general: the venue, the street, the metro stop, the price, the time. Never "various events" or "a range of activities".
- Vary sentence length. Mix short ones with longer ones.
- Where the task asks for a warm or editorial voice, react like a local ("Get there before 22h, the queue for the terrace is long"). Where it asks for a neutral, factual voice, stay neutral.
- Never add facts, numbers, quotes or claims that are not in the source material.
- Translations: keep the meaning, write the PT-PT the way a Portuguese editor would (not word-for-word, not Brazilian), and apply these rules to the translation even if the source breaks them.

The test: read it back. If a line sounds like a press release or a content farm, rewrite it the way you would say it to a friend over a coffee at a café in Bonfim.
`.trim();

// ---------------------------------------------------------------------------
// Deterministic post-pass
// ---------------------------------------------------------------------------

/** Em dash, horizontal bar, and a spaced double hyphen used as a dash. */
const DASH = /\u2014|\u2015|&mdash;|&#8212;|&#x2014;/i;

function straightenQuotes(s: string): string {
  return s
    .replace(/[\u201C\u201D\u201E\u201F\u2033]|&ldquo;|&rdquo;|&bdquo;|&#822[01];/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]|&lsquo;|&rsquo;|&sbquo;|&#821[67];/g, "'");
}

function normaliseDashes(s: string): string {
  return s
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '\u2014')
    .replace(/\u2015/g, '\u2014')
    .replace(/(\S) -- (\S)/g, '$1 \u2014 $2');
}

/**
 * Replaces em dashes inside one run of text.
 * - digit\u2014digit (a range) -> "-"
 * - plain text: a dash at the start of a line -> "- " (keeps a list bullet), at the end -> removed
 * - HTML: a dash at the start/end of a block element's text -> removed
 * - a dash at the end of the run / before closing punctuation -> removed
 * - in a title, a single " \u2014 " -> ": "
 * - otherwise -> ", " (and a comma doubled with other punctuation collapses)
 */
function replaceDashes(s: string, opts: { title?: boolean; html?: boolean; atBlockStart?: boolean; atBlockEnd?: boolean } = {}): string {
  if (!DASH.test(s) && !s.includes(' -- ')) return s;
  let t = normaliseDashes(s);
  if (!t.includes('\u2014')) return t;

  t = t.replace(/(\d)\s*\u2014\s*([€$£]?\d)/g, "$1-$2");
  if (opts.atBlockStart) t = t.replace(/^(\s*)\u2014\s*/, '$1');
  if (opts.atBlockEnd) t = t.replace(/\s*\u2014(\s*)$/, '$1');
  if (!opts.html) {
    // Plain text only: in HTML a newline is just whitespace and the run's
    // edges may sit next to an inline tag (handled by atBlockStart/End).
    t = t.replace(/(^|\n)([ \t]*)\u2014[ \t]*/g, '$1$2- ');
    t = t.replace(/[ \t]*\u2014[ \t]*(?=\n|$)/g, '');
  }
  t = t.replace(/\s*\u2014\s*(?=[.,;:!?)\]])/g, '');
  t = t.replace(/\(\s*\u2014\s*/g, '(');

  if (opts.title && (t.match(/\u2014/g) ?? []).length === 1) {
    t = t.replace(/\s*\u2014\s*/, ': ');
  }
  t = t.replace(/([.,;:!?])\s*\u2014\s*/g, '$1 ');
  t = t.replace(/\s*\u2014\s*/g, ', ');
  // Tidy what the replacements can leave behind.
  t = t.replace(/,\s*,/g, ',').replace(/,\s*([.;:!?])/g, '$1').replace(/\(\s*,\s*/g, '(').replace(/([.;:!?]) ,/g, '$1');
  return t;
}

/** Post-pass for plain text (captions, descriptions, titles, excerpts). */
export function humanizeText(text: string, opts: { title?: boolean } = {}): string {
  if (!text) return text;
  return replaceDashes(straightenQuotes(text), { title: opts.title });
}

const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'cite', 'code', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u']);

function isInlineTag(tag: string | undefined): boolean {
  if (!tag) return false;
  const m = tag.match(/^<\/?\s*([a-zA-Z0-9]+)/);
  return !!m && INLINE_TAGS.has(m[1].toLowerCase());
}

/**
 * Post-pass for HTML (newsletter editions, blog bodies). Only text between
 * tags changes; tags, attributes, comments, <style>, <script> and <title> stay
 * byte-for-byte the same.
 */
export function humanizeHtml(html: string): string {
  if (!html) return html;
  const parts = html.split(/(<!--[\s\S]*?-->|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<title[\s\S]*?<\/title>|<[^>]+>)/i);
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i];
    if (!text || !/[\u2014\u2015\u2018\u2019\u201A-\u201F\u2032\u2033&]|--/.test(text)) continue;
    const prev = parts[i - 1];
    const next = parts[i + 1];
    parts[i] = replaceDashes(straightenQuotes(text), {
      html: true,
      atBlockStart: prev === undefined || !isInlineTag(prev),
      atBlockEnd: next === undefined || !isInlineTag(next),
    });
  }
  return parts.join('');
}
