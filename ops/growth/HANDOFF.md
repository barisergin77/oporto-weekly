# Handoff — Oporto Weekly growth operation

**From:** the Claude Code session on the owner's Mac, which built and ran this
project from April to October 2026.
**To:** the Claude Code instance on the owner's EC2 server, which runs the
daily growth loop from 2026-10-18.
**Read this once fully, then `PLAYBOOK.md` every run.**

The Mac session's knowledge lived in its private memory; everything below is
that knowledge moved into the repo, so you start with the same context.

---

## 1. The project in one paragraph

oportoweekly.com is a free weekly newsletter + website about what to do in
Porto, in English and European Portuguese. Every Thursday a fully automated
pipeline researches the week's events with Gemini, writes the edition,
archives it to the site, emails both audiences (~56 subscribers on
2026-10-17), posts to Instagram via Buffer, and extracts every event into its
own page. Tuesdays it publishes a long-form guide. The owner (Baris, in Porto)
handed the growth side over on 2026-10-17: **more search traffic, more
visibility, more subscribers**. He wants to be contacted only for decisions
that are genuinely his.

## 2. Owner preferences (follow these)

- **Contact only for critical decisions.** Otherwise act, and record what you
  did in `LOG.md`.
- **Daily cadence, one improvement per run, freeze Wed 18:00 – Thu 23:59 UTC.**
  He chose this over every-3-hours because changes must be measurable and
  the newsletter must never be put at risk.
- **Keep BnB Genius out of this project entirely.** It is a separate business
  that happens to share his Facebook account. Never suggest cross-promotion.
- **Reddit is not an option** — he can no longer post there.
- Be honest about mistakes and uncertainty; state numbers, not adjectives.
  He reads summaries on his phone: short, plain, specific.

## 3. Stack and where things are

- Next.js 14 App Router, TypeScript, on Vercel **Pro** (project
  `oporto-weekly-app`). Repo `barisergin77/oporto-weekly`, branch `main`.
- Email: Resend (Audiences `RESEND_AUDIENCE_EN` / `_PT`). AI: Gemini 2.5
  (Pro → Flash fallback); images Gemini + Imgur. Instagram: Buffer API.
- Crons are **GitHub Actions** (`.github/workflows/cron-*.yml`) that POST to
  `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`. GitHub's scheduler
  fires **hours late and out of order** — never assume a time.
- Content: `data/events/*.json` (one file per event), `data/blog-posts.json`
  + `public/blog/*.html`, `data/newsletters*.json` + `public/newsletters/`.
- Analytics: Search Console (`sc-domain:oportoweekly.com`), GA4 property
  `555124096` via GTM `GTM-KZ9GGM8W`, consent banner (Consent Mode v2).
- Live commit: `https://oportoweekly.com/api/version`. Ledger/status:
  `/api/cron/status` (Bearer). Health: `POST /api/cron/health` (Bearer).

## 4. The Thursday pipeline — do not touch without owner approval

`cron-newsletter.yml` orchestrates: generate + archive → wait until the
deploy serves the archive → send EN → PT translate + send → Instagram.
(Reddit draft retired 2026-10-18.) The run-ledger (`data/run-ledger.json`, `lib/run-ledger.ts`)
records each step per week; the scheduler-watchdog re-dispatches any step
still missing 5 hours late.

Rules that exist because each was learned through an outage (Apr–Oct 2026):

1. **Recoverable work is idempotent via its artifact, not a claim.**
   Generation skips if the archived HTML exists. A Vercel timeout/OOM skips
   the JS `catch`, so a claim taken before slow work strands forever
   (2026-06-18: the edition never shipped).
2. **The atomic send claim sits immediately before `sendBatch`**, never held
   across slow work. Double sends happened twice before this.
3. **Every function stays well under 300 s**; every fetch has a timeout and
   a fallback (e.g. a static hero image).
4. **Never compute the week slug from `now()`** — use `thursdayWeekStart()`
   / `currentWeekSlug()` (2026-05-01: a Friday run re-sent the newsletter
   under a phantom slug).
