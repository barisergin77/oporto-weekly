import { icsResponse, icsStaticParams } from '@/lib/event-ics-route';

/** /pt/event/<slug>/calendar.ics — ficheiro .ics com o nome e a descrição em português. */

export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = icsStaticParams;

export function GET(_req: Request, { params }: { params: { slug: string } }) {
  return icsResponse(params.slug, 'pt');
}
