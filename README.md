# Oporto Weekly

A curated Porto events newsletter — generated weekly by AI, sent via email, published to the web, and shared on Instagram. Entirely automated.

**Live:** [oportoweekly.com](https://oportoweekly.com) · **Instagram:** [@oportoweekly](https://www.instagram.com/oportoweekly/)

---

## What it does

Every Thursday morning, without human intervention:

1. Researches Porto events across 6 categories (Gemini + Google Search)
2. Generates a unique hero image (Gemini 3 Pro Image / Nano Banana Pro)
3. Writes a full travel-magazine-style HTML newsletter (Gemini 2.5 Pro)
4. Sends it to EN subscribers (Resend)
5. Translates to European Portuguese and sends to PT subscribers
6. Archives the edition to the public website
7. Creates and schedules an Instagram post (Buffer)
8. Runs a health check and emails an alert if anything broke
9. Notifies Google, Bing, and RSS aggregators (IndexNow + GSC + WebSub)

Separately, every Tuesday: generates a long-form blog article with two AI-generated images.

---

## Subsystem docs

Deep-dive docs live in [`docs/`](./docs/). These are the canonical references when reviewing a specific part of the project later:

- [`docs/subscribers.md`](./docs/subscribers.md) — Resend Audiences (previously Beehiiv), migration script, ops runbook, disaster recovery.
- [`docs/search-engines.md`](./docs/search-engines.md) — sitemap, IndexNow / Google Indexing API / GSC / WebSub pipeline, manual + daily re-submit, diagnostics.
- [`docs/reddit.md`](./docs/reddit.md) — weekly r/porto post draft generator (manual paste, not auto-posted), posting etiquette, regenerate-on-demand.
- [`docs/events.md`](./docs/events.md) — per-event + per-venue pages, extraction/image pipeline, venue slug canonicalisation, ops runbook.

The README stays high-level (what + where); details live in the subsystem doc.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Vercel Cron Jobs                            │
├──────────────────────────────────────────────────────────────────────┤
│  Thu 08:00 UTC  ──►  /api/cron/newsletter    (EN newsletter)         │
│  Thu 08:15 UTC  ──►  /api/cron/newsletter-pt (PT translation + send) │
│  Thu 08:30 UTC  ──►  /api/cron/health        (post-send smoke test)  │
│  Thu 08:45 UTC  ──►  /api/cron/instagram     (IG post via Buffer)    │
│  Tue 09:00 UTC  ──►  /api/cron/blog          (long-form article)     │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Content Pipeline                               │
├──────────────────────────────────────────────────────────────────────┤
│  Gemini Google Search  (6 queries/week)                              │
│  Gemini 2.5 Pro        (article + newsletter generation)             │
│  Gemini 3 Pro Image    (hero images, IG images, blog images)         │
│         │                                                            │
│         ▼                                                            │
│  Imgur  (public image hosting for emails + Instagram)                │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Delivery                                       │
├──────────────────────────────────────────────────────────────────────┤
│  Resend (batch email, 100/req)       ──► EN + PT subscribers         │
│  Buffer GraphQL API                   ──► @oportoweekly Instagram    │
│  GitHub API (commitFiles, atomic)    ──► oporto-weekly repo          │
│         │                                                            │
│         ▼                                                            │
│  GitHub push  ──►  Vercel auto-deploy  ──►  oportoweekly.com         │
└──────────────────────────────────────────────────────────────────────┘
```

**Key design choice:** Vercel's serverless filesystem is read-only, so archived editions can't be written directly. Instead, the cron commits HTML + JSON index files to the GitHub repo via the Git Data API. That push triggers a Vercel redeploy (~30-45s) and the new edition appears on the website.

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router, TypeScript) | |
| Hosting | Vercel | Cron jobs, serverless functions, CDN |
| Subscribers | Resend Audiences | One audience per language (EN, PT). IDs in `RESEND_AUDIENCE_EN` / `RESEND_AUDIENCE_PT`. Same API key as sending. Beehiiv is the previous vendor — `BEEHIIV_API_KEY` is kept in env as a fallback in case we ever migrate back; nothing in production reads it. |
| Email delivery | Resend | From `hello@oportoweekly.com` (Cloudflare forwards → Gmail). Includes `List-Unsubscribe` + `List-Unsubscribe-Post` headers for Gmail's native one-click unsubscribe. |
| AI text | Gemini 2.5 Pro (primary) → Flash → Flash-Lite (fallback chain) | |
| AI images | Gemini 3 Pro Image (Nano Banana Pro) via `gemini-3-pro-image-preview:generateContent` with `responseModalities: ['TEXT','IMAGE']` | |
| Image hosting | Imgur | Public URLs for email recipients + Instagram (Buffer needs public URLs). |
| Instagram | Buffer GraphQL API | Schedules to `@oportoweekly` queue. |
| SEO | IndexNow (Bing/Yandex) + Google Indexing API + WebSub | Fires after every edition + blog post. |
| Auth (for GitHub API) | Personal access token (`GITHUB_TOKEN`) | Used to commit archives from the cron. |

---

## Cron Schedule (GitHub Actions)

Vercel Hobby plan caps projects at 2 cron jobs with 10s max duration — our pipelines need 5 crons and 3+ minutes. So we schedule via GitHub Actions (free, unlimited) that simply `curl` our Vercel endpoints. The actual work runs on Vercel as a regular API invocation (300s duration).

Workflows live in `.github/workflows/cron-*.yml`. Each one passes `Authorization: Bearer ${CRON_SECRET}` (stored as a GitHub Actions secret). Endpoints reject requests without the valid secret (`lib/cron-auth.ts`).

| Time (UTC) | Time (Porto local, WEST) | Cron | What it does |
|---|---|---|---|
| Thu 08:00 | Thu 09:00 | `newsletter` | Research → hero image → generate HTML → send EN → archive |
| Thu 08:15 | Thu 09:15 | `newsletter-pt` | Read EN HTML from repo → translate via Gemini → send PT → archive |
| Thu 08:30 | Thu 09:30 | `health` | Fetch every page; if any fail → email alert |
| Thu 08:45 | Thu 09:45 | `instagram` | Parse top 5 picks from newsletter → generate IG image → upload to Imgur → caption → schedule via Buffer |
| Thu 08:50 | Thu 09:50 | `reddit-draft` | Format this week's events as r/porto markdown → email two versions to editor (manual paste, not auto-posted) |
| Thu 09:15 | Thu 10:15 | `event-images` | Backfill press photos for new events → scrape og:image → upload to Imgur → atomic commit |
| Thu 09:30 | Thu 10:30 | `event-descriptions` | 3-paragraph long-form detail-page copy for new events → atomic commit |
| Tue 09:00 | Tue 10:00 | `blog` | Research topic → generate article → 2 images → commit via GitHub API |

---

## Environment Variables

All set in Vercel (Production). Copy `.env.example` for local dev.

| Variable | Purpose | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Gemini research, content, images | [aistudio.google.com](https://aistudio.google.com) |
| `RESEND_API_KEY` | Send emails + read/write Audiences (subscriber storage) | [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_AUDIENCE_EN` | Audience id for English subscribers | `npm run migrate-subs setup` prints this |
| `RESEND_AUDIENCE_PT` | Audience id for Portuguese subscribers | `npm run migrate-subs setup` prints this |
| `BEEHIIV_API_KEY` | **Kept as fallback** — previous subscriber vendor. Not read in production. Needed locally if you ever run the migration script to restore from Beehiiv. | Beehiiv → Settings → API |
| `GITHUB_TOKEN` | Commit archives via Git Data API | Personal access token, scope: `Contents: Read and write` on `oporto-weekly` repo |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Indexing API + GSC sitemap submit | GCP → IAM → Service Accounts → Keys → JSON |
| `INDEXNOW_KEY` | Bing/Yandex instant indexing | Arbitrary string, also saved in `public/<KEY>.txt` |
| `IMGUR_CLIENT_ID` | Upload newsletter hero + IG images | [api.imgur.com/oauth2/addclient](https://api.imgur.com/oauth2/addclient) |
| `BUFFER_API_KEY` | Schedule Instagram posts | Buffer → Developers → Generate token |
| `BUFFER_CHANNEL_ID` | Target Buffer channel (IG) | Buffer → channel URL query param |
| `NEWSLETTER_SECRET` | Bearer auth for `/api/send-newsletter` (legacy, optional) | `openssl rand -hex 32` |

---

## Project Structure

```
oporto-weekly-app/
├── app/
│   ├── layout.tsx                           # Root layout, metadata defaults
│   ├── page.tsx                             # EN homepage (latest newsletter + subscribe sidebar)
│   ├── pt/page.tsx                          # PT homepage (same layout, PT content)
│   ├── archive/
│   │   ├── page.tsx                         # EN archive list
│   │   └── [slug]/page.tsx                  # Individual EN edition (same sidebar as home)
│   ├── pt/arquivo/
│   │   ├── page.tsx                         # PT archive list
│   │   └── [slug]/page.tsx                  # Individual PT edition
│   ├── blog/
│   │   ├── page.tsx                         # Blog list (card grid)
│   │   └── [slug]/page.tsx                  # Individual article (hero, serif h1, author signature)
│   ├── porto-events/page.tsx                # SEO landing page for "porto events" keyword
│   ├── components/
│   │   ├── Header.tsx                       # Shared top nav (light theme)
│   │   └── Footer.tsx                       # Shared footer
│   ├── SubscribeForm.tsx                    # EN subscribe form
│   ├── SubscribeFormPT.tsx                  # PT subscribe form
│   ├── icon.tsx                             # Dynamic favicon (OW monogram)
│   ├── apple-icon.tsx                       # iOS home screen icon (180x180)
│   ├── opengraph-image.tsx                  # Default OG social card
│   ├── archive/[slug]/opengraph-image.tsx   # Per-edition OG card (dynamic)
│   ├── sitemap.ts                           # All URLs for Google
│   ├── news-sitemap.xml/route.ts            # Google News-specific sitemap
│   ├── feed.xml/route.ts                    # RSS feed (with WebSub hub link)
│   ├── robots.ts                            # robots.txt
│   ├── globals.css                          # Responsive styles + dark-to-light newsletter recolors
│   └── api/
│       ├── subscribe/route.ts               # POST {email, lang} → Resend Audience + welcome email
│       ├── unsubscribe/route.ts             # GET/POST → flips `unsubscribed` in Resend Audiences + confirmation page
│       ├── send-newsletter/route.ts         # Legacy manual send endpoint (bearer-auth'd)
│       └── cron/
│           ├── newsletter/route.ts          # Thursday 08:00 — EN newsletter
│           ├── newsletter-pt/route.ts       # Thursday 08:15 — PT translation + send
│           ├── health/route.ts              # Thursday 08:30 — smoke test
│           ├── instagram/route.ts           # Thursday 08:45 — IG post via Buffer
│           ├── reddit-draft/route.ts        # Thursday 08:50 — r/porto draft email (manual paste)
│           └── blog/route.ts                # Tuesday 09:00 — blog article
├── lib/
│   ├── archive.ts                           # Newsletter read/write helpers, stripEmailFooter, replaceHeaderWithBanner
│   ├── blog.ts                              # Blog post data helpers
│   ├── audiences.ts                         # Subscriber fetch/add/remove via Resend Audiences (one audience per language)
│   ├── resend-client.ts                     # sendEmail, sendBatch (adds List-Unsubscribe headers)
│   ├── imagen.ts                            # Gemini 3 Pro Image generation
│   ├── imgur.ts                             # Imgur upload helper (shared between newsletter + IG)
│   ├── github.ts                            # GitHub Git Data API — atomic multi-file commits
│   ├── search-engines.ts                    # IndexNow + Google Indexing API + WebSub ping
│   └── design.ts                            # Design tokens (colors, typography)
├── data/
│   ├── newsletters.json                     # EN archive index (newest first)
│   ├── newsletters-pt.json                  # PT archive index
│   └── blog-posts.json                      # Blog post metadata
├── public/
│   ├── newsletters/<slug>.html              # Archived EN + PT newsletter HTML
│   ├── blog/<slug>.html                     # Blog post body HTML
│   ├── blog/images/<slug>-hero.png          # Blog hero/inline images
│   ├── preview-newsletter.html              # Static design reference for the weekly email
│   ├── <INDEXNOW_KEY>.txt                   # IndexNow verification file
│   └── favicon.ico / icon.png               # Auto-generated from app/icon.tsx
├── vercel.json                              # Cron schedule
└── next.config.js / tsconfig.json           # Standard
```

---

## Design System

Tokens in `lib/design.ts` — used everywhere (chrome + prompts).

| Token | Value | Use |
|---|---|---|
| `colors.bg` | `#faf7f0` | Page background (warm cream) |
| `colors.bgAlt` | `#efe8da` | Alt sections, footer |
| `colors.bgSoft` | `#f4ede0` | Tip callout, CTAs |
| `colors.card` | `#ffffff` | Cards |
| `colors.divider` | `#e5dfd3` | Borders/hairlines |
| `colors.text` | `#1a1a1a` | Body text |
| `colors.textSoft` | `#5a5a5a` | Secondary text |
| `colors.heading` | `#1a1a2e` | Titles (dark navy) |
| `colors.accent` | `#c9a96e` | Gold — eyebrows, dividers, links |
| `typography.serif` | `Georgia, "Times New Roman"` | Headings |
| `typography.sans` | `Inter, system-ui, Arial` | Body |

**Newsletter email**: self-contained HTML with inline styles only, max-width 640px, table-based layout (email client compat).

**Old archived editions** (pre-redesign) use a dark navy theme; `app/globals.css` has CSS overrides that recolor them to the new light theme when rendered on the web.

---

## Local Development

```bash
cp .env.example .env.local
# Fill in the keys

npm install
npm run dev
# http://localhost:3000
```

To test a cron locally: `curl http://localhost:3000/api/cron/blog` (or swap in any cron path).

⚠️ Local cron runs will actually send emails / post to Instagram / commit to GitHub if the corresponding API keys are set. Comment out the send/commit steps when testing.

---

## Deploy & CI/CD

Vercel is connected to the GitHub repo. Every push to `main` triggers a production deploy (~30-45s).

```bash
# Standard flow
git add .
git commit -m "your change"
git push origin main
# Vercel auto-deploys — check status with `vercel ls` or the dashboard
```

Manual production deploy from CLI:

```bash
vercel deploy --prod --yes
```

---

## Operations

### Trigger a cron manually

```bash
curl -s --max-time 300 https://oportoweekly.com/api/cron/newsletter
curl -s --max-time 300 https://oportoweekly.com/api/cron/newsletter-pt
curl -s --max-time 300 https://oportoweekly.com/api/cron/health
curl -s --max-time 300 https://oportoweekly.com/api/cron/instagram
curl -s --max-time 300 https://oportoweekly.com/api/cron/blog
```

⚠️ Manually triggering `newsletter` sends real emails. Don't do this for testing unless you want subscribers to get the email.

### View Vercel logs

```bash
cd oporto-weekly-app
vercel logs --environment production --since 10m --no-follow --no-branch --expand
```

### List subscribers

```bash
# Resend dashboard: https://resend.com/audiences — filter by audience.
# Or programmatically:
npm run migrate-subs verify    # shows EN/PT active counts + any drift
```

Legacy Beehiiv list (kept in case we restore from there):

```bash
curl -s "https://api.beehiiv.com/v2/publications/pub_8e15aa9e-4215-4fe3-b803-d991916b0dd9/subscriptions" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" \
  | jq -r '.data[] | "\(.email) | \(.status) | utm_source=\(.utm_source)"'
```

### Add an env var

```bash
echo -n "value" | vercel env add VAR_NAME production
```

### Force-redeploy after env var change

```bash
vercel deploy --prod --yes
```

---

## Troubleshooting

Common issues we've hit and how they were fixed — documented so we don't re-solve them later.

**Next.js fetch caching returns stale GitHub HEAD SHA.** Next.js 14 App Router caches `fetch()` GET responses by default. `lib/github.ts` passes `cache: 'no-store'` to every GitHub API call — don't remove this or commits will fail with "Update is not a fast forward".

**Subscriber storage lives in Resend Audiences, not Beehiiv.** One audience per language (`RESEND_AUDIENCE_EN` / `RESEND_AUDIENCE_PT`). The migration script at `scripts/migrate-beehiiv-to-resend.ts` is idempotent — re-running it after Beehiiv → Resend is one-way safe. `BEEHIIV_API_KEY` is kept in env as a fallback but no production code reads it.

**Resend `contacts.update` takes an `id`, not an `email`** (SDK v3.2.0). `lib/audiences.ts` looks up the id via `contacts.list` before every update. That's O(N) per unsubscribe; fine for <1k contacts, revisit if the list grows past Resend's default list-page size.

**Gemini rate limits.** We use a three-model fallback chain: `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`. The first one that's not rate-limited wins. Don't remove this or the newsletter will fail on the Thursday after we hit free-tier limits.

**Imagen 3 deprecated.** The API endpoint `imagen-3.0-generate-001:predict` returns 404 for new API keys. We use `gemini-3-pro-image-preview:generateContent` with `responseModalities: ['TEXT','IMAGE']` instead (see `lib/imagen.ts`).

**Images need public URLs for email + Instagram.** Vercel deploys take 30-60s, too slow for a cron that's mid-send. We upload to Imgur first (`lib/imgur.ts`), use that URL in the email body, and the Imgur URL sticks in the archived HTML too.

**Vercel serverless filesystem is read-only.** All archiving goes through the GitHub API (`lib/github.ts` → `commitFiles()`). The push triggers a redeploy which makes the new edition visible on the website.

**`List-Unsubscribe` headers.** Gmail, Outlook, Apple Mail show a native one-click unsubscribe button in the inbox UI when these headers are present. `lib/resend-client.ts` adds them on every send. The `SUBSCRIBER_EMAIL` placeholder in the generated HTML is replaced per-subscriber at send time.

---

## Manual scripts

Scripts in `scripts/` run locally (not on Vercel). Useful for backfills:

| Script | Purpose |
|---|---|
| `scripts/generate-edition.mjs` | Manually generate a newsletter edition |
| `scripts/generate-instagram.mjs` | Legacy — replaced by `/api/cron/instagram`. Kept for reference / manual IG posts. |

---

## Roadmap

- Google News Publisher Center application (technical setup complete, submission pending)
- Per-event thumbnails in the newsletter (currently 1 hero image + section emojis only)
- Weekly retrospective email to self — open rates, click rates, unsubscribes
- Vercel Blob for newsletter images (alternative to Imgur if it goes down)
