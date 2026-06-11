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

// Strips the email footer (unsubscribe/manage preferences) before web rendering.
// Handles multiple markup variants used across newsletter generations:
//   - New format (travel-magazine theme): <!-- FOOTER --> ... <!-- END FOOTER -->
//   - Legacy: class="footer", <tr> rows with unsubscribe, bare <p> paragraphs
export function stripEmailFooter(html: string): string {
  let result = html;

  // 1. Remove the whole `<!-- FOOTER --> ... <!-- END FOOTER -->` block used by
  //    the current travel-magazine template (footer is a bare <div>, not class=footer).
  result = result.replace(/<!--\s*FOOTER\s*-->[\s\S]*?<!--\s*END\s+FOOTER\s*-->/gi, '');

  // 2. Remove <td class="footer"> cells
  result = result.replace(/<td\s+class="footer"[^>]*>[\s\S]*?<\/td>/gi, '');

  // 3. Remove <div class="footer"> divs
  result = result.replace(/<div\s+class="footer"[^>]*>[\s\S]*?<\/div>/gi, '');

  // 4. Remove <tr> rows containing Unsubscribe / Manage preferences / "receiving this email"
  //    (negative lookahead prevents crossing <tr> boundaries so we never eat siblings)
  result = result.replace(
    /<tr\b[^>]*>(?:(?!<\/?tr\b)[\s\S])*?(?:[Uu]nsubscribe|[Mm]anage\s+preferences|receiving\s+this\s+email)(?:(?!<\/?tr\b)[\s\S])*?<\/tr>/g,
    ''
  );

  // 5. Remove standalone <p> paragraphs mentioning unsubscribe/manage preferences
  result = result.replace(
    /<p[^>]*>[^<]{0,200}(?:[Uu]nsubscribe|[Mm]anage\s+your\s+preferences|receiving\s+this\s+email)[^<]{0,200}<\/p>/g,
    ''
  );

  return result;
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

/**
 * Snap any date to its publishing Thursday (the most recent Thursday at
 * or before `now`, UTC). EVERY cron that derives the week slug MUST use
 * this — the 2026-05-01 incident happened because one endpoint computed
 * the slug from `now` directly and produced a phantom Friday-start week.
 * The logic was then duplicated across three route files, which is its
 * own drift risk; this is the single shared implementation.
 */
export function thursdayWeekStart(now: Date = new Date()): Date {
  const d = new Date(now);
  const daysSinceThursday = (d.getUTCDay() - 4 + 7) % 7; // Thu=0, Fri=1, ..., Wed=6
  d.setUTCDate(d.getUTCDate() - daysSinceThursday);
  return d;
}

/** Week slug for the edition publishing on the most recent Thursday. */
export function currentWeekSlug(now: Date = new Date()): string {
  return generateSlug(formatWeekRange(thursdayWeekStart(now)));
}

/**
 * Validates that LLM-generated newsletter HTML is a complete, sendable
 * document. Gemini occasionally truncates long outputs (token limits,
 * mid-stream errors) — without this gate, a half-document would be
 * archived and emailed to every subscriber with no human in the loop.
 *
 * Throws with a precise reason on failure so the cron can unmark its
 * ledger claim and let the watchdog retry a clean run.
 */
export function assertValidNewsletterHtml(
  html: string,
  opts: { lang: 'en' | 'pt'; minBytes?: number } = { lang: 'en' }
): void {
  const minBytes = opts.minBytes ?? 15_000;
  const fail = (reason: string): never => {
    throw new Error(
      `Newsletter HTML validation failed (${opts.lang}): ${reason}. ` +
      `Got ${html.length} chars starting "${html.slice(0, 80).replace(/\n/g, ' ')}…"`
    );
  };

  if (html.length < minBytes) fail(`too short (<${minBytes} bytes) — likely truncated generation`);
  const head = html.slice(0, 200).toLowerCase();
  if (!head.includes('<!doctype html') && !head.includes('<html')) fail('does not start with an HTML document');
  const tail = html.slice(-200).toLowerCase();
  if (!tail.includes('</html>')) fail('missing closing </html> — truncated output');
  if (!/oporto weekly/i.test(html)) fail('missing brand string');
  if (!/unsubscribe|cancelar subscri/i.test(html)) fail('missing unsubscribe link — footer dropped');
  if (opts.lang === 'pt' && !/lang="pt"/i.test(html)) fail('PT translation kept lang="en"');
}

export function generateSlug(weekRange: string): string {
  return weekRange
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Format a Thursday-publish date as a 7-day range, e.g. "April 16-22, 2026".
// If the range crosses a month boundary: "April 30 - May 6, 2026".
export function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

// Portuguese variant, e.g. "16-22 de abril de 2026" or
// "30 de abril - 6 de maio de 2026".
export function formatWeekRangePT(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString('pt-PT', { month: 'long' });
  const endMonth = end.toLocaleDateString('pt-PT', { month: 'long' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay}-${endDay} de ${startMonth} de ${year}`;
  }
  return `${startDay} de ${startMonth} - ${endDay} de ${endMonth} de ${year}`;
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
