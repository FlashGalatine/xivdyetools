#!/usr/bin/env bash
# i18n audit 2026-10-04 — gate + sweep runner (the 2026-09-19 runner, extended). Run from anywhere.
# Writes one file per gate to evidence/. Never fails the whole run on one red gate.
# Subset vitest runs pass --coverage.enabled=false: most workspaces set coverage.enabled: true with
# thresholds, so a green subset run would otherwise exit 1 and read as a red gate.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"      # docs/audits/2026-10-04-i18n
EV="$ROOT/evidence"
REPO="$(cd "$ROOT/../../.." && pwd)"             # worktree root
SK="$REPO/.agents/skills/i18n-manager/scripts"
AS="$REPO/.agents/skills/audit-shared/scripts"
SC="$EV/scripts"
export PYTHONIOENCODING=utf-8
mkdir -p "$EV"
cd "$REPO" || exit 1

run() {  # run <evidence-name> <command...>
  local name="$1"; shift
  echo "### $name" >> "$EV/_gate-summary.txt"
  echo "CMD: $*" >> "$EV/_gate-summary.txt"
  "$@" > "$EV/$name.txt" 2>&1
  local rc=$?
  echo "EXIT: $rc" >> "$EV/_gate-summary.txt"
  echo "TAIL:" >> "$EV/_gate-summary.txt"
  tail -12 "$EV/$name.txt" >> "$EV/_gate-summary.txt"
  echo "" >> "$EV/_gate-summary.txt"
  echo "[$rc] $name"
}

: > "$EV/_gate-summary.txt"
NOCOV=--coverage.enabled=false

echo "== 0. build (packages needed by app tests) =="
run build-packages pnpm turbo run build --filter='./packages/*'

echo "== 1. core generated-locale drift =="
run core-build-locales pnpm --filter @xivdyetools/core run build:locales
git status --porcelain packages/core/src/data/locales packages/core/dyenames.csv > "$EV/core-locale-drift.txt" 2>&1
echo "### core-locale-drift (empty = no hand edits)" >> "$EV/_gate-summary.txt"
cat "$EV/core-locale-drift.txt" >> "$EV/_gate-summary.txt"
echo "" >> "$EV/_gate-summary.txt"

echo "== 2. core i18n tests =="
run core-i18n-tests pnpm --filter @xivdyetools/core exec vitest run src/config/__tests__/band-vocabulary.parity.test.ts src/services/__tests__/DyeSearch.parity.test.ts src/services/__tests__/LocalizationService.explicit-locale.test.ts src/services/__tests__/LocalizationService.test.ts src/services/localization $NOCOV

echo "== 3. bot-logic i18n gates =="
run botlogic-i18n pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n src/localization.test.ts src/localization.uninitialized.test.ts src/commands/glamour.test.ts $NOCOV

echo "== 4. web-app gates =="
run webapp-validate-i18n pnpm --filter xivdyetools-web-app run validate:i18n
run webapp-i18n-unused pnpm --filter xivdyetools-web-app run i18n:unused
run webapp-i18n-tests pnpm --filter xivdyetools-web-app exec vitest run scripts/i18n-parity-gate.test.js scripts/i18n-guardrails.test.js src/__tests__/i18n-orphans.test.ts src/__tests__/privacy-copy-parity.test.ts src/components/__tests__/v4/locale-switch.test.ts src/shared/__tests__/preset-i18n.test.ts src/shared/__tests__/method-tags.parity.test.ts src/__tests__/font-contract.test.ts src/__tests__/public-metadata.test.ts src/shared/__tests__/glamour-markdown.test.ts $NOCOV

echo "== 5. og-worker gates =="
run og-i18n pnpm --filter xivdyetools-og-worker exec vitest run src/services/og-strings.test.ts src/services/svg/roles-i18n.test.ts src/services/svg/harmony.deck-fit.test.ts src/og-data-generator.test.ts src/services/font-coverage.test.ts src/services/font-faces.test.ts $NOCOV

echo "== 6. discord-worker gates =="
run discord-i18n pnpm --filter xivdyetools-discord-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts src/services/locale-and-fonts.test.ts src/services/font-coverage.test.ts src/services/font-coverage.filter.test.ts src/services/font-faces.test.ts src/services/fonts.test.ts src/commands/localize.test.ts $NOCOV

echo "== 6b. moderation-worker gates =="
run moderation-i18n pnpm --filter xivdyetools-moderation-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts $NOCOV

echo "== 6c. svg glamour card =="
run svg-glamour pnpm --filter @xivdyetools/svg exec vitest run src/glamour-card.test.ts $NOCOV

