/**
 * One-shot migration: Beehiiv subscriber list → Resend Audiences.
 *
 * Idempotent. Safe to re-run — contacts that already exist in the target
 * audience are skipped, not duplicated.
 *
 * Usage (tsx auto-loads .env.local via --env-file):
 *   # First run: creates audiences and prints ids to paste into env
 *   npx tsx --env-file=.env.local scripts/migrate-beehiiv-to-resend.ts setup
 *
 *   # Second run (after env vars are added to .env.local): import subscribers
 *   npx tsx --env-file=.env.local scripts/migrate-beehiiv-to-resend.ts migrate --dry-run
 *   npx tsx --env-file=.env.local scripts/migrate-beehiiv-to-resend.ts migrate
 *
 *   # Any time: sanity-check counts in both systems
 *   npx tsx --env-file=.env.local scripts/migrate-beehiiv-to-resend.ts verify
 *
 * Required env (in .env.local):
 *   BEEHIIV_API_KEY
 *   RESEND_API_KEY
 *   RESEND_AUDIENCE_EN   (added after `setup`)
 *   RESEND_AUDIENCE_PT   (added after `setup`)
 */

import { Resend } from 'resend';

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PUB_ID = 'pub_8e15aa9e-4215-4fe3-b803-d991916b0dd9';
const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';

const AUDIENCE_NAMES = {
  en: 'Oporto Weekly (EN)',
  pt: 'Oporto Weekly (PT)',
} as const;

type Lang = 'en' | 'pt';

function resend(): Resend {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  return new Resend(RESEND_API_KEY);
}

// ---------------------------------------------------------------------------
// Beehiiv: read all subscribers
// ---------------------------------------------------------------------------
interface BeehiivSub {
  email: string;
  status: string;
  utm_source?: string;
}

