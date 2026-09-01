#!/usr/bin/env bash
# Secret-shaped literals in tracked source/config (tree only; history is gitleaks' job).
# Run from the monorepo root.
set -u
OUT=docs/audits/2026-08-29-security/evidence
mkdir -p "$OUT"
git ls-files \
  | grep -E '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' \
  | xargs -d '\n' grep -n -E "(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}['\"][^'\"]{12,}" \
  > "$OUT/potential-secrets.txt" 2>/dev/null || true
echo "total hits: $(wc -l < "$OUT/potential-secrets.txt")"
echo "--- hits outside tests / docs / audits / locales / markdown ---"
grep -v -E '\.test\.ts:|/__tests__/|/tests/|/e2e/|docs/audits/|/locales/|\.md:' "$OUT/potential-secrets.txt" | cut -c1-200 | head -80
