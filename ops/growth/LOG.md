# Growth log

Newest first. One entry per change. Fill in **Result** on the measure date.

Baseline 2026-10-17 (`metrics/2026-10-17.json`): search 343 clicks / 14,693
impressions / pos 9.3 over 28 days (prev 28: 191 / 10,293 / 16.9);
subscribers 56 active (34 EN, 22 PT), ~1.4 net/week; signups by page: none
recorded yet (tracking started today).

## 2026-11-11 — Siza Talks duplicate merged before Thursday's edition (#17); price backfill
- Run 09:30 UTC Wed, outside the freeze. Not Mon/Tue, so no guide re-check.
- Live check: /api/version f2b49f7 (past yesterday's f61db5a), health ok.
- Metrics (`metrics/2026-11-11.json`): 611 clicks / 25,079 impr / pos 10.67
  over 28d (yesterday 571 / 24,063; prev 28d 329 / 14,958). Last 7d **348
  clicks vs 109**, impressions 13,326 vs 5,522, CTR 2.6% vs 2.0%, position
  9.4 vs 11.9. GA4 7d 129 users / 157 sessions / 369 PV (prev 76 / 102 /
  267); 97 organic, 27 AI assistant, 18 direct, 13 organic social;
  `sign_up` 5. Subscribers 69 (11-05). Signups attributed 28d: 22, none new
  since 11-09. Instagram 24 (21 a week ago).
- Results due: none today (#6 forward block is 11-12, #33 is 11-13).
- Duplicate pass (Wednesday): find-duplicates 0 strong, 44 review pairs. The
  upcoming review pairs are all separate shows (Voulez-Vous weekly nights,
  Maguy Marin FOCO pieces, GMP openings vs solo shows, Imperial Heritage
  Ballet two titles, MANIFESTUM nights). But the low-CTR list led to one it
  missed.
- Why: "siza talks 2026" 92 impr / 1.1% CTR at pos 2.9. Two records for the
  same Serralves event (12–14 Nov, in tomorrow's edition week): the scan
  wrote the serralves.pt page on 11-01 (venue "Serralves") and again on
  11-07 from a lead, with the room as venue ("Auditório do Museu de
  Serralves"), so the same-page rule (same canonical venue) didn't fire.
  GSC 10-01→11-10: the 11-01 page has 117 impr / 1 click for "siza talks
  2026" (pos 3.6) + 47 for "siza talks"; the 11-07 copy 13 impr.
- Change (`[defer]`, data + redirect only): kept
  `siza-talks-international-conversations-serralves-nov-12-2026`, gave it
  the fuller copy (day-by-day speakers, re-checked against serralves.pt:
  opening 19:00, Kjetil Thorsen 19:30; 13 + 14 Nov from 16:00; €5 a day,
  50% off Friends/students/65+), namePt, category art, the image. Removed
  the 11-07 copy, 301 EN+PT in next.config.mjs, forward-leads eventSlug
  pointed at the kept record. `auditorio-do-museu-de-serralves` and
  `auditorio-de-serralves` added as Serralves aliases in
  data/venue-aliases.json (no scan code change), so the scan lookup now
  matches the room-name copy to the kept record (checked with
  findExistingEventByIdentity).
- Price backfill (2c): the 08:46 session already priced 18 today; 9
  upcoming events still had no price. Checked 6 Agenda Porto pages + the
  Gomry catalog: only the Acaso board-game club states one ("Donativo" →
  price "Donation", no priceFrom). Psy Frequency, AQ3 + Puto, Tincal lab,
  Dentro da Pele, Natal na Árvore and FC Porto vs Estrela Amadora state no
  price → left empty.
- Verified: tsc; build OK (5,939 pages); built EN + PT kept pages show the
  merged copy; the removed slug isn't built and its 301 is in the routes
  manifest. Live check moves to the next run ([defer], flush 21:00).
- Expect: one page instead of two for "siza talks" searches through Sat;
  the edition can't list it twice. Small, short-lived; the alias stops the
  same room-name repeat at Serralves.
- Measure on: 2026-11-13 (Thursday edition lists Siza Talks at most once;
  find-duplicates shows no new Serralves auditorium copy).
- Result:
- Next run (Thu 11-12): freeze 05:00–11:00 UTC, observe and log only until
  the 10:00 backstop confirms all sends. Then confirm /api/version past
  today's SHA + health.
- Needs owner: still open from 11-10: (1) GTM GA4 event tag for
  `affiliate_ticket_click` + `gomry_organizer_click`; (2) Impact and Gomry
  dashboards; (3) `picks path=` for the 11-05 run.

## 2026-11-10 — Seasonal shortcut chips: Christmas hub + next month (#40); Fever/Gomry measured
- Run 09:30 UTC Tue, outside the freeze. Guide re-check (2b): guidesDue()
  is empty (oldest check made-in-porto 10-31; first due 11-30), no changes.
- Live check: /api/version 59e7586 (includes 767f876), health ok.
- Metrics (`metrics/2026-11-10.json`): 571 clicks / 24,063 impr / pos 10.63
  over 28d (yesterday 550 / 24,085; prev 28d 329 / 14,699). Last 7d **317
  clicks vs 100**, impressions 12,400 vs 5,208, CTR 2.6% vs 1.9%, position
  9.4 vs 12.2. GA4 7d 124 users / 151 sessions / 360 PV (prev 72 / 93 /
  259); 98 organic, 27 AI assistant, 16 direct, 8 organic social;
  `sign_up` 6. Subscribers 69 (11-05). Signups attributed 28d: 22. Instagram
  24 (+3 in a week).
- Results due (#29 Fever, #30 Gomry, measure 11-10):
  - Fever: GA4 outbound `click` to fever.pxf.io = **11** since 10-27
    (consented visitors only), tied first with agenda-porto.pt; pages are
    the Candlelight event pages (Coldplay/Imagine Dragons 21 Nov + 31 Oct,
    ABBA, Hans Zimmer, Christmas Classics). Impact actions/earnings: not
    read (the Impact API call needs approval in the unattended run) → owner
    checks the Impact dashboard. Verdict: **working on clicks**, revenue unknown.
  - Gomry: 0 outbound clicks to gomry.com; FC Porto vs Estoril page got 1
    click (to fcporto.pt). Verdict: **no result yet**.
  - Finding: the custom events `affiliate_ticket_click` and
    `gomry_organizer_click` have **never reached GA4** (0 since 10-27). They
    are dataLayer pushes like `sign_up`, which only arrived after the owner
    added a GA4 event tag in GTM (#7). Same fix needed → Needs owner.
- Venue pages (#32 measurement): 396 pages, 42 clicks / 3,484 impr in 28d
  (1.2%), top ones at pos 9–10 (Move Club PT 0/217, Casa da Música PT 0/172,
  EN 0/116). The Alchemist no longer in the list. #36 (venue snippets,
  measure 11-30) already targets this; no noindex change before that result.
- Duplicates: find-duplicates 0 strong, 44 review pairs (mostly past
  re-extractions). Full pass stays Wednesday.
- Why: #40. December searches ("porto events december 2026", "christmas
  porto", "natal porto") build from mid-November; October's month query was
  the #2 query last month. The Christmas hub (12 events today) and the
  December hub were only linked from the month hubs.
- Change (f61db5a, `[defer]`, live with tonight's 21:00 flush):
  `app/components/ShortcutChips.tsx` adds two seasonal chips to the chip
  row on home (EN/PT), /porto-events, day/landing hubs and every event page
  (EN/PT, ~2,000 pages): "Christmas"/"Natal" → /porto-events/christmas,
  /pt/eventos/natal from 1 Nov to 6 Jan while the hub is indexable (≥3
  events; computed once per day per build); and next month's hub
  ("December"/"Dezembro") from the 15th when that hub exists. LandingHub
  marks the Christmas chip as current on the Christmas hub. No `<head>`
  change, so no sitemap bump.
- Verified: tsc; build OK (5,883 pages); built HTML: Outworld event page has
  the Christmas chip, /pt has Natal, /porto-events/christmas marks it
  aria-current; December chip absent as expected (day 10 < 15). Live check
  moves to the next run ([defer]).
- Expect: Christmas hub EN+PT impressions/clicks up through December; the
  December hub gets crawled and ranks before demand peaks.
- Measure on: 2026-12-08 (GSC impr/clicks /porto-events/christmas,
  /pt/eventos/natal, /porto-events/december-2026, /pt/eventos/dezembro-2026;
  queries with christmas/natal/december/dezembro).
- Result:
- Next run (Wed 11-11): confirm /api/version past today's SHA + health;
  duplicate pass before the 21:00 flush; anything shipped Wednesday must be
  live by the flush.
- Needs owner: (1) GTM: add a GA4 event tag for the custom events
  `affiliate_ticket_click` (param `provider`) and `gomry_organizer_click`,
  like the `sign_up` tag, and publish. Until then affiliate clicks are only
  visible as generic outbound clicks. (2) Fever: check the Impact dashboard
  for clicks/actions/earnings since 10-27; Gomry: check the dashboard for
  sales/referrals. (3) Still open: `picks path=` for the 11-05 run.
- Note: PLAYBOOK §2 allows up to two items per run; today's run prompt says
  ONE, so I followed the prompt.

## 2026-11-09 — Welcome email refresh (#8); #42 closed
- Run 09:30 UTC Mon, outside the freeze. Guide re-check (2b): guidesDue()
  is empty (oldest check made-in-porto 10-31, 9 days), so no guide changes.
- Metrics (`metrics/2026-11-09.json`): 550 clicks / 24,085 impr / pos 10.54
  over 28d (yesterday 506 / 22,503 / 10.57; prev 28d 336 / 13,362 / 9.90).
  Last 7d **306 clicks vs 85**, impressions 11,335 vs 4,781, CTR 2.7% vs
  1.8%, position 9.5 vs 12.4. GA4 7d 127 users / 157 sessions / 413 PV
  (prev 62 / 81 / 168), best week again; 99 organic, **25 AI assistant**
  (16 yesterday), 22 direct, 8 organic social; `sign_up` 5. Subscribers 69
  (11-05). Signups attributed 28d: 22 (11 event, 5 porto-events, 2 blog, 2
  archive, 2 home); 3 since yesterday's run (/porto-events/free EN, Mistérios
  da Rosa PT event page, made-in-porto guide EN). Instagram 24 (+4 in a week).
- Results due: none today. Low-CTR list: Siza Talks and Bate Papo com Theo
  are in the 11-07 #39 set (too early); the rest are past events or rank 30+.
- January 2027 hub (#40): only 2 January events so far (needs 5); the scan
  will reach January in the next weeks. Check stays 11-20.
- Why: #8. Every new subscriber (9 last week) gets the welcome email first.
  It still had the old dark theme, said "First issue lands this Thursday"
  even to people joining after Thursday's send, called us "the best weekly
  guide", and gave readers nothing to open or reply to.
- Change (767f876): `lib/welcome-email.ts`, used by `app/api/subscribe`.
  Cream/white layout from lib/design.ts in email-safe tables; "Your first
  edition arrives on Thursday 12 November" (that Thursday before 11:00 UTC,
  else the next one); links to /porto-events/this-weekend + /archive (PT:
  /pt/eventos/este-fim-de-semana + /pt/arquivo); a "hit reply and say hi"
  box (replies go to hello@oportoweekly.com, the From address), which tells
  inbox providers the mail is wanted. EN + PT, humanizer rules, 0 em dashes.
  Pure module: no file reads, so the subscribe path can't fail on it.
  #42 leftover: swept lib/ for em dashes in reader strings; only the archive
  banner alt text had one (fixed, but `replaceHeaderWithBanner` is unused).
  Upcoming event records: 7 of 334 contain a dash, all in official names. #42
  closed.
- Verified: tsc; date logic checked on 7 cases (Mon, Thu before/after 11:00,
  Wed night, Fri, year rollover); rendered EN + PT HTML read through (caught
  and fixed double quotes from the font stack breaking style attributes);
  build OK. Live: /api/version = 767f876, health ok (9 checks), POST
  /api/subscribe with an invalid email → 400 (route loads). No test email
  sent (rule 3).
- Expect: some replies to hello@ from new subscribers, better inbox
  placement for Thursday's edition over time; more first-session clicks to
  the site. Small, hard to measure with ~9 signups a week.
- Measure on: 2026-12-07 (owner: count replies at hello@; Resend opens for
  tag type=welcome if visible).
- Result:
- Next run (Tue 11-10): #29/#30 Fever + Gomry measurement; guide re-check
  only if guidesDue() has any (none until 11-30). Wed: duplicate pass
  before the flush.
- Needs owner: (1) Optional: send yourself a test signup to see the new
  welcome email (I didn't email anyone). (2) Still open: `picks path=` for
  the 11-05 run needs Actions or Vercel log access.

## 2026-11-08 — Site-wide copy: em dashes and AI words out (#42); blog title fixed
- Run 09:30 UTC Sun, outside the freeze. Not Mon/Tue, so no guide re-check.
- Metrics (`metrics/2026-11-08.json`): 506 clicks / 22,503 impr / pos 10.57
  over 28d (yesterday 464 / 21,184 / 10.69; prev 28d 334 / 13,266 / 10.03).
  Last 7d **266 clicks vs 80**, impressions 9,830 vs 4,435, CTR 2.7% vs
  1.8%, position 9.7 vs 12.9. GA4 7d 111 users / 142 sessions / 385 PV
  (prev 60 / 73 / 155), best week again; 86 organic, 27 direct, 16 AI, 9
  organic social; `sign_up` 4. Subscribers 69 (11-05). Signups attributed
  28d: 19 (10 event, 4 porto-events, 2 archive, 2 home, 1 blog); 1 new since
  yesterday (11-07 PT, Feira da Mala event page). Instagram 24 (+4 in a week).
- Results due: none today. Low-CTR list: nothing new (Iberanime past; "siza
  talks 2026" and "bate papo com theo" were in yesterday's #39 set, too early).
- Why: #42 leftovers (humanizer rule 10). The site-wide default title, OG and
  Twitter cards, /porto-events (title, description, intro "one of Europe's
  most vibrant cities", FAQ + FAQ JSON-LD), the archive and blog indexes and
  the feed all had em dashes; the blog indexes also said "hidden gems" /
  "tesouros escondidos". Found along the way: /blog and /pt/blog titles
  rendered "Porto Guide — Blog | Oporto Weekly | Oporto Weekly" (the layout
  template appended the brand a second time).
- Change (65b51b7): layout default "Oporto Weekly: Porto Events & Culture
  Newsletter", description "…picked every Thursday morning…"; /porto-events
  title "Porto Events This Week: Upcoming Things To Do in Porto", rewritten
  descriptions, intro and FAQ answers (no em dash, no "vibrant", "curates" →
  "picks"); /blog "Porto Guides: Shopping, Food, Nightlife and More" + new
  description naming the actual guide topics, PT "Guias do Porto: compras,
  comida, noite e mais"; /archive + /pt/arquivo titles/descriptions, and the
  list's stored "Oporto Weekly — <date>" lines rendered with a colon;
  edition JSON-LD headline "Porto Events Guide: <week>" (EN+PT), feed and
  news-sitemap titles likewise; DayHub descriptions; OG image text; llms.txt
  price separator; "Featured in …, the weekly edition" line; guide byline.
  Sitemap ARCHIVE_VENUE_SNIPPETS → 11-08. Not touched: app/api/ (internal
  emails, prompts, send path), code comments, event names (official titles).
- Verified: tsc; build OK (twice, the second after the archive-list fix);
  built /blog, /pt/blog, /archive, /pt/arquivo, /porto-events, home titles +
  descriptions read correctly, 0 em dashes on the four index pages (the
  /porto-events ones left are event names), edition headline and the
  "Featured in" line checked in built HTML. Live: /api/version = 65b51b7,
  /blog 200 with the new single-brand title, health ok (9 checks, 0 failed).
  Indexing API: 5 index URLs → 200.
- Expect: small. Cleaner snippets on /porto-events and /blog; /blog CTR up
  from the fixed title. Mainly a rule-compliance change.
- Measure on: 2026-12-06 (GSC /blog, /pt/blog, /porto-events CTR 28d).
- Result:
- Left for later: lib/ reader strings (grep lib/ for em dashes in strings,
  e.g. guide/hub helpers), noted in #42.
- Next run (Mon 11-09): guide re-check if guidesDue() has any; #29/#30
  Fever + Gomry measurement due 11-10; Wednesday duplicate pass before the
  flush (today's sweep added 19 events).
- Needs owner: nothing new. Still open: `picks path=` for the 11-05 run
  needs Actions or Vercel log access.

## 2026-11-07 — Event snippets: weekday, start time, tidy prices (#39); em-dash pass (#42)
- Run 09:30 UTC Sat, outside the freeze. Not Mon/Tue, so no guide re-check.
- Metrics (`metrics/2026-11-07.json`): 464 clicks / 21,184 impr / pos 10.69
  over 28d (yesterday 415 / 19,781 / 10.82; prev 28d 330 / 13,278 / 10.05).
  Last 7d **223 clicks vs 77**, impressions 8,895 vs 4,048, CTR 2.5% vs
  1.9%, position 10.0 vs 13.3. GA4 7d 106 users / 134 sessions / 356 PV
  (prev 53 / 64 / 132), best week again; 84 organic, 27 direct, 13 AI, 7
  organic social; `sign_up` 3. Subscribers 69 (11-05). Signups attributed
  28d: 18 (9 event, 4 porto-events, 2 archive, 2 home, 1 blog); 1 new since
  yesterday (11-06 20:46 EN, homepage). Instagram 22 followers (+1).
- Result due: 10-17 event snippets → **worked, modestly** (filled in): /event/
  CTR 2.03% → 3.08% (ex-Iberanime 2.87% → 3.08%).
- Why: #39. Upcoming event pages rank on page one but lose the click:
  Outworld 323 impr / 2.2% at pos 7.6, Bate Papo com Theo (PT) 178 / 1.1% at
  pos 6, Siza Talks 92 / 1.1% at pos 4, Al Di Meola PT 76 / 1.3%. Snippets had
  no weekday or start time, prices in mixed formats ("53€",
  "€30.00–€70.00"), 32 upcoming EN pages said "Gratuito", and every title
  had an em dash (humanizer rule; also #42).
- Change (d039227), `lib/event-seo.ts`: titles "Outworld · Sat 28 Nov 2026,
  Super Bock Arena · Tickets & Info" (weekday for one-day events when it
  fits, else the old form); descriptions start "Saturday 28 November 2026,
  22:00, at Super Bock Arena. Tickets €53." (time only from the record, 367 of
  394 upcoming have one; none for ranges or 00:00). `priceText` puts euro
  prices in one format and maps PT labels on EN pages to Free/Free entry.
  It also feeds guide "Coming up" blocks, listings and the PT event price pin,
  so those read the same. It only reformats numbers already in the text.
  Em dashes gone from event titles/descriptions (incl. names and venues
  holding one), archive descriptions, SubscribeCTA (EN+PT) and the month-hub
  description + intro. Sitemap EVENT_SNIPPETS + ARCHIVE_VENUE_SNIPPETS → 11-07.
- Verified: tsc; all 972 events × 2 languages: max title 77 (as before),
  max description 155, 0 em dashes; 21 price samples checked by hand; build OK
  (twice; the second after removing a dash from archive pick names); built
  Outworld EN, Bate Papo PT, November hub, October 8-14 archive checked;
  SubscribeCTA text on 1,944 event pages. Live: /api/version = d039227,
  Outworld title live, health ok (9 checks, 0 failed). Indexing API: 5
  changed event URLs → 200.
- Expect: /event/ CTR from 3.08% toward 3.5–4% over 28d, mostly on upcoming
  events that rank on page one.
- Measure on: 2026-12-05 (GSC /event/ pages CTR, 11-08 → 12-02 vs 10-18 → 11-04;
  and the four pages above).
- Result:
- Left for later (#42): em dashes in site-wide brand titles (app/layout.tsx
  default title/description/OG, /archive index, archive JSON-LD headline).
- Next run (Mon 11-09): guide re-check if guidesDue() has any; #29/#30
  Fever + Gomry measurement due 11-10.
- Needs owner: nothing new. Still open from 11-06: reading `picks path=` for
  the 11-05 run (Opus picks) needs Actions or Vercel log access.

## 2026-11-06 — Christmas + New Year hub (#40); Fujifilm duplicate merged
- Run 09:00 UTC Fri, outside the freeze. Not Mon/Tue, so no guide re-check.
- Metrics (`metrics/2026-11-06.json`): 415 clicks / 19,781 impr / pos 10.82
  over 28d (yesterday 377 / 18,403 / 10.96; prev 28d 331 / 13,272 / 10.11).
  Last 7d **182 clicks vs 74**, impressions 7,776 vs 3,714, CTR 2.3% vs
  2.0%, position 10.6 vs 13.1. GA4 7d 93 users / 117 sessions / 310 PV (prev
  48 / 59 / 131), best week again; 76 organic, 22 direct, 10 AI, 7 organic
  social; `sign_up` 3. **Subscribers 69 on 11-05 (45 EN, 24 PT), +9 in a
  week**, best week so far (was 60). Signups attributed 28d: 17. **First
  blog signup** (11-05 PT, nightlife guide; inline box #35 live 5 days) and
  one from /pt home. Instagram 21 followers.
- 11-05 edition: all 6 steps done 10:01 → 10:12 UTC. Read the live archive
  page: no event listed twice. Picks: Canções de Granito (Coliseu, Porto
  2001 anniversary), Museum as Performance, Jussen, Max Cooper, Magusto
  Melancólico (free, the week's occasion). That fits the Opus rubric
  (one-off first, occasion, one free pick, 4 days), but **`picks path=` is
  not readable from this host**: it is only in the workflow's HTTP response
  and Vercel logs (gh, Vercel MCP and the watcher log are blocked here).
- Results due: 11-03 and 11-04 dedupe entries → worked (filled in).
  #26c/#38 early read: 0 new cross-site or aggregator pairs from the scan or
  sweep since 11-04.
- Why (1): find-duplicates showed 1 STRONG pair: Fujifilm House of
  Photography 1st anniversary, 11-07, twice from the same Agenda Porto page.
  The forward scan had it since 11-03; Thursday's archive step created a
  second record → root cause in backlog #41 (needs owner).
- Change (1): kept the edition's slug (the sent edition links to it) with
  the scan record's copy, image and pickCandidate, re-checked against the
  Agenda Porto page today (14:30 to 20:30, Rua de Sá da Bandeira 289, free,
  photowalk with Duarte Silva, 3-month participatory show). Copy removed,
  301 EN + PT.
- Why (2): #40. "porto events october 2026" was a top query in October;
  seasonal searches start weeks ahead, and we had no Christmas page.
- Change (2): `/porto-events/christmas` + `/pt/eventos/natal`, a new
  LandingHub kind: events whose own name is festive (Natal, Christmas,
  Réveillon, New Year, Passagem de Ano, Presépio, Quebra-Nozes, Advent), up
  to 6 Jan. 7 at launch (Gospel de Natal at Hard Club, Quebra-Nozes at the
  Coliseu, Yeatman Christmas Wine, TNSJ Schubertíada Christmas concert, Natal
  ao Vivo, Gare NYE, Natal na Árvore), 0 false matches. Under 3 events it
  goes noindex and leaves the sitemap; out of season it is empty. Linked
  from the Nov/Dec/Jan month hubs; its bottom nav links to the December hub.
- Commit a169da5. Verified: tsc; test:dedupe 37; find-duplicates 0 STRONG;
  build OK; built pages have the right title/description, index,follow,
  hreflang pair and the month-hub link. Live: /api/version = a169da5, both
  pages 200, Fujifilm copy 308 → kept page, health ok (9 checks). Indexing
  API: both new URLs → 200.
- Expect: the two pages start getting impressions within 2 to 3 weeks and
  pick up clicks through December; event count grows as the scan adds
  festive events.
- Measure on: 2026-12-04 (GSC impressions/clicks for both URLs and
  christmas/natal queries); final read 2027-01-07.
- Result:
- Found, not fixed: the shared SubscribeCTA text has an em dash ("concerts,
  exhibitions and markets — in your inbox Thursday morning"), and the month
  hub intros/descriptions have one too. Older copy, humanizer rule → backlog.
  January 2027 hub doesn't exist yet although a 5 Jan 2027 event exists;
  check how listEventMonths picks months (11-20).
- Next run (Sat 11-07): #39 (event snippets) or the em-dash pass.
- **Needs owner:** (1) #41: Thursday's archive step
  (`lib/events-pipeline.ts:167`) looks up existing events without the
  source URL or start time, so a page the forward scan already added gets
  re-created (Fujifilm this week). Fix: pass `url: r.externalLink` and the
  time, plus a test. It is the Thursday path, so: OK to change it?
  (2) To confirm the Opus picks path, someone with Actions or Vercel log
  access has to read `picks path=` from the 11-05 run (or grant this host
  read access).

## 2026-11-05 — Freeze day: observe only
- Run 09:00 UTC Thu, inside the freeze (Thu 05:00 → 11:00, held until the
  10:00 backstop confirms EN, PT and Instagram sent). No code, no data edits,
  no deploy. Not Mon/Tue, so no guide re-check.
- Metrics (`metrics/2026-11-05.json`): 377 clicks / 18,403 impr / pos 10.96
  over 28d (yesterday 348 / 17,231 / 11.12; prev 28d 324 / 13,302 / 10.18).
  Last 7d **144 clicks vs 71** (doubled), impressions 6,567 vs 3,477, CTR
  2.2% vs 2.0%, position 11.2 vs 13.1. GA4 7d 83 users / 109 sessions / 276
  PV (prev 42 / 51 / 115), best week again; 66 organic, 24 direct, 9 AI, 8
  organic social; `sign_up` 2. Subscribers 60 (10-29; today's snapshot comes
  with the send). Signups attributed 28d: **15** (9 event, 4 porto-events,
  2 archive); 1 new since yesterday (11-04 15:25 EN, DesobeDOC event page).
  Blog still 0 (inline box live 4 days, measure 11-29).
- Low-CTR queries: Iberanime still 2,099 impr / 0.2% (past event; #39 is the
  general fix), the rest rank 30+ or are past. Nothing new.
- Pipeline: `/api/cron/status` has no `november-5-…` entry at 09:00 (10-29
  started 10:00). Backstop at 10:00 not read in this run.
- Duplicates before today's edition: today's forward scan (7eff3d5) and
  source sweep (7498e50) ran; `find-duplicates` 0 STRONG over 938 records.
  Review pairs touching 11-05 → 11-11 are all distinct events (Curtas
  Portuguesas 1 vs 2, Fujifilm opening vs its run, Porto Belo Aug vs Nov,
  Voulez-Vous 11-12 vs 11-19, two different TNSJ "Inferno" shows). So no
  doubled listing should reach today's edition. **#38 early read: no new
  cross-site pair after its first real scan + sweep**; full check Fri 11-06.
- Results due: none today (11-05 edition checks are Fri 11-06).
- Change: none (freeze).
- Next run: Fri 11-06: `picks path=` for the first Opus-picks edition (#34),
  duplicates in the sent edition (11-03/11-04 entries), #26c/#38 measure via
  find-duplicates; then pick from #39 (event snippets) or #40 (Christmas/NYE
  hub, should be live by mid-Nov).
- Needs owner: nothing new.

## 2026-11-04 (owner session) — #38 shipped, held sweep items, Instagram link
- **#38 live** (e259148, PR #22, owner "build backlog 38"): non-Latin names
  rejected; same venue + day + start time + a rare shared word = one event
  across sites (Zuaa TMP/bol.pt); "Rivoli Palco do Grande Auditório" and
  similar stage names → the known venue. Checked on 927 records: 0 merges,
  0 venueSlug changes. test:dedupe 35. **Measure Thu 11-05+**: scan/sweep
  logs should show no new cross-site pairs in find-duplicates.
- **Held sweep items fixed by hand** (owner "fix by hand", e4f7b9b): Lemonade
  stand-up 11-12 (Evento Café), Voulez-Vous 11-12 + 11-19, TT Club Experience
  12-05 (venue was "Porto"), Jardim das Chegadas (INSTITUTO, 11-05→12-17).
  Dropped the Árvore bees talk: agenda-porto says 11-07 but its text and 4
  other listings say 10-31.
- **#26c live** (12fc95b, PR #23, owner: stop using aggregator sites if the
  event is already added from the venue page): agenda-porto.pt-style copies of
  venue-page events are skipped by the scan and the sweep. On live data it
  also folds the three TMP circus pieces into Mostra Estufa 2026 (its copy
  names them). **Measure**: Fri 11-06 find-duplicates + Wednesday dedupe pass.
- **#13 blocked**: the owner's personal FB account is ad-restricted since
  2023 (no appeal), so the IG ↔ Page link fails. Plan: wife as Page admin
  links it; IG followers from the public profile meanwhile. Owner wants the
  empty FB Page set up (Claude prepares + applies via Chrome, owner reviews
  first).

## 2026-11-04 — Four duplicates out of Thursday's week (#17/#38)
- Run 09:00 UTC Wed. Freeze now Thu 05:00 → 11:00 (owner 11-03); today's
  push must be live by the 21:00 flush. Not Mon/Tue, so no guide re-check.
- Metrics (`metrics/2026-11-04.json`): 348 clicks / 17,231 impr / pos 11.12
  over 28d (yesterday 340 / 16,726 / 11.08; prev 28d 317 / 13,295 / 10.29).
  Last 7d **109 clicks vs 74** (+47%), impressions 5,522 vs 3,314, CTR 2.0%
  vs 2.2%, position 11.9 vs 13.1. GA4 7d 76 users / 102 sessions / 267 PV
  (prev 39 / 48 / 101), best week again; 58 organic, 26 direct, 8 AI, 8
  organic social. Subscribers 60 (10-29; next snapshot Thu). Signups
  attributed 28d: **14** (was 9 yesterday): 8 event pages, 4 porto-events,
  2 archive; 5 new since yesterday's run (2 from the Baluarte 4 event page,
  /porto-events/november-2026, /porto-events/may-2026, CdM organ symphony).
  Blog still 0 (inline box live 3 days).
- Results due: none today. Filled the 10-17 subscribe-forms entry's empty
  Result (measured 10-31, never written into that entry).
- Why: Thursday 11-05's edition reads 11-05 → 11-11. find-duplicates shows 0
  STRONG; I listed all 131 records in the window by venue + time and read
  every same-venue, same-slot pair.
- Change (929dadb): removed 4 copies, 301 EN + PT to the kept page:
  - Accordia book launch, Serralves 11-05 18:30: agenda-porto.pt copy →
    kept the serralves.pt record.
  - Nativo (Tiago Manuel Soares), Bolhão 11-07 21:00: agenda-porto.pt copy
    (added this morning, venue "Palácio do Bolhão") → kept the bol.pt record
    (Teatro do Bolhão, which is in the Palácio). Carried over the photo and
    the student price from Agenda Porto (€15, students €10; EN + PT copy says
    "Agenda Porto lists €10 for students").
  - OSP solidarity concert for the Liga Contra o Cancro, Casa da Música 11-06
    21:30: agenda-porto.pt copy → kept the casadamusica.com record.
  - "Queer Porto 12", "Various venues", 11-03 → 11-07: really one screening
    (Mouse, bol.pt) stored as the festival → kept the Batalha festival
    record; its forward lead now points there.
  - Left alone (distinct events): Fujifilm anniversary opening vs the Life
    as You See It run, Mimosa APO 6K vs the marathon, Mostra Estufa vs its
    three pieces.
- Verified: tsc; test:dedupe 30 + find-duplicates --check (0 STRONG, also
  after rebasing onto the owner's e4f7b9b sweep fixes); build OK; no built
  pages for the 4 copies; kept Nativo page has the new price line. Live:
  /api/version = 929dadb; Accordia EN and Queer Porto PT copies 308 → kept
  pages; Nativo page 200; health ok (9 checks). No Indexing API call (kept
  URLs unchanged).
- Expect: no doubled listings in Thursday's edition, the weekend page or the
  November hub.
- Measure on: 2026-11-05 edition (check Fri 11-06 with `picks path=`).
- Result (11-06): worked. The sent edition (live archive page read 11-06)
  lists the OSP solidarity concert once; Accordia, Nativo and Queer Porto
  'Mouse' aren't in it; no event appears twice across Picks and sections,
  and find-duplicates finds no new copy of the four. One new pair
  did appear on the site (Fujifilm anniversary, see the 11-06 entry).
- Needs owner: (1) 3 of today's 4 copies came from **agenda-porto.pt**, the
  city's aggregator, re-listing events the scan already had from the venue's
  own page. Backlog #26c would stop using aggregator pages as sources (keep
  them as leads only). Scan code, so: OK to build it, together with #38
  (a)–(c) from yesterday? (2) #13: the Instagram ↔ FB Page link can be
  retried once from today, from Meta Business Suite on desktop (Settings →
  Linked accounts → Instagram), not the app.

## 2026-11-03 — Two cross-site duplicates out of Thursday's week (#38)
- Run 09:00 UTC Tue, outside the freeze (starts Wed 18:00).
- Metrics (`metrics/2026-11-03.json`): 340 clicks / 16,726 impr / pos 11.08
  over 28d (yesterday 322 / 16,119 / 11.10; prev 28d 316 / 13,407 / 10.39).
  Last 7d **100 clicks vs 74** (first 100-click week), impressions 5,208 vs
  3,138, CTR 1.9% vs 2.4%, position 12.2 vs 12.9 (improving for once). GA4
  7d 72 users / 93 sessions / 259 PV (prev 37 / 43 / 87), best week again;
  49 organic, 28 direct, 9 organic social, 5 AI. Subscribers 60 (10-29).
  Signups attributed 28d: 9 (new: 11-02 EN from a Cabarex event page).
  Blog pages still 0 (inline box live 2 days).
- **Result due (10-20 forward scan phase 1): worked on volume** (filled in
  that entry): 84 records 10-23→10-31, ~49/week vs 3–10 expected;
  duplicates are the cost.
- Guide re-check (2b): `guidesDue('2026-11-03')` = []. First due 11-30.
- Lowest-CTR queries: nothing new to act on (iberanime past; "move club"
  handled by #36 yesterday; the rest rank 30+).
- Why: Thursday 11-05's edition reads this week's events. Filenames showed
  two pairs find-duplicates didn't flag (different sites, so #37's
  same-site rule doesn't apply): Skryabin at Hard Club 11-05 (venue page +
  karabas.co page with a Cyrillic name, slug `-hard-club-nov-5-2026`), and
  Isabél Zuaa "AFRO SALOYÁ" at Rivoli 11-06 (TMP page + bol.pt page, venue
  "Rivoli Palco do Grande Auditório" → its own thin venue page). Both were
  pickCandidates.
- Change (6eff5e7): kept `skryabin-hard-club-nov-5-2026` with the venue's
  own time (Room 2, 19:00, hardclubporto.com fetched today; karabas JSON-LD
  says 20:00, so likely show vs doors, and the copy says "Hard Club lists
  19:00"), price €35–100 and the real photo from karabas JSON-LD; copy
  rewritten from those two pages, EN + PT, no em dashes. Kept the older
  Zuaa record, venue → Rivoli Theatre; new `rivoli-theatre` alias entry
  (`rivoli-palco-do-grande-auditorio`, `tmp-rivoli`, `teatro-rivoli`).
  Removed both copies, 301 EN + PT.
- Verified: tsc; test:dedupe 30 + find-duplicates --check; build OK; built
  Rivoli venue page lists Zuaa once, the Skryabin page has the new copy.
  Live: /api/version = 6eff5e7; both copies 308 → kept pages (EN + PT
  checked one each); kept Skryabin page 200; health ok (9 checks). No
  Indexing API call (kept URLs unchanged).
- Expect: no doubled Skryabin/Zuaa listing in Thursday's edition or on the
  month hub/weekend page.
- Measure on: 2026-11-05 edition (check Fri 11-06 with `picks path=`).
- Result (11-06): worked. Neither Skryabin nor Zuaa is listed twice in the
  sent edition; find-duplicates finds no new copy of either.
- Next run (Wed 11-04, before 18:00): another duplicate pass over the
  11-05→11-11 window after that morning's scan + sweep. Fri 11-06: Opus
  picks check.
- Needs owner: (1) #38 scan fixes, all scan code: (a) reject or
  transliterate names with no Latin letters, never a slug starting with
  "-"; (b) same canonical venue + same start day and time + a shared rare
  name word counts as one event even across sites; (c) treat venue stages
  like "Palco do Grande Auditório" like room names. OK to build these?
  (2) Reminder: #13 Instagram ↔ FB Page link can be retried once from Meta
  Business Suite on desktop from Wed 11-04.

## 2026-11-02 — Venue snippets name the next events (#36)
- Run 09:00 UTC Mon, outside the freeze.
- Metrics (`metrics/2026-11-02.json`): 322 clicks / 16,119 impr / pos 11.10
  over 28d (yesterday 320 / 15,869 / 11.04; prev 28d 309 / 13,213 / 10.54).
  Last 7d 85 clicks vs 80, impressions 4,781 vs 3,092 (+55%), CTR 1.8% vs
  2.6%, position 12.4 vs 12.8. GA4 7d 62 users / 81 sessions / 168 PV (prev
  35 / 41 / 86), best week so far; 44 organic, 23 direct, 9 organic social,
  4 AI. Subscribers 60 (10-29). Signups attributed 28d: 8 (new: 11-01 EN
  from /porto-events/november-2026). Blog pages still 0 (inline box live 1 day).
- **Result due (10-19 Today/This weekend pages): worked, small** (filled in
  that entry): 9 clicks / 70 impr across the 4 pages, 33 GA4 views, 1 signup.
- Guide re-check (2b): `guidesDue('2026-11-02')` = [] (all 16 guides checked
  10-31 or 11-01 in the owner's consolidation). Nothing to re-check; first due
  11-30 (made-in-porto). Armazém question from yesterday: answered by the
  owner (d4a18cb, removed, closed 2022).
- Why: venue pages (247 with impressions) had 29 clicks / 2,341 impr in 28d,
  1.2% at pos ~9–10. Most of it is venue-name searches: "move club porto"
  0/66, "move club" 0/67, "the alchemist porto" 0/21, Casa da Música EN+PT
  0/273. Every description said "concerts, exhibitions and more, with dates
  and prices. Updated every Thursday." with an em dash, nightclubs included.
- Change (be129d9): `venueSeo(venue, events, lang)` names the next 1–2
  events with dates (dated events first, "until 7 Mar" for open runs), then
  the count; with nothing upcoming, the latest past event with its date and
  "Nothing listed right now". Em dashes in event names → commas. Optional
  sentences are dropped when they don't fit 155 chars, so 0 of 562
  descriptions are clipped (first draft: 241 clipped). Titles unchanged.
  Sitemap `VENUE_NEXT_EVENTS` lastmod for venue URLs.
- Verified: tsc; build OK (first attempt hit my 10-min background limit, not
  an error; rerun passed); 0 built venue pages keep the old text; Move Club
  EN/PT and Alchemist read as intended. Live: /api/version = be129d9, EN
  Move Club page 200 with the new description, health ok (9/9). Indexing
  API: Move Club + Casa da Música EN/PT → 200.
- Expect: venue-page CTR from 1.2% toward 2%+; positions shouldn't move.
- Measure on: 2026-11-30 (GSC /venue + /pt/venue clicks/impr/CTR, 28d vs
  the 28d to 11-01).
- Result:
- Found, not fixed (one change per run): `find-duplicates` shows 3 upcoming
  duplicate pairs in this Thursday's week: Jussen at Casa da Música 11-05
  (EN and PT pages of the same concert), Serralves "Museum as Performance"
  11-07 (STRONG), Porto Marathon EN/PT 11-08 → backlog #37.
- Next run (Tue 11-03): #37 dedupe those 3 pairs before the Wed 18:00
  freeze. Fri 11-06: check `picks path=` on the first Opus-picks edition.
- Needs owner: (1) The 3 duplicates look like the scan creating the EN and
  PT page of one event as two events. I'll remove the copies by hand
  tomorrow (data only, like abc1131); a fix in the scan's dedupe (same host
  + same date) touches the scan, so: OK to do it? (2) Reminder: #13
  Instagram ↔ FB Page link may be retried once from Meta Business Suite on
  or after Wed 11-04.

## 2026-11-01 — Subscribe box inside guides (#35) + vintage market guide fact-checked (#4)
- Run 09:00 UTC Sun, outside the freeze.
- Metrics (`metrics/2026-11-01.json`): 320 clicks / 15,869 impr / pos 11.04
  over 28d (yesterday 318 / 15,400 / 10.98; prev 28d 290 / 12,896 / 10.72).
  Last 7d 80 clicks vs 73, impressions 4,435 vs 3,094 (+43%), CTR 1.8% vs
  2.4%, position 12.9 vs 12.2 (same wider-but-deeper pattern). GA4 7d 60
  users / 73 sessions / 155 PV (prev 33 / 39 / 80), best week so far; 39
  organic, 21 direct, 8 organic social, 5 AI. Subscribers 60 (10-29).
  Signups attributed 28d: 7, none new since 10-30.
- **Result due (10-18 "Guides link to upcoming events"): worked, small
  sample** (filled in that entry): blog-landing pages/session 1.00 → 1.45.
- Owner shipped a lot overnight (PRs #10–#17): #34 Opus picks merged
  (2141ab7), humanizer, Made-in-Porto guide, guide promos, /play game, event
  search/filters, daily source sweep (213 + 39 events on 11-01). Not reviewed
  by me beyond the build passing with them.
- Change 1 (#35): guides were the top landing pages but had 0 of 7 signups;
  the only form sat after the article, sign-off, Book-it box and upcoming
  events. Now `SubscribeCTA context="blog-inline"` sits before each guide's
  second `<h2>` (≈40% down), EN + PT, new copy ("Planning a trip to Porto?" /
  "Todas as quintas-feiras"); end form kept. Body only, no `<head>` change.
- Change 2 (#4): `shop-like-a-local-in-porto-your-2026-vintage-market-guide`
  (#5 page: 9 clicks / 823 impr, "2026" in title). Checked against
  mercadobolhao.pt, Porto Secreto (06/2024), Shop in Porto, Time Out, porto.pt,
  Visit Porto, Domus Arte listings:
  - Bolhão hours confirmed (official); "322, 4000-248" vs "214" conflict →
    "Rua Formosa, Baixa" + side entrances; "about ten restaurants" removed.
  - Chiclete "moved to Praça dos Poveiros 2025, 10th anniversary": no source;
    listings give Rua da Firmeza 408 and Rua do Heroísmo 333 → no address,
    "check Instagram".
  - Mon Père "cash only", Yeahllow "by appointment only", Com Sotaque café,
    Matérica, Domus Arte filigree, CRU prices: unsourced → removed.
  - Armazém "closed end of 2022": unsourced, and Shop in Porto lists it daily
    (Airbnb says permanently closed) → note removed. **The 10-31 guide still
    lists Armazém as open; status is unresolved** (backlog #4).
  - A Vida Portuguesa → Time Out Market at São Bento (first shop closed 2020);
    Porto Belo hours → Agenda Porto; Vandoma + Campanhã; Yeahllow full
    address; O'Kilo €10/kg marked as the 2024 price; "2025 and 2026" dropped.
  - New EN/PT description (places + "checked November 2026"); sitemap
    `FACTS_REFRESHED` → 11-01 with this slug added.
- Commit f3fa10e. Verified: tsc; build OK; inline box on 37/37 EN and 37/37
  PT built guides; vintage guide EN + PT carry the new facts, removed claims
  absent. Live: /api/version = f3fa10e, page 200 with new text, health ok
  (9 checks). Indexing API: EN + PT URLs → 200.
- Expect: (1) first blog-page signups; target ≥2 in 4 weeks (0 so far).
  (2) CTR on the vintage guide up from 1.1% (9/823), small and slow.
- Measure on: 2026-11-29 (signup-sources byPageType blog, 28d; GSC page
  CTR for the vintage guide vs the 28d to 10-31).
- Result:
- Next run (Mon 11-02): result due for 10-19 Today/This weekend pages.
  Then #4 Armazém re-check, or budget/nightlife guide. Wed 11-04 18:00 freeze.
- Needs owner: (1) Do you know whether **Armazém (Rua de Miragaia 93)** is
  still open? Sources conflict; one of our guides lists it, the other said
  closed. (2) Thu 11-05 is the first Opus-picks edition; I'll check
  `picks path=` on Fri.

## 2026-10-31 — Top shopping guide fact-checked (#4); #34 branch verified for merge
- Run 09:00 UTC Sat, outside the freeze.
- Metrics (`metrics/2026-10-31.json`): 318 clicks / 15,400 impr / pos 10.98
  over 28d (yesterday 312 / 15,057 / 10.80; prev 28d 285 / 12,897 / 11.08).
  Last 7d 77 clicks vs 72, impressions 4,048 vs 3,041 (+33%), CTR 1.9% vs
  2.4%, position 13.3 vs 11.8 (seventh day of the same wider-but-deeper
  pattern; clicks are up this time). GA4 7d 53 users / 64 sessions / 132 PV
  (prev 36 / 41 / 80), best week so far; 30 organic, 19 direct, 8 organic
  social, 7 AI. Subscribers 60 (10-29). Signups attributed 28d: 7, none new.
- **Result due (10-17 "Subscribe forms where search visitors land"): worked,
  modestly.** Subscribers 56 (10-15) → 55 → 60 (10-29): +4 net in two weeks,
  2.0/week vs the ~1.4/week baseline. All 7 attributed signups came from
  pages that had no form before: 4 event pages, 2 archive, 1 this-weekend.
  Blog pages: 0 signups despite being the top landing pages → idea #35.
- Housekeeping: local `main` had the owner's playbook commit (164229d, ops
  only) unpushed and diverged from origin; rebased onto origin/main and
  pushed with this log.
- #34 (Opus picks): the 10-30 session pushed `feat/34-opus-picks` (33c363c +
  e79b178 room-name venue merges). Checked in a worktree merged with today's
  main: clean merge, tsc OK, `test:picks` 13 pass, build OK. Read the diff:
  never throws, 60 s deadline, Gemini fallback on any failure, slug
  validation. Note the 60 s sits inside the route's 300 s budget, before
  Gemini; fine if Gemini + verify stay under ~200 s as now. I could not
  open/see the PR from here (`gh` needs approval). Not merged by me: it
  touches `app/api/cron/newsletter/route.ts` (send path, rule 2).
- Why (#4): `/blog/porto-shopping-guide-your-map-to-vintage-artisan-finds`
  is the #1 page (43 of 318 clicks, 1,155 impr, pos 8.5) and had never been
  fact-checked. Checked every listing against sources (Visit Porto, Agenda
  Porto, porto.pt, Shop in Porto, clausporto.com, Time Out):
  - A Vida Portuguesa, Rua de Cândido dos Reis 36: **closed in 2020**; the
    brand returned in 2024 inside Time Out Market (São Bento, south wing).
    The guide sent readers to the closed shop first.
  - Mercado da Alegria (Passeio Alegre): **Sundays** from 9:00 (city listings,
    2025 Christmas calendar, 2026 Agenda Porto); guide said 2nd/4th Saturday.
  - Porto Belo: Saturdays, but hours differ by source/season → "Saturdays,
    check Agenda Porto" instead of 10–19.
  - Vandoma: Sat 8–13, Av. 25 de Abril (Campanhã): confirmed, added Campanhã.
  - Claus Porto: Rua das Flores 22 confirmed; official hours daily 10–19
    added; prices in **$** with no source removed.
  - CRU: address confirmed; hours conflict between sources → removed; the
    "2026 planner €16.80 / hoodie €99" prices removed (unsourced).
  - CCB shop names (Collectiva, Daily day, Free Bird) not verifiable → made
    generic. Armazém: city's Shop in Porto lists it daily 11:30–20:00 and the
    Old & Vintage fair on the 3rd weekend; kept, "café" → "bar".
  - "2025-2026 guide" dropped from the intro and the description.
- Change (afae206): EN + PT bodies, new EN/PT excerpt (meta description:
  names the places + "checked October 2026"), sitemap `FACTS_REFRESHED`
  revision for this slug.
- Verified: tsc; build OK; built EN + PT pages carry the new text, old
  address/$ prices gone. Live: /api/version = afae206, page 200, health
  ok: true. Indexing API: EN + PT URLs → 200.
- Expect: CTR on this page up from 3.7% (43/1,155), fewer bounces from people
  sent to a closed shop. Small, slow.
- Measure on: 2026-11-28 (GSC page clicks/CTR, 28d vs the 28d to 10-30).
- Result:
- Next run (Sun 11-01): #4 continued: `shop-like-a-local-in-porto-your-2026-
  vintage-market-guide` (#3 page, has "2026" in its slug/title, so its facts
  matter most). Check whether #34 was merged; if not, remind the owner (must
  be live before Wed 11-04 18:00).
- Needs owner: (1) **#34: please merge `feat/34-opus-picks` into main** (open
  the PR on GitHub if the 10-30 session didn't). Verified today against
  current main; it's the send path, so I won't merge it myself. Deadline Wed
  11-04 18:00 UTC. The branch also carries e79b178 (museu / blue-lounge /
  cibermusica → Serralves / Casa da Música, with 301s), which answers
  yesterday's question (2). (2) The guide is in your first-person voice
  ("I've lost count of the vinyl I've picked up here"); I only changed facts,
  not the voice.

## 2026-10-30 — Forward scan: room-only venue names → site's venue (#33)
- Run 09:00 UTC Fri, outside the freeze.
- Metrics (`metrics/2026-10-30.json`): 312 clicks / 15,057 impr / pos 10.80
  over 28d (yesterday 305 / 14,773 / 10.71; prev 28d 285 / 12,769 / 11.29).
  Last 7d 74 clicks vs 78, impressions 3,714 vs 3,049 (+22%), CTR 2.0% vs
  2.6%; 7d position 13.1 vs 11.9: sixth day of the same pattern (more
  impressions, deeper average; top pages hold 8–9). GA4 7d 48 users / 59
  sessions / 131 PV (prev 34 / 39 / 68), best week so far; 25 organic, 19
  direct, 8 organic social, 7 AI. **Subscribers 60 on 10-29 (was 55; EN 38
  +5, PT 22)**, the biggest weekly gain so far. Signups attributed in 28d: 7 (new:
  10-29 13:34 EN from the new archive edition, 10-30 08:22 PT from a PT event
  page). No result due today (first is 10-31).
- Thursday 10-29 pipeline: EN/PT web + email + Instagram all marked complete
  in the ledger. The edition doesn't mention the "Library" event.
- Why: the Serralves talk (forward scan 10-29) had venue "Library" → thin
  `/venue/library` page, live since the 10-29 flush. Owner approved (b) 10-29.
  Same host data shows the pattern isn't one-off: serralves.pt records also
  carry "museu" / "galeria-contemporanea-do-museu", casadamusica.com "blue-lounge",
  "cibermusica" (older records, left as they are).
- Change (fa2a6cb): (a) record → venue "Serralves", venueSlug `serralves`;
  `library` → `serralves` in `redirectOnly`, so /venue/library and
  /pt/venue/library 301. (b) `isGenericRoomName()` + `hostVenueName()` in
  `lib/venues.ts`; `hostVenues` in `data/venue-aliases.json` (serralves.pt,
  casadamusica.com, hardclubporto.com, coliseu.pt, galeriamunicipaldoporto.pt).
  The scan's page check swaps a room-only venue for the host's venue, or
  rejects the candidate with a logged reason if the host isn't known.
  2 new tests in test:dedupe (20 pass).
- Verified: tsc; test:dedupe 20 + find-duplicates --check; test:leads 5;
  build OK (`/venue/library` no longer built, event page links
  `/venue/serralves`, serralves page lists the talk, redirect in routes-manifest).
  Live: /api/version = fa2a6cb (deploy took ~8 min); /venue/library and
  /pt/venue/library 308 → serralves; event page 200 and links
  /venue/serralves; health ok (9/9). No Indexing API call: the venue page
  was 1 day old and the event URL is unchanged.
- Expect: no new room-named venue pages from the scan. Rejections with
  "is a room name" in the scan log point at hosts worth adding to `hostVenues`.
- Measure on: 2026-11-13 (scan commits of the next 2 weeks: no generic
  venueSlugs; count "room name" rejections).
- Result:
- Next run: #34 (Opus 5.5 Editor's Picks) as a PR for the owner to merge;
  it has to be live before the Wed 11-04 18:00 freeze, so Sat/Sun at the
  latest. Then the 10-31 signups result (entry 10-17).
- Needs owner: (1) #34 PR is next (tomorrow), not today: one change per run.
  Say if you want it sooner. (2) Optional: may I also merge the older
  sub-venue records (serralves "museu", casadamusica "blue-lounge",
  "cibermusica") into their venues with 301s? Data + redirects only.

## 2026-10-29 — Freeze day: observe only
- Run 09:00 UTC Thu, inside the freeze (Wed 18:00 → Thu 23:59). No code, no
  data edits, no deploy.
- Metrics (`metrics/2026-10-29.json`): 305 clicks / 14,773 impr / pos 10.71
  over 28d (yesterday 305 / 14,578 / 10.57; prev 28d 290 / 12,724 / 11.4).
  Last 7d 71 clicks vs 83, impressions 3,477 vs 2,958, CTR 2.0% vs 2.8%;
  **7d position 13.1 vs 11.6**: fifth day of slipping while impressions rise
  (+18%), same pattern as before; top pages still hold 8–9. GA4 7d 42 users /
  51 sessions / 115 PV (prev 34 / 39 / 71), best week so far; 22 organic,
  16 direct, 8 organic social, 5 AI; `sign_up` 2. Subscribers 55 (10-22; next
  snapshot today). Signups attributed in 28d: **5**; new one 10-29 08:24 EN
  from `/event/candlelight-queen-vs-the-beatles-palacio-da-bolsa-oct-31-2026`,
  the first from a Fever-created event page (#29).
- Pipeline: `/api/cron/status` has no `october-29-…` entry yet at 09:00 (past
  weeks started ~13:00). Not checked further in this run.
- Forward scan check (e41efec 10-28 13:48, 6 events; ff6336f 10-29 06:07, 5
  events). `find-duplicates`: 0 strong; the 19 review pairs are all older ones
  (was 20), so **nothing doubled feeds today's edition** (the 10-27 measure item;
  the edition itself isn't generated yet). Two quality issues, both flushed
  live at 17:00 today, left for Friday because of the freeze:
  - `talk-with-paulo-rangel-…-serralves-library-oct-31-2026` has venue
    "Library" / venueSlug `library`, so it opens a thin `/venue/library` page
    and the event shows "Library" as the venue. Fix Fri: venue "Serralves",
    venueSlug `serralves` (event is pickCandidate, so it may appear in today's
    edition as "Library"). → backlog #33.
  - `galeria-digital-do-porto-…-jul-19-2025`: a long-running city-wide digital
    art circuit (2025-07-19 → 2026-12-31) from the official GMP page, so the
    facts are fine; venue "Various locations…" already gets no venue page
    (PLACEHOLDER_VENUE). Only odd thing is a 2025 date in the slug. Kept.
  - The other 9 come from detail pages (casadamusica, galeriamunicipaldoporto,
    cm-matosinhos, serralves…) with factual copy.
- Change: none (freeze).
- Next run: Fri 10-30: fix the Serralves venue (#33, data only), then check
  the first due result on 10-31 (signups, entry 10-17), then #4 (verified
  refresh of the shopping guides, still the top 2 pages: 54 of 305 clicks) or #32.
- Needs owner: (1) #33: may I map generic sub-venue names ("Library",
  "Auditorium", "Garden"…) to the source host's venue in the forward scan?
  Scan code, so I'm asking first.

## 2026-10-28 — llms.txt: month hubs + PT section (#14); forward-scan duplicate removed
- Run 09:00 UTC Wed, before the 18:00 freeze.
- Metrics (`metrics/2026-10-28.json`): 305 clicks / 14,578 impr / pos 10.57
  over 28d (yesterday 307 / 14,436 / 10.38; prev 28d 285 / 12,588 / 11.7).
  Last 7d 74 clicks vs 80, impressions 3,314 vs 2,917, CTR 2.2% vs 2.7%;
  **7d position 13.1 vs 11.2**: fourth day of slipping, with impressions up 14%,
  so likely more pages ranking deep rather than losses (top pages hold 8–9).
  GA4 7d 39 users / 48 sessions / 101 PV (prev 30 / 35 / 68), the best week so far;
  19 organic, 14 direct, 11 organic social, 4 AI; `sign_up` 2. Subscribers 55
  (10-22; next snapshot Thu). Signups attributed in 28d: 4 (none new since 10-25).
  No result due today (first is 10-31).
- Forward scan check (e5d5068, 4 events): Bloom & Maz Halloween (xceed),
  Tunas de Elite (casadamusica), Lucía Solla Sobral launch (livrarialello) are
  real detail pages with factual copy, so I kept them. **"Atlas, mapeamento poético"
  (bol.pt) duplicates the live 10-27 record** `joana-providencia-campo-alegre-…`
  (TMP page, same dates/price), and it would also have opened a second venue page
  (`tmp-campo-alegre-auditorio`). Name matching missed it (the old name is
  "Joana Providência / Teatro do Bolhão / Atlas…"). I removed the unpublished copy
  (never live, so no 301) and moved its official BOL photo (credit + source)
  onto the live record, replacing the AI illustration. → backlog #31.
- Low-CTR pass (#10): nothing actionable. "mike stern casa da musica" is a
  6 Oct concert; the others rank 20–80. New: "the alchemist porto" 83 impr /
  pos 8.1 / 0 clicks on a thin PT venue page → backlog #32. #15 checked: mobile
  already shows the form above the edition.
- Change (13bf93e): `/llms.txt` gains "Events by month" (current + coming EN
  hubs) and "Em português": /pt, latest PT edition, hoje / este fim de semana,
  /pt/eventos month hubs, /pt/arquivo, /pt/blog + 36 PT guides with PT
  titles/excerpts. Hourly ISR as before.
- Verified: tsc; build OK; built llms.txt has both sections, and the linked PT
  archive page (`october-22-28-2026-pt`) is built; the Atlas page carries the BOL
  photo; the image URL returns 200. Live: /api/version = 13bf93e; live
  /llms.txt (200) has both new sections; health ok (true). No Indexing API call
  (llms.txt isn't an indexable page).
- Expect: AI assistants can cite PT pages and month hubs; small. AI Assistant
  sessions (4–6/week now) and PT landings from them.
- Measure on: 2026-11-25 (GA4 AI Assistant sessions + landing pages, 4 weeks).
- Result:
- Next run: Thu 10-29 is freeze (observe only; check the 10-29 edition has no
  duplicates — measure item from 10-27). Fri 10-30: #4 (verified refresh of
  the shopping guides, the top 2 pages) or #32.
- Needs owner: (1) #28 + #31: may I improve the forward-scan dedupe
  (same source URL, and name containment + overlapping dates)? Two of
  the last three scans wrote an event we already had. (2) Today's Porto Expats
  draft is from the server job, as agreed; I didn't touch it.

## 2026-10-27 — Gomry partnership + adult-content filter (#30, owner GO)
- What: `data/gomry.json` from Gomry's public catalog API (Porto/Gaia/Matosinhos; today 12 listings, all FC Porto home matches resold by "Gomry Retail"); `lib/gomry.ts` + `lib/tickets.ts` (Fever tiers 1–3 > Gomry `?ref=Pi2YQafpuFtB` > plain); 2 FC Porto home matches created (Estoril 31 Oct, Sporting 29 Nov) with factual copy and resale price as listed (US$), excluded from Editor's Picks; "Organising this event?" box (EN/PT) on independent organizers' upcoming events (7 of 45 upcoming today) + footer link; GA4 dataLayer events `gomry_organizer_click`, `affiliate_ticket_click` {provider}. Owner: "skip that sensual shows thing" → `isAdultContent` filter in Fever/Gomry creation (age limits alone don't count), Halloween at Magic Moments deleted (301 → this-weekend EN/PT). Bogus Fever link `/m/123456` on the Apr 24 ABBA Candlelight replaced with Fever's Porto Candlelight page.
- Measure 2026-11-10: GA4 clicks on both events; Gomry dashboard sales/referrals.

## 2026-10-27 — Fever affiliate integration (#29, owner GO)
- What: Impact API connected (Fever campaign 16345 Active, deep-linking allowed). Porto catalog: 94 items — tier 1 general 47, tier 2 Candlelight 31, tier 3 1, tier 4 non-commissionable 15 (third-party concerts).
  `data/fever.json` synced daily (04:30 UTC, ~/fever-sync); `lib/fever.ts` ticketLink → event pages EN/PT use the tracked link (rel="sponsored nofollow noopener" + affiliate note) for tier 1–3 matches; Fever-dated events (Candlelight etc., next 42 days) created with `feverId`; edition cap 2 Fever events; newsletter footer + site footer disclosure; FB-group rule in fb-groups.md + PLAYBOOK rule 8 + ~/oporto-expats/PROMPT.md.
- Verify: tsc, test:dedupe 16, test:leads 5, test:compose 12, test:fever 9, `npm run build` OK.
- Measure on 2026-11-10: Impact clicks/actions/earnings, and which event pages send them.

## 2026-10-27 — Forward-scan duplicates removed before Thursday (#17/#28) + Porto Expats draft (#12)
- Metrics (`metrics/2026-10-27.json`): 307 clicks / 14,436 impr / pos 10.38
  over 28d (yesterday 313 / 14,356 / 10.29; prev 28d 281 / 12,383 / 12.0).
  Last 7d 74 clicks vs 80, impressions 3,138 vs 3,317, CTR 2.4% vs 2.4%;
  **7d position 12.9 vs 10.6**: third day of slipping. GA4 7d 37 users / 43
  sessions / 87 PV (prev 29 / 34 / 66); 19 organic, 10 direct, 10 organic
  social, 4 AI; `sign_up` 2. Subscribers 55 (10-22). Signups attributed in
  28d: 4 (no new ones since 10-25). No result due today (first is 10-31).
- Forward scan (#27): **committing again**: 729b0f0 and f4db5dc on 10-26,
  330223d today (6 events). I read today's 6 before the 21:00 flush. All come
  from detail pages (3cket, casadamusica, bol.pt, cm-matosinhos) and the copy
  is factual. FYI: ALMAWEEN (€3–4, youth association, 17+) says all tickets
  are sold out; I kept it.
- Why: `find-duplicates` + the weekend list showed **two pairs written twice
  by the 10-26 scan, each pair from the same source URL**, already live since
  the 10-27 00:13 flush, and both would be candidates for Thursday's edition.
  Today's Hetta record also opened a second venue page for Radioclube Agramonte.
- Change (abc1131): removed `qui-29-maria-pistolas-oct-29-2026` →
  `voulez-vous-x-maria-pistolas-…` and `moonspell-hard-club-oct-31-2026` →
  `moonspell-invicta-halloween-…`, with 301s EN + PT (next.config dedupes).
  Alias `radioclube-agramonte` → `rca-radioclube-agramonte` (venue-aliases),
  Hetta record's venueSlug updated. "Caminhos da Floresta" and "Festival
  Floresta Amazónica" share a URL and dates but are the festival and its
  installation programme, so both stay.
- Verified: find-duplicates 0 strong / 0 stale venueSlug; tsc; build OK
  (retired pages not built, Hetta links the canonical venue); /api/version =
  abc1131; both event URLs (EN, PT) and the venue alias 308 to the kept pages;
  health ok (9/9). No Indexing API call: the retired pages were 1 day old.
- Draft (#12): `drafts/porto-expats-post-2026-10-28.txt`, for the owner to
  post **Wed 10-28 before 22:00** (group rule: events on Wednesdays, starting
  prices). 6 picks for 30 Oct – 1 Nov, every one priced, 1 link at the end,
  no subscribe ask. Facts come from each record's source page; I couldn't
  re-open the pages (Firecrawl isn't permitted in this run).
- Expect: Thursday's edition has no doubled items; the draft, if posted, gives
  organic-social sessions + signups from /this-weekend like 10-22.
- Measure on: 10-29 edition (no duplicates); social sessions/signups 11-01.
- Result:
- Next run: #10 low-CTR pass ("mike stern casa da musica" 66 impr, pos 6.3,
  0 clicks), and keep watching 7d position. **Wed 18:00 UTC freeze starts
  tomorrow**: tomorrow's run can still ship before 18:00.
- Needs owner: (1) Post the Porto Expats draft on Wed 10-28 if it looks OK.
  (2) #28: may I add a same-source-URL dedupe to `lib/forward-scan.ts`? Name
  matching missed both pairs, and "MOONSPELL" may come back on the next scan
  now that its file is gone. (3) #27 is resolved on my side; thanks if you
  fixed it.

## 2026-10-26 — Coffee guide merge + 301 (backlog #24)
- Metrics (`metrics/2026-10-26.json`): 313 clicks / 14,356 impr / pos 10.29
  over 28d (yesterday 314 / 14,464 / 10.03; prev 28d 267 / 12,011 / 12.6).
  Last 7d 80 clicks vs 79, impressions 3,092 vs 4,877, CTR 2.6% vs 1.6%;
  **7d position 12.8 vs 9.7** (yesterday 12.2): still slipping, watch it. GA4
  7d 35 users / 41 sessions / 86 PV (prev 32 / 36 / 61); 17 organic, 10
  organic social, 8 direct, 6 AI; `sign_up` 2. Subscribers 55 (10-22).
  **Signups attributed in 28d: 4**, 3 of them on 10-25 (event page ×2,
  archive ×1, all EN). No result due today (first is 10-31).
- Forward scan check: **no `chore: forward scan` commit on 10-25 or 10-26.**
  A prod dry run at 09:05 UTC was healthy: 90 sources, 54 discovered, 18
  dupes, **14 verified** (Casa da Música November leads, Adriana Calcanhotto
  10-27, etc.), 8 leads resolved. So discovery works, and the real run fails
  or times out after verification (enrichment: PT translation, images,
  commit). I can't see why: Vercel logs and `gh run list` aren't permitted in
  this run. Since a253328 (owner, 10-25) this scan is the newsletter's daily
  research, so I didn't touch it. → Needs owner.
- Change (fed90c4): merged the unique stops from `…-a-2026-guide` into
  `…-the-2026-guide`, EN + PT: Fábrica Coffee Roasters (Rua de José Falcão
  122), Época (Rua do Rosário 22, weekday brunch, closed weekends) and Majestic
  Café (opened Dec 1921 as "Elite", Rua de Santa Catarina 112). I checked these
  against current listings and visitporto.travel and left out unconfirmed
  details (Wi-Fi, Turkish eggs, Majestic prices). Removed the a-2026 entry and
  HTML, and 301'd `/blog/…-a-2026-guide` and `/pt/blog/…` to the-2026
  (`next.config.mjs` blogMerges). Sitemap lastmod bumped for the-2026
  (`COFFEE_MERGED`).
- Verified: tsc; build OK; the built EN page has the new sections; /api/version =
  fed90c4; both old URLs (EN + PT) 308 to the-2026; the live PT page has the new
  sections; health ok (9/9). Indexing API: 4 URLs → 200.
- Expect: the-2026 picks up a-2026's impressions; "coffee shops porto" /
  "pastel de nata porto" clicks up a little. Small (2 clicks moved).
- Measure on: 2026-11-23 (GSC clicks on the-2026-guide vs 15 / 929 baseline).
- Result:
- Next run: #26 is forward-scan work and needs owner input first (see below).
  Otherwise #10 (low-CTR pass: "mike stern casa da musica" 66 impr at pos 6.3,
  0 clicks) or #12 (draft Porto Expats post Tue 10-27 for Wed 10-28).
- Needs owner: **the daily forward scan hasn't committed for 2 days** (10-25,
  10-26 07:00) though a dry run verifies 14 events. Thursday's edition is now
  composed from these, so please check the GitHub Action / Vercel log for
  `/api/cron/forward-scan` (likely a timeout during enrichment of 14 events, or
  a commit error). Or grant this run Vercel log access and I'll diagnose it.

## 2026-10-25 — Forward scan: Fever hubs as listings, guessed URLs dropped (backlog #25a,b)
- Metrics (`metrics/2026-10-25.json`): 314 clicks / 14,464 impr / pos 10.03
  over 28d (yesterday 322 / 14,433 / 9.88; prev 28d 249 / 11,598 / 13.2).
  Last 7d 73 clicks vs 87, impressions 3,094 vs 5,144 (iberanime spike still
  in prev7), CTR 2.4% vs 1.7%; 7d position 12.2 vs 9.3 (worth watching).
  GA4 7d 33 users / 39 sessions / 80 PV (prev 31 / 37 / 61); 17 organic, 10
  organic social, 6 AI, 6 direct; `sign_up` 1. Subscribers 55 (10-22).
  **Second attributed signup:** EN, from an event page
  (`/event/final-days-for-voice-by-lydia-ourahmane-…`, 10-25 08:12 UTC).
- Check from 10-24: the 10-24 forward-scan commit (0a3433d, "Canta-me uma
  História – ao vivo", Super Bock Arena, 7 Nov) comes from the venue's own
  event page and its copy is factual. It was already flushed (10-24 22:52), and
  nothing needed removing. Today's 07:00 cron committed nothing.
- Change (`lib/forward-scan.ts`, b6150f2): (a) feverup.com URLs without
  `/m/<id>` are listings (collection hubs like `/porto/candlelight`), both as
  model URLs and as grounding sources. (b) When the search returned pages on a
  host but not the model's exact URL, that URL is a guess: it's dropped, the
  host becomes the rescue hint, and `sources.guessedUrls` counts it.
- Verified: offline check of 10 URLs (Fever hub/event, casadamusica
  guessed/real, hosts with no sources stay untouched); tsc; build OK (no page
  changes); /api/version = b6150f2; health ok (9/9). **Prod dry run: 21
  discovered, 5 dupes, 3 verified** (10-24: 2), 8 guessed URLs dropped, 3
  listings. The verified events are real Casa da Música detail pages
  (`/en/event/schubert-and-strauss/`, `/event/a-arte-da-fuga/`). Before, the
  model guessed `/agenda/<slug>/<id>` paths there, which 404'd. 13 Gemini
  calls, 29.9k in / 32.0k out, 84 s.
- Remaining rejections → backlog #26: `hardclubporto.com/schedule` (listing
  word not in the filter, 404) ×3; coliseu.pt detail pages are JS-rendered
  (19 chars of text) ×2; aggregators (`agenda-porto.pt`,
  `rottacuradoria.com.br`) used as sources; rescue found nothing for 4.
- Expect: daily cron commits ≥1 clean event most days.
- Measure on: next runs: read each `chore: forward scan` commit before the
  21:00 flush. Yield 2026-11-03; search effect 11-17.
- Result:
- Next run: #24 (coffee guide merge + 301). It's ready and is the only
  search-side item; the forward scan has had 4 runs in a row.
- Needs owner: nothing to decide.

## 2026-10-24 — Forward scan: grounding sources fixed (backlog #23)
- Metrics (`metrics/2026-10-24.json`): 322 clicks / 14,433 impr / pos 9.88
  over 28d (yesterday 316 / 14,402 / 9.83; prev 28d 241 / 11,497 / 13.6).
  Last 7d 72 clicks vs 92, impressions 3,041 vs 5,200 (iberanime spike in
  prev7), CTR 2.4% vs 1.8%. GA4 7d 36 users / 41 sessions / 80 PV (prev 31 /
  38 / 59); 21 organic, 10 organic social, 5 AI, 5 direct; `sign_up` 1.
  Subscribers 55 (10-22 snapshot). Signups attributed in 28d: 1. No result
  due today (first is 10-31).
- Today's 07:00 forward-scan cron committed nothing (no commit since 10-23).
- Why: 10-23 prod dry run had `sources.returned = 0`, so every candidate URL
  was model-written and most 404'd.
- Diagnosis: there's no GEMINI_API_KEY in `.env.local`, so I couldn't probe
  locally, and I didn't decrypt the prod env. The discovery and rescue searches
  asked for JSON-only replies. Gemini attaches grounding chunks to prose it can
  attribute to sources, so the fix asks for prose.
- Change (`lib/forward-scan.ts`, 3d6fd1d): grounded searches now write one
  plain sentence per event (incl. the page address as found); a no-search
  JSON-mode call (`structure()`, thinking off) converts that to candidates,
  copying URLs only as written. The rescue search answers in prose too. New
  `sources.grounding` counts per call: metadata / queries / chunks / supports.
- Verified: tsc; build OK (no page changes); /api/version = 3d6fd1d; health
  ok (9/9). **Prod dry run: grounding chunks on 3/3 calls; 38 sources
  returned (was 0), 23 resolved, 10 candidates matched; 45 discovered, 9
  dupes, 2 verified** (10-23: 0). 10 Gemini calls, 13.1k in / 36.5k out, 71 s.
  - Verified: Cartografias Poéticas (Helena Cardoso), Casa Comum, 27 Oct →
    16 Jan, free, from up.pt (good, specific page). Candlelight Queen vs The
    Beatles, Palácio da Bolsa, 31 Oct 22:00, from €29, **but the source is
    Fever's generic `/porto/candlelight` hub** (lists many concerts) and the
    dry-run description is one thin line. I couldn't check the page myself
    (Firecrawl permission not granted in this run).
  - Remaining rejections: casadamusica.com `/agenda/<slug>/<id>` and
    hardclubporto.com `/event/<slug>/` are still model-guessed (404);
    ticketline fails in undici (header whitespace / content-length mismatch).
    → backlog #25.
- Expect: forward events committed > 0 on daily runs; impressions on
  forward-scan event pages.
- Measure on: 2026-10-25 run: read any `chore: forward scan` commit and
  remove a record whose source is a hub/listing page or whose copy is thin
  **before the 21:00 UTC flush**. Yield 2026-11-03; search effect 11-17.
- Result:
- Next run: #25 (hub filter + prefer grounding sources) or #24 (coffee guide
  merge + 301), whichever is smaller, plus the check above.
- Needs owner: nothing to decide.

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
- Result (11-03): **worked, well above target on volume.** Records tagged
  `forward-scan` by day added: 0 until 10-22, then 84 from 10-23 to 10-31
  (about 49 a week, against the 3 to 10 expected). The 280 on 11-01 and
  the later ones also include the owner's daily source sweep, which writes
  the same tag, so they can't be split from the scan this way. Quality cost:
  duplicates keep reaching the edition week (10-27, 10-28, 11-02, and 2
  more on 11-03, see that entry). Gemini usage: not measurable from here
  (no runtime-log access). Search effect still due 11-17.

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
- Result (11-02, 10-19 → 11-01): **worked, small.** GSC: this-weekend 8
  clicks / 31 impr (pos 19.5), today 1 / 17 (pos 3.9), PT fim-de-semana 0 /
  17 (pos 14.9), PT hoje 0 / 5. Queries match the intent ("whats on in porto
  this weekend" pos 8, "eventos no porto este fim de semana" pos 16.7, "o
  que fazer no porto hoje" pos 25.5). GA4: this-weekend 26 views / 18
  sessions, today 7 views (PT pages 0, consent-only). Traffic sources: Facebook 11
  (the Porto Expats posts), chips on event pages ~12, Google 3. 1 signup came
  from /porto-events/this-weekend (10-22). Search effect still due 11-16.

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
- Result (2026-11-01): **worked, small sample.** GA4 pages/session for
  sessions landing on /blog/*: 1.00 (24 sessions / 24 PV, 10-04→10-17) →
  1.45 (20 / 29, 10-18→10-31). Sitewide also rose 1.55 → 2.10, so not all of
  it is this change. Search part still due 11-14.

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
- Result (11-07, GSC /event/ pages, 09-19→10-16 vs 10-18→11-04): **worked,
  modestly.** CTR 2.03% → 3.08% (147 / 7,255 → 225 / 7,305) on twice the
  pages (417 → 893). Without Iberanime 2.87% → 3.08%; Iberanime itself 0.2%
  → 0.5% (12 / 2,558 in 28d, past event). Only one query now has 100+ impr
  on an event page in the window ("outworld porto" 88 / 3 clicks, pos 7.6).
  Follow-up shipped as #39 on 11-07.

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
- Result (10-31, written into this entry 11-04): worked, modestly. +4 net in
  two weeks (2.0/week vs ~1.4); all 7 attributed signups from pages that had
  no form before; blog 0 → #35. See the 10-31 entry.

## 2026-10-23 (owner tip) Porto Expats as an edition source
Owner flagged Porto Expats' "Porto Weekly Guide" (Substack, Fridays, Mon–Sun). Their 26 Oct–1 Nov issue listed 8 events (Batalha Halloween quiz + film, Bloom & MAZ at Real Companhia Velha, LOOK.Sharp 6th birthday, Casa da Música Halloween, Three Sixty at Póvoa Arena, Porto Expats Meetup at Eleven Lab Baixa); data/events had none of them (only Adriana Calcanhotto that week). Added `site:portoexpats.substack.com Porto Weekly Guide events` to the Thursday SEARCH_QUERIES. Their posts are indexed within hours, so Thursday's grounded search sees Friday's issue. Leads only: never copy their text. Check the Oct 29 edition for the Halloween weekend.

## 2026-10-23 — Forward scan daily, from tomorrow (owner request)
- Why: owner: "it's almost a daily thing now". The scan only ran Mon + Fri and
  only looked 2+ weeks ahead, so events the Thursday edition missed this week
  (e.g. Porto Expats' Halloween list) never reached the site.
- Change: cron daily 07:00 UTC (Thursday still skipped by the freeze check);
  window tomorrow → +70 days; third discovery search for the next 14 days with
  what's-on guides (Porto Expats) as leads only — url must be the event's own
  page; near-term candidates verified first. Thursday extraction merges by
  identity, so overlap with edition events is harmless.
- Cost: ~3.5× the Gemini calls of Mon + Fri (cap still 5 events/run).
- Dry run on prod after deploy (2026-10-23 ~18:20 UTC): window 10-24→01-01,
  48 discovered, 4 dupes, 12 checked, **0 verified** — mostly model-written
  URLs that 404 (casadamusica.com/agenda/…, serralves.pt/pt/actividades/…) or
  pages that don't confirm the event. NEXT RUN (Sat 10-24): #23 grounding /
  URL-quality fix is the top priority, ahead of #24. Told owner.

## 2026-11-03 — Gomry back on, links only (#30, owner OK)
- Faris (Gomry): event pages now show visitor currency; verified € 322 for a PT visitor on Porto vs Sporting. Catalog API still returns `usd` (currency/country params ignored) and og/twitter descriptions still say $350.45; replied in the thread asking for EUR in the API.
- PR #19 (d3ad523): `GOMRY_ENABLED = true`; `priceText` quotes Gomry only in EUR, so no Gomry prices for now. Sporting 29 Nov copy EN/PT: resale via Gomry, official at fcporto.pt. Live and verified (ref link EN/PT). `~/fever-sync/run.sh` Gomry steps re-enabled (04:30 UTC).
- Next: when the API returns EUR, prices come back on their own; check after Faris replies.
- JSON-LD (PR #20, 826233b): unknown prices no longer emitted as 0 EUR (30 of 387 upcoming events); price only from priceFrom, free label or € text. Watch GSC for the non-critical "Missing field 'price'" warning.
- Watchdog (PR #21, 1c3ad24): removed paused blog-post/blog-instagram (false alarm 11-03 18:34). Dispatch returned 403: PAT Claude-Server lacks Actions write, so watchdog rescue can't dispatch any workflow (incl. Thu newsletter). Asked owner to add Actions: Read and write; then probe with a bad-ref dispatch (expect 422).
- 18:50 owner added Actions: Read and write to Claude-Server PAT; probe now 422 (authorized). Watchdog rescue restored.
