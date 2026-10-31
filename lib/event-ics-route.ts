/**
 * Shared GET for /event/<slug>/calendar.ics and /pt/event/<slug>/calendar.ics
 * (lib/event-calendar.ts). Prerendered for every event at build, like the
 * event pages themselves.
 */

import { eventDisplay, getEvent, listEvents } from './events';
import { buildIcs } from './event-calendar';

const SITE = 'https://oportoweekly.com';

export const icsStaticParams = () => listEvents().map((e) => ({ slug: e.slug }));

export function icsResponse(slug: string, lang: 'en' | 'pt'): Response {
  const ev = getEvent(slug);
  if (!ev) return new Response('Not found', { status: 404 });
  const disp = eventDisplay(ev, lang);
  const url = `${SITE}${lang === 'pt' ? '/pt/event/' : '/event/'}${ev.slug}`;
  const body = buildIcs(ev, { title: disp.name, description: disp.description, location: `${ev.venue}, Porto`, url });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ev.slug}.ics"`,
      // A calendar file is not a page; keep it out of search results.
      'X-Robots-Tag': 'noindex',
    },
  });
}
