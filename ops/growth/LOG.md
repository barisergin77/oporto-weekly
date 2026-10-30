# Growth log

Newest first. One entry per change. Fill in **Result** on the measure date.

Baseline 2026-10-17 (`metrics/2026-10-17.json`): search 343 clicks / 14,693
impressions / pos 9.3 over 28 days (prev 28: 191 / 10,293 / 16.9);
subscribers 56 active (34 EN, 22 PT), ~1.4 net/week; signups by page: none
recorded yet (tracking started today).

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
