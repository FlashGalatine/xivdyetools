#!/usr/bin/env bash
# Pre-merge readiness for the i18n audit branch. Read-only: asserts, never fixes.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
fail=0
note() { echo "  $1"; }
ok()   { echo "[ ok ] $1"; }
bad()  { echo "[FAIL] $1"; fail=1; }

echo "=== 1. every touched publishable package bumped above its published version ==="
for pkg in core svg bot-logic types logger auth worker-kit; do
  d="packages/$pkg"
  [ -d "$d" ] || continue
  # did this branch touch it at all?
  if ! git diff --name-only origin/main...HEAD -- "$d" | grep -q .; then continue; fi
  local_v=$(node -p "require('./$d/package.json').version")
  name=$(node -p "require('./$d/package.json').name")
  pub_v=$(npm view "$name" version 2>/dev/null | tr -d '\r')
  if [ "$local_v" = "$pub_v" ]; then
    bad "$name touched but still at published $local_v — the publish workflow no-ops"
  else
    ok "$name $pub_v (registry) -> $local_v (local)"
  fi
done

echo
echo "=== 2. every touched app bumped ==="
for d in apps/*/; do
  app=$(basename "$d")
  git diff --name-only origin/main...HEAD -- "$d" | grep -q . || continue
  base_v=$(git show "origin/main:$d/package.json" 2>/dev/null | node -pe "try{JSON.parse(require('fs').readFileSync(0,'utf8')).version}catch(e){''}")
  head_v=$(node -p "require('./$d/package.json').version")
  if [ -n "$base_v" ] && [ "$base_v" = "$head_v" ]; then
    bad "$app touched but version unchanged ($head_v)"
  else
    ok "$app $base_v -> $head_v"
  fi
done

echo
echo "=== 3. every touched unit has a changelog entry for its new version ==="
for d in packages/*/ apps/*/; do
  unit=$(basename "$d")
  git diff --name-only origin/main...HEAD -- "$d" | grep -q . || continue
  [ -f "$d/CHANGELOG.md" ] || { note "$unit has no CHANGELOG.md (skipped)"; continue; }
  v=$(node -p "require('./$d/package.json').version" 2>/dev/null) || continue
  if grep -q "\[$v\]" "$d/CHANGELOG.md"; then ok "$unit CHANGELOG has [$v]"; else bad "$unit CHANGELOG missing [$v]"; fi
done

echo
echo "=== 4. no leftover debris ==="
if git diff --name-only origin/main...HEAD | grep -E '\.(orig|rej|bak)$|/tmp/'; then
  bad "merge/backup debris in the diff"
else
  ok "no .orig/.rej/.bak files"
fi

echo
echo "=== 5. generated core locales match their sources ==="
pnpm --filter @xivdyetools/core run build:locales >/dev/null 2>&1
if git status --porcelain packages/core/src/data/locales | grep -q .; then
  bad "regenerating locales changes them — generator and committed JSON disagree"
  git status --porcelain packages/core/src/data/locales
else
  ok "committed locale JSON is exactly what build:locales produces"
fi

echo
echo "=== 6. all findings closed out ==="
open=$(grep -l "^OPEN" docs/audits/2026-09-03-i18n/findings/*.md 2>/dev/null | wc -l)
if [ "$open" -gt 0 ]; then bad "$open finding(s) still marked OPEN"; else ok "no finding left OPEN"; fi

echo
[ "$fail" -eq 0 ] && echo "PRE-MERGE: ALL CHECKS PASS" || echo "PRE-MERGE: FAILURES ABOVE"
exit "$fail"
