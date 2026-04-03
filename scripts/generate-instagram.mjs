#!/usr/bin/env node
// Usage: node scripts/generate-instagram.mjs [slug]
// Generates Instagram image (via nano-banana-pro) + caption for the latest (or specified) edition.
// Steps:
//   1. Load latest edition from data/newsletters.json
//   2. Parse top 5 editor's picks from the HTML
//   3. Generate Instagram image with nano-banana-pro
//   4. Write caption (EN + PT) to projects/oporto-weekly/latest-instagram.md
//   5. Schedule via Buffer (if --post flag passed)

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WORKSPACE = path.join(ROOT, '..'); // ~/.openclaw/workspace

// Load .env.local
const envFile = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const eqIdx = line.indexOf('=');
  const key = line.slice(0, eqIdx).trim();
  let val = line.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  val = val.replace(/\\n/g, '').trim();
  process.env[key] = val;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BUFFER_API_KEY = 'zhR3BWV7iy_fOGH6-lfwCPQMrSmA6_vuplUZYnz0jSW';
const BUFFER_CHANNEL_ID = '69bfb432af47dacb69420430';

const slugArg = process.argv[2];
const doPost = process.argv.includes('--post');

// ─── Step 1: Load edition ────────────────────────────────────────────────────

const newslettersPath = path.join(ROOT, 'data', 'newsletters.json');
const editions = JSON.parse(fs.readFileSync(newslettersPath, 'utf-8'));
const edition = slugArg ? editions.find(e => e.slug === slugArg) : editions[0];

if (!edition) {
  console.error(`Edition not found: ${slugArg || '(latest)'}`);
  process.exit(1);
}

console.log(`\nGenerating Instagram content for: ${edition.title}\n`);

const htmlPath = path.join(ROOT, 'public', 'newsletters', `${edition.slug}.html`);
const html = fs.readFileSync(htmlPath, 'utf-8');

// ─── Step 2: Parse top 5 picks from HTML ────────────────────────────────────

function parseTopPicks(html) {
  const picks = [];
  // Match event name + venue + price blocks
  const eventRegex = /<strong[^>]*color:\s*#c9a96e[^>]*>([^<]+)<\/strong>[\s\S]*?<strong>(?:Venue|Local):<\/strong>\s*([^<]+)<\/p>[\s\S]*?<strong>(?:Price|Preço):<\/strong>\s*([^<]+)<\/p>/g;
  let match;
  while ((match = eventRegex.exec(html)) !== null && picks.length < 5) {
    picks.push({
      name: match[1].trim(),
      venue: match[2].trim(),
      price: match[3].trim(),
    });
  }
  return picks;
}

const picks = parseTopPicks(html);
if (picks.length === 0) {
  console.error('Could not parse events from HTML. Check the newsletter format.');
  process.exit(1);
}

console.log(`Parsed ${picks.length} picks:`);
picks.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} @ ${p.venue} (${p.price})`));

// ─── Step 3: Generate Instagram image with nano-banana-pro ──────────────────

const weekRange = edition.weekRange;
const timestamp = new Date().toISOString().replace(/[:\-T]/g, '-').slice(0, 19).replace(/--/g, '-');
const outputFilename = `${timestamp}-oporto-weekly-instagram.png`;
const outputPath = path.join(WORKSPACE, 'projects', 'oporto-weekly', outputFilename);

// Map event name keywords to thumbnail visual descriptions
function getThumbnailDescription(name, venue) {
  const n = name.toLowerCase();
  const v = (venue || '').toLowerCase();
  if (n.includes('trap') || n.includes('rap') || n.includes('hip hop')) return 'packed festival crowd with stage lights and smoke';
  if (n.includes('tame impala') || n.includes('concert') || n.includes('arena') || v.includes('arena') || v.includes('coliseu')) return 'sold-out concert hall with dramatic stage lighting and crowd';
  if (n.includes('techno') || n.includes('electronic') || n.includes('dj') || v.includes('gare') || v.includes('club') || v.includes('pérola')) return 'dark club interior with colorful DJ booth lights and dancing crowd';
  if (n.includes('film') || n.includes('cinema') || n.includes('festival') && n.includes('film')) return 'vintage cinema marquee with golden lights';
  if (n.includes('candlelight') || n.includes('classical') || n.includes('orchestra')) return 'intimate candlelit concert hall with warm amber glow and musicians';
  if (n.includes('cross') || n.includes('procession') || n.includes('religious') || n.includes('easter')) return 'atmospheric night procession with candles through old stone streets';
  if (n.includes('football') || n.includes('fc porto') || n.includes('futebol')) return 'football stadium at night with floodlights and roaring crowd';
  if (n.includes('jazz')) return 'intimate jazz bar with warm lighting and musicians on stage';
  if (n.includes('fado')) return 'fado singer in traditional setting with warm amber lighting';
  if (n.includes('market') || n.includes('mercado')) return 'colourful outdoor market with fresh produce and vendors';
  if (n.includes('art') || n.includes('exhibition') || n.includes('gallery') || n.includes('museu')) return 'modern art gallery with dramatic spotlit artwork';
  if (n.includes('wine') || n.includes('vinho') || n.includes('food') || n.includes('gastro')) return 'elegant wine tasting with Porto cityscape at golden hour';
  if (n.includes('family') || n.includes('kids') || n.includes('children')) return 'joyful outdoor family event in sunny Porto square';
  if (n.includes('termómetro') || n.includes('termometro') || n.includes('festival')) return 'outdoor music festival crowd in Porto with stage and colourful lights';
  return 'vibrant Porto street scene at night with warm golden lights';
}

const picksWithThumbnails = picks.map((p, i) => {
  const thumb = getThumbnailDescription(p.name, p.venue);
  const label = p.price && p.price.toLowerCase() !== 'check tickets' && p.price.toLowerCase() !== 'check program' ? ` (${p.price})` : '';
  return `${i + 1}. ${p.name} — ${p.venue}${label}\n   thumbnail: ${thumb}`;
}).join('\n');

const imagePrompt = `Design a polished Instagram post (square 1:1) for "Oporto Weekly" — a weekly Porto events newsletter.

