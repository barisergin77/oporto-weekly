/**
 * Plain web search via Firecrawl (owner 2026-11-15: Gemini Search grounding went past the
 * 5,000 free searches/month and bills $14 per 1,000 after that). Used for the "find this
 * event's own page" lookups where we only need result URLs, not a grounded answer.
 *
 * Returns null when FIRECRAWL_API_KEY is not set (e.g. on Vercel), so callers can fall
 * back to their old grounded path; [] when the search ran and found nothing or failed.
 */
export const searchUsage = { firecrawlSearches: 0 };

export function webSearchAvailable(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

export interface WebResult { url: string; title: string; description: string }

export async function webSearch(query: string, limit = 5, timeoutMs = 30_000): Promise<string[] | null> {
  const r = await webSearchResults(query, limit, timeoutMs);
  return r === null ? null : r.map((x) => x.url);
}

/** Same search, with each result's title and snippet (for discovery). */
export async function webSearchResults(query: string, limit = 10, timeoutMs = 30_000): Promise<WebResult[] | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  searchUsage.firecrawlSearches++;
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit, sources: ['web'] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const web = data?.data?.web ?? data?.data ?? [];
    return (Array.isArray(web) ? web : [])
      .filter((r: { url?: unknown }) => typeof r?.url === 'string' && /^https?:\/\//.test(r.url as string))
      .map((r: { url: string; title?: string; description?: string }) => ({ url: r.url, title: r.title ?? '', description: r.description ?? '' }));
  } catch {
    return [];
  }
}
