/**
 * Re-translate an edition's EN HTML into PT, overwriting the existing PT file.
 *
 * Use case: the EN HTML was patched after PT was archived (e.g. event
 * links injected, google.com URLs cleaned) and PT drifted out of sync.
 * Running this pulls the current EN state, translates, and writes a
 * fresh PT HTML so both languages show the same links/structure.
 *
 * The PT newsletter cron does this automatically for the current week;
 * this script is for historical editions.
 *
 * Usage:
 *   npm run retranslate-pt -- april-16-2026
 *   npm run retranslate-pt -- april-16-2026 --dry-run
 *
 * Writes:
 *   public/newsletters/<slug>-pt.html   (overwritten)
 */

import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-pro';
const FALLBACK = 'gemini-2.5-flash';

async function translateNewsletter(enHtml: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  // Same prompt the newsletter-pt cron uses.
  const prompt = `Translate the following HTML email newsletter from English to European Portuguese (pt-PT).

RULES:
- Translate ALL visible text to European Portuguese (pt-PT, not Brazilian).
- Keep event names, venue names, band names, and place names exactly as-is (proper nouns).
- Translate day abbreviations: Mon→Seg, Tue→Ter, Wed→Qua, Thu→Qui, Fri→Sex, Sat→Sáb, Sun→Dom.
- Translate common phrases: "Free"→"Gratuito", "More info"→"Mais info", "Get tickets"→"Comprar bilhetes", "Book"→"Reservar", "Unsubscribe"→"Cancelar subscrição", "Visit website"→"Visitar site".
- Use 24h time format (9 PM → 21h00).
- Change <html lang="en"> to <html lang="pt">.
- Keep ALL HTML structure, CSS classes, inline styles, links (href), and image URLs EXACTLY the same.
- Output ONLY the complete translated HTML. No markdown fences, no commentary.

HTML TO TRANSLATE:
${enHtml}`;

  async function callModel(model: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 65536 },
      }),
    });
    if (!res.ok) throw new Error(`${model} failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    return text.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
  }

  try {
    return await callModel(MODEL);
  } catch (err) {
    console.warn(`${MODEL} failed, falling back to ${FALLBACK}:`, err instanceof Error ? err.message : err);
    return await callModel(FALLBACK);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!slug) {
    console.error('Usage: npm run retranslate-pt -- <edition-slug> [--dry-run]');
    console.error('Example: npm run retranslate-pt -- april-16-2026');
    process.exit(1);
  }

  const enPath = path.join(process.cwd(), 'public', 'newsletters', `${slug}.html`);
  const ptPath = path.join(process.cwd(), 'public', 'newsletters', `${slug}-pt.html`);

  if (!fs.existsSync(enPath)) {
    console.error(`EN HTML not found: ${enPath}`);
    process.exit(1);
  }

  const enHtml = fs.readFileSync(enPath, 'utf-8');
  console.log(`📥 EN source: ${enPath} (${enHtml.length} bytes)`);

  // Quick audit so we know what's improving
  const enEventLinks = (enHtml.match(/href="https:\/\/oportoweekly\.com\/event\//g) ?? []).length;
  const enGoogleLinks = (enHtml.match(/href="https:\/\/www\.google\.com\/search/g) ?? []).length;
  console.log(`   EN has ${enEventLinks} event links, ${enGoogleLinks} google.com links`);

  if (fs.existsSync(ptPath)) {
    const beforePt = fs.readFileSync(ptPath, 'utf-8');
    const ptEventLinks = (beforePt.match(/href="https:\/\/oportoweekly\.com\/event\//g) ?? []).length;
    const ptGoogleLinks = (beforePt.match(/href="https:\/\/www\.google\.com\/search/g) ?? []).length;
    console.log(`   PT (before): ${ptEventLinks} event links, ${ptGoogleLinks} google.com links`);
  }

  console.log('\n🤖 Translating…');
  const ptHtml = await translateNewsletter(enHtml);
  const outEventLinks = (ptHtml.match(/href="https:\/\/oportoweekly\.com\/event\//g) ?? []).length;
  const outGoogleLinks = (ptHtml.match(/href="https:\/\/www\.google\.com\/search/g) ?? []).length;
  console.log(`   PT (after):  ${outEventLinks} event links, ${outGoogleLinks} google.com links (${ptHtml.length} bytes)`);

  if (dryRun) {
    console.log('\n🔎 Dry-run — not writing. First 400 chars of output:');
    console.log(ptHtml.slice(0, 400));
    return;
  }

  fs.writeFileSync(ptPath, ptHtml, 'utf-8');
  console.log(`\n✅ Wrote ${ptPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
