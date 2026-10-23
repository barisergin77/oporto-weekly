/**
 * "Forward to a friend" block, injected into the weekly edition email at send
 * time only (the archived web copy stays as is). BACKLOG #6, owner-approved
 * 2026-10-21. Pure string transform: idempotent, and a no-op if the footer
 * anchor and </body> are both missing.
 */

const MARKER = '<!-- ow-forward-block -->';
const SITE = 'https://oportoweekly.com';
const UTM = 'utm_source=newsletter&utm_medium=email&utm_campaign=forward';

const COPY = {
  en: {
    eyebrow: 'SHARE THE WEEKEND',
    title: 'Know someone who’d enjoy this?',
    body: 'Forward this email to a friend in Porto, or send them the link to get Oporto Weekly free every Thursday.',
    cta: 'Share by email',
    signup: 'Signup link',
    mailSubject: 'Oporto Weekly: what’s on in Porto this week',
    mailBody: (signup: string, edition?: string) =>
      `Thought you'd like this: a free weekly email with the best things to do in Porto.\n\n` +
      (edition ? `This week's edition: ${edition}\n` : '') +
      `Sign up: ${signup}`,
    home: `${SITE}/`,
  },
  pt: {
    eyebrow: 'PARTILHE O FIM DE SEMANA',
    title: 'Conhece alguém que vai gostar?',
    body: 'Reencaminhe este email a um amigo no Porto, ou envie-lhe o link para receber a Oporto Weekly grátis todas as quintas-feiras.',
    cta: 'Partilhar por email',
    signup: 'Link de inscrição',
    mailSubject: 'Oporto Weekly: o que fazer no Porto esta semana',
    mailBody: (signup: string, edition?: string) =>
      `Lembrei-me de ti: um email semanal gratuito com o melhor para fazer no Porto.\n\n` +
      (edition ? `Edição desta semana: ${edition}\n` : '') +
      `Inscreve-te aqui: ${signup}`,
    home: `${SITE}/pt`,
  },
} as const;

export function forwardBlockHtml(lang: 'en' | 'pt', editionUrl?: string): string {
  const c = COPY[lang];
  const signup = `${c.home}?${UTM}`;
  const mailto = `mailto:?subject=${encodeURIComponent(c.mailSubject)}&body=${encodeURIComponent(c.mailBody(signup, editionUrl))}`;
  const link = 'color:#1a1a2e;border-bottom:1px solid #c9a96e;text-decoration:none;';
  return `${MARKER}
<div style="background-color:#faf7f0;padding:36px 28px;text-align:center;border-top:1px solid #e5dfd3;">
  <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#c9a96e;margin:0 0 12px;">${c.eyebrow}</div>
  <div style="font-family:Georgia,'Playfair Display',serif;font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 12px;">${c.title}</div>
  <p style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:#3a3a3a;margin:0 0 20px;">${c.body}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;"><tr>
    <td style="background:#1a1a2e;border-radius:4px;"><a href="${mailto}" style="display:inline-block;padding:12px 24px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#ffffff;text-decoration:none;">${c.cta}</a></td>
  </tr></table>
  <p style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#5a5a5a;margin:0;">${c.signup}: <a href="${signup}" style="${link}">${c.home.replace('https://', '').replace(/\/$/, '')}</a></p>
</div>
`;
}

/** Insert the block before the footer (or before </body>). */
export function withForwardBlock(html: string, lang: 'en' | 'pt', editionUrl?: string): string {
  if (html.includes(MARKER)) return html;
  const block = forwardBlockHtml(lang, editionUrl);
  const footer = html.search(/<div[^>]*background:\s*#efe8da/i);
  if (footer >= 0) return html.slice(0, footer) + block + html.slice(footer);
  const body = html.search(/<\/body>/i);
  if (body >= 0) return html.slice(0, body) + block + html.slice(body);
  return html;
}
