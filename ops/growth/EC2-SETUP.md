# Running the growth loop on the EC2 box

The loop is a daily, non-interactive Claude Code run in a checkout of this
repo. Everything it needs to know is in `ops/growth/`; everything it needs
to *do* is git, npm and the scripts in this repo.

## One-time setup

1. **Node 20+ and Claude Code** installed and logged in (`claude --version`).
2. **Clone with push access:**
   ```bash
   git clone https://github.com/barisergin77/oporto-weekly.git ~/oporto-weekly
   cd ~/oporto-weekly && npm ci
   ```
   Pushing needs a credential. The fine-grained PAT already in
   `GITHUB_TOKEN` works (`git config credential.helper store`, then push
   once and enter it as the password). It **expires 2027-01-02** — rotate it
   here too when you rotate it in Vercel.
3. **Secrets — a trimmed file, not the whole `.env.local`.** On the Mac,
   `~/oporto-weekly-ec2.env` holds only the four keys the loop uses:
   `GOOGLE_SERVICE_ACCOUNT_JSON` (Search Console, GA4, recrawl requests),
   `CRON_SECRET` (health/status checks), `GITHUB_TOKEN` (git push) and
   `INDEXNOW_KEY`. Copy it over and lock it down:
   ```bash
   scp ~/oporto-weekly-ec2.env <ec2-host>:~/oporto-weekly/.env.local
   ssh <ec2-host> chmod 600 ~/oporto-weekly/.env.local
   ```
   Deliberately left out: `RESEND_*` (could email subscribers), `BUFFER_*`
   (could post to Instagram), `GEMINI_API_KEY`, `IMGUR_CLIENT_ID`, and the
   `VERCEL_*`/`TURBO_*` values `vercel env pull` adds. The site builds with
   no secrets at all (verified 2026-10-17), so nothing else is needed. Values
   are quoted: read them with `--env-file` or strip the quotes in shell.
4. **Git identity:** `git config user.name "oporto-growth-bot"` and
   `git config user.email "growth@oportoweekly.com"`.
5. **Dry run by hand first:**
   ```bash
   cd ~/oporto-weekly && git pull && npx tsx --env-file=.env.local scripts/growth-metrics.ts
   ```
   It should print search, visitor and subscriber numbers.

## The daily job

`crontab -e`, then one line (09:00 UTC daily):

```cron
0 9 * * * cd ~/oporto-weekly && git pull -q && claude -p "$(cat ops/growth/DAILY_PROMPT.md)" --permission-mode acceptEdits --allowedTools "Bash(git:*) Bash(npm:*) Bash(npx:*) Bash(curl:*) Bash(node:*) Read Edit Write Glob Grep WebSearch WebFetch" >> ~/growth-loop.log 2>&1
```

- Check the flag names against `claude --help` for your installed version.
- `--allowedTools` is deliberately narrower than skipping permissions
  entirely: the run can edit the repo, build, push and call the site, but
  nothing else on the server.
- The freeze window (Wed 18:00 – Thu 23:59 UTC) is enforced by the playbook,
  so the job can run every day; on Wednesday evening/Thursday it only
  observes.

## Checking on it

- `ops/growth/LOG.md` on GitHub — one entry per run, with a "Needs owner"
  note when it wants a decision.
- `~/growth-loop.log` on the server for raw run output.
- The daily health-check email still alerts on any site or credential
  problem, independently of the loop.
