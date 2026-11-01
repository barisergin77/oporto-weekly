/**
 * Instagram cross-links (owner 2026-11-01). Pure constants + string helpers,
 * no env access, so client components can import this too.
 */

export const INSTAGRAM_URL = 'https://www.instagram.com/oportoweekly/';
export const INSTAGRAM_HANDLE = '@oportoweekly';

export const INSTAGRAM_CTA = {
  en: 'Follow us on Instagram',
  pt: 'Siga-nos no Instagram',
} as const;

/** One footer line for the email editions, styled like the footer's other links. */
export function instagramEmailLine(lang: 'en' | 'pt'): string {
  return `<p style="font-size:12px;color:#5a5a5a;margin:10px 0 0;"><a href="${INSTAGRAM_URL}" style="color:#1a1a2e;border-bottom:1px solid #c9a96e;text-decoration:none;">${INSTAGRAM_CTA[lang]}</a> ${INSTAGRAM_HANDLE}</p>`;
}

const IG_PARAGRAPH = /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*instagram\.com\/oportoweekly(?:(?!<\/p>)[\s\S])*<\/p>/i;

/**
 * Make sure the edition's footer carries exactly one canonical Instagram line
 * in the right language. The EN prompt asks for it verbatim, but the LLM (or
 * the PT translation) can drop or reword it, so this is the deterministic
 * guarantee. It goes right after the paragraph holding the unsubscribe link.
 * No unsubscribe link found = the HTML is left untouched.
 */
export function ensureInstagramFooter(html: string, lang: 'en' | 'pt'): string {
  const unsub = /api\/unsubscribe/i.exec(html);
  if (!unsub) return html;
  const pStart = html.lastIndexOf('<p', unsub.index);
  const regionStart = pStart >= 0 ? pStart : unsub.index;
  const head = html.slice(0, regionStart);
  let tail = html.slice(regionStart);
  const line = instagramEmailLine(lang);
  const existing = IG_PARAGRAPH.exec(tail);
  // Never replace a paragraph that also holds the unsubscribe link.
  if (existing && !/api\/unsubscribe/i.test(existing[0])) {
    return head + tail.slice(0, existing.index) + line + tail.slice(existing.index + existing[0].length);
  }
  if (existing) return html;
  const close = tail.indexOf('</p>');
  if (close < 0) return html;
  tail = tail.slice(0, close + 4) + '\n' + line + tail.slice(close + 4);
  return head + tail;
}
