# Growth log

Newest first. One entry per change. Fill in **Result** on the measure date.

Baseline 2026-10-17 (`metrics/2026-10-17.json`): search 343 clicks / 14,693
impressions / pos 9.3 over 28 days (prev 28: 191 / 10,293 / 16.9);
subscribers 56 active (34 EN, 22 PT), ~1.4 net/week; signups by page: none
recorded yet (tracking started today).

## 2026-10-23 — Daily loop (11:13 UTC): observe only, #24 measured
- No code or deploy. The entry below says today's loop should be skipped
  (`~/oporto-growth/skip-2026-10-23`). Today's one deploy (d612f76) already
  shipped in the interactive session, and rule 5 allows one per day. I ran
  anyway, so I kept this run to measuring and logging.
- Metrics (`metrics/2026-10-23.json`): 316 clicks / 14,402 impr / pos 9.83
  over 28d (yesterday 322 / 14,369 / 9.75; prev 28d 240 / 11,477 / 14.0).
  Last 7d 78 clicks vs 81, impressions 3,049 vs 5,242, CTR 2.6% vs 1.5%.
  GA4 7d 34 users / 39 sessions / 68 PV (prev 33 / 40 / 66); 20 organic, 10
  organic social, 5 AI, 4 direct; GA4 `sign_up` 1. **Subscribers 55 on the
  10-22 snapshot (56 → 55: EN 34 → 33, PT 22)**, the first net drop. Signups
  attributed in 28d: 1 (/porto-events/this-weekend, 10-22).
- Results due:
  - Reddit retirement (10-18): **worked.** The 10-22 ledger has research, en-web,
    en-email, pt-web, pt-email and instagram all done by 13:21 UTC, and there
    is no reddit step.
  - Forward-scan quality gate (10-21): **no change.** Today's Fri 07:00 cron
    committed nothing (there is no "chore: forward scan" commit since 10-20),
    so no thin records went out and no events were published either. The cron
    ran on the old code: #22 (3fff59e) deployed at 08:19 UTC. I couldn't read
    the cron output (`gh run list` needs approval). Next real test: Mon 10-26
    07:00 cron.
- #24 measured (GSC, 2026-05-01 → 10-20): `…-the-2026-guide` has 15 clicks /
  929 impr / pos 8.8 ("coffee shops porto" 29 impr at pos 4.3, "best pastel de
  nata porto" pos 5.8). `…-a-2026-guide` has 2 / 62 / 11.7. PT copies: 0
  clicks. Keep **the-2026-guide**, merge in anything unique from a-2026-guide
  and 301 a-2026 (EN + PT) to it. No owner decision is needed: the backlog
  item already says to 301 the weaker page, and 2 clicks isn't real traffic.
  Ready for the next run.
- Next run (Sat 10-24): #24 (merge + 301, sitemap bump) or #23 (grounding
  sources). Do #23 before Mon's 07:00 cron if it's small.
- Needs owner: nothing to decide. FYI: subscribers went 56 → 55. It's one
  unsubscribe, so watch it, but nothing to act on yet.

