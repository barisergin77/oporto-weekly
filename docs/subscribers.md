# Subscriber Storage

**Current system:** Resend Audiences (one per language).
**Previous system:** Beehiiv. Migrated April 2026. API key kept in env as a fallback.

---

## Why Resend Audiences (and not Beehiiv)

Originally subscribers lived in Beehiiv while Resend did the actual sending. That meant two vendors for one job: Beehiiv was a glorified email-list database (we weren't using its landing pages, referrals, automations, or analytics), and every send loop had to fetch the list from Beehiiv before handing it off to Resend.

The split created three ongoing costs:

1. **Two sources of truth.** Subscribe writes to Beehiiv, unsubscribe writes to Beehiiv, but sends happen through Resend. Any sync bug means we send to someone who's already unsubscribed.
2. **Two API keys, two dashboards, two vendors to renew.**
3. **Nothing Beehiiv-only was in use.** Opens, clicks, suppression, deliverability — all of that already lived in Resend once we enabled tracking.

Consolidating onto Resend Audiences gave us one source of truth, fewer moving parts, and a subscriber store that's native to the thing doing the sending.

`BEEHIIV_API_KEY` is kept in env as a fallback. No production code reads it, but the migration script can still pull from Beehiiv if we ever need to restore, and we can migrate back to Beehiiv without a hunt for credentials.

---

## How it works now

### Audiences

Two audiences, named on the Resend dashboard as:

- `Oporto Weekly (EN)` — id in env var `RESEND_AUDIENCE_EN`
- `Oporto Weekly (PT)` — id in env var `RESEND_AUDIENCE_PT`

A contact can exist in both (same email subscribed to both languages) — `getActiveSubscribers()` dedupes by email when called without a language filter.

### Public API (`lib/audiences.ts`)

Three functions, same signatures as the old `lib/beehiiv.ts`:

| Function | Used by | Notes |
|---|---|---|
| `addSubscriber(email, lang)` | `/api/subscribe` | Idempotent. If contact exists, flips `unsubscribed: false` (re-subscribe after opt-out). |
| `removeSubscriber(email)` | `/api/unsubscribe` | Flips `unsubscribed: true` in BOTH audiences. Missing from one is not an error. |
| `getActiveSubscribers(lang?)` | both newsletter crons, legacy `send-newsletter` | Returns only `unsubscribed: false` contacts. |

### Resend SDK quirk

`resend.contacts.update()` in SDK v3.2.0 takes an `id`, not an `email`. `lib/audiences.ts` looks up the id via `contacts.list` before every update. That's O(N) per unsubscribe; fine for <1k contacts, revisit if the list grows.

---

## Operations

All commands assume `.env.local` has `BEEHIIV_API_KEY`, `RESEND_API_KEY`, and (after `setup`) the audience ids. Same vars must also live in Vercel production env.

### Initial migration (already done)

```bash
npm run migrate-subs setup              # creates 2 audiences, prints ids
# → paste RESEND_AUDIENCE_EN / RESEND_AUDIENCE_PT into Vercel + .env.local
npm run migrate-subs migrate --dry-run  # sanity check counts
npm run migrate-subs migrate            # idempotent; re-runnable
npm run migrate-subs verify             # EN/PT counts should match Beehiiv
```

### Check subscriber counts any time

```bash
npm run migrate-subs verify
```

Output shape:

```
                    Beehiiv     Resend
   EN (active)        123         123
   PT (active)         45          45
   Δ EN               +0
   Δ PT               +0
   Only in Beehiiv:  0
   Only in Resend:   0
```

Non-zero deltas after the cutover are expected over time — new subscribers hit Resend only, and anyone who unsubscribes flips their flag in Resend but not in Beehiiv.

### Add/remove a subscriber by hand

Rare — the public endpoints cover the normal flow. But if you need to poke the list directly:

- Resend dashboard: https://resend.com/audiences → pick audience → Add Contact (or the three-dot menu to mark unsubscribed).
- Programmatically: call `addSubscriber` / `removeSubscriber` from a one-off script or `curl` the subscribe endpoint.

### Re-import from Beehiiv (disaster recovery)

The migration script is idempotent — contacts that already exist in the Resend audience are skipped. Re-running is safe.

```bash
npm run migrate-subs migrate
```

### Migrate back to Beehiiv (undo)

Not scripted; unlikely to need it. Export contacts from Resend (dashboard CSV export per audience), bulk import into Beehiiv, then revert the `lib/audiences.ts` → `lib/beehiiv.ts` cutover commit (`git log --grep="Beehiiv to Resend"`).

---

## Env var reference

| Var | Required? | Purpose |
|---|---|---|
| `RESEND_API_KEY` | ✅ always | Reads/writes audiences AND sends email |
| `RESEND_AUDIENCE_EN` | ✅ always | EN audience id |
| `RESEND_AUDIENCE_PT` | ✅ always | PT audience id |
| `BEEHIIV_API_KEY` | optional | Only needed locally to re-run migration from Beehiiv. Not read in production. |

---

## Tagging for analytics

Every send carries tags so the Resend dashboard can slice open/click rates:

```
newsletter (EN)  → type=newsletter, lang=en, edition=<slug>
newsletter (PT)  → type=newsletter, lang=pt, edition=<ptSlug>
subscribe       → type=welcome,   lang=<lang>
health          → type=health-alert
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
scripts/migrate-beehiiv-to-resend.ts   — setup / migrate / verify
app/api/subscribe/route.ts             — calls addSubscriber
app/api/unsubscribe/route.ts           — calls removeSubscriber
app/api/cron/newsletter/route.ts       — calls getActiveSubscribers('en')
app/api/cron/newsletter-pt/route.ts    — calls getActiveSubscribers('pt')
app/api/send-newsletter/route.ts       — legacy; calls getActiveSubscribers()
```