STYLE (match exactly):
- Background: deep dark navy #1a1a2e
- Header: large bold white serif font "OPORTO WEEKLY" at top center
- Gold (#c9a96e) ornamental divider line below the header
- Week label in gold: "WEEK ${weekRange.toUpperCase()}"
- Section title: "TOP PICKS THIS WEEK" in white with gold flourishes
- 5 event listings in rows, each with:
  - Gold line-art icon on the left (music note, film reel, candle, football, etc.)
  - Event name in bold white uppercase
  - Venue in gold italic
  - On the RIGHT side of each row: a small realistic photo thumbnail matching the event — actual photographic imagery, NOT placeholder boxes, NOT text, NOT borders with "placeholder" written — real-looking editorial photography
- Beige vintage/textured border around the whole image
- Footer: "OPORTO WEEKLY" logo bottom left, @oportoweekly bottom right
- Overall: elegant, editorial, upscale magazine feel

EVENTS TO LIST (with thumbnail visual guide):
${picksWithThumbnails}

CRITICAL: Each thumbnail on the right MUST be a real-looking atmospheric photo. No placeholder boxes. No empty rectangles. No "IMAGE" text. Actual photographic-style imagery that evokes the event atmosphere.`;

console.log(`\nGenerating image with nano-banana-pro...`);
console.log(`Output: ${outputPath}\n`);

const scriptPath = `${process.env.HOME}/.openclaw/workspace/skills/nano-banana-pro/scripts/generate_image.py`;

if (!fs.existsSync(scriptPath)) {
  console.error(`nano-banana-pro script not found at: ${scriptPath}`);
  process.exit(1);
}

try {
  execSync(
    `uv run "${scriptPath}" --prompt "${imagePrompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}" --filename "${outputPath}" --resolution 2K --api-key "${GEMINI_API_KEY}"`,
    { stdio: 'inherit', timeout: 120000 }
  );
} catch (err) {
  console.error('Image generation failed:', err.message);
  process.exit(1);
}

// Copy to latest-post.png for reference
fs.copyFileSync(outputPath, path.join(WORKSPACE, 'projects', 'oporto-weekly', 'latest-post.png'));
console.log(`\nCopied to latest-post.png`);

// ─── Step 4: Generate caption ────────────────────────────────────────────────

console.log('\nGenerating Instagram caption...');

const picksForCaption = picks.map((p, i) => `${i + 1}. ${p.name} @ ${p.venue}`).join('\n');

async function generateCaption() {
  const prompt = `Write a short Instagram caption for Oporto Weekly's weekly post.

Week: ${weekRange}
Top picks this week:
${picksForCaption}

Rules:
- 2-3 sentences max, punchy and warm
- Include 1-2 relevant emojis
- End with: 🔗 Link in bio for full guide
- Then add a PT translation (label it "🇵🇹 PT:")
- Then a hashtag block (15-20 tags, mix of #porto #events #oporto #portugal etc.)
- Keep it natural, not corporate

Output format:
[EN caption]

🇵🇹 PT:
[PT caption]

[hashtag block]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Caption generation failed: ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
}

const caption = await generateCaption();

const captionPath = path.join(WORKSPACE, 'projects', 'oporto-weekly', 'latest-instagram.md');
const captionContent = `# Instagram Post — ${edition.title}

**Image:** ${outputFilename}
**Week:** ${weekRange}

## Caption
${caption}

---
*Generated: ${new Date().toISOString()}*
`;

fs.writeFileSync(captionPath, captionContent, 'utf-8');
console.log(`Caption saved to: ${captionPath}`);
console.log('\n--- CAPTION PREVIEW ---');
console.log(caption);
console.log('--- END CAPTION ---\n');

// ─── Step 5: Post via Buffer (optional) ─────────────────────────────────────

if (doPost) {
  console.log('\nPosting to Buffer...');

  // Buffer requires a public image URL — host locally or use a file upload approach
  // For now, we output instructions since Buffer needs a public URL
  console.log(`
⚠️  Buffer requires a publicly-accessible image URL.
Image saved at: ${outputPath}

To post manually:
1. Open Buffer (buffer.com)
2. Upload: ${outputPath}
3. Paste caption from: ${captionPath}
4. Schedule for Friday morning

OR: Deploy the image to oportoweekly.com/public/ and pass the URL to Buffer API.
  `);
} else {
  console.log(`\nDone! To schedule via Buffer, run with --post flag.`);
  console.log(`\nSummary:`);
  console.log(`  Image:   ${outputPath}`);
  console.log(`  Caption: ${captionPath}`);
}
