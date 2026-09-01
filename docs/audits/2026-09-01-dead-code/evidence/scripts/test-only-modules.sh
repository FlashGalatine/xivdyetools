#!/usr/bin/env bash
# test-only-modules.sh — source modules whose ONLY importers are test files.
# orphans.sh counts a test file as an importer, so a module like web-app's dye-action-dropdown.ts
# (570 lines, imported by 9 test files and 0 production files) reads as "used" there and to knip,
# which treats tests as entries. This is the tier both miss.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
istest='\.(test|spec)\.[tj]sx?$|__tests__/|/e2e/|/tests?/|test-utils|test-setup|/mocks/'
all=$(git ls-files apps packages | grep -E '\.(ts|tsx)$' | grep -v -E '/coverage/|e2e-coverage/')
prod=$(echo "$all" | grep -v -E "$istest")
tests=$(echo "$all" | grep -E "$istest")
for f in $prod; do
  base=$(basename "$f"); base="${base%.*}"
  case "$base" in index|types|env|constants) continue;; esac
  pat="['\"][^'\"]*/${base}(\.js|\.ts|\.tsx)?['\"]|['\"]${base}(\.js)?['\"]"
  np=$(echo "$prod" | grep -v "^$f$" | xargs -d '\n' grep -l -E "$pat" 2>/dev/null | wc -l)
  [ "$np" -gt 0 ] && continue
  nt=$(echo "$tests" | xargs -d '\n' grep -l -E "$pat" 2>/dev/null | wc -l)
  [ "$nt" -eq 0 ] && continue          # zero importers at all -> orphans.sh territory
  printf 'TEST-ONLY MODULE  %-64s prodImporters=0 testImporters=%s lines=%s\n' "$f" "$nt" "$(wc -l < "$f")"
done
