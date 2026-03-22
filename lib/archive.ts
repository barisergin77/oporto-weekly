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
  // Pattern 1: div.header or td.header with nested content
  // Replace "Oporto Weekly" title and "Your Curated Guide" tagline with banner,
  // but preserve the date line
  let result = html;

  // Extract date text from the header (look for date-like text)
  const dateMatch = result.match(
    /class="header-date"[^>]*>([^<]+)</i
  ) || result.match(
    /(?:March|April|May|June|July|August|September|October|November|December|January|February)\s+\d{1,2}\s*[-–]\s*(?:March|April|May|June|July|August|September|October|November|December|January|February)?\s*\d{1,2},?\s*\d{4}/i
  );

  const bannerHtml = `<div style="text-align:center;padding:0;">` +
    `<img src="/hero-banner.png" alt="Oporto Weekly — Your Curated Guide to Porto" ` +
    `style="width:100%;max-width:640px;display:block;margin:0 auto;border-radius:4px 4px 0 0;" />` +
    `</div>`;

  // Try replacing div.header or td.header block
  // Match the header element and everything inside it up to its closing tag
  const headerPatterns = [
    // <div class="header">...</div>
    /(<div\s+class="header"[^>]*>)([\s\S]*?)(<\/div>)/i,
    // <td class="header" ...>...</td>
    /(<td\s+class="header"[^>]*>)([\s\S]*?)(<\/td>)/i,
  ];

  for (const pattern of headerPatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, (match, openTag, content, closeTag) => {
        // Keep the date line if found in this block
        const dateInBlock = content.match(
          /(<[^>]*class="header-date"[^>]*>[^<]*<\/[^>]+>)/i
        );
        const dateHtml = dateInBlock ? dateInBlock[1] : '';

        return openTag.replace(/padding:[^;"]+/g, 'padding:0') +
          bannerHtml +
          (dateHtml ? `<div style="background:#1a1a2e;padding:12px 0 20px;text-align:center;">${dateHtml}</div>` : '') +
          closeTag;
      });
      return result;
    }
  }

  // Fallback: if no class="header" found, try to find the header by inline styles
  // Look for the first big block with background #1a1a2e containing "Oporto Weekly"
  const inlineHeaderPattern = /(<(?:div|td|table)[^>]*style="[^"]*background[^"]*#1a1a2e[^"]*"[^>]*>)([\s\S]*?Oporto Weekly[\s\S]*?)(<\/(?:div|td|table)>)/i;
  if (inlineHeaderPattern.test(result)) {
    result = result.replace(inlineHeaderPattern, (match, openTag, content, closeTag) => {
      // Try to find a date in the content
      const dateInContent = content.match(
        /((?:March|April|May|June|July|August|September|October|November|December|January|February)\s+\d{1,2}\s*[-–]\s*(?:March|April|May|June|July|August|September|October|November|December|January|February)?\s*\d{1,2},?\s*\d{4})/i
      );
      const dateText = dateInContent ? dateInContent[1] : '';

      return openTag.replace(/padding:[^;"]+/g, 'padding:0') +
        bannerHtml +
        (dateText ? `<div style="background:#1a1a2e;padding:12px 0 20px;text-align:center;"><p style="font-size:14px;color:#c9a96e;">${dateText}</p></div>` : '') +
        closeTag;
    });
  }

  return result;
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
