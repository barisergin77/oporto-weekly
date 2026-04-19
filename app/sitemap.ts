import { MetadataRoute } from 'next';
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';
import { listEvents } from '@/lib/events';

export default function sitemap(): MetadataRoute.Sitemap {
  const newsletters = listNewsletters();
  const archiveUrls = newsletters.map((n) => ({
    url: `https://oportoweekly.com/archive/${n.slug}`,
    lastModified: new Date(n.sentAt),
    changeFrequency: 'never' as const,
    priority: 0.7,
  }));

  const blogPosts = listBlogPosts();
  const blogUrls = blogPosts.map((p) => ({
    url: `https://oportoweekly.com/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Individual event pages. Priority 0.9 (upcoming) vs 0.6 (past) because
  // upcoming events match specific high-intent searches ("tito paris porto");
  // past ones are evergreen archive.
  const today = new Date().toISOString().slice(0, 10);
  const eventUrls = listEvents().map((e) => {
    const isPast = (e.endDate ?? e.date) < today;
    return {
      url: `https://oportoweekly.com/event/${e.slug}`,
      lastModified: new Date(e.addedAt),
      changeFrequency: (isPast ? 'never' : 'weekly') as 'never' | 'weekly',
      priority: isPast ? 0.6 : 0.9,
    };
  });

  return [
    { url: 'https://oportoweekly.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://oportoweekly.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/porto-events', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://oportoweekly.com/pt', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/archive', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...eventUrls,
    ...blogUrls,
    ...archiveUrls,
    { url: 'https://oportoweekly.com/pt/arquivo', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    ...listNewslettersPT().map((n) => ({
      url: `https://oportoweekly.com/pt/arquivo/${n.slug}`,
      lastModified: new Date(n.sentAt),
      changeFrequency: 'never' as const,
      priority: 0.6,
    })),
  ];
}
