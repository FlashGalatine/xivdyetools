#!/usr/bin/env bash
# sizes.sh — non-test vs test TS line counts per deploy unit, over tracked files only.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
printf '%-28s %8s %8s %8s %8s\n' unit srcFiles srcLines tstFiles tstLines
for d in packages/*/ apps/*/; do
  unit="${d%/}"
  src=$(git ls-files "$unit" | grep -E '\.(ts|tsx)$' | grep -v -E '\.(test|spec)\.tsx?$|__tests__/|/e2e/|/tests?/')
  tst=$(git ls-files "$unit" | grep -E '\.(ts|tsx)$' | grep -E '\.(test|spec)\.tsx?$|__tests__/|/e2e/|/tests?/')
  sf=$(echo "$src" | grep -c . ); tf=$(echo "$tst" | grep -c .)
  sl=$(echo "$src" | grep . | xargs -d '\n' cat 2>/dev/null | wc -l)
  tl=$(echo "$tst" | grep . | xargs -d '\n' cat 2>/dev/null | wc -l)
  printf '%-28s %8s %8s %8s %8s\n' "$unit" "$sf" "$sl" "$tf" "$tl"
done
