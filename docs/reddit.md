# Reddit Drafts

Weekly "ready-to-paste" r/porto post generator. Not an auto-poster.

---

## Why not automate the posting too?

r/porto, r/portugal, r/portocityguide, and most event-adjacent subs have strict rules against self-promotion. Mod tooling (AutoModerator + Reddit's native heuristics) aggressively shadow-bans accounts that:

- Post links to the same domain repeatedly
- Post on a visible cron cadence (same weekday, same time)
- Post-and-run without comment history or karma in the sub
- Submit a headline that looks like a newsletter promo

Manual posting sidesteps all of it. Reading as a helpful local sharing a weekly roundup is worth more than 10× automation speed. The cron just removes the research + formatting friction.

---

## How it works

**Thursday 08:50 UTC** — `.github/workflows/cron-reddit-draft.yml` hits `/api/cron/reddit-draft`. The endpoint:

1. Pulls the **latest** newsletter from `data/newsletters.json` via the GitHub API (not "today's computed slug", so on-demand regeneration works any day).
2. Fetches that edition's HTML, strips the footer.
3. Passes it to Gemini 2.5 Flash with `thinkingBudget: 0` (this is a reformat task — Pro's mandatory thinking budget consumed the entire output budget on the first try). Fallback: Flash-Lite.
4. The Gemini prompt is few-shot'd on a real r/porto post that performed well (thread [1sc7d4m](https://www.reddit.com/r/porto/comments/1sc7d4m), 8 upvotes). It also carries a compact "AI writing tells to avoid" list distilled from the humanizer skill, since early runs produced press-release prose ("rich tapestry", "breathtaking").
5. Output is ONE bilingual post (EN + PT), ~5 events curated from the full newsletter, no category grid, no emoji — matching the reference's format.
6. Emails the title and body separately to the editor (`barisergin@gmail.com`) so they can be pasted into Reddit's "Title" and "Body" fields directly.

---

## The email

Subject: `Reddit draft · r/porto · April 16-22, 2026`

Body: short header, a monospace block with the **title** (paste into Reddit's Title field), a monospace block with the **body** in markdown (paste into the body field). Reddit respects the `**bold**` + `*` bullets verbatim.

Tagged `type=reddit-draft` so it doesn't pollute newsletter open-rate stats in the Resend dashboard.

---

## Posting etiquette (copied from the email itself so it's hard to forget)

- **Prefer Version A.** Version B is safer only if you already have karma and comment history in r/porto.
- **Comment on someone else's post first, then submit.** Reddit's algorithm treats fresh accounts that only submit as suspicious.
- **Don't post at the same minute every week.** Morning vs evening, Thursday vs Friday — vary it. Also helps with visibility across different waves of users.
- **Reply to comments conversationally.** If someone asks for a venue tip, just answer — don't link to the newsletter.
- **Rough 9:1 rule:** for every self-promotion post, make ~9 organic contributions (answering questions, sharing non-newsletter content, commenting). Real for community subs.

---

## Regenerating on demand

If you want a fresh draft mid-week (e.g. an event got added, or you want to retry a different tone):

```
GitHub → Actions → "Cron · Reddit Draft" → Run workflow
```

or from CLI:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://oportoweekly.com/api/cron/reddit-draft | jq
```

The endpoint is idempotent — re-running just sends you a new email.

---

## Schedule (all crons, for context)

| Time (UTC) | Time (Porto local) | Cron |
|---|---|---|
| Thu 08:00 | Thu 09:00 | newsletter (EN) |
| Thu 08:15 | Thu 09:15 | newsletter-pt |
| Thu 08:30 | Thu 09:30 | health check |
| Thu 08:45 | Thu 09:45 | instagram |
| **Thu 08:50** | **Thu 09:50** | **reddit-draft** |
| Tue 09:00 | Tue 10:00 | blog |
| Daily 06:00 | Daily 07:00 | search-engines ping |

---

## File map

```
app/api/cron/reddit-draft/route.ts      — reads newsletter, calls Gemini, emails draft
.github/workflows/cron-reddit-draft.yml  — Thursday 08:50 UTC + workflow_dispatch
docs/reddit.md                            — this file
```
