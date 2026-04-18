# Search Engine Indexing

How Oporto Weekly tells Google, Bing, and RSS aggregators about new content. Covers the sitemap, the notification pipeline, and the manual / scheduled re-submit path.

---

## Channels

Four parallel notification channels fire on every publish and (separately) every morning:

| Channel | What it tells | Auth | Where |
|---|---|---|---|
| **IndexNow** | Bing, Yandex, Seznam, Naver | Key file at `/oportoweekly2026indexnow.txt` + `INDEXNOW_KEY` env var | `notifyIndexNow` in `lib/search-engines.ts` |
| **Google Indexing API** | Google (officially job postings + streams; unofficially useful for any URL) | `GOOGLE_SERVICE_ACCOUNT_JSON` (service account with Owner access in GSC + Indexing API enabled) | `notifyGoogleIndexingAPI` |
| **GSC sitemap submit** | Google (tells GSC to re-fetch the sitemap) | Same service account | `submitSitemapToGSC` |
| **WebSub** | Feedly, Flipboard, any RSS hub subscriber | None (public hub) | `pingWebSub` → `pubsubhubbub.appspot.com` |

Google does NOT use IndexNow. IndexNow is genuinely only for Bing/Yandex/etc.

---

## Sitemap

`app/sitemap.ts` is Next.js's built-in `MetadataRoute.Sitemap` — regenerated on every build. It enumerates:

- Top-level: home, `/blog`, `/porto-events`, `/pt`, `/archive`, `/pt/arquivo`
- Every blog post: `/blog/<slug>`
- Every EN edition: `/archive/<slug>`
- Every PT edition: `/pt/arquivo/<slug>`

26 URLs as of this writing.

Lives at https://oportoweekly.com/sitemap.xml. Robots.txt (`app/robots.ts`) points at it.

---

## When notifications fire

### On publish (per-content)

Each content cron calls `notifySearchEngines(<slug>)` after archiving. That helper fires all four channels above for:

- The root URL (`https://oportoweekly.com`)
- The parent index (`/blog` or `/archive`)
- The specific content URL (`/blog/<slug>` or `/archive/<slug>`)

| Cron | Triggers |
|---|---|
| `newsletter/route.ts` | After EN archive |
| `newsletter-pt/route.ts` | After PT archive |
| `blog/route.ts` | After blog archive |

### Daily full re-submit

`.github/workflows/search-engines-ping.yml` runs at 06:00 UTC every day and curls `/api/search-engines/resubmit` with `Authorization: Bearer $CRON_SECRET`. The endpoint:

1. Collects ALL canonical URLs (not just one) from the sitemap data sources
2. Fires all four channels on the full set
3. Returns a JSON diagnostic response with env-var status + per-channel timing

This is belt-and-suspenders on top of the per-publish pings — catches skipped days, env-var changes, and nudges Google to re-crawl older URLs.

### Manual re-submit

The same endpoint + workflow is `workflow_dispatch`-enabled:

```
GitHub → Actions → Search Engines · Full Re-submit → Run workflow
```

Use after verifying a new GSC property, or if you suspect the daily ping missed.

Or from CLI:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://oportoweekly.com/api/search-engines/resubmit | jq
```

---

## Diagnostic response

The resubmit endpoint returns:

```json
{
  "ok": true,
  "urlCount": 26,
  "urls": [ ... ],
  "envConfigured": {
    "INDEXNOW_KEY": true,
    "GOOGLE_SERVICE_ACCOUNT_JSON": true
  },
  "notes": [],
  "results": [
    { "name": "IndexNow",          "status": "ok", "ms": 171 },
    { "name": "GoogleIndexingAPI", "status": "ok", "ms": 2639 },
    { "name": "GSCSitemap",        "status": "ok", "ms": 181 },
    { "name": "WebSub",            "status": "ok", "ms": 788 }
  ]
}
```

If an env var is missing, the corresponding channel silently no-ops **but** `notes[]` surfaces the reason. That's the first thing to check if you think indexing stopped.

---

## Env var reference

| Var | Required? | Purpose |
|---|---|---|
| `INDEXNOW_KEY` | ✅ for Bing/Yandex | Value must match contents of `public/<KEY>.txt`. Currently `oportoweekly2026indexnow`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ for Google | Full service account JSON. Service account must be Owner in GSC property AND have Indexing API + Search Console API enabled in the GCP project. |
| `CRON_SECRET` | ✅ | Bearer auth for the resubmit endpoint (same secret used by every cron workflow). |

---

## Setup checklist (for a new property)

If you ever move domain or need to re-bootstrap:

1. **GSC property** — verify oportoweekly.com in Search Console (DNS TXT via Cloudflare).
2. **Service account** — create in GCP, enable Indexing API + Search Console API, generate JSON key.
3. **GSC Owner** — in Search Console → Settings → Users and permissions, add the service account's email as Owner (not just User). Indexing API requires Owner.
4. **Paste JSON** — `GOOGLE_SERVICE_ACCOUNT_JSON` into Vercel env (Production).
5. **IndexNow key** — pick any alphanumeric string, save as `public/<KEY>.txt` (body = the key itself), set `INDEXNOW_KEY` env.
6. **Submit sitemap** — GSC → Sitemaps → add `https://oportoweekly.com/sitemap.xml`. (The cron will keep it fresh automatically after this.)
7. **Verify** — `curl -H "Authorization: Bearer $CRON_SECRET" https://oportoweekly.com/api/search-engines/resubmit` should return all-ok with no notes.

---

## Why only one page indexed at first

Sitemap submission ≠ indexing. Google indexes at its own pace (days to weeks), even when everything is wired correctly. The `submitSitemapToGSC` call says "please re-crawl the sitemap," not "please index all URLs now." For priority pages use GSC → URL Inspection → "Request Indexing" (~10/day per property).

The daily re-ping exists precisely to keep applying pressure; expect indexed-page count to climb over 1–2 weeks without further intervention.

---

## File map

```
lib/search-engines.ts                              — 4 notification channels
app/api/search-engines/resubmit/route.ts           — manual/scheduled full resubmit
app/sitemap.ts                                     — sitemap generator
app/robots.ts                                      — robots.txt
app/feed.xml/route.ts                              — RSS (WebSub hub link inside)
public/oportoweekly2026indexnow.txt                — IndexNow key file
.github/workflows/search-engines-ping.yml          — daily 06:00 UTC + workflow_dispatch
```
