#!/usr/bin/env bash
# Step 2 automated evidence for the 2026-10-26 whole-monorepo security audit.
# Run from the monorepo root: bash docs/audits/2026-10-26-security/evidence/scripts/collect.sh
# Produces files, not verdicts. Every grep runs over `git ls-files` (traps/shell.md).
set -u
OUT=docs/audits/2026-10-26-security
SKILL_DIR=.agents/skills/security-audit
PREV=0ab33466c2e184e433b05aeb96cbe46e88f0e041   # 2026-10-03-security audit commit (pre-remediation base)
E=$OUT/evidence

status() { printf '%s exit=%s\n' "$1" "$2" >> "$E/collect-status.txt"; }
: > "$E/collect-status.txt"

pnpm audit --prod --json > "$E/pnpm-audit.json" 2>&1; status pnpm-audit-json $?
pnpm audit --prod --audit-level high > "$E/pnpm-audit-summary.txt" 2>&1; status pnpm-audit-high $?
pnpm audit --json > "$E/pnpm-audit-full.json" 2>&1; status pnpm-audit-full $?

if command -v gitleaks >/dev/null 2>&1; then
  # installed 2026-10-26 at ~/bin/gitleaks.exe (v8.30.1 = CI's pin); provenance in evidence/gitleaks.md
  GL_TMP=$(mktemp -d) && git archive HEAD | tar -x -C "$GL_TMP"            # clean tracked tree
  gitleaks dir "$GL_TMP" --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --report-format=json --report-path="$E/gitleaks-tree.json" > "$E/gitleaks-tree.log" 2>&1; status gitleaks-tree $?
  gitleaks git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--remotes --report-format=json --report-path="$E/gitleaks-history-remotes.json" > "$E/gitleaks-history-remotes.log" 2>&1; status gitleaks-history-remotes $?
  gitleaks git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--all --report-format=json --report-path="$E/gitleaks-history-all-local-refs.json" > "$E/gitleaks-history-all-local-refs.log" 2>&1; status gitleaks-history-all $?
  rm -rf "$GL_TMP"
else
  echo "gitleaks binary not on PATH — BLOCKED locally (download needs the maintainer's yes). Substitutes: GitHub secret-scanning alerts API + CI secret-scan job result." > "$E/gitleaks-BLOCKED.txt"
  status gitleaks BLOCKED
fi
gh api repos/FlashGalatine/xivdyetools/secret-scanning/alerts --paginate > "$E/github-secret-scanning-alerts.json" 2> "$E/github-secret-scanning-alerts.error.txt"; status gh-secret-scanning $?
gh run list --repo FlashGalatine/xivdyetools --workflow ci.yml --branch main --limit 5 --json databaseId,headSha,conclusion,createdAt,displayTitle > "$E/ci-main-runs.json" 2>&1; status gh-ci-runs $?

git ls-files | grep -E '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' \
  | xargs grep -n -E "(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}['\"][^'\"]{12,}" \
  > "$E/potential-secrets.txt" 2>/dev/null; status potential-secrets $?

git ls-files '*/wrangler.toml' | xargs grep -n -E '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain|preview_urls|^\[\[ratelimits\]\]|^\[\[services\]\]|^\[observability' > "$E/wrangler-surface.txt"; status wrangler-surface $?
git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* >> "$E/wrangler-surface.txt" 2>/dev/null; status dev-vars-ignored $?

git diff --stat "$PREV"..HEAD -- apps packages .github scripts > "$E/delta-since-last-audit.txt"; status delta $?
git log --format='%h %cs %s' "$PREV"..HEAD -- apps packages .github scripts > "$E/delta-commits.txt"; status delta-commits $?

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

# extra: workflow inventory, every outbound fetch target, HTML/eval sinks, Worker/postMessage/chara surface
git ls-files '.github/workflows/*' > "$E/workflows.txt"; status workflows $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "\bfetch\(" > "$E/outbound-fetch.txt" 2>/dev/null; status outbound-fetch $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "innerHTML|outerHTML|insertAdjacentHTML|unsafeHTML|unsafeSVG|document\.write|new Function|\beval\(" > "$E/html-sinks.txt" 2>/dev/null; status html-sinks $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "postMessage\(|addEventListener\(['\"]message['\"]|new Worker\(|importScripts|new URL\(.*import\.meta" > "$E/messaging-workers.txt" 2>/dev/null; status messaging-workers $?
git ls-files | grep -i -E 'chara' | grep -v -E '\.md$' > "$E/chara-files.txt"; status chara-files $?
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E "JSON\.parse\(|new RegExp\(|\.match\(|\.replace\(/" > "$E/parse-sinks.txt" 2>/dev/null; status parse-sinks $?
git ls-files '*.yml' '*.yaml' | grep '.github' | xargs grep -n -E "^\s*uses:|permissions:|pull_request_target|\\$\{\{ *github\.(event|head_ref)" > "$E/workflow-uses.txt" 2>/dev/null; status workflow-uses $?

wc -l "$E"/*.txt "$E"/*.json >> "$E/collect-status.txt" 2>/dev/null
