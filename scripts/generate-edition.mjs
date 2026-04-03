#!/usr/bin/env node
// Usage: node scripts/generate-edition.mjs "March 12-19, 2026"
// Generates EN + PT HTML newsletters and saves them to public/newsletters/ + data/*.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load .env.local
const envFile = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIdx = line.indexOf('=');
  const key = line.slice(0, eqIdx).trim();
  let val = line.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  // Strip literal \n sequences that Vercel env pull sometimes appends
  val = val.replace(/\\n/g, '').trim();
  process.env[key] = val;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const weekRange = process.argv[2];
if (!weekRange) { console.error('Usage: node scripts/generate-edition.mjs "March 12-19, 2026"'); process.exit(1); }

const SEARCH_QUERIES = [
  `Porto events ${weekRange}`,
  `Porto concerts ${weekRange}`,
  `Porto art exhibitions ${weekRange}`,
  `Porto food markets weekend ${weekRange}`,
  `Porto family events ${weekRange}`,
  `Porto nightlife ${weekRange}`,
];

async function geminiSearch(query) {
  console.log(`  Searching: ${query}`);
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('\n') ?? '';
  return `=== ${query} ===\n${text}`;
}

async function generateHtml(researchData, dateLabel) {
  console.log('  Generating EN HTML...');
  const prompt = `You are the editor of "Oporto Weekly", a curated newsletter about events in Porto, Portugal.

The edition covers: ${dateLabel}. Based on the research below, generate a COMPLETE HTML email newsletter.

RESEARCH DATA:
${researchData}

NEWSLETTER STRUCTURE (follow exactly):
1. Dark header: background #1a1a2e, white title "Oporto Weekly", gold (#c9a96e) accents and week date
2. Editor's Picks — top 5 must-see events this week
3. Music & Concerts
4. Art & Exhibitions
5. Food Markets & Wine
6. Family
7. Nightlife
8. Tip of the Week — one practical Porto insider tip

For EACH event include:
- Event name (bold)
- Date & time
- Venue name
- Price (or "Free")
- 1-2 sentence description
- "More info →" link (use real URL from research if available, otherwise link to google search)

DESIGN REQUIREMENTS:
- Full HTML document with inline styles only (email-safe)
- Background: #1a1a2e (dark navy)
- Header bg: #1a1a2e with gold (#c9a96e) divider line
- Card bg: #16213e
- Body text: #ccd6f6
- Accent/headings: #c9a96e (gold)
- Section headers: white text on #0f3460 background
- Max width: 600px, centered
- Mobile-friendly, table-based layout for email clients
- Footer: unsubscribe note, "© Oporto Weekly · Porto, Portugal"

Output ONLY the complete HTML. No markdown, no explanation.`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 65536 },
    }),
  });
  if (!res.ok) throw new Error(`Generation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let html = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

async function translateHtml(enHtml) {
  console.log('  Translating to PT...');
  const prompt = `Translate the following HTML newsletter from English to European Portuguese (pt-PT).

RULES:
- Translate ALL text content to Portuguese, including section headers, descriptions, tips, footer text
- Keep event names and venue names as-is (they are proper nouns)
- Translate day abbreviations: Mon→Seg, Tue→Ter, Wed→Qua, Thu→Qui, Fri→Sex, Sat→Sáb, Sun→Dom
- Translate "Free"→"Gratuito", "More info"→"Mais info", "Get tickets"→"Comprar bilhetes"
- Use 24h time format (9 PM → 21h)
- Change <html lang="en"> to <html lang="pt">
- Keep ALL HTML structure, CSS, classes, links, and styling exactly the same
- Keep all URLs unchanged
- Output ONLY the complete translated HTML. No markdown, no explanation.

HTML TO TRANSLATE:
${enHtml}`;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 65536 },
    }),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let html = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
  return html;
}

// Strip email-only footer content before saving to web
// Removes: "You are receiving this email..." and "Unsubscribe | Manage preferences"
// Keeps: copyright line and all other content
function stripEmailFooter(html) {
  // Remove the "receiving this email" paragraph
  html = html.replace(/<p[^>]*>\s*You are receiving this email[^<]*<\/p>/gi, '');
  // Remove the Unsubscribe | Manage preferences paragraph
  html = html.replace(/<p[^>]*>\s*<a[^>]*>\s*Unsubscribe\s*<\/a>[^<]*<a[^>]*>[^<]*<\/a>\s*<\/p>/gi, '');
  // PT versions
  html = html.replace(/<p[^>]*>\s*Está a receber este e-mail[^<]*<\/p>/gi, '');
  html = html.replace(/<p[^>]*>\s*<a[^>]*>\s*Cancelar subscri[^<]*<\/a>[^<]*<a[^>]*>[^<]*<\/a>\s*<\/p>/gi, '');
  return html;
}

function generateSlug(str) {
  return str.toLowerCase().replace(/[–—]/g, '-').replace(/,/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function saveEdition(slug, meta, html, indexFile) {
  const htmlPath = path.join(ROOT, 'public', 'newsletters', `${slug}.html`);
  const webHtml = stripEmailFooter(html);
  fs.writeFileSync(htmlPath, webHtml, 'utf-8');
  console.log(`  Saved: ${htmlPath}`);

  const indexPath = path.join(ROOT, 'data', indexFile);
  const existing = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const filtered = existing.filter(e => e.slug !== slug);
  fs.writeFileSync(indexPath, JSON.stringify([meta, ...filtered], null, 2), 'utf-8');
  console.log(`  Updated: ${indexPath}`);
}

// Main
(async () => {
  console.log(`\nGenerating edition: ${weekRange}\n`);

  // 1. Research
  console.log('Step 1: Research...');
  const searchResults = [];
  for (const query of SEARCH_QUERIES) {
    const result = await geminiSearch(query);
    searchResults.push(result);
    await new Promise(r => setTimeout(r, 2000));
  }
  const researchData = searchResults.join('\n\n');

  // 2. Generate EN HTML
  console.log('\nStep 2: Generate EN newsletter...');
  const enHtml = await generateHtml(researchData, weekRange);
  const enSlug = generateSlug(weekRange);
  const now = new Date().toISOString();

  saveEdition(enSlug, {
    slug: enSlug,
    title: `Oporto Weekly — ${weekRange}`,
    description: `Porto events and culture guide for ${weekRange}`,
    sentAt: now,
    weekRange,
  }, enHtml, 'newsletters.json');

  // 3. Translate to PT
  console.log('\nStep 3: Generate PT translation...');
  const ptHtml = await translateHtml(enHtml);
  const ptSlug = enSlug + '-pt';

  saveEdition(ptSlug, {
    slug: ptSlug,
    title: `Oporto Weekly — ${weekRange}`,
    description: `Eventos no Porto: ${weekRange}`,
    sentAt: now,
    weekRange,
  }, ptHtml, 'newsletters-pt.json');

  console.log('\nDone! EN + PT editions generated and saved.');
})();
