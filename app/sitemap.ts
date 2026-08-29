import { MetadataRoute } from 'next';
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { listBlogPosts, listBlogPostsPT } from '@/lib/blog';
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
  // PT blog articles — only those that have been translated.
  const blogUrlsPT = listBlogPostsPT().map((p) => ({
    url: `https://oportoweekly.com/pt/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Individual event pages. Priority 0.9 (upcoming) vs 0.6 (past) because
  // upcoming events match specific high-intent searches ("tito paris porto");
  // past ones are evergreen archive.
  const today = new Date().toISOString().slice(0, 10);
  const events = listEvents();
  const eventUrls = events.flatMap((e) => {
    const isPast = (e.endDate ?? e.date) < today;
    const changeFrequency = (isPast ? 'never' : 'weekly') as 'never' | 'weekly';
    const priority = isPast ? 0.6 : 0.9;
    const lastModified = new Date(e.addedAt);
    return [
      { url: `https://oportoweekly.com/event/${e.slug}`, lastModified, changeFrequency, priority },
      // PT event page — slightly lower priority than the EN original.
      { url: `https://oportoweekly.com/pt/event/${e.slug}`, lastModified, changeFrequency, priority: priority - 0.1 },
    ];
  });

  // Venue aggregation pages — dedupe by venueSlug, one URL per venue.
  // High priority (0.85) because they rank well for "<venue> events" queries
  // and stay useful over time (always up to date as new events are indexed).
  const venueSlugs = Array.from(
    new Set(events.map((e) => e.venueSlug).filter((s): s is string => Boolean(s)))
  );
  const venueUrls = venueSlugs.flatMap((slug) => {
    const venueEvents = events.filter((e) => e.venueSlug === slug);
    const lastAdded = venueEvents.map((e) => e.addedAt).sort().pop();
    const lastModified = lastAdded ? new Date(lastAdded) : new Date();
    return [
      { url: `https://oportoweekly.com/venue/${slug}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.85 },
      { url: `https://oportoweekly.com/pt/venue/${slug}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.75 },
    ];
  });

  return [
    { url: 'https://oportoweekly.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://oportoweekly.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/porto-events', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://oportoweekly.com/pt', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://oportoweekly.com/pt/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://oportoweekly.com/archive', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...eventUrls,
    ...venueUrls,
    ...blogUrls,
    ...blogUrlsPT,
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
