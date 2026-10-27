#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
#   exit 0 → SKIP this build
#   exit 1 → BUILD
#
# Why: ~half of all deploys were bookkeeping commits that touch only
# data/run-ledger.json or data/subscriber-history.json. Both are read at
# runtime through the GitHub API (lib/github.ts getFileContent), never from
# the deployed filesystem, so rebuilding 1,300+ static pages for them changed
# nothing — but each build still landed in Deployment Storage, which hit the
# Hobby 10 GB cap on 2026-09-21.
#
# FAIL-SAFE: every uncertain path BUILDS. Skipping a needed deploy is far
# worse than an unneeded one — newsletter-send waits for the archive deploy to
# go live, so a wrongly skipped archive build would hold that week's email.

# ENV VAR CHANGES: a Vercel env change has no git diff, so a plain
# `vercel redeploy` looks bookkeeping-only and is SKIPPED here (2026-10-04:
# rotated BUFFER_API_KEY + GITHUB_TOKEN, redeploy was canceled). To roll out
# an env change, bump .deploy-trigger and push — it is not on the allowlist,
# so it always builds.

set -u

# DEFERRED (2026-10-15): enrichment crons — press photos, long descriptions,
# PT translations, link validation — touch only data/events/*.json, and on a
# Thursday each committed separately: ~9 full deployments for one edition, 22
# of 52 builds in 30 days. Hobby keeps deleted deployments on the 10 GB meter
# for ~30 days, so that alone filled it again. These changes are not urgent,
# so they are skipped here and published together by
# .github/workflows/deploy-flush.yml, which builds whenever the live commit
# (/api/version) is behind HEAD. Anything else in the same diff still builds.
DEFERRED_PREFIX="data/events/"

# Files that never affect the built site. Keep this list short and exact.
SKIPPABLE=(
  "data/run-ledger.json"
  "data/subscriber-history.json"
  "data/pick-date-blocklist.json"
  "data/signup-sources.json"
  "data/forward-leads.json"   # read at runtime from GitHub (cron/forward-scan)
)

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$prev" ]; then
  echo "build: no previous deployment SHA (first deploy or redeploy)"
  exit 1
fi

# Vercel clones shallowly; the previous deployed commit may be missing.
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=50 origin "$prev" 2>/dev/null || true
fi
if ! changed="$(git diff --name-only "$prev" HEAD 2>/dev/null)"; then
  echo "build: could not diff ${prev}..HEAD"
  exit 1
fi
if [ -z "$changed" ]; then
  echo "build: empty diff (explicit redeploy)"
  exit 1
fi

while IFS= read -r f; do
  skippable=0
  for s in "${SKIPPABLE[@]}"; do
    [ "$f" = "$s" ] && skippable=1 && break
  done
  case "$f" in
    "$DEFERRED_PREFIX"*.json) skippable=1 ;;
    data/fever.json) skippable=1 ;;  # daily Fever catalog sync (~/fever-sync) — deferred like data/events
    ops/*) skippable=1 ;;  # growth-loop notes, logs and metrics — never served
  esac
  if [ "$skippable" -eq 0 ]; then
    echo "build: ${f} affects the site"
    exit 1
  fi
done <<< "$changed"

echo "skip: only bookkeeping/deferred files changed since ${prev:0:7} (deploy-flush publishes deferred ones):"
echo "$changed" | sed 's/^/  /'
exit 0
