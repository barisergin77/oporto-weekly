import { listNewsletters } from '@/lib/archive';

export const dynamic = 'force-static';

export function GET() {
  const newsletters = listNewsletters();

  const items = newsletters
    .map((n) => {
      const pubDate = new Date(n.sentAt).toISOString();
      const url = `https://oportoweekly.com/archive/${n.slug}`;
      return `
  <url>
    <loc>${url}</loc>
    <news:news>
      <news:publication>
        <news:name>Oporto Weekly</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${n.weekRange} — Porto Events Guide</news:title>
      <news:keywords>Porto events, Porto guide, things to do in Porto, Porto culture</news:keywords>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
