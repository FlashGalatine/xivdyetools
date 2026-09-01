#!/usr/bin/env bash
# unit-exports.sh <unit-dir> — list every exported symbol of a unit's non-test sources,
# then bucket its reference counts with symrefs.sh (prod / tests / rest-of-repo).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
unit="${1%/}"
here="docs/audits/2026-09-01-dead-code/evidence"
git ls-files "$unit/src" | grep -E '\.tsx?$' | grep -v -E '\.(test|spec)\.tsx?$|__tests__/' \
  | xargs -d '\n' grep -hoE '^export (declare )?(abstract )?(const|let|function|async function|class|type|interface|enum) [A-Za-z0-9_]+' \
  | awk '{print $NF}' | sort -u > "$here/exports-$(basename "$unit").txt"
# re-exported names in barrels: `export { a, b } from`
git ls-files "$unit/src" | grep -E '\.tsx?$' | grep -v -E '\.(test|spec)\.tsx?$' \
  | xargs -d '\n' grep -hoE '^export \{[^}]*\}' \
  | tr -d '{}' | sed 's/^export //' | tr ',' '\n' | sed 's/ as .*//' | tr -d ' ' | grep -E '^[A-Za-z_]' \
  | sort -u >> "$here/exports-$(basename "$unit").txt"
sort -u -o "$here/exports-$(basename "$unit").txt" "$here/exports-$(basename "$unit").txt"
wc -l < "$here/exports-$(basename "$unit").txt"
bash "$here/scripts/symrefs.sh" "$unit" $(cat "$here/exports-$(basename "$unit").txt") \
  > "$here/symrefs-$(basename "$unit").txt"
awk '$2=="prod=0" || $0 ~ /prod=0 / {print}' "$here/symrefs-$(basename "$unit").txt" | wc -l
