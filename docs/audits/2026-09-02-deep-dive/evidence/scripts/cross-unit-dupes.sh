#!/usr/bin/env bash
# Find exported symbols defined in more than one deploy unit (copy-drift candidates).
# Usage: bash cross-unit-dupes.sh <audit-folder>
set -u
OUT="$1/evidence"
TMP="$OUT/.symbols.tmp"
: > "$TMP"
while IFS= read -r f; do
  unit=$(echo "$f" | cut -d/ -f1-2)
  grep -oE '^export (async )?function [A-Za-z_][A-Za-z0-9_]*|^export const [A-Za-z_][A-Za-z0-9_]*|^export class [A-Za-z_][A-Za-z0-9_]*' "$f" \
    | sed -E 's/^export (async )?(function|const|class) //' \
    | while IFS= read -r sym; do echo -e "$sym\t$unit\t$f"; done >> "$TMP"
done < "$OUT/src-files.txt"

# symbols appearing in >1 unit
echo "=== exported symbols defined in more than one deploy unit ===" > "$OUT/cross-unit-dupes.txt"
cut -f1,2 "$TMP" | sort -u | cut -f1 | sort | uniq -d > "$OUT/.dupsyms.tmp"
while IFS= read -r sym; do
  units=$(awk -F'\t' -v s="$sym" '$1==s {print $2}' "$TMP" | sort -u | tr '\n' ' ')
  files=$(awk -F'\t' -v s="$sym" '$1==s {print $3}' "$TMP" | sort -u | tr '\n' ' ')
  echo "$sym  ::  $units" >> "$OUT/cross-unit-dupes.txt"
  echo "     $files" >> "$OUT/cross-unit-dupes.txt"
done < "$OUT/.dupsyms.tmp"
rm -f "$TMP" "$OUT/.dupsyms.tmp"
echo "duplicate symbols across units: $(grep -c '  ::  ' "$OUT/cross-unit-dupes.txt")"