5. **The newsletter is only sent once the archive page is live** (2026-06-11:
   email links 404'd because the send raced the deploy).
6. **Design the retry, not just the refusal.** The pick-date fact-check
   (`verifyPickDates`) once blocked a whole edition and every retry repeated
   the same failure (2026-10-01). Wrong-week picks are now remembered in
   `data/pick-date-blocklist.json` so retries exclude them.

If the pipeline fails on a Thursday: read `/api/cron/status` and the failed
GitHub Actions log, fix the cause, and dispatch `cron-newsletter.yml` — it is
safe to re-run (idempotent). A stuck claim is cleared by removing that
week's entry from `data/run-ledger.json`. Tell the owner the same day.

## 5. Deploys

- Every push to `main` deploys, **except** commits whose changes are only
  bookkeeping (`data/run-ledger.json`, `subscriber-history.json`,
  `pick-date-blocklist.json`, `signup-sources.json`), `ops/`, or
  `data/events/*.json`. The last group is **deferred** and published by
  `deploy-flush.yml` (Thu 17:00 + daily 21:00 UTC). Logic:
  `scripts/vercel-ignore-build.sh`. Anything uncertain builds.
- **Env var changes:** `vercel redeploy` gets skipped by that step. Bump
  `.deploy-trigger` and push instead.
- History: on Hobby, deployment storage hit its 10 GB cap twice (Sep, Oct).
  Pro removed the cap; the skip rules stay because they cost nothing.

## 6. SEO lessons already paid for

- **A `<head>` change on existing pages must bump a revision constant in
  `app/sitemap.ts`** (`notBefore()` pattern). Otherwise Google keeps
  validating its stale copy: a correct hreflang fix sat invisible for seven
  weeks in 2026 because lastmod and `changefreq: never` said "unchanged".
- hreflang must be bidirectional (EN ↔ PT) or Google ignores it.
- Never change a slug — URLs carry the rankings. Retitle instead.
- Placeholder venues ("TBC", "Various venues", "City Centre", "Downtown")
  get no venue page: `hasVenuePage()` in `lib/events.ts`. Extend the regex
  if new ones appear.
- `/newsletters/*.html` (raw email files) are `noindex`.
- Google Indexing API quota: **200 URLs/day**; the daily resubmit cron uses
  ~108. Send only the URLs you changed.
- Two odd GSC verdicts (Google choosing an unrelated site as canonical for two
  PT pages) were re-crawled on 2026-09-17 and looked like a Google quirk.
  Re-check them before chasing.

## 7. Credentials (values are in `.env.local`, never in git)

| Variable | Used for | Expires |
|---|---|---|
| `GITHUB_TOKEN` | all ledger/archive commits; git push from EC2 | **2027-01-02** |
| `BUFFER_API_KEY` | Instagram posting | ~2027-01-02 (90-day key, Buffer shows no date) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GSC + GA4 + Indexing API (base64 JSON) | — |
| `CRON_SECRET` | every cron/health/status call | — |

The daily health check emails the owner when the GitHub token has ≤14 days
left or either key stops working. Rotation procedure: validate the new key,
`vercel env add <NAME> production --sensitive --force`, bump
`.deploy-trigger`, push, confirm with the health check. Update the EC2
`.env.local` and git credential too.

## 8. State of growth on handoff (2026-10-17)

Baseline: 343 search clicks / 28 days (avg position 9.3, up from 16.9),
56 subscribers growing ~1.4/week, 0 attributed signups (tracking began that
day). Shipped on 2026-10-17 — all logged in `LOG.md` with measure dates:

- Subscribe forms on event / guide / venue pages + signup attribution.
- Facts-first search snippets for events, archives, venues; search-phrased
  homepage titles; 9 guides retitled year-neutral.
- Month hubs `/porto-events/<month>` and `/pt/eventos/<mes>`.
- Removed a nested second `<head>`/`<title>` from ~70 edition pages.
- `/llms.txt`.

First results are due **2026-10-31** (signups) and **2026-11-07 / 11-14**
(search). Check them before building on top of them.

## 9. Open items needing the owner

- **Instagram follower metric:** @oportoweekly must be linked to the
  "Oporto Weekly" Facebook Page (from the Instagram app). Meta temporarily
  restricted the action on 2026-09-20 after repeated retries. Once linked:
  Graph API Explorer → app 1365027752320457, permissions `instagram_basic,
  pages_show_list, pages_read_engagement` → long-lived token (needs the app
  secret) → never-expiring Page token → `IG_GRAPH_TOKEN` + `IG_USER_ID`.
  The code in `lib/instagram.ts` is ready.
- ~~Retiring the Reddit draft step~~ — done 2026-10-18 (owner approved).
- **GA4 `sign_up` key event** in GTM (optional; server-side attribution
  already works).

## 10. Working style that worked

- Measure first (`scripts/growth-metrics.ts`), then pick from the data.
- Verify against production as the "before" when changing shared markup:
  identical page heights caught a dropped font link before it shipped.
- Read before overwriting, and check `git status` for "modified" on files you
  think are new.
- One retry against a third-party service, then stop.
- When you are wrong, say so in the log plainly and fix it.
