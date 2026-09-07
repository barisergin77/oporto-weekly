import { MetadataRoute } from 'next';
import { listNewsletters, listNewslettersPT } from '@/lib/archive';
import { listBlogPosts, listBlogPostsPT } from '@/lib/blog';
import { listEvents } from '@/lib/events';

// A page's lastmod is max(content date, last time its markup changed). Content
// here is often frozen (a sent edition, a past event) while the <head> is not,
// and a stale lastmod tells Google not to re-crawl — so a markup fix stays
// invisible and GSC re-validates against the pre-fix copy. That is exactly how
// the "Duplicate without user-selected canonical" validation failed on
// 2026-09-05: crawled Jul 4, fixed Jul 18, lastmod still said Jul 2.
const ARCHIVE_HREFLANG = new Date('2026-07-18T12:50:00Z'); // bidirectional hreflang on archive + home
const PT_NAMESPACE = new Date('2026-08-29T19:36:57Z'); // /pt/event, /pt/venue, /pt/blog + EN hreflang back-links

function notBefore(date: string | Date, revision: Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > revision ? d : revision;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const newsletters = listNewsletters();
  const archiveUrls = newsletters.map((n) => ({
    url: `https://oportoweekly.com/archive/${n.slug}`,
    lastModified: notBefore(n.sentAt, ARCHIVE_HREFLANG),
    // Not 'never': the body is evergreen but head markup can still be revised,
    // and 'never' discourages the re-crawl a markup fix depends on.
    changeFrequency: 'yearly' as const,
    priority: 0.7,
  }));

  const blogPosts = listBlogPosts();
  const blogUrls = blogPosts.map((p) => ({
    url: `https://oportoweekly.com/blog/${p.slug}`,
    lastModified: notBefore(p.publishedAt, PT_NAMESPACE),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  // PT blog articles — only those that have been translated.
  const blogUrlsPT = listBlogPostsPT().map((p) => ({
    url: `https://oportoweekly.com/pt/blog/${p.slug}`,
    lastModified: notBefore(p.publishedAt, PT_NAMESPACE),
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
    // 'yearly' rather than 'never' for past events: the body is evergreen but
    // head markup still gets revised, and 'never' suppresses the re-crawl.
    const changeFrequency = (isPast ? 'yearly' : 'weekly') as 'yearly' | 'weekly';
    const priority = isPast ? 0.6 : 0.9;
    // Both language variants gained hreflang (and /pt/event was created) on
    // PT_NAMESPACE, so neither may advertise a lastmod older than that.
    const lastModified = notBefore(e.addedAt, PT_NAMESPACE);
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
    const lastModified = notBefore(lastAdded ?? new Date(), PT_NAMESPACE);
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
      lastModified: notBefore(n.sentAt, ARCHIVE_HREFLANG),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ];
}
