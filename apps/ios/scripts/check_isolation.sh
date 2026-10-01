#!/usr/bin/env bash
# Fails if this branch changes anything outside apps/ios compared with the web app's main branch.
# That keeps `git merge origin/main` conflict-free and keeps iOS work out of the web app.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
base_ref="${ISOLATION_BASE:-origin/main}"
git rev-parse --verify --quiet "$base_ref" >/dev/null || base_ref=main
base=$(git merge-base HEAD "$base_ref")
outside=$( { git diff --name-only "$base" HEAD; git diff --name-only HEAD; git ls-files --others --exclude-standard; } \
  | sort -u | grep -v '^apps/ios/' || true)
if [ -n "$outside" ]; then
  echo "error: the iOS branch must only change apps/ios. Changed outside it (vs $base_ref):" >&2
  echo "$outside" >&2
  exit 1
fi
echo "isolation ok: only apps/ios differs from $base_ref"
