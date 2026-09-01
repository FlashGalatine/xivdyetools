#!/usr/bin/env bash
# dead-css.sh — class selectors declared in web-app CSS with zero references in any tracked
# template/source. NOTE (traps/knip-and-dead-verdicts §3): a hit here is a *candidate*, not a
# verdict — tools render inside V4LayoutShell's shadow root but the same components also mount in
# light-DOM modals, and tool-content.css is deliberately loaded in both scopes.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
src=$(git ls-files apps/web-app | grep -E '\.(ts|tsx|html)$' | grep -v -E '/coverage/|e2e-coverage/')
for css in $(git ls-files apps/web-app | grep -E '\.css$'); do
  echo "=== $css"
  grep -ohE '^\s*\.[a-zA-Z_][a-zA-Z0-9_-]*' "$css" | tr -d ' .' | sort -u | while read -r cls; do
    [ -z "$cls" ] && continue
    n=$(echo "$src" | xargs -d '\n' grep -l -F -- "$cls" 2>/dev/null | wc -l)
    o=$(git ls-files apps/web-app | grep -E '\.css$' | grep -v "^$css$" | xargs -d '\n' grep -l -F -- "$cls" 2>/dev/null | wc -l)
    [ "$n" -eq 0 ] && printf '   NO TEMPLATE REF: %-40s (other css files: %s)\n' "$cls" "$o"
  done
done
