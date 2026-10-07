# TERM-016: Japanese names the dye channel two ways: 染色枠 and チャンネル
**Tier:** P3 · **Locale(s):** ja · **Deploy unit:** apps/web-app · **Term source:** none pinned (en says "dye channels" everywhere) · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/ja.json:1360` `glamour.verdict.explain` 染色枠 vs `:1219` `swatch.gearHint` "2チャンネル" and `:1255` `swatch.equipCount` "{channels}チャンネル"

## Evidence
- One mechanic, two nouns across the Glamour and Swatch views.

## Fix
- Pick one from the client's dye UI, add it to the dictionary, apply to the three keys.

## Status
FIX COMMITTED, NOT DEPLOYED — `31c8914f` + `c88d51c6` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint6`, web-app 5.14.4, core 5.8.2; PR #248, open, stacked on #247).
