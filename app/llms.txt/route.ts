/**
 * /llms.txt — a plain-text map of the site for AI assistants (llmstxt.org).
 *
 * GA4 showed "AI Assistant" as a real referral channel by 2026-10 (11 of ~160
 * sessions). Assistants cite pages they can read and attribute cleanly; this
 * gives them a current, factual summary with canonical URLs.
 * Regenerated hourly from the same data the pages use.
 */
import { listNewsletters } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';
import { listUpcomingEvents } from '@/lib/events';

export const revalidate = 3600;
const SITE = 'https://oportoweekly.com';

export function GET() {
  const latest = listNewsletters()[0];
  const upcoming = listUpcomingEvents().slice(0, 25);
  const guides = listBlogPosts();

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
    '## Upcoming events',
    ...upcoming.map((e) => `- [${e.name}](${SITE}/event/${e.slug}): ${e.endDate && e.endDate !== e.date ? `${e.date.slice(0, 10)} to ${e.endDate}` : e.date.slice(0, 10)}, ${e.venue}${e.price ? ` — ${e.price}` : ''}`),
    '',
    '## Guides',
    ...guides.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.excerpt}`),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
