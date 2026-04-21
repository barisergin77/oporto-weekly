# Subscriber Storage

**Current system:** Resend Audiences (one per language).
**Previous system:** Beehiiv. Fully decommissioned April 2026 — API keys revoked on the Beehiiv side, env var removed from Vercel, migration script deleted. No Beehiiv dependency remains.

---

## Architecture

Two Resend audiences, one per language:

- `Oporto Weekly (EN)` — id in env var `RESEND_AUDIENCE_EN`
- `Oporto Weekly (PT)` — id in env var `RESEND_AUDIENCE_PT`

A contact can exist in both (same email subscribed to both languages) — `getActiveSubscribers()` dedupes by email when called without a language filter.

Same API key (`RESEND_API_KEY`, **Full Access** scope) is used for both sending emails and reading/writing audiences. One key, one dashboard, one vendor.

### Public API (`lib/audiences.ts`)

Three functions, same signatures the earlier Beehiiv client exposed so migrating the callers was a one-line import swap:

| Function | Used by | Notes |
|---|---|---|
| `addSubscriber(email, lang)` | `/api/subscribe` | Idempotent. If contact exists, flips `unsubscribed: false` (re-subscribe after opt-out). |
| `removeSubscriber(email)` | `/api/unsubscribe` | Flips `unsubscribed: true` in BOTH audiences. Missing from one is not an error. |
| `getActiveSubscribers(lang?)` | both newsletter crons | Returns only `unsubscribed: false` contacts. |

### Resend SDK quirk

`resend.contacts.update()` in SDK v3.2.0 takes an `id`, not an `email`. `lib/audiences.ts` looks up the id via `contacts.list` before every update. That's O(N) per unsubscribe; fine for <1k contacts, revisit if the list grows past Resend's default list-page size.

---

## Operations

### Check subscriber counts

Resend dashboard: https://resend.com/audiences — filter by audience. Or programmatically via a small script against `resend.contacts.list({ audienceId })`.

### Add / remove by hand

Rare — the public endpoints cover the normal flow. If needed:

- Resend dashboard → Audiences → pick audience → Add Contact (or three-dot menu → mark unsubscribed)
- Or hit `/api/subscribe` / `/api/unsubscribe` with curl.

### Add a new language

1. Resend dashboard → Audiences → Create audience named `Oporto Weekly (XX)`.
2. Copy the audience id, set `RESEND_AUDIENCE_XX` in Vercel.
3. Extend `Lang` and `audienceId()` in `lib/audiences.ts` to include the new language.

---

## Env var reference

| Var | Purpose | Sensitive in Vercel? |
|---|---|---|
| `RESEND_API_KEY` | Reads/writes audiences AND sends email (Full Access scope) | ✅ yes |
| `RESEND_AUDIENCE_EN` | EN audience id | no — just an identifier |
| `RESEND_AUDIENCE_PT` | PT audience id | no |

---

## Tagging for analytics

Every send carries tags so the Resend dashboard can slice open/click rates:

```
newsletter (EN)  → type=newsletter, lang=en, edition=<slug>
newsletter (PT)  → type=newsletter, lang=pt, edition=<ptSlug>
subscribe       → type=welcome,   lang=<lang>
health          → type=health-alert
reddit-draft email → type=reddit-draft
```

Filter examples in the Resend Emails tab:

- `type:newsletter AND lang:en` → EN open rate, welcome flow excluded
- `edition:april-16-22-2026` → this week's EN only
- `type:welcome` → isolates welcome-email performance

**Caveat:** Apple Mail Privacy and Gmail image proxies pre-fetch the tracking pixel, inflating open rates systematically. Treat opens as directional, clicks as reliable.

---

## File map

```
lib/audiences.ts                       — Resend Audiences client (public API)
app/api/subscribe/route.ts             — calls addSubscriber
app/api/unsubscribe/route.ts           — calls removeSubscriber
app/api/cron/newsletter/route.ts       — calls getActiveSubscribers('en')
app/api/cron/newsletter-pt/route.ts    — calls getActiveSubscribers('pt')
```

---

## History

- **March 2026:** Subscribers lived in Beehiiv, sends went through Resend. Two vendors doing one job.
- **April 18, 2026:** Migrated to Resend Audiences. Kept `BEEHIIV_API_KEY` in env as a fallback in case we needed to restore.
- **April 21, 2026** (following the Vercel security incident): Beehiiv API keys revoked on their side, env var removed from Vercel, `scripts/migrate-beehiiv-to-resend.ts` deleted. Fully single-vendor now.
