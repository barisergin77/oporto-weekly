/**
 * Blog article translation — EN → European Portuguese for /pt/blog.
 * Server-only (calls Gemini). Two calls per post: title+excerpt (small
 * JSON) and the article body HTML (structure-preserving).
 */

import type { BlogPost } from './blog';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const url = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

export interface BlogTranslation {
  titlePt: string;
  excerptPt: string;
  htmlPt: string;
}

async function gemini(model: string, body: object): Promise<string> {
  const res = await fetch(url(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${model} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
}

export async function translateBlogPost(post: BlogPost, enHtml: string): Promise<BlogTranslation> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');

  // 1. Title + excerpt (short, structured).
  const metaRaw = await gemini('gemini-2.5-flash', {
    contents: [{ parts: [{ text:
      `Translate to European Portuguese (pt-PT, not Brazilian). Keep proper nouns ` +
      `(place names, venue names, "Porto") as-is. Return ONLY JSON, no fences:\n` +
      `{"titlePt": "...", "excerptPt": "..."}\n\n` +
      `TITLE: ${post.title}\nEXCERPT: ${post.excerpt}` }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json' },
  });
  const js = metaRaw.slice(metaRaw.indexOf('{'), metaRaw.lastIndexOf('}') + 1);
  const meta = JSON.parse(js) as { titlePt?: string; excerptPt?: string };
  if (!meta.titlePt || !meta.excerptPt) throw new Error('Blog meta translation incomplete');

  // 2. Article body HTML (structure-preserving).
  let htmlPt = await gemini('gemini-2.5-flash', {
    contents: [{ parts: [{ text:
      `Translate the VISIBLE TEXT of this HTML article fragment to European ` +
      `Portuguese (pt-PT, not Brazilian). Keep ALL HTML tags, attributes, ` +
      `classes, and href/src values EXACTLY as-is — translate only human-` +
      `readable text between tags. Keep proper nouns (venues, place names, ` +
      `"Porto") untranslated. Output ONLY the translated HTML, no markdown ` +
      `fences, no commentary.\n\nHTML:\n${enHtml}` }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 32768, thinkingConfig: { thinkingBudget: 0 } },
  });
  htmlPt = htmlPt.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
  if (htmlPt.length < enHtml.length * 0.4) {
    throw new Error(`Blog body translation suspiciously short (${htmlPt.length} vs ${enHtml.length}) — likely truncated`);
  }

  return { titlePt: meta.titlePt.trim(), excerptPt: meta.excerptPt.trim(), htmlPt };
}
