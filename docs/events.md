# Individual Event Pages

Each event mentioned in a weekly newsletter gets its own canonical URL at `/event/<slug>`, with an aggregated `/venue/<slug>` page per unique venue. This turns the newsletter's internal structure into dozens of indexable, share-worthy pages — the single biggest SEO lever available to the project.

---

## Why event pages

The weekly newsletter is a search-intent mismatch. Visitors search Google for specific event names (`tito paris porto`), not "porto events april 16-22 roundup". Splitting the newsletter into per-event pages:

- Matches the actual long-tail query
- Multiplies indexable URLs by ~20x per week
- Emits `schema.org/Event` JSON-LD that can surface in Google Events and rich snippets (date, venue, price in the SERP)
- Gives visitors a shareable, bookmarkable page per event
- Enables venue aggregation (`/venue/casa-da-musica`), which ranks well for `<venue> events` queries

Expected URL growth: 20 events/week × 52 weeks ≈ **1,040 event pages/year**, plus 50-100 venue pages. At current scale, Vercel Hobby handles this comfortably.

---

## Data model

**One file per event** at `data/events/<slug>.json` with:

```ts
interface EventRecord {
  slug: string;              // tito-paris-casa-da-musica-apr-17-2026
  name: string;              // "Tito Paris Concert"
  date: string;              // "2026-04-17" or "2026-04-17T21:30"
  endDate?: string;          // for multi-day events
  venue: string;             // "Casa da Música"
  venueSlug?: string;        // "casa-da-musica" (canonicalised — see below)
  price?: string;            // "€20-€40"
  priceFrom?: number;        // 20 (used in JSON-LD Offer)
  currency?: string;         // "EUR"
  category: EventCategory;   // music | art | food | family | nightlife | sports | other
  description: string;       // 1-2 factual sentences
  sourceEdition: string;     // "april-16-22-2026"
  image?: EventImage;        // { url, credit, sourceUrl }
  externalLink?: string;     // Official ticketing / venue page
  addedAt: string;           // ISO timestamp
}
```

### Venue slug canonicalisation

`venueToSlug()` strips sub-room and sub-venue suffixes so events at the same place aggregate under one URL:

| Raw venue string | Slug |
|---|---|
| `Casa da Música` | `casa-da-musica` |
| `Casa da Música, Sala 2` | `casa-da-musica` |
| `Casa da Música Café` | `casa-da-musica` |
| `Hilton Porto Gaia / Pestana Palácio` | `hilton-porto-gaia` |
| `Einstein's Lab` | `einsteins-lab` |

Rules: strip after first comma or slash, strip trailing `Café`/`Sala X`/`Main Hall`/`Auditorium X` suffixes, strip apostrophes, normalise diacritics, lowercase, kebab.

### Event slug format

`<name>-<venue>-<mon><day>-<year>` e.g. `tito-paris-casa-da-musica-apr-17-2026`.

- Self-describing (readable from the URL)
- Chronologically sortable
- Uniqueness via date — recurring events (weekly markets, residencies) don't collide

---

## How the pipeline runs

### Thursday 08:00 UTC — `cron/newsletter` (EN)

After generating + sending the newsletter HTML:

1. Calls `extractEventsFromHtml(html, slug)` from `lib/events-pipeline.ts`
2. Gemini Flash (thinking disabled) returns structured JSON: ~20 events per edition
3. Each raw event → `EventRecord` with computed slug + canonical venueSlug
4. **All event JSONs commit atomically with the HTML in a single GitHub commit** (no partial states)
5. Vercel auto-deploys; event pages + venue pages go live within ~60s

Non-fatal: if extraction fails, the newsletter still archives. Events can be rebuilt later via `npm run extract-events -- <slug>`.

### Thursday 09:15 UTC — `cron/event-images`

Runs ~75 min after newsletter (after subs, PT, health, Instagram, reddit-draft all complete):

1. Lists all `data/events/*.json` via the GitHub contents API
2. Filters to events without an `image` field
3. Sorts newest-first, caps at 20 per run
4. For each: if `externalLink` is a real URL (not `google.com`), uses it; otherwise Gemini Search finds one
5. Fetches the page, extracts `<meta property="og:image">` (falls back to `twitter:image`)
6. Downloads → uploads to Imgur → commits `{url, credit, sourceUrl}` back to the event JSON
7. Time-budgeted: stops early if it exceeds 270s to leave buffer for the final commit

All updated events commit in **one atomic commit** for a clean git history.

### Post-run reality

Image hit rate varies by week (~50-80% depending on how many events have working press pages). Events that fail fall back to a category-emoji placeholder on the event page — no broken UI.

---

## CTAs and the "never google.com" rule

The event page shows a `Get tickets →` button **only when `externalLink` passes `isRealEventUrl()`**, which rejects `google.com` / `google.pt` / any `*/search` URL.

Enforcement is layered:

1. **Extraction prompt** explicitly forbids google URLs, says to omit the field instead
2. **`toEventRecord()` in `lib/events-pipeline.ts`** filters bad URLs before persisting
3. **Event page** double-checks via `isRealEventUrl()` before rendering the CTA

Never render a button that links to a Google search results page. It kills credibility.

---

## Manual ops

```bash
# Extract events from an already-shipped edition (historical backfill)
npm run extract-events -- april-16-2026
npm run extract-events -- april-16-2026 --dry-run

# Backfill images for events that don't have one yet
npm run fetch-event-images
npm run fetch-event-images -- --slug=tito-paris-casa-da-musica-apr-17-2026
npm run fetch-event-images -- --force   # refetch everything

# Trigger the image cron remotely (same as GitHub Actions)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://oportoweekly.com/api/cron/event-images | jq
```

---

## File map

```
lib/events.ts                              — types, helpers, file I/O, venueToSlug, isRealEventUrl, toEventJsonLd
lib/events-pipeline.ts                     — Gemini extraction + Imgur image acquisition (pure logic, shared)
scripts/extract-events-from-newsletter.ts  — one-off HTML → event JSONs (npm run extract-events)
scripts/fetch-event-images.ts              — backfill press photos (npm run fetch-event-images)
app/event/[slug]/page.tsx                  — individual event page (Porto-Secreto-style layout)
app/venue/[slug]/page.tsx                  — venue aggregation page (upcoming + past)
app/api/cron/event-images/route.ts         — Thursday 09:15 UTC background image cron
.github/workflows/cron-event-images.yml    — schedule + workflow_dispatch
```

---

## Schema.org rich snippets

Each event page emits `@type: Event` JSON-LD with:
- `name`, `description`, `startDate`, optional `endDate`
- `location: { @type: Place, name: venue, address: { addressLocality: Porto, addressCountry: PT } }`
- `offers` when we have `priceFrom` (or `price: 0` for free events)
- `image` when we have a photo
- `organizer: Oporto Weekly`

Each venue page emits `@type: Place` with the 20 most recent upcoming events as `event[]`.

This is what makes Google Events eligible to feature us in the "events near Porto" carousel (long-tail SEO). Validate via https://search.google.com/test/rich-results after a fresh deploy.