## 2026-10-23 — Forward-to-a-friend block (#6) + forward-scan yield (#22)
- Why: owner-approved referral loop (#6); forward scan verified 0 of 12 on today's
  prod dry run (7 candidates were /agenda listing pages).
- Change: `lib/forward-block.ts` adds a "Share the weekend" block (mailto share +
  utm_campaign=forward signup link, EN+PT) above the footer at send time only;
  `scripts/send-test-edition.ts` sends a [TEST] copy to one address. Forward scan:
  source stats, network cause codes, listing/search URLs dropped, DNS check, one
  rescue search for URL-less candidates. Done in an interactive session; daily
  loop skipped today (~/oporto-growth/skip-2026-10-23).
- Verified: tsc + next build OK; EN+PT [TEST] emails to owner; listing filter
  12/12 on samples. GA4 sign_up now a key event (#7, owner).
- Expect: first forward-attributed signups after Thu 10-29 send; forward scan
  verified > 0 per run.
- Measure on: 2026-11-12 (forward signups), next Mon/Fri cron (scan yield)
- Result:

## 2026-10-22 — Freeze day (Thu): observe only, no change shipped
- Run at 09:00 UTC, inside the freeze, so no code, deploy or cron changes.
- Metrics (`metrics/2026-10-22.json`): 322 clicks / 14,369 impr / pos 9.75
  over 28d (yesterday 318 / 14,304 / 9.66; prev 28d 229 / 11,450 / 14.4).
  Last 7d 83 clicks vs 79 prev; impressions 2,958 vs 5,401 (iberanime spike
  gone), so 7d CTR is 2.8% vs 1.5%. GA4 7d 34 users / 39 sessions / 71 PV
  (prev 30 / 37 / 56); 21 organic search, **9 organic social (yesterday's
  snapshot had none)**, 5 AI assistant, 4 direct. Subscribers 56 (snapshot
  comes with today's send).
- **First attributed signup:** EN, `/porto-events/this-weekend`, 2026-10-22
  00:15 UTC (#19's page + #6's form). Together with the 0 → 9 social
  sessions, this fits the Porto Expats "this weekend" post drafted for Wed
  10-21 (`drafts/porto-expats-post-2026-10-21.txt`, now committed). I can't
  confirm the owner posted it; one signup is not a trend.
- Results due: Reddit retirement (10-18) is measured on today's Thursday
  run. At 09:00 the ledger has no `october-22-28-2026` entry yet (the cascade
  normally runs ~13:00–15:00 UTC), so I'll check it on the next run. Nothing
  else is due before 10-23.
- Next safe run: Fri 10-23 after the 07:00 forward-scan cron. First read
  that cron's committed records (10-21 measure), then #6 (referral block,
  approved; test send to the owner first) or #22 (scan yield). One deploy.
- Needs owner: nothing to decide. Useful to know: was the Porto Expats post
  published on Wed 10-21? (Helps attribute the social sessions.)

## 2026-10-21 — Forward scan: quality gate, source URLs, JSON-LD (backlog #21)
- Metrics (`metrics/2026-10-21.json`): 318 clicks / 14,304 impr / pos 9.66
  over 28d (yesterday 324 / 14,449 / 9.53; prev 28d 227 / 11,358 / 14.7).
  Last 7d 80 clicks vs 85 prev; impressions 2,917 vs 5,478 as the iberanime
  spike rolls off, so 7d CTR is up to 2.7% (prev 1.6%). GA4 7d 30 users / 35
  sessions / 68 PV (prev 30 / 36 / 49); 24 organic, 5 AI assistant.
  Subscribers 56 (next snapshot Thu). Attributed signups: 0. No result due
  before 10-22.
- Why: had to ship before Fri 07:00 cron. Yesterday's only committed record
  was filler ("The page is about an event named…"), and 21 of 22 rejections
  were "page not fetchable" with no cause logged.
- Change (`lib/forward-scan.ts`, 6bef1dc):
  - Thin/meta copy is rejected: anything talking about "the page / website /
    listing", "is not mentioned/provided", or a long description under 60
    words. The reader prompt also says to write about the event, never the
    page.
  - Discovery collects the grounding-search source URLs (vertexaisearch
    redirects resolved via Location). Per candidate it tries up to 3 URLs:
    sources whose path shares a name token (same host first), then the
    model's URL.
  - Fetch failures now give a cause per URL (HTTP status, not HTML, too
    little text, timeout, network error).
  - JSON-LD Event objects (`@graph` included) are parsed and put first as
    plain quotable fields. If exactly one LD event matches the name, its
    startDate must equal the reader's date.
- Verified: tsc; build 2,115 pages, route dynamic. Offline: the filter
  catches the 10-20 "Tempo de Natal" record and passes normal copy; URL
  matching tested; JSON-LD tested on single, `@graph` and malformed pages.
  Live: /api/version = 6bef1dc; health ok (9/9).
- Production dry run after deploy: 30 discovered, 3 duplicates, 11 checked,
  1 verified (Fingertips again, now from superbockarena.pt/evento/fingertips/,
  description is factual). 7 Gemini calls, 28.6k in / 19.8k out tokens.
  **Yield isn't fixed yet.** The new logging shows why:
  - 7 of 11 failed at the network level ("fetch failed"). From here:
    hardclub.com resets the connection (ECONNRESET, likely a bot block);
    `www.teatrosabandeira.com` doesn't exist (ENOTFOUND, a made-up domain);
    ticketline.pt returns 200 from EC2 but fails from Vercel (probably blocks
    datacenter IPs).
  - Several model URLs are listing or search pages (`/agenda/`,
    `/pesquisa?q=`).
  - No rejected candidate had a matching grounding source. The run doesn't
    log the source count, so I can't tell yet whether sources aren't being
    returned, aren't resolving, or just don't match.
  - 4 rejections were "page does not confirm the event".
  The quality gate (the must-have before Friday) is live. Yield work moved
  to backlog #22 for the next run (one deploy per run).
- Expect: no more thin or meta records. Friday's real run commits ≤1–2
  events, all factual.
- Measure on: 2026-10-23 (Fri cron output: committed records read clean);
  yield with #22 by 2026-11-03.
- Result (10-23): no change. Fri cron committed 0 records (ran before #22
  deployed), so nothing thin went out but nothing was published either.
  Yield check is on 11-03.

## 2026-10-20 — Forward event scan, phase 1 (owner priority, backlog #20)
- Metrics (`metrics/2026-10-20.json`): 324 clicks / 14,449 impr / pos 9.53
  over 28d (yesterday 328 / 14,599 / 9.44; prev 28d 221 / 11,074 / 15.2).
  Last 7d 80 clicks vs 86 prev, impressions 3,317 vs 5,063: the iberanime
  spike is rolling off, so 7d CTR is back to 2.4% (prev 1.7%). GA4 7d 29
  users / 34 sessions / 66 PV (prev 30 / 36 / 52); 22 organic, 5 AI
  assistant. Subscribers 56 (next snapshot Thu). Attributed signups: 0. No
  result due before 10-22.
- Design: `/api/cron/forward-scan` + `cron-forward-scan.yml` (Mon + Fri
  07:00 UTC). It's a new workflow outside the Thursday cascade (not in the
  watchdog, ledger or send path). The owner asked for it explicitly in #20.
  The route refuses to run Wed 18:00 → Thu 23:59 UTC in case GitHub fires
  late. Window: day after the next edition's week → +70 days (so it never
  researches the week the Thursday pipeline covers). Steps: 2 grounded
  Gemini Flash discovery calls → fuzzy dedupe against data/events (name
  tokens + overlapping dates or same venue) → fetch the official URL
  ourselves (social/aggregator hosts blocked). Gemini reads only that page.
  Accept only if the name, date and venue quotes literally occur in the
  fetched text, the date quote carries the day of the month, the date is
  inside the window and the venue is in the Porto area. Price and
  descriptions come from the page. Then PT translation + image; anything not
  fully enriched is dropped, so the Thursday enrichment crons (which pick
  the latest-dated un-enriched events first) aren't crowded out. Max 12
  verified / 5 committed per run, one atomic commit, `data/events` only →
  published by deploy-flush. `sourceEdition: "forward-scan"` (archive,
  Instagram and pick history ignore it); the weekend page's "listings
  pending" notice ignores forward events. Dry run: `?dryRun=1` (no PT, no
  image, no commit). (c84621c)
