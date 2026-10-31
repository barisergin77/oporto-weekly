import { icsResponse, icsStaticParams } from '@/lib/event-ics-route';

/** /event/<slug>/calendar.ics — the "Add to calendar" download (lib/event-calendar.ts). */

export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = icsStaticParams;

export function GET(_req: Request, { params }: { params: { slug: string } }) {
  return icsResponse(params.slug, 'en');
}
