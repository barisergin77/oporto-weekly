/**
 * Side-by-side check for the Gemini 2.5 Flash -> 3.8 Flash switch (Gemini 2.5 retires 1 Dec 2026).
 * Run once per model (FLASH is read at import, so the model comes from the environment), then diff:
 *
 *   GEMINI_FLASH_MODEL=gemini-2.5-flash npx tsx --env-file=.env.local scripts/gemini-compare.ts run tmp-compare/a.json
 *   GEMINI_FLASH_MODEL=gemini-3.8-flash npx tsx --env-file=.env.local scripts/gemini-compare.ts run tmp-compare/b.json
 *   npx tsx scripts/gemini-compare.ts diff tmp-compare/a.json tmp-compare/b.json
 *
 * Sample: the latest EN edition (extractEventsFromHtml), the 8 most recently added events with an external
 * link (sweep double-check reader, extractPageFields) and 3 of them through translateEventFields. ~12 calls per run.
 */
import fs from 'fs';
import path from 'path';

const [mode, a, b] = process.argv.slice(2);

function pageText(html: string) {
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function run(out: string) {
  const { FLASH } = await import('../lib/gemini-models');
  const { extractEventsFromHtml, translateEventFields } = await import('../lib/events-pipeline');
  const { extractPageFields } = await import('../lib/sweep-double-check');
  const res: Record<string, unknown> = { model: FLASH };

  const edition = fs.readdirSync('public/newsletters').filter((f) => /-2026\.html$/.test(f))
    .sort((x, y) => fs.statSync(path.join('public/newsletters', y)).mtimeMs - fs.statSync(path.join('public/newsletters', x)).mtimeMs)[0];
  const t0 = Date.now();
  const evs = await extractEventsFromHtml(fs.readFileSync(path.join('public/newsletters', edition), 'utf8'), edition, []);
  res.edition = { file: edition, ms: Date.now() - t0, events: evs.map((e) => ({ name: e.name, date: e.date, venue: e.venue, price: e.price, url: e.externalLink })) };

  const recent = fs.readdirSync('data/events').map((f) => JSON.parse(fs.readFileSync(path.join('data/events', f), 'utf8')))
    .filter((e) => e.externalLink && e.addedAt).sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt))).slice(0, 8);
  const pages: unknown[] = [];
  for (const e of recent) {
    try {
      const r = await fetch(e.externalLink, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
      const text = pageText(await r.text());
      const f = await extractPageFields(text, e.externalLink, { name: e.name, date: e.date });
      pages.push({ slug: e.slug, url: e.externalLink, name: f.name, date: f.date, time: f.time, endDate: f.endDate, venue: f.venue, price: f.price, priceFrom: f.priceFrom, isFree: f.isFree });
    } catch (err) { pages.push({ slug: e.slug, error: String(err).slice(0, 160) }); }
  }
  res.pages = pages;

  const tr: unknown[] = [];
  for (const e of recent.slice(0, 3)) {
    try { tr.push({ slug: e.slug, ...(await translateEventFields(e)) }); } catch (err) { tr.push({ slug: e.slug, error: String(err).slice(0, 160) }); }
  }
  res.translations = tr;
  fs.writeFileSync(out, JSON.stringify(res, null, 2));
  console.log(`wrote ${out} (${FLASH})`);
}

const norm = (v: unknown) => (v == null ? '' : String(v).trim().toLowerCase().replace(/\s+/g, ' '));

function diff(fa: string, fb: string) {
  const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
  console.log(`${A.model} vs ${B.model}`);
  let same = 0, total = 0;
  const cmp = (label: string, x: any, y: any, keys: string[]) => {
    for (const k of keys) {
      total++;
      if (norm(x?.[k]) === norm(y?.[k])) same++;
      else console.log(`  ${label} ${k}: ${JSON.stringify(x?.[k])} | ${JSON.stringify(y?.[k])}`);
    }
  };
  const ea = A.edition.events, eb = B.edition.events;
  console.log(`edition ${A.edition.file}: ${ea.length} vs ${eb.length} events (${A.edition.ms} vs ${B.edition.ms} ms)`);
  const byName = new Map(eb.map((e: any) => [norm(e.name), e]));
  for (const e of ea) {
    const o = byName.get(norm(e.name));
    if (!o) { console.log(`  only in A: ${e.name}`); total++; continue; }
    cmp(`[edition] ${e.name.slice(0, 40)}`, e, o, ['date', 'venue', 'price', 'url']); total++; same++;
  }
  for (const e of eb) if (!ea.some((x: any) => norm(x.name) === norm(e.name))) { console.log(`  only in B: ${e.name}`); total++; }
  A.pages.forEach((p: any, i: number) => cmp(`[page] ${p.slug.slice(0, 40)}`, p, B.pages[i], ['error', 'name', 'date', 'time', 'endDate', 'venue', 'priceFrom', 'isFree']));
  A.translations.forEach((t: any, i: number) => cmp(`[pt] ${t.slug.slice(0, 40)}`, t, B.translations[i], ['error']));
  console.log(`match ${same}/${total} (${Math.round((100 * same) / total)}%)`);
}

if (mode === 'run' && a) run(a).catch((e) => { console.error(e); process.exit(1); });
else if (mode === 'diff' && a && b) diff(a, b);
else { console.error('usage: gemini-compare.ts run OUT.json | diff A.json B.json'); process.exit(2); }
