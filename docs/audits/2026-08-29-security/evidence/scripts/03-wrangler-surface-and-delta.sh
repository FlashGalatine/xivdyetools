#!/usr/bin/env bash
# Wrangler public-surface inventory, .dev.vars ignore check, and the delta since the
# previous security audit (b195723f = first commit of docs/audits/2026-08-21-security).
# Run from the monorepo root.
set -u
OUT=docs/audits/2026-08-29-security/evidence
PREV=b195723f
mkdir -p "$OUT"

git ls-files '*/wrangler.toml' \
  | xargs -d '\n' grep -n -E '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain|preview_urls' \
  > "$OUT/wrangler-surface.txt"
{
  echo "--- git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* ---"
  git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* 2>&1
  echo "--- .gitignore lines mentioning dev.vars / .env / secret / wrangler ---"
  grep -n -E 'dev\.vars|\.env|secret|wrangler' .gitignore
} >> "$OUT/wrangler-surface.txt"

git diff --stat "$PREV"..HEAD > "$OUT/delta-since-last-audit.txt"
git log --format='%h %ad %s' --date=short "$PREV"..HEAD > "$OUT/commits-since-last-audit.txt"

: > "$OUT/delta-files-by-unit.txt"
for u in apps/api-worker apps/discord-worker apps/image-worker apps/moderation-worker apps/oauth \
         apps/og-worker apps/presets-api apps/stoat-worker apps/web-app \
         packages/auth packages/bot-logic packages/core packages/logger packages/svg packages/test-utils packages/types packages/worker-kit \
         .github .gitleaks.toml .npmrc pnpm-workspace.yaml package.json turbo.json; do
  n=$(git diff --name-only "$PREV"..HEAD -- "$u" | wc -l)
  {
    echo "## $u ($n files)"
    git diff --name-only "$PREV"..HEAD -- "$u"
    echo
  } >> "$OUT/delta-files-by-unit.txt"
done

echo "--- wrangler-surface tail ---"
tail -14 "$OUT/wrangler-surface.txt"
echo "--- delta ---"
tail -1 "$OUT/delta-since-last-audit.txt"
echo "commits since $PREV: $(wc -l < "$OUT/commits-since-last-audit.txt")"
grep '^## ' "$OUT/delta-files-by-unit.txt"
