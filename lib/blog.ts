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

export function generateBlogSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 60);
}
