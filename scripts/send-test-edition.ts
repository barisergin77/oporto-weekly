/**
 * Preview / test-send an archived edition exactly as subscribers get it
 * (forward block injected, SUBSCRIBER_EMAIL replaced). Sends to ONE address
 * only, subject prefixed "[TEST]". Never touches audiences or the run ledger.
 *
 *   npx tsx --env-file=.env.local scripts/send-test-edition.ts <slug> <en|pt> [--to you@example.com] [--out file.html]
 *
 * Without --to it only writes the HTML (default /tmp/<slug>-<lang>-email.html).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';
import { withForwardBlock } from '@/lib/forward-block';

const [slug, lang] = process.argv.slice(2) as [string, 'en' | 'pt'];
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
if (!slug || (lang !== 'en' && lang !== 'pt')) {
  console.error('usage: send-test-edition.ts <slug> <en|pt> [--to email] [--out file]');
  process.exit(1);
}
const to = arg('--to');
if (to && (to.includes(',') || !/^[^@\s]+@[^@\s]+$/.test(to))) {
  console.error('--to takes exactly one email address');
  process.exit(1);
}

const file = lang === 'pt' ? `${slug}-pt` : slug;
const archived = fs.readFileSync(path.join('public/newsletters', `${file}.html`), 'utf8');
const editionUrl = lang === 'pt'
  ? `https://oportoweekly.com/pt/arquivo/${file}`
  : `https://oportoweekly.com/archive/${file}`;
const html = withForwardBlock(archived, lang, editionUrl)
  .replace(/SUBSCRIBER_EMAIL/g, encodeURIComponent(to ?? 'test@example.com'));

const out = arg('--out') ?? `/tmp/${file}-email.html`;
fs.writeFileSync(out, html);
console.log(`HTML: ${out}`);

async function main() {
  if (!to) return;
  const { data, error } = await new Resend(process.env.RESEND_API_KEY!).emails.send({
    from: 'Oporto Weekly <hello@oportoweekly.com>',
    to,
    subject: `[TEST] Oporto Weekly: ${file}`,
    html,
    tags: [{ name: 'type', value: 'test' }, { name: 'lang', value: lang }],
  });
  if (error) throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  console.log(`Sent test to ${to} (Resend ${data?.id})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