echo "== 7. locale-diff sweeps =="
run locale-diff-botlogic   python "$SK/locale-diff.py" packages/bot-logic/src/i18n/locales
run locale-diff-webapp     python "$SK/locale-diff.py" apps/web-app/src/locales
run locale-diff-core       python "$SK/locale-diff.py" packages/core/src/data/locales

echo "== 8. script inventory =="
run script-inventory python "$SK/script-inventory.py" packages/core/src/data/locales packages/bot-logic/src/i18n/locales apps/web-app/src/locales apps/og-worker/src/services/og-strings.ts apps/og-worker/src/services/og-embed.ts

echo "== 9. font sizes =="
: > "$EV/font-sizes.txt"
for f in apps/og-worker/src/fonts/*.ttf apps/og-worker/src/fonts/*.otf apps/discord-worker/src/fonts/*.ttf apps/discord-worker/src/fonts/*.otf; do
  [ -e "$f" ] || continue
  echo "$f  $(wc -c < "$f") bytes" >> "$EV/font-sizes.txt"
done
echo "### font-sizes" >> "$EV/_gate-summary.txt"
cat "$EV/font-sizes.txt" >> "$EV/_gate-summary.txt" 2>/dev/null
echo "" >> "$EV/_gate-summary.txt"

echo "== 10. font vs locale last-commit dates =="
{
  echo "-- last commit touching each path --"
  for p in packages/core/src/data/locales packages/bot-logic/src/i18n/locales apps/web-app/src/locales \
           apps/og-worker/src/services/og-strings.ts apps/og-worker/src/services/og-embed.ts \
           apps/og-worker/src/fonts apps/discord-worker/src/fonts; do
    echo "$(git log -1 --format=%cI -- "$p")  $p"
  done
} > "$EV/font-vs-locale-mtimes.txt" 2>&1
echo "### font-vs-locale-mtimes" >> "$EV/_gate-summary.txt"
cat "$EV/font-vs-locale-mtimes.txt" >> "$EV/_gate-summary.txt"
echo "" >> "$EV/_gate-summary.txt"

echo "== 11. web-app eslint (i18n rules) =="
pnpm --filter xivdyetools-web-app exec eslint src -f json > "$EV/eslint.json" 2>"$EV/eslint.err.txt"
echo "eslint exit: $?" >> "$EV/_gate-summary.txt"

echo "== 12. policy documents + American English =="
run policy-locale-parity python "$AS/policy-locale-parity.py"
run american-spelling        node "$AS/american-spelling.mjs" .
run american-spelling-all    node "$AS/american-spelling.mjs" . --all
run american-spelling-locales node "$AS/american-spelling.mjs" . apps/web-app/src/locales/en.json packages/bot-logic/src/i18n/locales/en.json apps/og-worker/src/services/og-strings.ts apps/og-worker/src/services/og-embed.ts apps/moderation-worker/src/services/bot-i18n.ts

echo "== 13. audit-local python sweeps =="
run vocab-split          python "$SC/vocab-split.py"
run term-check           python "$SC/term-check.py"
run font-union-analysis  python "$SC/font-union-analysis.py"
run svg-literal-glyphs   python "$SC/svg-literal-glyphs.py"
run variable-font-check  python "$SC/variable-font-check.py"
run dynamic-keys         python "$SC/check_dynamic_keys.py"
run tool-name-consistency python "$SC/tool-name-consistency.py" --all
run market-board-term    python "$SC/market-board-term.py"
bash "$SC/font-sweep.sh" > /dev/null 2>&1; echo "font-sweep exit: $?" >> "$EV/_gate-summary.txt"

echo "== 14. innerHTML template sites + hardcoded-sentence grep (tracked files only) =="
git ls-files 'apps/web-app/src/**/*.ts' | grep -v -E '\.test\.ts$|__tests__' | xargs grep -n 'innerHTML = `' > "$EV/webapp-innerhtml-sites.txt" 2>&1
echo "innerHTML sites: $(wc -l < "$EV/webapp-innerhtml-sites.txt")" >> "$EV/_gate-summary.txt"
for u in apps/discord-worker apps/og-worker apps/moderation-worker apps/presets-api apps/api-worker apps/oauth apps/stoat-worker packages/bot-logic packages/svg packages/core; do
  n="$(echo "$u" | tr '/' '-')"
  git ls-files "$u/src/**/*.ts" | grep -v -E '\.test\.ts$|__tests__|og-strings|og-embed|localize|/locales/' | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}" > "$EV/hc-sentences-$n.txt" 2>&1
  echo "hc-sentences $u: $(wc -l < "$EV/hc-sentences-$n.txt")" >> "$EV/_gate-summary.txt"
done

echo "DONE"
