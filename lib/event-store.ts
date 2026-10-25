/**
 * data/events as it is on GitHub main RIGHT NOW — not the deployed bundle.
 *
 * Why: data/events/*.json commits are deferred (scripts/vercel-ignore-build.sh;
 * deploy-flush publishes them at 21:00 UTC), so on Thursday morning the
 * bundle lacks everything the daily scan found since Wednesday's flush,
 * including the early Thursday scan that exists to feed the composition.
 * Composing (or deduping) against the bundle would miss those events and
 * re-create them under new slugs.
 *
 * Cheap: two API calls list the directory with blob SHAs; files whose SHA
 * matches the bundled copy are read locally, only new/changed ones are
 * fetched. Falls back to the bundle if GitHub can't be listed.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { listEvents, canonicalVenueSlug, type EventRecord } from './events';
import { getFileContent } from './github';

const REPO = 'barisergin77/oporto-weekly';
const EVENTS_DIR = path.join(process.cwd(), 'data', 'events');

/** Git's blob id for some content: sha1("blob <len>\0<content>"). */
export function gitBlobSha(content: Buffer): string {
  return crypto.createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

async function gh<T>(apiPath: string): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${apiPath}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub ${apiPath}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export interface FreshEvents {
  events: EventRecord[];
  source: 'github' | 'bundle';
  /** Files fetched from GitHub because the bundle lacked them or had an older copy. */
  fetched: number;
}

export async function loadEventsFresh(): Promise<FreshEvents> {
  try {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');
    const dataDir = await gh<Array<{ name: string; type: string; sha: string }>>('/contents/data?ref=main');
    const dir = dataDir.find((e) => e.name === 'events' && e.type === 'dir');
    if (!dir) throw new Error('data/events not found on main');
    const tree = await gh<{ tree: Array<{ path: string; type: string; sha: string }>; truncated: boolean }>(`/git/trees/${dir.sha}`);
    if (tree.truncated) throw new Error('data/events tree truncated');
    const files = tree.tree.filter((t) => t.type === 'blob' && t.path.endsWith('.json'));

    const events: EventRecord[] = [];
    const toFetch: string[] = [];
    for (const f of files) {
      const local = path.join(EVENTS_DIR, f.path);
      if (fs.existsSync(local)) {
        const buf = fs.readFileSync(local);
        if (gitBlobSha(buf) === f.sha) {
          try { events.push(JSON.parse(buf.toString('utf-8')) as EventRecord); continue; } catch { /* refetch */ }
        }
      }
      toFetch.push(f.path);
    }
    const CONCURRENCY = 8;
    for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
      const got = await Promise.all(toFetch.slice(i, i + CONCURRENCY).map(async (name) => {
        const body = await getFileContent(`data/events/${name}`);
        try { return body ? (JSON.parse(body) as EventRecord) : null; } catch { return null; }
      }));
      for (const e of got) if (e) events.push(e);
    }
    for (const e of events) if (e.venueSlug) e.venueSlug = canonicalVenueSlug(e.venueSlug);
    return { events, source: 'github', fetched: toFetch.length };
  } catch (err) {
    console.warn('[event-store] GitHub listing failed, using the deployed bundle:', err instanceof Error ? err.message : err);
    return { events: listEvents(), source: 'bundle', fetched: 0 };
  }
}
