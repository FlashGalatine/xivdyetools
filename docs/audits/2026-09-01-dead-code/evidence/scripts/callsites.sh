#!/usr/bin/env bash
# callsites.sh <unit> <symbol>... — non-test call/import sites of each symbol INSIDE the unit,
# excluding the declaring line, so a "test-only" verdict can be read off directly.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
unit="${1%/}"; shift
files=$(git ls-files "$unit" | grep -E '\.tsx?$' | grep -v -E '\.(test|spec)\.tsx?$|__tests__/|/tests?/|/e2e/')
for sym in "$@"; do
  echo "### $sym"
  echo "$files" | xargs -d '\n' grep -nw -- "$sym" 2>/dev/null | grep -v -E "^[^:]*: *[0-9]*: *\*" | grep -v "export (function|const|class|interface|type)"
  echo
done
