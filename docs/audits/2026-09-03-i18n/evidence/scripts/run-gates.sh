#!/usr/bin/env bash
# i18n audit 2026-09-03 — gate + sweep runner. Run from the worktree root.
# Writes one file per gate to ../ (evidence/). Never fails the whole run on one red gate.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"      # docs/audits/2026-09-03-i18n
EV="$ROOT/evidence"
REPO="$(cd "$ROOT/../../.." && pwd)"             # worktree root
SK="/c/dev/XIVProjects/.claude/skills/i18n-manager/scripts"
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

echo "== 0. build (packages needed by app tests) =="
run build-packages pnpm turbo run build --filter='./packages/*'

echo "== 1. core generated-locale drift =="
run core-build-locales pnpm --filter @xivdyetools/core run build:locales
git status --porcelain packages/core/src/data/locales packages/core/dyenames.csv > "$EV/core-locale-drift.txt" 2>&1
echo "### core-locale-drift (empty = no hand edits)" >> "$EV/_gate-summary.txt"
cat "$EV/core-locale-drift.txt" >> "$EV/_gate-summary.txt"
echo "" >> "$EV/_gate-summary.txt"

echo "== 2. core parity tests =="
run core-i18n-tests pnpm --filter @xivdyetools/core exec vitest run src/config/__tests__/band-vocabulary.parity.test.ts src/services/__tests__/DyeSearch.parity.test.ts src/services/__tests__/LocalizationService.explicit-locale.test.ts

echo "== 3. bot-logic i18n gates =="
run botlogic-i18n pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n

echo "== 4. web-app gates =="
run webapp-validate-i18n pnpm --filter xivdyetools-web-app run validate:i18n
run webapp-i18n-unused pnpm --filter xivdyetools-web-app run i18n:unused
run webapp-i18n-tests pnpm --filter xivdyetools-web-app exec vitest run src/__tests__/i18n-orphans.test.ts src/components/__tests__/v4/locale-switch.test.ts src/components/__tests__/chara-import-i18n.test.ts src/shared/__tests__/preset-i18n.test.ts

echo "== 5. og-worker gates =="
run og-i18n pnpm --filter xivdyetools-og-worker exec vitest run src/services/og-strings.test.ts src/services/svg/roles-i18n.test.ts src/og-data-generator.test.ts src/services/font-coverage.test.ts

echo "== 6. discord-worker gates =="
run discord-i18n pnpm --filter xivdyetools-discord-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts src/services/locale-and-fonts.test.ts src/services/font-coverage.test.ts

echo "== 6b. moderation-worker gates =="
run moderation-i18n pnpm --filter xivdyetools-moderation-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts

echo "== 7. locale-diff sweeps =="
run locale-diff-botlogic   python "$SK/locale-diff.py" packages/bot-logic/src/i18n/locales
run locale-diff-webapp     python "$SK/locale-diff.py" apps/web-app/src/locales
run locale-diff-core       python "$SK/locale-diff.py" packages/core/src/data/locales

echo "== 8. script inventory =="
run script-inventory python "$SK/script-inventory.py" packages/core/src/data/locales packages/bot-logic/src/i18n/locales apps/web-app/src/locales apps/og-worker/src/services/og-strings.ts apps/og-worker/src/services/og-embed.ts

echo "== 9. font coverage per subset =="
for f in apps/og-worker/src/fonts/*.ttf apps/og-worker/src/fonts/*.otf apps/discord-worker/src/fonts/*.ttf apps/discord-worker/src/fonts/*.otf; do
  [ -e "$f" ] || continue
  b="$(basename "$f")"
  echo "$b  $(wc -c < "$f") bytes" >> "$EV/font-sizes.txt"
done
echo "### font-sizes" >> "$EV/_gate-summary.txt"
cat "$EV/font-sizes.txt" >> "$EV/_gate-summary.txt" 2>/dev/null
echo "" >> "$EV/_gate-summary.txt"

echo "== 10. font mtimes vs locale mtimes =="
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

echo "DONE"
