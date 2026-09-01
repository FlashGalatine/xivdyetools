#!/usr/bin/env bash
# orphans.sh — tracked .ts/.tsx source files nothing else imports by basename.
# Entry points (index.ts, wrangler main, config, *.test.ts) are excluded from the *candidate* list
# but still count as importers. Verify every hit by hand: dynamic imports, wrangler `main`,
# workflow references and side-effect imports do not show up as a basename reference.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
all=$(git ls-files | grep -E '\.(ts|tsx|js|mjs)$' | grep -v -E '/coverage/|e2e-coverage/|^docs/audits/')
for f in $(echo "$all" | grep -v -E '\.(test|spec)\.tsx?$|__tests__/'); do
  base=$(basename "$f"); base="${base%.*}"
  [ "$base" = "index" ] && continue
  n=$(echo "$all" | grep -v "^$f$" | xargs -d '\n' grep -l -E "['\"][^'\"]*/?${base}(\.js|\.ts|\.tsx)?['\"]" 2>/dev/null | wc -l)
  if [ "$n" -eq 0 ]; then echo "ORPHAN? $f"; fi
done
