/**
 * Assertions for the forward-scan leads queue (data/forward-leads.json,
 * lib/forward-leads.ts). Plain node:assert under tsx; no network — the scan
 * test stubs global fetch (Gemini, page fetches, grounding redirects).
 *
 *   npm run test:leads
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LEADS_PATH, LEADS_PER_RUN, MAX_LEAD_ATTEMPTS, applyLeadOutcomes, isValidLead, leadKey, leadsChanged,
  parseLeadsFile, selectLeads, serializeLeadsFile, type ForwardLead, type LeadsFile,
} from '../lib/forward-leads';
import { runForwardScan, isListingUrl } from '../lib/forward-scan';
import { FORWARD_SOURCE, type EventRecord } from '../lib/events';

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; } catch (err) { console.error(`FAIL ${name}`); throw err; }
}

const lead = (p: Partial<ForwardLead> & { name: string; date: string }): ForwardLead => ({
  venue: 'Casa da Música', source: 'test-newsletter', addedAt: '2026-10-25T00:00:00Z', ...p,
});
const WINDOW = { from: '2026-10-26', to: '2027-01-03' };
const TODAY = '2026-10-25';

async function main() {
  // ------------------------------------------------------------- the seeded file
  await test('data/forward-leads.json parses; every lead valid, unique, verifiable URL', () => {
    const file = parseLeadsFile(fs.readFileSync(LEADS_PATH, 'utf-8'));
    assert.ok(file, 'file parses');
    assert.ok(Array.isArray(file!._readme) && file!._readme.length > 0, 'format documented in _readme');
    const keys = new Set<string>();
    for (const l of file!.leads) {
      assert.ok(isValidLead(l), `valid: ${JSON.stringify(l).slice(0, 80)}`);
      assert.ok(l.source && l.addedAt, `source + addedAt: ${l.name}`);
      assert.ok(!keys.has(leadKey(l)), `unique: ${l.name}`);
      keys.add(leadKey(l));
      if (l.url) {
        assert.ok(!isListingUrl(l.url), `not a listing page: ${l.url}`);
        assert.ok(!/newsletter|mailchimp|list-manage/i.test(l.url), `newsletter never cited: ${l.url}`);
      }
    }
  });

  // ------------------------------------------------------------- selection
  await test('selectLeads: pending + in window, earliest first, capped; past → expired', () => {
    const leads: unknown[] = [
      lead({ name: 'Past Gig', date: '2026-10-01' }),
      lead({ name: 'Past Run Still On', date: '2026-10-01', endDate: '2026-11-15' }),
      lead({ name: 'Far Future', date: '2027-02-01' }),
      lead({ name: 'Done Already', date: '2026-11-03', status: 'done' }),
      lead({ name: 'Rejected', date: '2026-11-03', status: 'rejected' }),
      { name: 'Broken', date: 'next week', venue: 'X' },
      ...Array.from({ length: 10 }, (_, i) => lead({ name: `Gig ${i}`, date: `2026-11-${String(20 - i).padStart(2, '0')}T21:00` })),
    ];
    const { due, expired } = selectLeads(leads, WINDOW, TODAY);
    assert.equal(due.length, LEADS_PER_RUN);
    assert.equal(due[0].name, 'Past Run Still On', 'a run that is still on is due');
    assert.ok(due.every((l, i) => i === 0 || due[i - 1].date <= l.date), 'earliest first');
    assert.ok(!due.some((l) => ['Far Future', 'Done Already', 'Rejected', 'Past Gig'].includes(l.name)));
    assert.deepEqual(expired.map((l) => l.name), ['Past Gig']);
    assert.equal(selectLeads(leads, WINDOW, TODAY, 0).due.length, 0, 'cap 0 (topup) → none');
  });

  await test('leadKey ignores time of day and spelling noise', () => {
    assert.equal(leadKey(lead({ name: 'Irmãos Jussen', date: '2026-11-05T19:30' })), leadKey(lead({ name: 'Irmaos Jussen', date: '2026-11-05' })));
  });

  // ------------------------------------------------------------- outcomes
  await test('applyLeadOutcomes: done / attempts → rejected / dropped; others and new leads kept', () => {
    const a = lead({ name: 'A', date: '2026-11-05' });
    const b = lead({ name: 'B', date: '2026-11-06', attempts: MAX_LEAD_ATTEMPTS - 2 });
    const c = lead({ name: 'C', date: '2026-11-07', attempts: MAX_LEAD_ATTEMPTS - 1 });
    const d = lead({ name: 'D', date: '2026-10-01' });
    const e = lead({ name: 'E', date: '2026-11-09' });
    const f = lead({ name: 'F', date: '2026-11-10' });
    const fresh: LeadsFile = { _readme: ['x'], leads: [a, b, c, d, e, f, { name: 'bad' } as unknown as ForwardLead, lead({ name: 'Added Meanwhile', date: '2026-11-11' })] };
    const now = new Date('2026-10-25T07:00:00Z');
    const out = applyLeadOutcomes(fresh, [
      { key: leadKey(a), kind: 'done', slug: 'a-casa-da-musica-nov-5-2026' },
      { key: leadKey(b), kind: 'failed', reason: 'HTTP 404' },
      { key: leadKey(c), kind: 'failed', reason: 'timeout' },
      { key: leadKey(d), kind: 'dropped', reason: 'past' },
      { key: leadKey(f), kind: 'rejected', reason: 'not in the Porto area (Lisboa)' },
    ], now);
    const by = (n: string) => out.leads.find((l) => l.name === n)!;
    assert.equal(by('A').status, 'done');
    assert.equal(by('A').eventSlug, 'a-casa-da-musica-nov-5-2026');
    assert.equal(by('A').resolvedAt, now.toISOString());
    assert.equal(by('B').status, 'pending');
    assert.equal(by('B').attempts, MAX_LEAD_ATTEMPTS - 1);
    assert.equal(by('B').reason, 'HTTP 404');
    assert.equal(by('C').status, 'rejected', 'last attempt → rejected');
    assert.equal(by('C').reason, 'timeout');
    assert.equal(by('F').status, 'rejected', 'final failure rejects at once');
    assert.equal(out.leads.some((l) => l.name === 'D'), false, 'past lead dropped');
    assert.deepEqual(by('E'), e, 'untouched');
    assert.ok(by('Added Meanwhile'), 'lead added after the scan started is kept');
    assert.ok(out.leads.some((l) => (l as { name: string }).name === 'bad'), 'invalid entry kept for a human');
    assert.deepEqual(out._readme, ['x']);
    assert.equal(leadsChanged(fresh, out), true);
    assert.equal(leadsChanged(fresh, applyLeadOutcomes(fresh, [])), false);
    assert.ok(serializeLeadsFile(out).endsWith('}\n'));
  });

  // ------------------------------------------------------------- scan with mocks
  await test('runForwardScan verifies leads first through verify(), dedupes, and reports outcomes', async () => {
    const realFetch = globalThis.fetch;
    const realKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test';
    const fetched: string[] = [];
    const prompts: string[] = [];

    const long = (who: string, when: string) =>
      Array.from({ length: 8 }, () => `${who} performs at Casa da Música in Porto on ${when}, with tickets sold at the box office.`).join(' ');
    const PAGES: Record<string, { name: string; date: string; dateQuote: string; time?: string; city?: string }> = {
      'https://casadamusica.com/event/irmaos-jussen/': { name: 'Irmãos Jussen', date: '2026-11-05', dateQuote: '5 novembro 2026', time: '19:30' },
      'https://casadamusica.com/event/rodrigo-cuevas/': { name: 'Rodrigo Cuevas', date: '2026-11-10', dateQuote: '10 novembro 2026', time: '21:30' },
      'https://casadamusica.com/event/needs-link/': { name: 'Needs Link Concert', date: '2026-11-12', dateQuote: '12 novembro 2026' },
      'https://casadamusica.com/event/lisbon-show/': { name: 'Lisbon Show', date: '2026-11-13', dateQuote: '13 novembro 2026', city: 'Lisboa' },
    };
    const html = (p: { name: string; dateQuote: string }) =>
      `<html><head><title>${p.name}</title></head><body><h1>${p.name}</h1><p>${p.dateQuote} · Casa da Música · Sala Suggia</p><p>${'Concert details and tickets. '.repeat(12)}</p></body></html>`;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith('https://generativelanguage.googleapis.com/')) {
        const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text as string;
        prompts.push(prompt);
        const reply = (text: string, chunks: string[] = []) => new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: chunks.map((uri) => ({ web: { uri } })) } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
        if (prompt.startsWith('Using web search, find notable')) return reply('NONE');
        if (prompt.startsWith('Using web search, find the official detail page')) return reply('Found it.', ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/cuevas']);
        const m = prompt.match(/^Below is the text of one web page \((\S+)\)/);
        const page = m && PAGES[m[1]];
        if (!page) return reply('{"isEventPage": false}');
        return reply(JSON.stringify({
          isEventPage: true, sourceType: 'venue', name: page.name, nameQuote: page.name, date: page.date, time: page.time ?? null,
          endDate: null, dateQuote: page.dateQuote, venue: 'Casa da Música', venueQuote: 'Casa da Música', city: page.city ?? 'Porto',
          price: null, priceFrom: null, category: 'music', pickCandidate: true,
          description: `${page.name} in concert at Casa da Música.`, longDescription: long(page.name, page.dateQuote),
        }));
      }
      if (url.startsWith('https://vertexaisearch.cloud.google.com/')) {
        return new Response(null, { status: 302, headers: { location: 'https://casadamusica.com/event/rodrigo-cuevas/' } });
      }
      fetched.push(url);
      const page = PAGES[url];
      if (!page) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
      return new Response(html(page), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }) as typeof fetch;

    const existing: EventRecord[] = [
      { slug: 'listed-gig-casa-da-musica-nov-8-2026', name: 'Listed Gig', venue: 'Casa da Música', venueSlug: 'casa-da-musica', date: '2026-11-08',
        category: 'music', description: 'A gig.', longDescription: 'Long.', externalLink: 'https://casadamusica.com/event/listed-gig/', sourceEdition: FORWARD_SOURCE, addedAt: '2026-10-01T00:00:00Z' },
      { slug: 'needs-link-concert-casa-da-musica-nov-12-2026', name: 'Needs Link Concert', venue: 'Casa da Música', venueSlug: 'casa-da-musica', date: '2026-11-12',
        category: 'music', description: 'A concert.', sourceEdition: FORWARD_SOURCE, addedAt: '2026-10-01T00:00:00Z' },
    ];
    const leads: ForwardLead[] = [
      lead({ name: 'Irmãos Jussen', date: '2026-11-05T19:30', url: 'https://casadamusica.com/event/irmaos-jussen/' }),
      lead({ name: 'Listed Gig', date: '2026-11-08', url: 'https://casadamusica.com/event/listed-gig/' }),
      lead({ name: 'Needs Link Concert', date: '2026-11-12', url: 'https://casadamusica.com/event/needs-link/' }),
      lead({ name: 'Rodrigo Cuevas', date: '2026-11-10' }), // no URL → rescue search
      lead({ name: 'Facebook Only Party', date: '2026-11-11', url: 'https://www.facebook.com/events/123' }), // blocked → rescue finds nothing
      lead({ name: 'Moved Page', date: '2026-11-14', url: 'https://casadamusica.com/event/moved/' }), // 404
      lead({ name: 'Lisbon Show', date: '2026-11-13', url: 'https://casadamusica.com/event/lisbon-show/' }),
      lead({ name: 'Old Show', date: '2026-10-02', url: 'https://casadamusica.com/event/old/' }),
      lead({ name: 'Far Show', date: '2027-03-01', url: 'https://casadamusica.com/event/far/' }),
      lead({ name: 'Already Done', date: '2026-11-20', status: 'done', url: 'https://casadamusica.com/event/done/' }),
    ];

    try {
      const r = await runForwardScan(existing, new Date('2026-10-25T07:00:00Z'), Date.now() + 240_000, { enrich: false, leads });
      const out = new Map(r.leads.outcomes.map((o) => [o.key, o]));
      const of = (name: string) => out.get(leadKey(leads.find((l) => l.name === name)!));

      assert.equal(r.discovered, 0, 'mock discovery found nothing');
      assert.deepEqual(r.accepted.map((e) => e.name).sort(), ['Irmãos Jussen', 'Rodrigo Cuevas']);
      const jussen = r.accepted.find((e) => e.name === 'Irmãos Jussen')!;
      assert.equal(jussen.date, '2026-11-05T19:30', 'time from the page');
      assert.equal(jussen.externalLink, 'https://casadamusica.com/event/irmaos-jussen/', 'record cites the event page, not the lead source');
      assert.equal(jussen.sourceEdition, FORWARD_SOURCE);
      assert.deepEqual(of('Irmãos Jussen'), { key: leadKey(leads[0]), kind: 'done', slug: jussen.slug });
      assert.equal(of('Rodrigo Cuevas')?.kind, 'done', 'URL found by the rescue search');

      assert.deepEqual(of('Listed Gig'), { key: leadKey(leads[1]), kind: 'done', slug: 'listed-gig-casa-da-musica-nov-8-2026', reason: 'already listed' });
      assert.ok(!fetched.includes('https://casadamusica.com/event/listed-gig/'), 'listed lead not fetched again');

      assert.equal(r.updated.length, 1, 'existing record with gaps updated from the lead page');
      assert.equal(r.updated[0].slug, 'needs-link-concert-casa-da-musica-nov-12-2026');
      assert.equal(r.updated[0].externalLink, 'https://casadamusica.com/event/needs-link/');
      assert.equal(of('Needs Link Concert')?.kind, 'done');

      assert.equal(of('Facebook Only Party')?.kind, 'failed');
      assert.ok(!fetched.some((u) => u.includes('facebook.com')), 'blocked host never fetched');
      assert.equal(of('Moved Page')?.kind, 'failed');
      assert.match((of('Moved Page') as { reason: string }).reason, /HTTP 404/);
      assert.equal(of('Lisbon Show')?.kind, 'rejected', 'outside Porto → rejected at once');
      assert.equal(of('Old Show')?.kind, 'dropped');
      assert.equal(of('Far Show'), undefined, 'beyond the window: untouched');
      assert.equal(of('Already Done'), undefined);
      assert.ok(r.rejected.some((x) => x.name === 'lead: Moved Page'), 'lead failures listed in rejected');

      // The lead verification used the same reader prompt as discovery.
      assert.ok(prompts.some((p) => p.includes('(https://casadamusica.com/event/irmaos-jussen/). We think it is the official page for "Irmãos Jussen"')));

      // Applying the outcomes to the file.
      const next = applyLeadOutcomes({ leads }, r.leads.outcomes, new Date('2026-10-25T07:05:00Z'));
      assert.equal(next.leads.length, leads.length - 1, 'old lead dropped');
      assert.equal(next.leads.find((l) => l.name === 'Moved Page')!.attempts, 1);
      assert.equal(next.leads.find((l) => l.name === 'Moved Page')!.status, 'pending');
      assert.equal(next.leads.find((l) => l.name === 'Irmãos Jussen')!.eventSlug, jussen.slug);

      // Topup mode never touches leads.
      const top = await runForwardScan(existing, new Date('2026-10-29T05:30:00Z'), Date.now() + 60_000, { mode: 'topup', leads });
      assert.equal(top.leads.outcomes.length, 0);
      assert.equal(top.leads.checked, 0);
    } finally {
      globalThis.fetch = realFetch;
      if (realKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = realKey;
    }
  });

  console.log(`test-leads: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
