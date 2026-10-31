/**
 * Local dry run of the Thursday composition — renders the edition to a file.
 * Never archives, commits, writes data/, touches the run ledger or sends.
 * Uses the local data/events (+ optionally a local daily scan held in
 * memory) and calls Gemini for the scan / top-up / generation / extraction.
 *
 *   npm run compose-dry-run -- --week 2026-10-29 --out /tmp/edition.html [--scan] [--topup] [--force-compose]
 *
 *   --scan           run today's daily scan first (no PT / images, nothing written)
 *   --topup          run the Thursday top-up search too
 *   --force-compose  compose even if the window is below the fallback thresholds
 *
 * Without GEMINI_API_KEY (or when the window would fall back to the legacy
 * path) it writes a deterministic PREVIEW of the composition's input instead:
 * the picks pool's top five, the sections by category and the "Also on" block
 * exactly as it would be inserted — no model copy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { listEvents, type EventRecord } from '../lib/events';
import { runForwardScan, runTopUp } from '../lib/forward-scan';
import { planEdition, generateNewsletter, recentPickNames, FALLBACK_HERO_URL } from '../lib/newsletter-generate';
import {
  selectEditionEvents, eventDigest, insertAlsoOn, renderAlsoOn, longRunsNotFeatured, mergeEventFiles,
} from '../lib/edition-compose';
import { formatWeekRange, generateSlug, assertValidNewsletterHtml } from '../lib/archive';
import { extractEventsFromHtml, injectEventLinks } from '../lib/events-pipeline';
import { blocklistCorrections, type BlockedPick } from '../lib/pick-blocklist';
import { whenText, insertFromTheBlog, renderFromTheBlog, type EditionSelection } from '../lib/edition-compose';
import { listBlogPosts } from '../lib/blog';
import { newsletterGuide } from '../lib/related-guides';
import { choosePicks, presetPicks, pickLogLine } from '../lib/opus-picks';
import { CATEGORY_LABEL } from '../lib/events';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Model-free preview of what the composition would work from. */
function renderPreview(sel: EditionSelection, weekRange: string, note: string): string {
  const card = (e: EventRecord, i?: number) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e5dfd3;font-family:Arial,sans-serif;font-size:14px;color:#3a3a3a;">` +
    `${i != null ? `<b style="color:#c9a96e;">${i}.</b> ` : ''}<a href="https://oportoweekly.com/event/${esc(e.slug)}" style="color:#1a1a2e;font-weight:600;">${esc(e.name)}</a>` +
    `<br><span style="color:#6b6b6b;">${esc(whenText(e))} · ${esc(e.venue)}${e.price ? ` · ${esc(e.price)}` : ''}${e.pickCandidate ? ' · pick candidate' : ''}</span>` +
    `<br>${esc(e.description)}</td></tr>`;
  const section = (title: string, list: EventRecord[], numbered = false) =>
    `<h2 style="font-family:Georgia,serif;color:#1a1a2e;margin:28px 0 8px;">${esc(title)} <small style="color:#c9a96e;font-size:12px;">${list.length}</small></h2>` +
    (list.length ? `<table width="100%" cellpadding="0" cellspacing="0">${list.map((e, i) => card(e, numbered ? i + 1 : undefined)).join('')}</table>` : '<p style="color:#6b6b6b;">(none)</p>');
  const cats = Array.from(new Set(sel.short.map((e) => e.category)));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Composition preview — ${esc(weekRange)}</title></head>
<body style="background:#efe8da;margin:0;"><div style="max-width:640px;margin:0 auto;background:#faf7f0;padding:28px;">
<p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#c9a96e;margin:0;">COMPOSITION PREVIEW (NO MODEL COPY)</p>
<h1 style="font-family:Georgia,serif;color:#1a1a2e;margin:6px 0;">${esc(weekRange)}</h1>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#3a3a3a;">${esc(note)}</p>
${section("Editor's Picks pool (top 5)", sel.pickPool.slice(0, 5), true)}
${cats.map((c) => section(CATEGORY_LABEL[c], sel.short.filter((e) => e.category === c))).join('')}
${renderAlsoOn(sel.longRuns) || '<p>(no long runs)</p>'}
</div></body></html>`;
}

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(name);

async function main() {
  const week = arg('--week') ?? '2026-10-29';
  const out = arg('--out') ?? `/tmp/edition-${week}.html`;
  const weekStart = new Date(`${week}T08:00:00Z`);
  if (weekStart.getUTCDay() !== 4) throw new Error(`--week must be a Thursday (got ${week})`);
  const weekStartISO = week;
  const weekEndISO = new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const weekRange = formatWeekRange(weekStart);
  const slug = generateSlug(weekRange);
  let gemini = 0;

  let corpus: EventRecord[] = listEvents();
  console.log(`${corpus.length} local events; edition ${slug} (${weekStartISO} → ${weekEndISO})`);

  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  if (!hasKey) console.log('GEMINI_API_KEY not set — skipping scan / top-up / generation; writing a model-free preview.');

  if (flag('--scan') && hasKey) {
    const t = Date.now();
    const r = await runForwardScan(corpus, new Date(), Date.now() + 280_000, { enrich: false });
    gemini += r.usage.geminiCalls;
    console.log(`scan: ${r.searches} searches, ${r.discovered} discovered, ${r.duplicates} duplicates, ${r.verified} verified, ` +
      `${r.accepted.length} new, ${r.updated.length} updated, ${r.rejected.length} rejected, ${r.usage.geminiCalls} Gemini calls, ${Math.round((Date.now() - t) / 1000)}s`);
    for (const e of r.accepted) console.log(`  + ${e.date} ${e.name} @ ${e.venue}${e.pickCandidate ? ' [pick candidate]' : ''} — ${e.externalLink}`);
    for (const e of r.updated) console.log(`  ↻ ${e.slug} — ${e.externalLink}`);
    for (const x of r.rejected) console.log(`  ✗ ${x.name}: ${x.reason.slice(0, 140)}`);
    const updated = new Map(r.updated.map((e) => [e.slug, e]));
    corpus = [...corpus.map((e) => updated.get(e.slug) ?? e), ...r.accepted];
  }

  const blockFile = path.join(process.cwd(), 'data', 'pick-date-blocklist.json');
  const blocklist: BlockedPick[] = fs.existsSync(blockFile) ? JSON.parse(fs.readFileSync(blockFile, 'utf-8')) : [];

  const plan = await planEdition({
    weekStartISO, weekEndISO,
    blocked: blocklist.map((b) => b.name),
    mode: flag('--force-compose') ? 'compose' : null,
    loadCorpus: async () => ({ events: corpus, source: flag('--scan') && hasKey ? 'local + scan' : 'local' }),
  });
  console.log(`path=${plan.path} — ${plan.reason}`);
  if (plan.path !== 'compose' || !plan.selection || !hasKey) {
    if (plan.path !== 'compose') console.log('Production would fall back to the legacy research path for this window.');
    const sel = plan.selection ?? selectEditionEvents(corpus, weekStartISO, weekEndISO, { blocked: blocklist.map((b) => b.name) });
    const note = `path=${plan.path} — ${plan.reason}. ${sel.short.length} short events, ${sel.longRuns.length} long runs, ${sel.pickPool.length} pick-eligible.`;
    fs.writeFileSync(out, renderPreview(sel, weekRange, note));
    console.log(`preview → ${out}: ${sel.short.length} short, ${sel.longRuns.length} long runs, ${Math.min(sel.pickPool.length, 5)} picks available`);
    return;
  }

  let topup: EventRecord[] = [];
  if (flag('--topup')) {
    const r = await runTopUp(corpus, weekStart, 90_000);
    gemini += r.result?.usage.geminiCalls ?? 0;
    topup = r.events;
    console.log(`top-up: ${topup.length} new${r.error ? ` (error: ${r.error})` : ''}; ${r.result?.rejected.length ?? 0} rejected`);
    corpus = [...corpus, ...topup];
  }

  const recentPicks = await recentPickNames(4);
  const sel = selectEditionEvents(corpus, weekStartISO, weekEndISO, {
    blocked: blocklist.map((b) => b.name),
    recentPicks,
  });
  console.log(`composing from ${sel.short.length} short + ${sel.longRuns.length} long-run events (${sel.pickPool.length} pick-eligible)`);
  // Same picks step as the route (#34): Opus picks, else Gemini (no key → fallback).
  const chosen = await choosePicks(sel, { recentPicks });
  console.log(pickLogLine(chosen));

  const t = Date.now();
  const raw = await generateNewsletter(eventDigest(sel), FALLBACK_HERO_URL, weekRange, blocklistCorrections(blocklist), { compose: true, picks: presetPicks(chosen) });
  gemini += 1;
  assertValidNewsletterHtml(raw, { lang: 'en' });
  const events = await extractEventsFromHtml(raw, slug, corpus);
  gemini += 1;
  const { html: linked, linked: anchors } = injectEventLinks(raw, events);
  const alsoOn = longRunsNotFeatured(sel.longRuns, events);
  let html = insertAlsoOn(linked, renderAlsoOn(alsoOn));
  const guide = newsletterGuide(listBlogPosts(), weekStartISO);
  if (guide) html = insertFromTheBlog(html, renderFromTheBlog(guide, 'en'));
  html = html.replace(/<body([^>]*)>/i, (m) => `${m}\n<!-- oporto-weekly:path=compose (dry run) -->`);
  fs.writeFileSync(out, html);

  const picks = events.filter((e) => e.editorPickRank != null).sort((a, b) => a.editorPickRank! - b.editorPickRank!);
  const known = new Set(corpus.map((e) => e.slug));
  const files = mergeEventFiles(events, topup);
  console.log(`generated in ${Math.round((Date.now() - t) / 1000)}s → ${out} (${html.length} bytes)`);
  console.log(`extracted ${events.length} events (${events.filter((e) => known.has(e.slug)).length} matched existing records, ${events.filter((e) => !known.has(e.slug)).length} new slugs), ${anchors} title links, ${Math.min(alsoOn.length, 8)} in "Also on"`);
  console.log(`picks (${picks.length}):`);
  for (const p of picks) console.log(`  ${p.editorPickRank}. ${p.name} — ${p.date} @ ${p.venue}`);
  console.log(`would commit ${files.length} event records with the archive (not written)`);
  console.log(`Gemini calls this run: ~${gemini}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
