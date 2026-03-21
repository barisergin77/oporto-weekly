import { MetadataRoute } from 'next';
import { listNewsletters } from '@/lib/archive';

export default function sitemap(): MetadataRoute.Sitemap {
  const newsletters = listNewsletters();
  const archiveUrls = newsletters.map((n) => ({
    url: `https://oportoweekly.com/archive/${n.slug}`,
    lastModified: new Date(n.sentAt),
    changeFrequency: 'never' as const,
    priority: 0.7,
  }));

  return [
    { url: 'https://oportoweekly.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://oportoweekly.com/porto-events', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://oportoweekly.com/pt', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/archive', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...archiveUrls,
  ];
}
