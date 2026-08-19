#!/usr/bin/env bash
# Word-boundary reference counts for symbols, bucketed: og-worker prod src / og-worker tests / rest of monorepo (tracked files only)
cd "$(git rev-parse --show-toplevel)"
for sym in "$@"; do
  prod=$(git ls-files 'apps/og-worker/src/*.ts' | grep -v '\.test\.ts$' | xargs grep -lw "$sym" 2>/dev/null | tr '\n' ' ')
  nprod=$(git ls-files 'apps/og-worker/src/*.ts' | grep -v '\.test\.ts$' | xargs grep -cw "$sym" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
  test=$(git ls-files 'apps/og-worker/src/*.test.ts' 'apps/og-worker/tests/*.ts' | xargs grep -cw "$sym" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
  other=$(git ls-files | grep -v '^apps/og-worker/' | grep -v 'docs/audits/' | grep -v 'CHANGELOG' | xargs grep -lw "$sym" 2>/dev/null | head -5 | tr '\n' ' ')
  printf '%-32s prod=%-3s tests=%-4s | prod files: %s| elsewhere: %s\n' "$sym" "$nprod" "$test" "$prod" "$other"
done
