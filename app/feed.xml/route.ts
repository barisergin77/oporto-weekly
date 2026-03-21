import { listNewsletters, getNewsletterHtml, stripEmailFooter } from '@/lib/archive';

export const dynamic = 'force-static';

export function GET() {
  const newsletters = listNewsletters();
  const site = 'https://oportoweekly.com';

  const items = newsletters
    .map((n) => {
      const html = getNewsletterHtml(n.slug);
      const content = html ? stripEmailFooter(html) : '';
      const pubDate = new Date(n.sentAt).toUTCString();
      const url = `${site}/archive/${n.slug}`;

      return `
    <item>
      <title><![CDATA[${n.weekRange} — Porto Events Guide]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${n.description}]]></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <category>Porto Events</category>
      <category>Porto Guide</category>
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Oporto Weekly — Porto Events &amp; Culture</title>
    <link>${site}</link>
    <description>The best events, culture, food, and things to do in Porto — curated every Thursday morning.</description>
    <language>en-gb</language>
    <copyright>© Oporto Weekly</copyright>
    <managingEditor>hello@oportoweekly.com (Oporto Weekly)</managingEditor>
    <webMaster>hello@oportoweekly.com (Oporto Weekly)</webMaster>
    <ttl>10080</ttl>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>
    <atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
    <image>
      <url>${site}/opengraph-image</url>
      <title>Oporto Weekly</title>
      <link>${site}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
