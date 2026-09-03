#!/usr/bin/env bash
# Re-run the six vitest gates without the bogus --reporter=basic (vitest 4 has no 'basic' reporter).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EV="$ROOT/evidence"
REPO="$(cd "$ROOT/../../.." && pwd)"
cd "$REPO" || exit 1

run() {
  local name="$1"; shift
  echo "### $name" >> "$EV/_gate-summary2.txt"
  echo "CMD: $*" >> "$EV/_gate-summary2.txt"
  "$@" > "$EV/$name.txt" 2>&1
  local rc=$?
  echo "EXIT: $rc" >> "$EV/_gate-summary2.txt"
  grep -E "Test Files|Tests |FAIL|✗|×" "$EV/$name.txt" | tail -25 >> "$EV/_gate-summary2.txt"
  echo "" >> "$EV/_gate-summary2.txt"
  echo "[$rc] $name"
}

: > "$EV/_gate-summary2.txt"

run core-i18n-tests pnpm --filter @xivdyetools/core exec vitest run src/config/__tests__/band-vocabulary.parity.test.ts src/services/__tests__/DyeSearch.parity.test.ts src/services/__tests__/LocalizationService.explicit-locale.test.ts
run botlogic-i18n pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n
run webapp-i18n-tests pnpm --filter xivdyetools-web-app exec vitest run src/__tests__/i18n-orphans.test.ts src/components/__tests__/v4/locale-switch.test.ts src/components/__tests__/chara-import-i18n.test.ts src/shared/__tests__/preset-i18n.test.ts
run og-i18n pnpm --filter xivdyetools-og-worker exec vitest run src/services/og-strings.test.ts src/services/svg/roles-i18n.test.ts src/og-data-generator.test.ts src/services/font-coverage.test.ts
run discord-i18n pnpm --filter xivdyetools-discord-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts src/services/locale-and-fonts.test.ts src/services/font-coverage.test.ts
run moderation-i18n pnpm --filter xivdyetools-moderation-worker exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts
run svg-tests pnpm --filter @xivdyetools/svg exec vitest run

echo "DONE"
