#!/usr/bin/env bash
# Step 2 automated evidence for the 2026-10-03 whole-monorepo security audit.
# Run from the monorepo root: bash docs/audits/2026-10-03-security/evidence/scripts/collect.sh
# Produces files, not verdicts. Every grep runs over `git ls-files` (traps/shell.md).
set -u
OUT=docs/audits/2026-10-03-security
SKILL_DIR=.agents/skills/security-audit
PREV=0332fcc5768a4477301ed5b15590eee16a772f87   # 2026-09-15-security audit commit
E=$OUT/evidence

status() { printf '%s exit=%s\n' "$1" "$2" >> "$E/collect-status.txt"; }
: > "$E/collect-status.txt"

pnpm audit --prod --json > "$E/pnpm-audit.json" 2>&1; status pnpm-audit-json $?
pnpm audit --prod --audit-level high > "$E/pnpm-audit-summary.txt" 2>&1; status pnpm-audit-high $?

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks dir . -c .gitleaks.toml -f json -r "$E/gitleaks-tree.json" --no-banner; status gitleaks-tree $?
  gitleaks git . -c .gitleaks.toml -f json -r "$E/gitleaks-history.json" --no-banner; status gitleaks-history $?
else
  echo "gitleaks binary not on PATH — BLOCKED (CI secret-scan job runs gitleaks-action on every push)" > "$E/gitleaks-BLOCKED.txt"
  status gitleaks BLOCKED
fi

git ls-files | grep -E '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' \
  | xargs grep -n -E "(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}['\"][^'\"]{12,}" \
  > "$E/potential-secrets.txt" 2>/dev/null; status potential-secrets $?

git ls-files '*/wrangler.toml' | xargs grep -n -E '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain|preview_urls|^\[\[ratelimits\]\]|^\[\[services\]\]' > "$E/wrangler-surface.txt"; status wrangler-surface $?
git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* >> "$E/wrangler-surface.txt" 2>/dev/null; status dev-vars-ignored $?

git diff --stat "$PREV"..HEAD -- apps packages .github scripts > "$E/delta-since-last-audit.txt"; status delta $?
git log --oneline "$PREV"..HEAD > "$E/delta-commits.txt"; status delta-commits $?

git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E \
  "writeDataPoint\(|\.put\(|\.prepare\(|INSERT INTO|localStorage\.setItem|sessionStorage\.setItem|indexedDB|sendBeacon\(|logger\.(info|warn|error|debug)\(" \
  > "$E/pii-sinks.txt" 2>/dev/null; status pii-sinks $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E \
  "cf-connecting-ip|x-forwarded-for|x-real-ip|user-agent|navigator\.userAgent|\bemail\b|global_name|\bdiscriminator\b|\bavatar\b|\busername\b|guild_id|channel_id|guild_locale|\blocale\b|TypeName|Nickname|nickname|filename|crypto\.randomUUID\(\)|Date\.now\(\).*(id|session)" \
  > "$E/pii-sources.txt" 2>/dev/null; status pii-sources $?

for f in apps/web-app/PRIVACY.md apps/web-app/TERMS_OF_SERVICE.md apps/discord-worker/PRIVACY_POLICY.md apps/discord-worker/TERMS_OF_SERVICE.md; do
  printf '\n===== %s =====\n' "$f"; grep -n -iE \
    "last updated|never|\bno\b|\bnot\b|only|complete list|discard|delet|expire|retention|[0-9]+[- ](second|day|month)|TTL|stored|sent|third|Analytics Engine|localStorage|IndexedDB|\bKV\b|\bD1\b|\bR2\b|/[a-z_]+" "$f"
done > "$E/policy-claims.txt"; status policy-claims $?

git ls-files 'apps/*/PRIVACY*.md' 'apps/*/TERMS_OF_SERVICE*.md' > "$E/policy-variants.txt"; status policy-variants $?
PYTHONIOENCODING=utf-8 python "$SKILL_DIR/../audit-shared/scripts/policy-locale-parity.py" > "$E/policy-locale-parity.txt" 2>&1; status policy-locale-parity $?

git ls-files 'apps/web-app/src/locales/*.json' | xargs grep -n -iE \
  "privacy|never leave|not sent|we store|no character data" > "$E/policy-claims-i18n.txt" 2>/dev/null; status policy-claims-i18n $?

# extra (this run): workflow inventory and every outbound fetch target, for the CI + SSRF rows
git ls-files '.github/workflows/*' > "$E/workflows.txt"; status workflows $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "\bfetch\(" > "$E/outbound-fetch.txt" 2>/dev/null; status outbound-fetch $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "innerHTML|outerHTML|insertAdjacentHTML|unsafeHTML|unsafeSVG|document\.write|new Function|\beval\(" > "$E/html-sinks.txt" 2>/dev/null; status html-sinks $?

wc -l "$E"/*.txt "$E"/*.json >> "$E/collect-status.txt" 2>/dev/null
