#!/usr/bin/env bash
# Lead-pattern grep over non-test source files (tracked tree, worktree at origin/main e7ac4042).
# Usage: bash lead-grep.sh <audit-folder>
set -u
OUT="$1/evidence"
find apps packages -type f -name '*.ts' \
  -not -name '*.test.ts' -not -name '*.spec.ts' \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/coverage/*' \
  -not -path '*/e2e-coverage/*' -not -path '*/__tests__/*' -not -path '*/.wrangler/*' \
  -not -path '*/docs/*' -path '*/src/*' | sort > "$OUT/src-files.txt"
echo "src files: $(wc -l < "$OUT/src-files.txt")"
PAT='catch\b|waitUntil|\.batch\(|Promise\.all|setTimeout|JSON\.parse|Date\.now|new Date\(|fetch\(|parseInt|Number\(|as any|as unknown as|!\.'
: > "$OUT/pattern-grep.txt"
while IFS= read -r f; do
  grep -n -E "$PAT" "$f" | sed "s|^|$f:|" >> "$OUT/pattern-grep.txt"
done < "$OUT/src-files.txt"
echo "pattern hits: $(wc -l < "$OUT/pattern-grep.txt")"
for p in 'catch\b' waitUntil '\.batch\(' 'Promise\.all' setTimeout 'JSON\.parse' 'Date\.now' 'fetch\(' parseInt 'as any' 'as unknown as' 'catch \{\}' 'catch \(\w*\) \{\}'; do
  printf "%-20s %s\n" "$p" "$(grep -c -E "$p" "$OUT/pattern-grep.txt")"
done
# directory map: non-test .ts lines per directory
: > "$OUT/dir-map.txt"
for d in apps/web-app/src apps/discord-worker/src apps/presets-api/src apps/moderation-worker/src apps/og-worker/src apps/api-worker/src apps/oauth/src packages/core/src; do
  echo "=== $d ===" >> "$OUT/dir-map.txt"
  find "$d" -type d -not -path '*/__tests__*' | while IFS= read -r dir; do
    n=$(find "$dir" -maxdepth 1 -name '*.ts' -not -name '*.test.ts' -not -name '*.spec.ts' -print0 | xargs -0 -r cat | wc -l)
    [ "$n" -gt 0 ] && echo "$n $dir"
  done | sort -rn >> "$OUT/dir-map.txt"
done
# hot spots: largest non-test source files
: > "$OUT/hot-spots.txt"
while IFS= read -r f; do echo "$(wc -l < "$f") $f"; done < "$OUT/src-files.txt" | sort -rn | head -40 > "$OUT/hot-spots.txt"
echo done