- Verified: tsc; build 2,113 pages; route built as dynamic; window, freeze
  guard and dedupe tested locally against real dates/events (iberanime
  variants → duplicate). Weekend pending notice still on EN + PT. Live:
  /api/version = c84621c; health ok (9/9).
- First runs (production):
  - Dry run: 30 discovered, 2 duplicates, 12 checked, 1 verified.
    Fingertips, Super Bock Arena, 6 Nov 21:30, €20–60. I checked this
    against the venue page myself and it's correct.
  - Real run: 15 discovered, 1 duplicate, 2 verified, 1 committed: "Tempo de
    Natal", Casa da Música, 20 Dec.
  - **That record was thin.** The page is mostly rendered by JavaScript, so
    the reader wrote filler about the page itself ("The page is about an
    event named…"). I removed it before the 21:00 flush, so it was never
    live. The safety gate worked as designed; quality and yield need work.
  - Yield: 21 of 22 rejections were "page not fetchable". Likely guessed
    URL paths or bot blocks; the HTTP status isn't logged yet.
- Gemini usage: dry run 3 calls (3.4k in / 26.3k out tokens); real run 8
  calls (10.0k in / 17.6k out) + 1 image generation + 1 translation. Small.
- Next (2026-10-21 run, before the freeze and before Fri's 07:00 cron):
  1. Reject meta-language and thin copy (descriptions mentioning "the
     page", fewer than ~60 words of event facts).
  2. Use the grounding-metadata source URLs (follow the redirect) instead
     of model-written URLs, and log the HTTP status.
  3. Try the page's JSON-LD Event first.
- Expect: 3–10 forward events/week once yield is fixed; impressions for
  upcoming-event queries before the event week; the weekend page filled
  Mon–Wed.
- Measure on: 2026-11-03 (events published, Gemini usage); search effect
  2026-11-17 (impressions/clicks on forward-scan event pages).
- Result:

## 2026-10-19 — "Today" + "This weekend" pages (owner priority, backlog #19)
- Metrics (`metrics/2026-10-19.json`): 328 clicks / 14,599 impr / pos 9.44
  over 28d (yesterday 339 / 14,711 / 9.35; prev 28d 215 / 10,716 / 15.8).
  Last 7d 79 clicks vs 78 prev; impressions 4,877 vs 3,369 (CTR 1.6% vs
  2.3%, still the iberanime spike: 2,552 impr / 12 clicks). GA4 7d 32 users /
  36 sessions (prev 34 / 39), 26 organic, 3 AI assistant. Subscribers 56
  (next snapshot Thu). Attributed signups: 0. No result due before 10-22.
- Why: owner priority 2026-10-18; nothing answered "what's on today / this
  weekend" (GSC already shows "hoje no porto" for /pt).
- Change: `/porto-events/today`, `/porto-events/this-weekend`,
  `/pt/eventos/hoje`, `/pt/eventos/este-fim-de-semana` — hourly ISR
  (`revalidate = 3600`), Europe/Lisbon dates (`lib/event-days.ts`; weekend =
  coming Fri–Sun, or the rest of it from Fri). Runs >7 days go under "Also
  on". If no listing yet (Mon–Wed for the weekend), the page says the picks
  come with Thursday's edition and links the month hub — no invented events.
  Bidirectional hreflang, sitemap (daily), llms.txt link. `ShortcutChips`
  (Today · This weekend · This month) on both homepages, /porto-events and
  all EN + PT event pages (body-only, no `<head>` change on existing pages,
  so no sitemap revision bump). (0db75fc)
- Verified: tsc; build 2,113 pages; prerender manifest
  `initialRevalidateSeconds: 3600` on the 4 routes; data/events traced into
  their serverless bundles (nft); titles "Things to Do in Porto Today · Mon
  19 Oct" / "O que fazer no Porto hoje · seg, 19 out"; hreflang pairs; chips
  on 984/984 event pages + both homepages + /porto-events; date logic tested
  across Mon–Sun, Lisbon midnight and the 25 Oct DST change. Live:
  /api/version = 0db75fc; health ok (9/9); live EN weekend + PT today pages
  200 with the expected title/intro; 4 URLs sent to the Indexing API (200).
- Note: until #20 (forward scan) ships, the weekend page has only long runs
  Mon–Wed; it fills when Thursday's events are flushed.
- Expect: impressions for "things to do in porto today/this weekend",
  "porto this weekend", "hoje no porto", "fim de semana porto"; clicks from
  chips into the pages (GA4 pageviews).
- Measure on: 2026-11-02 (GA4 views of the 4 pages; GSC impressions),
  search effect 2026-11-16.
- Result:

## 2026-10-18 — Organiser photo-removal line on event pages (owner-approved)
- Why: event photos are the organiser's official share image (og:image)
  with a credit link; a credit is not a licence. Owner approved adding an
  easy change/removal route (Telegram 2026-10-18).
- Change: EN + PT event hero captions, only for scraped photos (not AI
  illustrations): "Organiser? Ask us to change or remove it" → mailto
  hello@oportoweekly.com with the event name in the subject. Body-only.
- Verified: tsc, build; 56 EN + 56 PT built pages carry it, 0 AI-image pages.
- Policy from now: prefer official share/press-kit images with credit +
  link; never social-media, portfolio or "all rights reserved" photos;
  remove promptly on request.
- Result: n/a (risk control).

## 2026-10-18 — Reddit draft step retired (owner-approved)
- Why: owner can't post on Reddit; the Thursday cascade still generated and
  emailed a draft (backlog #16). Owner approved via Telegram 2026-10-18.
- Change: removed together, so the watchdog can't re-dispatch a missing
  step: step 5 of `cron-newsletter.yml`, `cron-reddit-draft.yml`,
  `/api/cron/reddit-draft`, `'reddit-draft'` from `Step`/`STEPS`
  (run-ledger) and from the watchdog's WATCHED list. Old ledger marks are
  dropped the next time the ledger is rewritten (STEPS ordering). Comments
  in event-images/validate-links updated; docs/reddit.md marked retired.
- Verified: tsc, build; /api/version = dac1a11; health ok (9/9); endpoint 404.
- Expect: no Reddit email on Thu 2026-10-22; watchdog shows no reddit step.
- Measure on: 2026-10-22 (Thursday run: all remaining steps green).
- Result: worked (10-23 check): the 10-22 ledger has 6/6 steps done and no
  reddit step.

## 2026-10-18 — Guides link to upcoming events + month hubs
- Metrics (`metrics/2026-10-18.json`): 339 clicks / 14,711 impr / pos 9.35
  over 28d (yesterday 343 / 14,693 / 9.3 — flat, as expected one day in).
  Last 7d 87 clicks vs 80 prev; CTR 1.7% vs 2.5% because impressions rose
  61% (3,196 → 5,144), mostly "iberanime porto 2026" (2,099 impr, 0.2%).
  GA4 7d: 31 users / 37 sessions (prev 34 / 39), 29 organic. Subscribers 56
  (unchanged since the 10-15 snapshot). Attributed signups: 0. No result is
  due before 2026-10-31.
- Why: guides are the top landing pages (two shopping guides: 65 of 339
  clicks) but linked to no event and no month hub (backlog #2).
- Change: `GuideUpcoming` on all 35 EN + 35 PT guides — up to 5 upcoming
  events + this/next month hub (+ /porto-events on EN). Guides are static and
  builds can be 2–3 days apart, so only events still running ≥3 days after
  the build are listed (first build showed 5 events all ending that day —
  caught before shipping). Body-only, no `<head>` change, no sitemap bump.
  (ccbc6cd)
- Verified: tsc, build (2,109 pages), block on 35/35 EN + 35/35 PT built
  guides, one `<title>`; live EN + PT shopping guide show 5 events + hub
  links; /api/version = ccbc6cd; health ok (9/9).
- Expect: more pages/session from blog landings; month-hub impressions up as
  they gain internal links; first blog→event clicks.
- Measure on: 2026-11-01 (GA4 pages/session for /blog landings vs 61 PV /
  37 sessions = 1.65 sitewide today); search effect with the hubs 2026-11-14.
- Noticed: duplicate event records ("Porto Contemporary Art Exhibition" ×2)
  → backlog #17.
- Result:

## 2026-10-17 — Edition pages: single <head>; archive + venue snippets
- Why: homepage + ~70 archive pages embedded the stored email as a second
  full HTML document (2nd doctype, <head>, viewport meta, <title>). Archive
  descriptions were "Oporto Weekly — <date>"; venue titles said "Events &
  Tickets" (we sell none).
- Change: `toEmbeddableHtml()` (keeps styles + font links + body);
  `editionSeo()` names the week's top picks; `venueSeo()`; sitemap bump.
  (1f9965e)
- Verified: page heights identical to production on 4 archives + both
  homepages; one <title> per page live; health OK.
- Expect: archive CTR up on "porto events <month> 2026"; venue CTR up.
- Measure on: 2026-11-14
- Result:

## 2026-10-17 — PT month hubs, month links, PT price labels
- Why: PT generic queries ("eventos porto", "agenda porto") rank ~50–60.
- Change: `/pt/eventos/<mes>-<ano>` (7), shared `MonthHub` renderer with EN,
  bidirectional hreflang; event pages link to their month hub; PT homepage
  "Agenda por mês"; 34 English free-text price labels translated. (2eae0ec)
- Verified: hreflang pairs, 65 PT links / 0 EN leaks on outubro-2026,
  build 31s for 2,109 pages after caching the month snapshot.
- Expect: PT impressions for month/agenda queries within 2–4 weeks.
- Measure on: 2026-11-14
- Result:

## 2026-10-17 — Month hubs + search-phrased homepage titles
- Why: recurring "events in porto <month> 2026" searches land on a weekly
  edition/homepage at pos 7–9. Homepage description was literally
  "Oporto Weekly — 15 October 2026"; /pt ranked ~50–60 for "agenda
  cultural porto", "eventos porto", "agenda porto".
- Change: `/porto-events/<month>-<year>` (7 months, 46–99 events each),
  linked from /porto-events + sitemap. Homepages: "Things to Do in Porto
  This Week · <week>" / "Agenda do Porto esta semana · <semana>". (8c16a23)
- Verified: build, October page in browser (57+8 events, 65 links, no
  overflow), month links on /porto-events, no console errors.
- Expect: month queries move from pos 7–9 to month hubs at top 5; /pt
  impressions for "agenda" queries rise within 2–4 weeks.
- Measure on: 2026-11-14
- Result:

## 2026-10-17 — Event snippets, year-neutral guide titles, llms.txt
- Why: "iberanime porto 2026" 2,099 impressions / 5 clicks (0.2%) at pos
  7.8; titles ~95 chars (dates cut off), descriptions cut mid-word. 9 of 35
  guides titled "2025".
- Change: `lib/event-seo.ts` (EN + PT titles ≤~62 chars, facts-first
  descriptions); 9 guides retitled year-neutral (bodies untouched — they
  contain unverified 2025 prices); sitemap lastmod bumped for both;
  `/llms.txt`. (7cf3632)
- Verified: all 492 events × 2 languages — longest title 70, no description
  over 155; built HTML checked.
- Expect: event-page CTR up (target ≥2% on queries with 100+ impressions);
  guide CTR up.
- Measure on: 2026-11-07
- Result:

## 2026-10-17 — Subscribe forms where search visitors land
- Why: 11 of the top 12 landing pages (guides, events) couldn't convert:
  no form on event/venue pages; blog only linked to the homepage.
- Change: `SubscribeCTA` (EN + PT) on event, blog and venue pages; signup
  attribution to `data/signup-sources.json` (path/lang/time, no email) and
  a `sign_up` dataLayer event. (6095e3b)
- Verified: renders on all page types, EN + PT, mobile, health OK.
- Expect: net subscriber growth above ~1.4/week; first signups attributed
  to event/blog pages.
- Measure on: 2026-10-31 (two weekly snapshots)
- Result:

## 2026-10-23 (owner tip) Porto Expats as an edition source
Owner flagged Porto Expats' "Porto Weekly Guide" (Substack, Fridays, Mon–Sun). Their 26 Oct–1 Nov issue listed 8 events (Batalha Halloween quiz + film, Bloom & MAZ at Real Companhia Velha, LOOK.Sharp 6th birthday, Casa da Música Halloween, Three Sixty at Póvoa Arena, Porto Expats Meetup at Eleven Lab Baixa); data/events had none of them (only Adriana Calcanhotto that week). Added `site:portoexpats.substack.com Porto Weekly Guide events` to the Thursday SEARCH_QUERIES. Their posts are indexed within hours, so Thursday's grounded search sees Friday's issue. Leads only: never copy their text. Check the Oct 29 edition for the Halloween weekend.
