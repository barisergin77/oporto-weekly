import fs from 'fs';
import path from 'path';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  heroImage: string;   // e.g. "/blog/images/best-rooftop-bars-porto-hero.webp"
  images: string[];    // additional inline images
  tags: string[];
  /** European-Portuguese title/excerpt for /pt/blog. Populated by the
   *  blog-translations cron; the PT body HTML lives at <slug>-pt.html. */
  titlePt?: string;
  excerptPt?: string;
}

const BLOG_INDEX = path.join(process.cwd(), 'data', 'blog-posts.json');

export function listBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_INDEX)) return [];
  return JSON.parse(fs.readFileSync(BLOG_INDEX, 'utf-8')) as BlogPost[];
}

export function getBlogPost(slug: string): BlogPost | null {
  return listBlogPosts().find(p => p.slug === slug) ?? null;
}

export function getBlogPostHtml(slug: string): string | null {
  const filePath = path.join(process.cwd(), 'public', 'blog', `${slug}.html`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

/** PT-translated article body, if it exists (public/blog/<slug>-pt.html). */
export function getBlogPostHtmlPT(slug: string): string | null {
  const filePath = path.join(process.cwd(), 'public', 'blog', `${slug}-pt.html`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

/** True when a Portuguese version of this post has been generated. */
export function hasBlogPT(slug: string): boolean {
  return fs.existsSync(path.join(process.cwd(), 'public', 'blog', `${slug}-pt.html`));
}

/** Posts that have a Portuguese translation — for /pt/blog listing + params. */
export function listBlogPostsPT(): BlogPost[] {
  return listBlogPosts().filter((p) => hasBlogPT(p.slug));
}

/** Display fields for a post in a given language, with EN fallback. */
export function blogDisplay(p: BlogPost, lang: 'en' | 'pt') {
  if (lang === 'pt') {
    return { title: p.titlePt ?? p.title, excerpt: p.excerptPt ?? p.excerpt };
  }
  return { title: p.title, excerpt: p.excerpt };
}

export function generateBlogSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 60);
}
