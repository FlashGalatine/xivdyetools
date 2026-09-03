#!/usr/bin/env bash
# recheck-nonsrc.sh — symrefs.sh buckets `prod` as <unit>/src only, so a symbol used from
# <unit>/scripts, <unit>/functions or a config file falls into NO bucket and reads as dead.
# (This is how `countLocalizations` / `LOCALE_CODES` were nearly mis-filed.)
# This re-checks every candidate against the unit's tracked non-src, non-test files.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
files=$(git ls-files apps packages scripts \
  | grep -E '\.(ts|tsx|js|mjs|cjs|json|toml|ya?ml|py)$' \
  | grep -v -E '/src/|/coverage/|e2e-coverage/|\.(test|spec)\.' )
while read -r sym; do
  [ -z "$sym" ] && continue
  hits=$(echo "$files" | xargs -d '\n' grep -lw -- "$sym" 2>/dev/null | tr '\n' ' ')
  printf '%-34s %s\n' "$sym" "${hits:-—}"
done
