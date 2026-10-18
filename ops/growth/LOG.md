# Growth log

Newest first. One entry per change. Fill in **Result** on the measure date.

Baseline 2026-10-17 (`metrics/2026-10-17.json`): search 343 clicks / 14,693
impressions / pos 9.3 over 28 days (prev 28: 191 / 10,293 / 16.9);
subscribers 56 active (34 EN, 22 PT), ~1.4 net/week; signups by page: none
recorded yet (tracking started today).

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
- Result:

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
