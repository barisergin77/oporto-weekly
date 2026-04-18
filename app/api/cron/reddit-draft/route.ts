/**
 * Thursday 08:50 UTC — generates a copy-pasteable r/porto post from this
 * week's newsletter and emails it to the editor.
 *
 * Not actually a "poster." We don't hit Reddit's API at all. Reddit's
 * moderator tooling in community subs aggressively auto-flags automated
 * self-promotion, so the shape of this cron is deliberately "prepare, don't
 * publish." The editor copies the draft into their Reddit account themselves,
 * which also keeps the posting pattern human and conversational.
 *
 * Output: two Reddit-formatted versions in the same email:
 *   A) Events only — safest for r/porto's strict anti-self-promo rules
 *   B) Events + a soft mention of the newsletter at the end
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getFileContent } from '@/lib/github';
import { stripEmailFooter, type NewsletterMeta } from '@/lib/archive';
import { sendEmail } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';

const EDITOR_EMAIL = 'barisergin@gmail.com';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function draftRedditPost(html: string, weekRange: string): Promise<string> {
  const prompt = `You are formatting a weekly Porto events roundup for r/porto on Reddit.

Below is this week's newsletter HTML. Extract ONLY the real events. Skip the
hero/cover section, the editor's note, the tip-of-the-week, the footer, and
any promotional copy.

Output TWO versions back-to-back, separated exactly by the line "---":

VERSION A (events-only, NO promotion — safest for r/porto):
[markdown]

---

VERSION B (events + one soft mention of the newsletter at the very end):
[markdown]

Format rules for both versions:
- Start with a title line using a natural, non-clickbait tone:
    "Things to do in Porto this week (${weekRange})"
- Short 1-sentence intro after the title ("Quick roundup of what's on this week — happy to answer questions in the comments.")
- Group events by category, in this order (skip a category if there are no
  events in it): 🎵 Music · 🎨 Art · 🍷 Food & Wine · 👨‍👩‍👧 Family · 🌙 Nightlife
- ONE emoji per category header, then no more emoji anywhere else.
- For each event, a single bullet in this shape:
    **Event Name** — Day DD Mon, venue. Price. One factual sentence.
- If a piece of info (price, exact time) isn't in the newsletter, omit it
  rather than inventing. Do not say "TBA" or "check website" — just leave it out.
- Use Reddit markdown: **bold** for event names, - for bullets. No tables.
- Be concise. Reddit users skim. Drop editorial adjectives like "unmissable"
  or "stunning". Just the facts.
- Total length: aim for ~250–400 words per version.

For VERSION B only, append at the very end (after a blank line):

    _If you want a fuller weekly list in your inbox on Thursdays, I write a
    free newsletter at oportoweekly.com._

Newsletter HTML:
${html}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 3000 },
  };

  let res = await geminiPost(GEMINI_URL, body);
  if (res.status === 503 || res.status === 429) {
    console.log('[cron/reddit-draft] Pro model busy, falling back to Flash');
    res = await geminiPost(GEMINI_URL_FALLBACK, body);
  }
  if (!res.ok) {
    throw new Error(`Gemini draft failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('Gemini returned empty draft');
  return text.trim();
}

function renderEmail(draft: string, weekRange: string): string {
  // Render the draft as pre-wrap monospace so the user can select + copy the
  // whole block cleanly into Reddit's markdown editor. Also include a quick
  // jump guide up top.
  const safe = draft
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:720px;margin:20px auto;padding:0 16px;color:#1a1a2e;">
  <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">Reddit draft — r/porto</h1>
  <p style="color:#5a5a5a;margin:0 0 20px;">Week of ${weekRange}. Two versions below — pick whichever fits your mood. Copy the whole block (between the heading and the "---", or between the "---" and the end) straight into Reddit's markdown editor.</p>
  <p style="background:#faf7f0;border-left:3px solid #c9a96e;padding:10px 14px;font-size:13px;color:#3a3a3a;margin:0 0 20px;">
    <strong>r/porto mod tip:</strong> Version A is safer — no link, no self-reference.
    Post Version B only if you have prior karma + comment history in the sub.
    Either way, comment on someone else's post first, then submit. Good luck.
  </p>
  <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;background:#f4ede0;border:1px solid #e5dfd3;border-radius:6px;padding:16px;overflow-x:auto;">${safe}</pre>
  <p style="color:#8a8170;font-size:11px;margin-top:24px;">Automated draft from /api/cron/reddit-draft · every Thursday 08:50 UTC</p>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    // Always use the LATEST EN newsletter, not "today's" computed slug.
    // This makes the cron correct on Thursday (picks up the edition that just
    // committed) AND for on-demand regeneration any other day of the week.
    // Fetched via GitHub API so a mid-deploy Vercel doesn't serve a stale index.
    const indexRaw = await getFileContent('data/newsletters.json');
    if (!indexRaw) throw new Error('data/newsletters.json not found in repo');
    const index = JSON.parse(indexRaw) as NewsletterMeta[];
    const latest = index[0];
    if (!latest) throw new Error('No newsletters in the index yet');

    const slug = latest.slug;
    const weekRange = latest.weekRange;

    const rawHtml = await getFileContent(`public/newsletters/${slug}.html`);
    if (!rawHtml) {
      throw new Error(
        `Newsletter HTML not found for slug "${slug}" — index points to it ` +
        `but the file is missing in the repo.`
      );
    }
    // Strip the footer before handing to Gemini — no point burning tokens
    // on unsubscribe boilerplate.
    const html = stripEmailFooter(rawHtml);

    const draft = await draftRedditPost(html, weekRange);
    const emailHtml = renderEmail(draft, weekRange);

    await sendEmail(
      EDITOR_EMAIL,
      `Reddit draft · r/porto · ${weekRange}`,
      emailHtml,
      [{ name: 'type', value: 'reddit-draft' }]
    );

    console.log(`[cron/reddit-draft] Sent draft for ${slug} (${draft.length} bytes)`);
    return NextResponse.json({
      ok: true,
      slug,
      weekRange,
      draftBytes: draft.length,
    });
  } catch (err) {
    console.error('[cron/reddit-draft]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
