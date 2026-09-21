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

set -u

# Files that never affect the built site. Keep this list short and exact.
SKIPPABLE=(
  "data/run-ledger.json"
  "data/subscriber-history.json"
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
  if [ "$skippable" -eq 0 ]; then
    echo "build: ${f} affects the site"
    exit 1
  fi
done <<< "$changed"

echo "skip: only bookkeeping files changed since ${prev:0:7}:"
echo "$changed" | sed 's/^/  /'
exit 0
