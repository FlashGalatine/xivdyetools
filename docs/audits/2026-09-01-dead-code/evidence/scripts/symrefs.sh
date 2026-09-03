#!/usr/bin/env bash
# symrefs.sh <unit-dir> <symbol>...
# Word-boundary reference counts per symbol, bucketed over TRACKED files only:
#   prod  = <unit>/src non-test .ts/.tsx   tests = <unit> test/spec/e2e files
#   other = everything else tracked in the repo (excluding docs/audits, CHANGELOGs, coverage dirs)
# Example: bash symrefs.sh apps/og-worker generateSwatchOG escapeXml
# A symbol with prod=0 AND other=0 is a test-only/dead candidate; other>0 names the consumer — verify before filing.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
unit="${1%/}"; shift
[ $# -gt 0 ] || { echo "usage: symrefs.sh <unit-dir> <symbol>..." >&2; exit 2; }
tmp="$(mktemp -d)"
git ls-files "$unit/src/*.ts" "$unit/src/*.tsx" "$unit/src/**/*.ts" "$unit/src/**/*.tsx" 2>/dev/null | sort -u \
  | grep -v -E '\.(test|spec)\.tsx?$|__tests__/|/e2e/' > "$tmp/prod"
git ls-files "$unit" | grep -E '\.(test|spec)\.[tj]sx?$|__tests__/|/e2e/|/tests?/' > "$tmp/tests"
git ls-files | grep -v -E "^$unit/|^docs/audits/|CHANGELOG|/coverage/|e2e-coverage/|\.(png|webp|ttf|woff2?|wasm|lock|svg)$" > "$tmp/other"
for sym in "$@"; do
  nprod=$(xargs -a "$tmp/prod" -d '\n' grep -cw -- "$sym" 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')
  pfiles=$(xargs -a "$tmp/prod" -d '\n' grep -lw -- "$sym" 2>/dev/null | tr '\n' ' ')
  ntest=$(xargs -a "$tmp/tests" -d '\n' grep -cw -- "$sym" 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')
  ofiles=$(xargs -a "$tmp/other" -d '\n' grep -lw -- "$sym" 2>/dev/null | head -5 | tr '\n' ' ')
  nother=$(xargs -a "$tmp/other" -d '\n' grep -lw -- "$sym" 2>/dev/null | wc -l)
  printf '%-36s prod=%-4s tests=%-4s other=%-3s | prod: %s| other: %s\n' "$sym" "$nprod" "$ntest" "$nother" "$pfiles" "$ofiles"
done
rm -rf "$tmp"
