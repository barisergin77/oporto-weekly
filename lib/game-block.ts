/**
 * Porto Zoom teaser for the weekly email, injected at send time only (like
 * lib/forward-block.ts; the archived web copy stays as is). One-edition trial
 * approved by the owner on 2026-11-07 ("game 1"): it runs only on the Lisbon
 * dates in TRIAL, then we decide whether it gets a smaller permanent spot.
 *
 * The image is a pre-cut close-up (zoom step 2) of that day's puzzle, saved
 * under a neutral name in public/play/email/ so the URL doesn't give the
 * answer away. CC credit = author + licence, full credits on /play/credits.
 */

import { lisbonDate } from './play';

const MARKER = '<!-- ow-game-block -->';
const SITE = 'https://oportoweekly.com';
const UTM = 'utm_source=newsletter&utm_medium=email&utm_campaign=porto_zoom';

const TRIAL: Record<string, { image: string; credit: string }> = {
  '2026-11-12': { image: '/play/email/cc32940a53.jpg', credit: 'Edgar Jiménez, CC BY-SA 2.0' },
};

const COPY = {
  en: {
    eyebrow: 'NEW · PORTO ZOOM',
    title: 'Can you name this Porto spot?',
    body: 'Our daily photo game: start with a close-up, zoom out with every guess. Five tries, a new spot every day.',
    cta: 'Play today’s puzzle',
    path: '/play',
    photo: 'Photo',
    credits: 'credits',
  },
  pt: {
    eyebrow: 'NOVO · PORTO ZOOM',
    title: 'Consegue adivinhar este lugar do Porto?',
    body: 'O nosso jogo diário de fotografia: começa num grande plano e afasta-se a cada palpite. Cinco tentativas, um lugar novo todos os dias.',
    cta: 'Jogar o puzzle de hoje',
    path: '/pt/jogar',
    photo: 'Foto',
    credits: 'créditos',
  },
} as const;

export function gameBlockHtml(lang: 'en' | 'pt', date: string = lisbonDate()): string | null {
  const day = TRIAL[date];
  if (!day) return null;
  const c = COPY[lang];
  const href = `${SITE}${c.path}?${UTM}`;
  const creditsHref = `${SITE}${lang === 'en' ? '/play/credits' : '/pt/jogar/creditos'}`;
  return `${MARKER}
<div style="background-color:#ffffff;padding:32px 28px;text-align:center;border-top:1px solid #e5dfd3;">
  <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#c9a96e;margin:0 0 12px;">${c.eyebrow}</div>
  <div style="font-family:Georgia,'Playfair Display',serif;font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 16px;">${c.title}</div>
  <a href="${href}" style="text-decoration:none;"><img src="${SITE}${day.image}" width="480" alt="${c.title}" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto 6px;border-radius:4px;border:0;"></a>
  <p style="font-family:'Inter',Arial,sans-serif;font-size:10px;color:#8a8170;margin:0 0 16px;">${c.photo}: ${day.credit} · <a href="${creditsHref}" style="color:#8a8170;">${c.credits}</a></p>
  <p style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:#3a3a3a;margin:0 0 20px;">${c.body}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>
    <td style="background:#c9a96e;border-radius:4px;"><a href="${href}" style="display:inline-block;padding:12px 24px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#1a1a2e;text-decoration:none;">🧩 ${c.cta}</a></td>
  </tr></table>
</div>
`;
}

/** Insert the block just before the forward block (or the footer, or </body>). Idempotent; no-op outside TRIAL dates. */
export function withGameBlock(html: string, lang: 'en' | 'pt', date?: string): string {
  if (html.includes(MARKER)) return html;
  const block = gameBlockHtml(lang, date);
  if (!block) return html;
  for (const re of [/<!-- ow-forward-block -->/, /<div[^>]*background:\s*#efe8da/i, /<\/body>/i]) {
    const at = html.search(re);
    if (at >= 0) return html.slice(0, at) + block + html.slice(at);
  }
  return html;
}
