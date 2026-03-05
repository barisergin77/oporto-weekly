# Oporto Weekly

A curated Porto events newsletter, auto-generated every Thursday morning via Gemini AI and delivered via Resend.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes
- **Vercel** — hosting + cron jobs
- **Beehiiv** — subscriber management
- **Resend** — transactional email delivery
- **Gemini 2.0 Flash** — AI-powered weekly research & content generation

## Architecture

```
Every Thursday 08:00 UTC
  └── Vercel Cron → GET /api/cron/newsletter
        ├── 6× Gemini searches (parallel) — Porto events by category
        ├── 1× Gemini call — generates full HTML newsletter
        └── POST /api/send-newsletter → Resend batch to all Beehiiv subscribers
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `BEEHIIV_API_KEY` | Beehiiv API key (Settings → API) |
| `RESEND_API_KEY` | Resend API key (resend.com/api-keys) |
| `GEMINI_API_KEY` | Google AI Studio key (aistudio.google.com) |
| `NEWSLETTER_SECRET` | Random secret to protect `/api/send-newsletter` — generate with `openssl rand -hex 32` |

## Local Development

```bash
cp .env.example .env.local
# Fill in your keys

npm install
npm run dev
# → http://localhost:3000
```

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/subscribe` | POST `{ email }` | Add subscriber to Beehiiv + send welcome email |
| `/api/send-newsletter` | POST `{ html, subject }` | Send to all active subscribers (requires `Authorization: Bearer {NEWSLETTER_SECRET}`) |
| `/api/cron/newsletter` | GET | Full research → generate → send pipeline (called by Vercel cron) |

## Deploy to Vercel

1. **Push to GitHub** (or connect your repo)

2. **Import project on Vercel** at vercel.com/new

3. **Set environment variables** in Vercel dashboard:
   - `BEEHIIV_API_KEY`
   - `RESEND_API_KEY`
   - `GEMINI_API_KEY`
   - `NEWSLETTER_SECRET`

4. **Deploy** — Vercel auto-detects Next.js

5. **Cron** runs automatically every Thursday at 08:00 UTC per `vercel.json`

### Verify cron is active
In Vercel dashboard → your project → **Cron Jobs** tab — you should see:
```
0 8 * * 4  /api/cron/newsletter
```

## Email Sender Domain

Currently using `onboarding@resend.dev` (Resend's shared domain) which works for testing.

To use your own domain:
1. Add your domain in Resend dashboard
2. Update `FROM` in `lib/resend-client.ts` to e.g. `hello@oportoweekly.com`

## Manual Send

To trigger the newsletter manually:
```bash
curl -X GET https://your-app.vercel.app/api/cron/newsletter
```

Or to send a custom newsletter:
```bash
curl -X POST https://your-app.vercel.app/api/send-newsletter \
  -H "Authorization: Bearer YOUR_NEWSLETTER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"subject": "Oporto Weekly — Test", "html": "<h1>Hello Porto!</h1>"}'
```
