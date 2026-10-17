# Growth log

Newest first. One entry per change. Fill in **Result** on the measure date.

Baseline 2026-10-17 (`metrics/2026-10-17.json`): search 343 clicks / 14,693
impressions / pos 9.3 over 28 days (prev 28: 191 / 10,293 / 16.9);
subscribers 56 active (34 EN, 22 PT), ~1.4 net/week; signups by page: none
recorded yet (tracking started today).

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
