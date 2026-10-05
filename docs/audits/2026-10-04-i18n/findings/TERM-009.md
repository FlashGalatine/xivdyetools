# TERM-009: English calls the clan "tribe" in Swatch Matcher, and calls the race lock "ANY TRIBE" in the Glamour Reader
**Tier:** P2 · **Locale(s):** en · **Deploy unit:** apps/web-app · **Term source:** dictionary *Clans* + core `clans` · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/en.json:1209` `swatch.dropBody` "the tribe and gender needed…", `:1212` `swatch.whoHead` "TRIBE & GENDER" vs `:1329` "the file's clan and gender"
- `en.json:1391` `glamour.fact.anyTribe` "ANY TRIBE" (+ `tribeOk` / `tribeNo`) — a race / gender lock (`chara-twins.ts:151`, `chara-game-rules.ts:148`)

## Evidence
- One word for two things, and neither is the dictionary's word for the first.

## Fix
- "clan" in `dropBody` / `whoHead`; "race" in `anyTribe` / `tribeOk` / `tribeNo`. The translations follow (the de / fr clan nouns are in the pin register).

## Status
OPEN
