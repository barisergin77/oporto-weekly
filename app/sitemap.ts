import { MetadataRoute } from 'next';
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { listBlogPosts } from '@/lib/blog';

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

  return [
    { url: 'https://oportoweekly.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://oportoweekly.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/porto-events', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://oportoweekly.com/pt', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/archive', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
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
