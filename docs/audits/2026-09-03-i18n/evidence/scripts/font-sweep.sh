#!/usr/bin/env bash
# Per-subset glyph coverage / surplus for both resvg workers.
set -u
export PYTHONIOENCODING=utf-8
SK=/c/dev/XIVProjects/.claude/skills/i18n-manager/scripts
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EV="$ROOT/evidence"
REPO="$(cd "$ROOT/../../.." && pwd)"
cd "$REPO" || exit 1

CORE=packages/core/src/data/locales
BL=packages/bot-logic/src/i18n/locales
OGS=apps/og-worker/src/services/og-strings.ts
OUT="$EV/font-coverage-manual.txt"
: > "$OUT"

probe() {  # probe <label> <font> <scripts> <sources...>
  local label="$1" font="$2" scripts="$3"; shift 3
  echo "########## $label ##########" >> "$OUT"
  echo "CMD: font-coverage.py $font $* --scripts $scripts" >> "$OUT"
  python "$SK/font-coverage.py" "$font" "$@" --scripts "$scripts" 2>&1 | grep -vE "^  U\+" >> "$OUT"
  echo "exit=$?" >> "$OUT"
  echo "" >> "$OUT"
}

probe "DISCORD SC (core+bot-logic)" apps/discord-worker/src/fonts/NotoSansSC-Subset.ttf cjk    "$CORE" "$BL"
probe "DISCORD JP (core+bot-logic)" apps/discord-worker/src/fonts/NotoSansJP-Subset.ttf kana   "$CORE" "$BL"
probe "DISCORD KR (core+bot-logic)" apps/discord-worker/src/fonts/NotoSansKR-Subset.ttf hangul "$CORE" "$BL"
probe "OG SC (core+og-strings)"     apps/og-worker/src/fonts/NotoSansSC-Subset.ttf      cjk    "$CORE" "$OGS"
probe "OG JP (core+og-strings)"     apps/og-worker/src/fonts/NotoSansJP-Subset.ttf      kana   "$CORE" "$OGS"
probe "OG KR (core+og-strings)"     apps/og-worker/src/fonts/NotoSansKR-Subset.ttf      hangul "$CORE" "$OGS"

cat "$OUT"
