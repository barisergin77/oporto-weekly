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
// This is a reformat-only task (HTML → Reddit markdown), no reasoning needed.
// Flash with thinking disabled is the right tool — Pro's internal "thinking"
// budget consumed ALL of maxOutputTokens and returned empty the first time.
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

async function geminiPost(url: string, body: object): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Extract the English + Portuguese month names from a weekRange like
// "April 16-22, 2026" or "April 30 - May 6, 2026" (use the START month).
function monthName(weekRange: string): string {
  const match = weekRange.match(/^([A-Z][a-z]+)/);
  return match ? match[1] : weekRange;
}

const PT_MONTHS: Record<string, string> = {
  January: 'janeiro', February: 'fevereiro', March: 'março', April: 'abril',
  May: 'maio', June: 'junho', July: 'julho', August: 'agosto',
  September: 'setembro', October: 'outubro', November: 'novembro', December: 'dezembro',
};
function monthNamePT(weekRange: string): string {
  return PT_MONTHS[monthName(weekRange)] ?? monthName(weekRange).toLowerCase();
}

async function draftRedditPost(html: string, weekRange: string): Promise<string> {
  // Few-shot'd on a real post that performed well in r/porto (thread 1sc7d4m,
  // April 4, 8 upvotes on a small sub). Key traits: bilingual, curated to ~5
  // events, no categories, conversational/factual tone, website link at the
  // end. See docs/reddit.md.
  const prompt = `You are drafting a Reddit post for r/porto, to be copy-pasted by the editor (a Porto local).

=== EXAMPLE OF A POST THAT WORKED WELL ON r/porto ===

Title: What's on in Porto this week — April events roundup / O que há para fazer no Porto esta semana — agenda de abril

Body:
***English:***

Been putting together a weekly list of things happening around the city. Thought I'd share this week's highlights since Easter weekend has some good stuff:

**Tame Impala** at Super Bock Arena tonight (April 4) — still worth checking if there are resale tickets floating around

**SÓTRAP 2026** at Exponor — northern Portugal's big trap festival, kicked off Thursday. João Gomes, Orochi, MC Paiva

**19th Italian Film Festival** — ongoing at various venues, free/cheap screenings, solid lineup this year

**Good Friday procession** (Way of the Cross) — went through the streets yesterday, actually impressive if you haven't seen it before

**FC Porto vs Famalicão** — Sunday at Dragão

Full list with dates, venues and prices at [oportoweekly.com](http://oportoweekly.com) if useful. I put it out every Thursday morning.

**Portuguese:**

Costumo fazer uma lista semanal de eventos na cidade. Como o fim de semana da Páscoa tem muita coisa boa, achei que valia a pena partilhar:

* **Tame Impala** no Super Bock Arena hoje (4 de abril) — vale a pena ver se há bilhetes em revenda
* **SÓTRAP 2026** na Exponor — o maior festival de trap do norte, com João Gomes, Orochi, MC Paiva
* **19.º Festival de Cinema Italiano** — em curso em vários locais, programação interessante este ano
* **Procissão do Senhor dos Passos** — passou pelas ruas ontem à noite, impressionante se nunca viram ao vivo
* **FC Porto vs Famalicão** — domingo no Dragão

Lista completa com datas, locais e preços em [oportoweekly.com/pt](http://oportoweekly.com/pt), se for útil. Publico toda quinta-feira de manhã.

=== END EXAMPLE ===

Your job: produce a post in that EXACT format and voice using this week's newsletter HTML.

EVENT SELECTION — pick the best 4–6 (not all; curate):
- Timely / one-off beats ongoing (a Saturday concert > a month-long museum show)
- Name recognition or cultural relevance (Tame Impala > unknown DJ; FC Porto match > Sunday league)
- Variety: one or two from music, art, food, sports, nightlife — NOT a full grid
- If genuinely nothing is happening in a category this week, just skip it

TONE — the most important rule. Write like a local sharing notes in a casual chat. Observational, not editorial. Short reads authentic.

You (the model) cannot hold real opinions about Porto events you've never been to. So favour OBSERVATIONAL + FACTUAL over opinion or mood. When the reference post's author says "actually impressive if you haven't seen it before," he's grounded — he saw it. Do not invent that kind of personal take. Stick to facts drawn from the newsletter HTML.

✅ OK (observational, factual, short):
  "João Gomes, Orochi, MC Paiva headlining"
  "runs through Saturday"
  "touring the new album"
  "free, family-friendly"
  "Sunday at Dragão"
  "last weekend before it closes"

❌ AVOID — these are AI writing tells. Any phrase that matches one of these patterns should be rewritten or deleted:

  * Puff / press-release: "rich tapestry", "breathtaking", "stunning", "vibrant celebration of", "legendary X presents", "high-energy", "must-see", "bustling"
  * Superficial -ing endings that tack on fake meaning: "a festival celebrating movement", "an event highlighting artistry", "bringing together X and Y"
  * Label-as-description (the event's own genre restated as the description): "a contemporary dance festival", "a digital art exhibition", "an organic farmers market with free entry". These add no information — just drop them.
  * Copula avoidance: "serves as", "stands as", "represents". Just use "is".
  * Rule-of-three flourishes: "speed, quality, and adoption". Vary list length.
  * Chatbot filler: "Here are some highlights:", "Hope this helps", "Let me know if...". The intro should feel written, not generated.
  * Negative parallelism: "It's not just X, it's Y". Just say what it is.
  * Em-dash overuse: the reference post uses em dashes but not on every line. If you find every event line has the same em-dash structure, vary — use "on Friday" or a period instead on some.

RHYTHM: vary sentence length. A three-word line ("Free entry.") mixed with a ten-word line is human. Six event lines all 12–15 words long is algorithmic.

CONTENT OF THE OBSERVATION (after the event name + venue + date): use facts only.
  - Lineup: "Lady Starlight headlining" / "João Gomes, Orochi, MC Paiva"
  - Scale: "northern Portugal's biggest trap festival"
  - Logistics: "runs through Saturday" / "free entry" / "last weekend before it closes"
  - Genre in plain words: "traditional fado program" / "contemporary dance"

If you have nothing factual to add beyond name + venue + date, STOP at the date. A bare "**Event** at Venue on Day" beats any adjective-soup filler. Target ≤10 words for the observation.

FORMAT — copy the reference post's SHAPE exactly:

Line 1 is the title, verbatim as shown (no "Title:" prefix, no quotes, just the text):
What's on in Porto this week — ${monthName(weekRange)} events roundup / O que há para fazer no Porto esta semana — agenda de ${monthNamePT(weekRange)}

Then blank line, then "***English:***", then blank line, then the intro sentence.

Then the events. EACH EVENT IS ONE LINE. The event name MUST be wrapped in **asterisks** for bold — copy this pattern exactly:

  **Event Name** at Venue on Day (Date) — short factual note

Variants are fine when a field doesn't exist (match the reference's flexibility):
  **Event Name** at Venue on Day (Date) — note            ← most common
  **Event Name** at Venue — note                          ← no separate date word
  **Event Name** — Day at Venue                           ← short fact, no note needed
  **Event Name** (Subtitle) — note                        ← no venue, has subtitle

RULE: the line ALWAYS starts with "**" (two asterisks), then the event name, then "**". No exceptions. A line without bold markers is broken output.

Separate each event paragraph with a blank line.

Then the sign-off: "Full list with dates, venues and prices at [oportoweekly.com](http://oportoweekly.com) if useful. I put it out every Thursday morning."

Then blank line, "**Portuguese:**", blank line, PT intro.

Then the SAME events in the SAME order as a BULLETED list (asterisk-space at the start). Each line also MUST keep the bold markers:

  * **Nome do evento** no Local em Dia (Data) — observação curta

Then the PT sign-off.

PORTUGUESE GRAMMAR (European Portuguese):
- Use "quinta-feira" / "sexta-feira" (not just "quinta" / "sexta" in most contexts)
- "na sexta-feira" / "no sábado" — match article to venue/day gender
- "dos Produtores" not "da Productores"
- "Casa da Música" (don't translate venue names)
- The reference's PT observations are excellent models — mirror their register

HARD CONSTRAINTS:
- Do NOT output "VERSION A" / "VERSION B" / "---" separators
- Do NOT add category headers, emoji, or decorative elements
- Do NOT invent prices, times, or lineups not in the HTML. If you can't find a venue or date for an event, drop it entirely.
- Target total length: 250–350 words across both sections

Newsletter HTML:
${html}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8000,
      // CRITICAL: Gemini 2.5 models default to spending tokens on internal
      // "thinking" before producing visible output. Zero-thinking is correct
      // for this task (pure reformatting). Without this, the first run hit
      // finishReason: MAX_TOKENS with 0 output tokens because thinking ate
      // the whole budget.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let res = await geminiPost(GEMINI_URL, body);
  if (res.status === 503 || res.status === 429) {
    console.log('[cron/reddit-draft] Flash busy, falling back to Flash-Lite');
    res = await geminiPost(GEMINI_URL_FALLBACK, body);
  }
  if (!res.ok) {
    throw new Error(`Gemini draft failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const finishReason: string = data?.candidates?.[0]?.finishReason ?? '';
  if (!text.trim()) {
    throw new Error(
      `Gemini returned empty draft (finishReason=${finishReason}). ` +
      `Likely the thinking budget consumed all output tokens — check thinkingBudget.`
    );
  }
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

  // The first line of the draft is the title. Split it out so you can copy
  // it separately into Reddit's "Title" field.
  const firstNewline = safe.indexOf('\n');
  const titleLine = firstNewline >= 0 ? safe.slice(0, firstNewline) : safe;
  const bodyBlock = firstNewline >= 0 ? safe.slice(firstNewline + 1).trimStart() : '';

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:720px;margin:20px auto;padding:0 16px;color:#1a1a2e;">
  <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">Reddit draft — r/porto</h1>
  <p style="color:#5a5a5a;margin:0 0 20px;">Week of ${weekRange}. Title is first, body below. Copy them into the matching fields of Reddit's post editor.</p>
  <p style="background:#faf7f0;border-left:3px solid #c9a96e;padding:10px 14px;font-size:13px;color:#3a3a3a;margin:0 0 20px;">
    <strong>Quick tips:</strong> comment on someone else's post first, then submit. Don't post at the same time every week — vary it. Reply conversationally to comments (don't link the newsletter). See docs/reddit.md.
  </p>

  <div style="font-size:11px;color:#8a8170;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Title</div>
  <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;background:#f4ede0;border:1px solid #e5dfd3;border-radius:6px;padding:12px 16px;margin:0 0 20px;">${titleLine}</pre>

  <div style="font-size:11px;color:#8a8170;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Body (markdown)</div>
  <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;background:#f4ede0;border:1px solid #e5dfd3;border-radius:6px;padding:16px;overflow-x:auto;margin:0;">${bodyBlock}</pre>

  <p style="color:#8a8170;font-size:11px;margin-top:24px;">Automated draft from /api/cron/reddit-draft · every Thursday 08:50 UTC</p>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  // Load latest newsletter slug (used as ledger key). Errors here happen
  // before any claim — surface as 500 directly.
  let slug: string;
  let weekRange: string;
  try {
    const indexRaw = await getFileContent('data/newsletters.json');
    if (!indexRaw) throw new Error('data/newsletters.json not found in repo');
    const index = JSON.parse(indexRaw) as NewsletterMeta[];
    const latest = index[0];
    if (!latest) throw new Error('No newsletters in the index yet');
    slug = latest.slug;
    weekRange = latest.weekRange;
  } catch (err) {
    console.error('[cron/reddit-draft] failed to load newsletter index:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Atomic claim outside the work try/catch.
  const { tryClaimStep, unmarkStep, getWeekEntry } = await import('@/lib/run-ledger');
  const claimed = await tryClaimStep(slug, 'reddit-draft');
  if (!claimed) {
    const entry = await getWeekEntry(slug);
    console.log(`[cron/reddit-draft] reddit-draft already claimed for ${slug} — skipping`);
    return NextResponse.json({
      skipped: true,
      reason: 'reddit-draft-already-claimed',
      slug,
      ledger: entry,
    });
  }

  try {
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
    // reddit-draft was claimed (and marked) at the top of the handler.
    return NextResponse.json({
      ok: true,
      slug,
      weekRange,
      draftBytes: draft.length,
    });
  } catch (err) {
    // Work failed after claim. The sendEmail call is the only irreversible
    // step, and it's the LAST step before the return. Any throw caught here
    // happened before sendEmail (or sendEmail itself threw, in which case
    // the editor inbox is the only audience — minor cost). Safe to unmark.
    console.error('[cron/reddit-draft] work failed after claim, unmarking:', err);
    await unmarkStep(slug, 'reddit-draft');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
