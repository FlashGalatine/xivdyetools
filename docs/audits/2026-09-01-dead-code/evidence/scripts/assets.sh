#!/usr/bin/env bash
# assets.sh — every tracked static asset under the apps' public/asset dirs vs. references to its
# basename anywhere in tracked source, html, css, json, toml, workflows and docs.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
refs=$(git ls-files | grep -E '\.(ts|tsx|js|mjs|json|jsonc|html|css|toml|ya?ml|md|xml|webmanifest)$' | grep -v -E '/coverage/|e2e-coverage/|^docs/audits/')
for f in $(git ls-files 'apps/*/public/*' 'apps/*/src/fonts/*' 'apps/*/assets/*' 'apps/*/fonts-src/*' 'apps/*/scripts/font-sources/*'); do
  base=$(basename "$f")
  n=$(echo "$refs" | xargs -d '\n' grep -l -F -- "$base" 2>/dev/null | grep -v "^$f$" | wc -l)
  sz=$(wc -c < "$f")
  printf '%-8s %-9s %s\n' "$n" "$sz" "$f"
done
