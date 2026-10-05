# TERM-016: Japanese names the dye channel two ways: 染色枠 and チャンネル
**Tier:** P3 · **Locale(s):** ja · **Deploy unit:** apps/web-app · **Term source:** none pinned (en says "dye channels" everywhere) · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/ja.json:1360` `glamour.verdict.explain` 染色枠 vs `:1219` `swatch.gearHint` "2チャンネル" and `:1255` `swatch.equipCount` "{channels}チャンネル"

## Evidence
- One mechanic, two nouns across the Glamour and Swatch views.

## Fix
- Pick one from the client's dye UI, add it to the dictionary, apply to the three keys.

## Status
OPEN
