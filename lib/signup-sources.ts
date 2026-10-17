/**
 * Where subscribers sign up from — page path, language and time only.
 * Deliberately NO email address: this file lives in the repo.
 *
 * GA4 sees a `sign_up` event too, but only from visitors who accepted
 * analytics cookies; this is the consent-independent count the weekly report
 * and growth loop rely on. Committed through the GitHub API like the
 * run-ledger and listed in the ignore-build allowlist, so a signup never
 * triggers a deploy.
 */

import { getFileContent, commitFiles } from './github';

const PATH = 'data/signup-sources.json';
const MAX_ENTRIES = 5000;

export interface SignupSource {
  at: string;
  lang: 'en' | 'pt';
  source: string; // page path, e.g. /blog/porto-shopping-guide
}

/** Keep only a clean, bounded path: no query, fragment or junk. */
export function cleanSource(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return 'unknown';
  const path = raw.split(/[?#]/)[0].slice(0, 200);
  return /^[\w\-./%]*$/.test(path) ? path : 'unknown';
}

/** Never throws — a tally failure must never fail a signup. */
export async function recordSignupSource(entry: Omit<SignupSource, 'at'>): Promise<void> {
  try {
    const raw = await getFileContent(PATH);
    const list: SignupSource[] = raw ? JSON.parse(raw) : [];
    list.push({ at: new Date().toISOString(), ...entry });
    await commitFiles(
      [{ path: PATH, content: JSON.stringify(list.slice(-MAX_ENTRIES), null, 2) + '\n' }],
      `chore(signups): +1 ${entry.lang} from ${entry.source}`
    );
  } catch (err) {
    console.error('[signup-sources] record failed (non-fatal):', err);
  }
}

export async function readSignupSources(): Promise<SignupSource[]> {
  try {
    const raw = await getFileContent(PATH);
    return raw ? (JSON.parse(raw) as SignupSource[]) : [];
  } catch {
    return [];
  }
}
