/**
 * Welcome email sent by /api/subscribe (backlog #8, 2026-11-09).
 *
 * Light theme matching the site and the newsletter (lib/design.ts), the date
 * of the subscriber's first edition instead of a fixed "this Thursday", links
 * to the archive and this weekend's page so new readers have something to open
 * right away, and a "reply to say hi" ask: a reply marks our sender as wanted
 * in the inbox, which helps every later Thursday email land outside spam.
 *
 * Pure: no file reads, so the subscribe route can never fail on it.
 */

import { colors, typography } from './design';

const SITE = 'https://oportoweekly.com';

// The design font stacks quote family names with ", which would end a
// style="…" attribute early.
const font = {
  serif: typography.serif.replace(/"/g, "'"),
  sans: typography.sans.replace(/"/g, "'"),
};

/** Editions go out Thursday morning; the send is done by ~10:15 UTC. */
const SEND_DONE_UTC_HOUR = 11;

/** The Thursday whose edition a subscriber who joins at `now` will get first. */
export function firstEditionDate(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 4 = Thursday
  let add = (4 - dow + 7) % 7;
  if (add === 0 && now.getUTCHours() >= SEND_DONE_UTC_HOUR) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

const fmt = (d: Date, lang: 'en' | 'pt') =>
  d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

const COPY = {
  en: {
    subject: 'Welcome to Oporto Weekly',
    heading: 'Welcome to Oporto Weekly',
    intro: 'Thanks for subscribing. Every Thursday morning you get one email with what\'s on in Porto that week: concerts, exhibitions, theatre, markets, family days and nights out, with five editor\'s picks at the top.',
    first: (date: string) => `Your first edition arrives on <strong>${date}</strong>.`,
    meanwhile: 'Until then:',
    links: [
      { href: `${SITE}/porto-events/this-weekend`, label: 'What\'s on in Porto this weekend' },
      { href: `${SITE}/archive`, label: 'Past editions, newest first' },
    ],
    reply: 'One small favour: hit reply and say hi. It tells your inbox you want these emails, so Thursday\'s edition doesn\'t end up in spam. Know an event we should cover? Reply with that too.',
    instagram: 'Follow us on Instagram',
    lang: 'en',
  },
  pt: {
    subject: 'Bem-vindo ao Oporto Weekly',
    heading: 'Bem-vindo ao Oporto Weekly',
    intro: 'Obrigado por subscrever. Todas as quintas-feiras de manhã recebe um email com o que se passa no Porto nessa semana: concertos, exposições, teatro, mercados, programas em família e saídas à noite, com cinco escolhas do editor no topo.',
    first: (date: string) => `A sua primeira edição chega na <strong>${date}</strong>.`,
    meanwhile: 'Até lá:',
    links: [
      { href: `${SITE}/pt/eventos/este-fim-de-semana`, label: 'O que fazer no Porto este fim de semana' },
      { href: `${SITE}/pt/arquivo`, label: 'Edições anteriores, da mais recente à mais antiga' },
    ],
    reply: 'Um pequeno favor: responda a este email com um olá. Assim a sua caixa de correio sabe que quer receber estes emails e a edição de quinta-feira não vai parar ao spam. Conhece um evento que devíamos incluir? Responda com isso também.',
    instagram: 'Siga-nos no Instagram',
    lang: 'pt',
  },
} as const;

export function welcomeEmail(lang: 'en' | 'pt', now: Date = new Date()): { subject: string; html: string } {
  const c = COPY[lang];
  const date = fmt(firstEditionDate(now), lang);
  const p = `margin:0 0 16px 0;font-family:${font.serif};font-size:17px;line-height:1.55;color:${colors.text};`;
  const links = c.links
    .map((l) => `<li style="margin:0 0 8px 0;"><a href="${l.href}" style="color:${colors.heading};text-decoration:underline;text-decoration-color:${colors.accent};">${l.label}</a></li>`)
    .join('');
  const html = `<!DOCTYPE html>
<html lang="${c.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;background:${colors.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${colors.card};border:1px solid ${colors.divider};">
<tr><td style="padding:32px 28px 8px 28px;border-top:4px solid ${colors.accent};">
<h1 style="margin:0 0 20px 0;font-family:${font.serif};font-size:28px;line-height:1.25;color:${colors.heading};">${c.heading}</h1>
<p style="${p}">${c.intro}</p>
<p style="${p}">${c.first(date)}</p>
<p style="${p}margin-bottom:8px;">${c.meanwhile}</p>
<ul style="margin:0 0 20px 0;padding-left:22px;font-family:${font.serif};font-size:17px;line-height:1.5;color:${colors.text};">${links}</ul>
<p style="${p}background:${colors.bgSoft};padding:14px 16px;border-left:3px solid ${colors.accent};">${c.reply}</p>
<p style="${p}"><a href="https://www.instagram.com/oportoweekly/" style="color:${colors.heading};text-decoration:underline;text-decoration-color:${colors.accent};">${c.instagram}</a> @oportoweekly</p>
</td></tr>
<tr><td style="padding:16px 28px;background:${colors.bgAlt};font-family:${font.sans};font-size:13px;color:${colors.textMuted};">© Oporto Weekly · Porto, Portugal · <a href="${SITE}" style="color:${colors.textMuted};">oportoweekly.com</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject: c.subject, html };
}
