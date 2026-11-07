/**
 * Gemini migration phase 2 (owner OK 2026-11-07, "ok gemini"). Gemini 2.5 Pro
 * retires 1 Dec 2026. This writes next week's edition twice, from the same
 * events and the same Opus picks: once with the current PRO model and once
 * with ?model=<candidate>. Both go ONLY to NEWSLETTER_TEST_TO so the owner can
 * compare them before PRO is switched.
 *
 * Read-only towards everything subscribers see: no archive, no run ledger, no
 * blocklist writes, no top-up scan, static hero image. Refuses during the
 * Thursday freeze (Wed 18:00 → Thu 23:59 UTC) unless ?force=true.
 *
 *   GET ?list=1                     → Gemini "pro" model ids available to the key
 *   GET ?model=gemini-x-pro[&week=YYYY-MM-DD] → generate + email both copies
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { formatWeekRange, thursdayWeekStart } from '@/lib/archive';
import { checkCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/resend-client';
import { PRO } from '@/lib/gemini-models';
import { FALLBACK_HERO_URL, generateNewsletter, planEdition } from '@/lib/newsletter-generate';
import { eventDigest } from '@/lib/edition-compose';
import { choosePicks, presetPicks, pickLogLine } from '@/lib/opus-picks';

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });
  const params = new URL(req.url).searchParams;

  try {
    if (params.get('list')) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${process.env.GEMINI_API_KEY}`);
      const data = (await res.json()) as { models?: { name: string }[] };
      const ids = (data.models ?? []).map((m) => m.name.replace(/^models\//, '')).filter((n) => /pro/i.test(n));
      return NextResponse.json({ current: PRO, pro: ids });
    }

    const model = (params.get('model') ?? '').trim();
    if (!/^gemini-[\w.-]+$/.test(model)) {
      return NextResponse.json({ error: 'pass ?model=gemini-…' }, { status: 400 });
    }
    const now = new Date();
    const day = now.getUTCDay();
    const inFreeze = day === 4 || (day === 3 && now.getUTCHours() >= 18);
    if (inFreeze && params.get('force') !== 'true') {
      return NextResponse.json({ skipped: true, reason: 'Thursday freeze' });
    }
    const to = (process.env.NEWSLETTER_TEST_TO ?? '').trim();
    if (!to || to.includes(',') || !/^[^@\s]+@[^@\s]+$/.test(to)) {
      return NextResponse.json({ skipped: true, reason: 'NEWSLETTER_TEST_TO not set to a single address' });
    }

    // Next edition's week (Thu → Wed) unless ?week= names a Thursday.
    const weekParam = params.get('week');
    const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? new Date(`${weekParam}T00:00:00Z`)
      : new Date(thursdayWeekStart(now).getTime() + 7 * 86400000);
    const weekStartISO = weekStart.toISOString().slice(0, 10);
    const weekEndISO = new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    const weekRange = formatWeekRange(weekStart);

    const { readPickBlocklist, blocklistCorrections } = await import('@/lib/pick-blocklist');
    const blocklist = await readPickBlocklist();
    const plan = await planEdition({
      weekStartISO, weekEndISO,
      blocked: blocklist.map((b) => b.name),
      mode: 'compose',
      loadCorpus: async () => (await import('@/lib/event-store')).loadEventsFresh(),
    });
    if (plan.path !== 'compose' || !plan.selection) {
      return NextResponse.json({ error: `cannot compose this week: ${plan.reason}` }, { status: 409 });
    }
    const { recentPickNames } = await import('@/lib/newsletter-generate');
    const recentPicks = await recentPickNames(4);
    const picks = await choosePicks(plan.selection, { recentPicks });
    console.log(`[newsletter-model-test] ${pickLogLine(picks)}`);
    const digest = eventDigest(plan.selection);
    const corrections = blocklistCorrections(blocklist);

    const runs = [
      { label: `current ${PRO}`, model: PRO },
      { label: `candidate ${model}`, model },
    ];
    const results = await Promise.allSettled(runs.map(async (r) => {
      const t0 = Date.now();
      const html = await generateNewsletter(digest, FALLBACK_HERO_URL, weekRange, corrections, {
        compose: true, picks: presetPicks(picks), model: r.model,
      });
      const secs = Math.round((Date.now() - t0) / 1000);
      const banner = `<div style="background:#fff3cd;color:#5c4400;padding:12px 16px;font:14px/1.4 sans-serif;text-align:center">Model test: <b>${r.label}</b> (${secs}s). Same events and picks in both copies. Not sent to subscribers.</div>`;
      const body = html.replace(/SUBSCRIBER_EMAIL/g, encodeURIComponent(to)).replace(/<body([^>]*)>/i, `<body$1>${banner}`);
      await sendEmail(to, `[MODEL TEST · ${r.model}] Oporto Weekly — ${weekRange}`, body, [
        { name: 'type', value: 'test' },
        { name: 'lang', value: 'en' },
      ]);
      return { label: r.label, secs, chars: html.length };
    }));

    const out = results.map((r, i) => (r.status === 'fulfilled' ? r.value : { label: runs[i].label, error: String(r.reason) }));
    console.log(`[newsletter-model-test] ${JSON.stringify(out)}`);
    return NextResponse.json({ week: weekRange, picks: picks.path ?? null, results: out });
  } catch (err) {
    console.error('[newsletter-model-test]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