async function fetchAllBeehiivSubscribers(): Promise<BeehiivSub[]> {
  if (!BEEHIIV_API_KEY) throw new Error('BEEHIIV_API_KEY not set');

  const all: BeehiivSub[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const url =
      `${BEEHIIV_BASE}/publications/${PUB_ID}/subscriptions` +
      `?status=active&limit=${limit}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Beehiiv fetch failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch: BeehiivSub[] = (data.data ?? []).map((s: any) => ({
      email: String(s.email).toLowerCase(),
      status: s.status,
      utm_source: s.utm_source ?? '',
    }));
    all.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  return all;
}

function langOf(sub: BeehiivSub): Lang {
  return sub.utm_source === 'website-pt' ? 'pt' : 'en';
}

// ---------------------------------------------------------------------------
// Resend: audience helpers
// ---------------------------------------------------------------------------
async function ensureAudience(name: string): Promise<string> {
  const r = resend();
  const list = await r.audiences.list();
  if (list.error) throw new Error(`audiences.list failed: ${JSON.stringify(list.error)}`);
  const existing = list.data?.data?.find(a => a.name === name);
  if (existing) return existing.id;

  const created = await r.audiences.create({ name });
  if (created.error || !created.data) {
    throw new Error(`audiences.create failed: ${JSON.stringify(created.error)}`);
  }
  return created.data.id;
}

async function listAudienceContacts(
  audienceId: string
): Promise<Array<{ id: string; email: string; unsubscribed: boolean }>> {
  const r = resend();
  const res = await r.contacts.list({ audienceId });
  if (res.error) throw new Error(`contacts.list failed: ${JSON.stringify(res.error)}`);
  return (res.data?.data ?? []).map(c => ({
    id: c.id,
    email: c.email.toLowerCase(),
    unsubscribed: Boolean(c.unsubscribed),
  }));
}

async function createContact(audienceId: string, email: string): Promise<'created' | 'exists'> {
  const r = resend();
  const res = await r.contacts.create({ email, unsubscribed: false, audienceId });
  if (res.error) {
    const msg = (res.error.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('exist')) return 'exists';
    throw new Error(`contacts.create failed for ${email}: ${JSON.stringify(res.error)}`);
  }
  return 'created';
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------
async function cmdSetup() {
  console.log('🔧  Ensuring Resend audiences exist…');
  const enId = await ensureAudience(AUDIENCE_NAMES.en);
  const ptId = await ensureAudience(AUDIENCE_NAMES.pt);

  console.log('\n✅  Audiences ready.\n');
  console.log('Add these to Vercel env AND to .env.local:');
  console.log(`   RESEND_AUDIENCE_EN=${enId}`);
  console.log(`   RESEND_AUDIENCE_PT=${ptId}`);
  console.log('\nThen run:   npx tsx scripts/migrate-beehiiv-to-resend.ts migrate --dry-run');
}

async function cmdMigrate(dryRun: boolean) {
  const enAud = process.env.RESEND_AUDIENCE_EN;
  const ptAud = process.env.RESEND_AUDIENCE_PT;
  if (!enAud || !ptAud) {
    throw new Error(
      'RESEND_AUDIENCE_EN / RESEND_AUDIENCE_PT not set. Run `setup` first ' +
      'and paste the ids into .env.local.'
    );
  }

  console.log('📥  Fetching Beehiiv subscribers…');
  const beehiivSubs = await fetchAllBeehiivSubscribers();
  const enSource = beehiivSubs.filter(s => langOf(s) === 'en');
  const ptSource = beehiivSubs.filter(s => langOf(s) === 'pt');
  console.log(`    Beehiiv active:  ${beehiivSubs.length} total · ${enSource.length} EN · ${ptSource.length} PT`);

  console.log('📥  Fetching existing Resend contacts…');
  const [enExisting, ptExisting] = await Promise.all([
    listAudienceContacts(enAud),
    listAudienceContacts(ptAud),
  ]);
  const enExistingEmails = new Set(enExisting.map(c => c.email));
  const ptExistingEmails = new Set(ptExisting.map(c => c.email));
  console.log(`    Resend already:  ${enExisting.length} EN · ${ptExisting.length} PT`);

  const toCreate: Array<{ audience: string; lang: Lang; email: string }> = [];
  for (const s of enSource) {
    if (!enExistingEmails.has(s.email)) toCreate.push({ audience: enAud, lang: 'en', email: s.email });
  }
  for (const s of ptSource) {
    if (!ptExistingEmails.has(s.email)) toCreate.push({ audience: ptAud, lang: 'pt', email: s.email });
  }
  console.log(`    New to import:   ${toCreate.length} (${toCreate.filter(x => x.lang === 'en').length} EN · ${toCreate.filter(x => x.lang === 'pt').length} PT)`);

  if (dryRun) {
    console.log('\n🔎  Dry-run mode — no writes. Sample of first 5 to import:');
    for (const t of toCreate.slice(0, 5)) console.log(`      [${t.lang}] ${t.email}`);
    console.log('\nRe-run without --dry-run to actually migrate.');
    return;
  }

  console.log(`\n🚚  Importing ${toCreate.length} contacts…`);
  let created = 0;
  let existed = 0;
  let failed = 0;
  for (let i = 0; i < toCreate.length; i++) {
    const t = toCreate[i];
    try {
      const res = await createContact(t.audience, t.email);
      if (res === 'created') created++;
      else existed++;
    } catch (err) {
      failed++;
      console.error(`    ❌  ${t.email} (${t.lang}):`, err instanceof Error ? err.message : err);
    }
    if ((i + 1) % 25 === 0) {
      console.log(`    …${i + 1}/${toCreate.length}`);
    }
  }

  console.log(`\n✅  Done. Created: ${created} · Already existed: ${existed} · Failed: ${failed}`);
  console.log('\nNext:  npx tsx scripts/migrate-beehiiv-to-resend.ts verify');
}

async function cmdVerify() {
  const enAud = process.env.RESEND_AUDIENCE_EN;
  const ptAud = process.env.RESEND_AUDIENCE_PT;
  if (!enAud || !ptAud) throw new Error('RESEND_AUDIENCE_EN / RESEND_AUDIENCE_PT not set');

  const beehiivSubs = await fetchAllBeehiivSubscribers();
  const [enR, ptR] = await Promise.all([listAudienceContacts(enAud), listAudienceContacts(ptAud)]);

  const enBee = beehiivSubs.filter(s => langOf(s) === 'en').length;
  const ptBee = beehiivSubs.filter(s => langOf(s) === 'pt').length;
  const enActive = enR.filter(c => !c.unsubscribed).length;
  const ptActive = ptR.filter(c => !c.unsubscribed).length;

  console.log('                    Beehiiv     Resend');
  console.log(`   EN (active)       ${String(enBee).padStart(4)}        ${String(enActive).padStart(4)}`);
  console.log(`   PT (active)       ${String(ptBee).padStart(4)}        ${String(ptActive).padStart(4)}`);
  console.log(`   Δ EN              ${enActive - enBee >= 0 ? '+' : ''}${enActive - enBee}`);
  console.log(`   Δ PT              ${ptActive - ptBee >= 0 ? '+' : ''}${ptActive - ptBee}`);

  const beehiivEmails = new Set(beehiivSubs.map(s => s.email));
  const resendEmails = new Set([...enR, ...ptR].map(c => c.email));
  const inBeehiivOnly = Array.from(beehiivEmails).filter(e => !resendEmails.has(e));
  const inResendOnly = Array.from(resendEmails).filter(e => !beehiivEmails.has(e));
  console.log(`   Only in Beehiiv:  ${inBeehiivOnly.length}${inBeehiivOnly.length ? ` (e.g. ${inBeehiivOnly.slice(0, 3).join(', ')})` : ''}`);
  console.log(`   Only in Resend:   ${inResendOnly.length}${inResendOnly.length ? ` (e.g. ${inResendOnly.slice(0, 3).join(', ')})` : ''}`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
async function main() {
  const [cmd, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes('--dry-run');

  switch (cmd) {
    case 'setup':
      await cmdSetup();
      break;
    case 'migrate':
      await cmdMigrate(dryRun);
      break;
    case 'verify':
      await cmdVerify();
      break;
    default:
      console.log('Usage:');
      console.log('  npx tsx scripts/migrate-beehiiv-to-resend.ts setup');
      console.log('  npx tsx scripts/migrate-beehiiv-to-resend.ts migrate [--dry-run]');
      console.log('  npx tsx scripts/migrate-beehiiv-to-resend.ts verify');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
