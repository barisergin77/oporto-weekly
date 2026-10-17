/**
 * Growth metrics snapshot for the daily improvement loop (ops/growth/).
 *
 *   npx tsx --env-file=.env.local scripts/growth-metrics.ts [--write]
 *
 * Prints the scoreboard; with --write also saves
 * ops/growth/metrics/<YYYY-MM-DD>.json so runs can be compared over time.
 * Needs GOOGLE_SERVICE_ACCOUNT_JSON (GSC + GA4) and network access to GitHub
 * for the subscriber/signup files (read from the repo checkout instead).
 */
import fs from 'fs';
import path from 'path';
import { getGoogleToken } from '../lib/search-engines';

const SITE = 'sc-domain:oportoweekly.com';
const GA4 = '555124096';
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function gsc(token: string, body: object) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GSC ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { rows?: any[] }).rows ?? [];
}
async function ga(token: string, body: object) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GA4 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { rows?: any[] }).rows ?? [];
}

(async () => {
  const out: Record<string, unknown> = { takenAt: new Date().toISOString() };
  const g = await getGoogleToken('https://www.googleapis.com/auth/webmasters.readonly');
  if (g) {
    // GSC lags ~3 days: compare the 7 and 28 complete days ending 3 days ago.
    const tot = async (s: number, e: number) => (await gsc(g, { startDate: day(s), endDate: day(e), dimensions: [] }))[0] ?? {};
    out.search = {
      last7: await tot(9, 3), prev7: await tot(16, 10),
      last28: await tot(30, 3), prev28: await tot(58, 31),
      topPages28: (await gsc(g, { startDate: day(30), endDate: day(3), dimensions: ['page'], rowLimit: 15 }))
        .map((r) => ({ page: r.keys[0].replace('https://oportoweekly.com', ''), clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })),
      lowCtr28: (await gsc(g, { startDate: day(30), endDate: day(3), dimensions: ['query'], rowLimit: 500 }))
        .filter((r) => r.impressions >= 40 && r.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 15)
        .map((r) => ({ query: r.keys[0], impressions: r.impressions, ctr: +(r.ctr * 100).toFixed(1), position: +r.position.toFixed(1) })),
    };
  }
  const a = await getGoogleToken('https://www.googleapis.com/auth/analytics.readonly');
  if (a) {
    const m = [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }];
    const tot = async (s: string, e: string) => (await ga(a, { dateRanges: [{ startDate: s, endDate: e }], metrics: m }))[0]?.metricValues?.map((v: any) => +v.value) ?? [0, 0, 0];
    const [u7, s7, pv7] = await tot('7daysAgo', 'yesterday');
    const [pu7, ps7, ppv7] = await tot('14daysAgo', '8daysAgo');
    out.visitors = {
      last7: { users: u7, sessions: s7, pageViews: pv7 }, prev7: { users: pu7, sessions: ps7, pageViews: ppv7 },
      channels7: (await ga(a, { dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }] }))
        .map((r) => ({ channel: r.dimensionValues[0].value, sessions: +r.metricValues[0].value })),
      signUpEvents7: +((await ga(a, { dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }] }))
        .find((r) => r.dimensionValues[0].value === 'sign_up')?.metricValues[0].value ?? 0),
    };
  }
  const read = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
  const hist = read('data/subscriber-history.json');
  out.subscribers = hist.slice(-4).map((h: any) => ({ week: h.week, active: h.activeUniqueTotal, en: h.en.active, pt: h.pt.active }));
  const since = new Date(Date.now() - 28 * 86400000).toISOString();
  const src = read('data/signup-sources.json').filter((s: any) => s.at >= since);
  const bySrc: Record<string, number> = {};
  for (const s of src) {
    const kind = s.source.replace(/^\/pt/, '').split('/')[1] || 'home';
    bySrc[kind] = (bySrc[kind] ?? 0) + 1;
  }
  out.signups28 = { total: src.length, byPageType: bySrc, recent: src.slice(-10) };

  console.log(JSON.stringify(out, null, 2));
  if (process.argv.includes('--write')) {
    const f = path.join('ops/growth/metrics', `${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
    console.error(`wrote ${f}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
