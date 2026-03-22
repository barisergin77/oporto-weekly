import fs from 'fs';
import path from 'path';

export interface NewsletterMeta {
  slug: string;
  title: string;
  weekRange: string;
  sentAt: string;
  description: string;
}

export function listNewsletters(): NewsletterMeta[] {
  const filePath = path.join(process.cwd(), 'data', 'newsletters.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as NewsletterMeta[];
}

export function getNewsletterMeta(slug: string): NewsletterMeta | null {
  const all = listNewsletters();
  return all.find((n) => n.slug === slug) ?? null;
}

export function getNewsletterHtml(slug: string): string | null {
  const filePath = path.join(process.cwd(), 'public', 'newsletters', `${slug}.html`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

// Strips the email footer div before web rendering
export function stripEmailFooter(html: string): string {
  return html.replace(/<div class="footer">[\s\S]*?<\/div>\s*(<\/div>\s*)?(<\/body>[\s\S]*)?$/, '</div>\n</body>\n</html>');
}

// Replaces the newsletter header (title + tagline) with the hero banner image,
// keeping the date line visible below it.
export function replaceHeaderWithBanner(html: string): string {
  const bannerImg = `<img src="/hero-banner.png" alt="Oporto Weekly — Your Curated Guide to Porto" ` +
    `style="width:100%;max-width:640px;display:block;margin:0 auto;" />`;

  // Extract a date string from anywhere in the header area
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[-–]\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{1,2},?\s*\d{4}/i;

  // Try class="header" (div or td)
  const classHeaderPattern = /(<(?:div|td)\s+class="header"[^>]*>)([\s\S]*?)(<\/(?:div|td)>)/i;

  if (classHeaderPattern.test(html)) {
    return html.replace(classHeaderPattern, (_match, openTag, content, closeTag) => {
      const dateMatch = content.match(datePattern);
      const dateHtml = dateMatch
        ? `<p style="color:#c9a96e;font-size:18px;margin:12px 0 0;padding:0 20px;">${dateMatch[0]}</p>`
        : '';

      return openTag.replace(/padding:[^;"]+/g, 'padding:0') +
        bannerImg + dateHtml +
        `<div style="height:3px;background-color:#c9a96e;margin-top:16px;"></div>` +
        closeTag;
    });
  }

  // Fallback: find header by inline background + "Oporto Weekly" text
  const inlinePattern = /(<(?:div|td|table)[^>]*style="[^"]*background[^"]*#1a1a2e[^"]*"[^>]*>)([\s\S]*?Oporto Weekly[\s\S]*?)(<\/(?:div|td|table)>)/i;

  if (inlinePattern.test(html)) {
    return html.replace(inlinePattern, (_match, openTag, content, closeTag) => {
      const dateMatch = content.match(datePattern);
      const dateHtml = dateMatch
        ? `<p style="color:#c9a96e;font-size:18px;margin:12px 0 0;padding:0 20px;text-align:center;">${dateMatch[0]}</p>`
        : '';

      return openTag.replace(/padding:[^;"]+/g, 'padding:0') +
        bannerImg + dateHtml +
        `<div style="height:3px;background-color:#c9a96e;margin-top:16px;"></div>` +
        closeTag;
    });
  }

  return html;
}

// ---------- Portuguese archive ----------

export function listNewslettersPT(): NewsletterMeta[] {
  const filePath = path.join(process.cwd(), 'data', 'newsletters-pt.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as NewsletterMeta[];
}

export function getNewsletterMetaPT(slug: string): NewsletterMeta | null {
  return listNewslettersPT().find((n) => n.slug === slug) ?? null;
}

export function getNewsletterHtmlPT(slug: string): string | null {
  const filePath = path.join(process.cwd(), 'public', 'newsletters', `${slug}.html`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

// ---------- Utilities ----------

export function generateSlug(weekRange: string): string {
  return weekRange
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Called by cron after sending — appends to newsletters.json and writes HTML file
export function saveNewsletter(
  meta: Omit<NewsletterMeta, never>,
  html: string
): void {
  const htmlPath = path.join(process.cwd(), 'public', 'newsletters', `${meta.slug}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const indexPath = path.join(process.cwd(), 'data', 'newsletters.json');
  const existing: NewsletterMeta[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const filtered = existing.filter((e) => e.slug !== meta.slug);
  fs.writeFileSync(indexPath, JSON.stringify([meta, ...filtered], null, 2), 'utf-8');
}

// Same but for Portuguese editions
export function saveNewsletterPT(
  meta: Omit<NewsletterMeta, never>,
  html: string
): void {
  const htmlPath = path.join(process.cwd(), 'public', 'newsletters', `${meta.slug}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const indexPath = path.join(process.cwd(), 'data', 'newsletters-pt.json');
  const existing: NewsletterMeta[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const filtered = existing.filter((e) => e.slug !== meta.slug);
  fs.writeFileSync(indexPath, JSON.stringify([meta, ...filtered], null, 2), 'utf-8');
}
