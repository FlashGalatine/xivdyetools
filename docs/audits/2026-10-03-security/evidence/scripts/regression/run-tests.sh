#!/bin/sh
# Runs one guard test file at a time (sequential). Output -> evidence/scripts/regression/results.txt
cd "$(git rev-parse --show-toplevel)"
OUT=docs/audits/2026-10-03-security/evidence/scripts/regression/results.txt
: > $OUT
run() { pkg=$1; f=$2
  r=$(pnpm --filter "$pkg" exec vitest run "$f" --coverage.enabled=false 2>&1 | grep -E "Tests |Test Files |No test files|FAIL" | tr '\n' ' ')
  echo "$pkg | $f | $r" >> $OUT
}
while IFS='|' read -r pkg f; do [ -n "$pkg" ] && run "$pkg" "$f"; done < docs/audits/2026-10-03-security/evidence/scripts/regression/tests.list
echo DONE >> $OUT
