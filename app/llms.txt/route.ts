/**
 * /llms.txt — a plain-text map of the site for AI assistants (llmstxt.org).
 *
 * GA4 showed "AI Assistant" as a real referral channel by 2026-10 (11 of ~160
 * sessions). Assistants cite pages they can read and attribute cleanly; this
 * gives them a current, factual summary with canonical URLs.
 * Regenerated hourly from the same data the pages use.
 * 2026-10-28: month hubs and a Portuguese section (PT key pages, /pt/eventos
 * month hubs, translated guides) — it used to list English pages only.
 */
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { blogDisplay, listBlogPosts, listBlogPostsPT } from '@/lib/blog';
import { listUpcomingEvents } from '@/lib/events';
import { listEventMonths, ptLabel, ptSlug } from '@/lib/event-months';
import { DAY_HUB_PATHS } from '@/lib/event-days';

export const revalidate = 3600;
const SITE = 'https://oportoweekly.com';

export function GET() {
  const latest = listNewsletters()[0];
  const upcoming = listUpcomingEvents().slice(0, 25);
  const guides = listBlogPosts();
  const latestPT = listNewslettersPT()[0];
  const guidesPT = listBlogPostsPT();
  // Current and coming months only — past hubs are archive, not "what's on".
  const thisMonth = new Date().toISOString().slice(0, 7);
  const months = listEventMonths().filter(
    (m) => `${m.year}-${String(m.month + 1).padStart(2, '0')}` >= thisMonth,
  );

  const lines = [
    '# Oporto Weekly',
    '',
    '> A free weekly newsletter and website about what to do in Porto, Portugal: concerts, exhibitions, festivals, markets, food and nightlife, curated every Thursday in English and European Portuguese.',
    '',
    'Oporto Weekly is written for visitors and locals in Porto. Each Thursday edition picks the five best things to do that week plus listings by category. Event pages give dates, venue, price and a short factual description. Guides cover neighbourhoods, food, wine cellars, viewpoints, shopping and nightlife.',
    '',
    '## Key pages',
    `- [Latest edition${latest ? ` (${latest.weekRange})` : ''}](${SITE}${latest ? `/archive/${latest.slug}` : '/'}): this week's picks`,
    `- [Upcoming Porto events](${SITE}/porto-events): everything currently listed`,
    `- [Things to do in Porto today](${SITE}/porto-events/today) and [this weekend](${SITE}/porto-events/this-weekend): updated hourly`,
    `- [Guides](${SITE}/blog): long-form Porto guides`,
    `- [Archive](${SITE}/archive): every past edition`,
    `- [Portuguese edition](${SITE}/pt): the same content in European Portuguese`,
    `- [Subscribe](${SITE}/): free, every Thursday morning`,
    '',
    '## Events by month',
    ...months.map((m) => `- [Porto events in ${m.label}](${SITE}/porto-events/${m.slug})`),
    '',
    '## Upcoming events',
    ...upcoming.map((e) => `- [${e.name}](${SITE}/event/${e.slug}): ${e.endDate && e.endDate !== e.date ? `${e.date.slice(0, 10)} to ${e.endDate}` : e.date.slice(0, 10)}, ${e.venue}${e.price ? ` — ${e.price}` : ''}`),
    '',
    '## Guides',
    ...guides.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.excerpt}`),
    '',
    '## Em português (European Portuguese)',
    `- [Agenda do Porto esta semana](${SITE}/pt): a edição da semana`,
    ...(latestPT ? [`- [Última edição (${latestPT.weekRange})](${SITE}/pt/arquivo/${latestPT.slug})`] : []),
    `- [O que fazer no Porto hoje](${SITE}${DAY_HUB_PATHS.today.pt}) e [este fim de semana](${SITE}${DAY_HUB_PATHS.weekend.pt}): atualizado de hora a hora`,
    ...months.map((m) => `- [Eventos no Porto em ${ptLabel(m)}](${SITE}/pt/eventos/${ptSlug(m)})`),
    `- [Arquivo](${SITE}/pt/arquivo): todas as edições`,
    `- [Guias](${SITE}/pt/blog)`,
    ...guidesPT.map((p) => {
      const d = blogDisplay(p, 'pt');
      return `- [${d.title}](${SITE}/pt/blog/${p.slug}): ${d.excerpt}`;
    }),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
