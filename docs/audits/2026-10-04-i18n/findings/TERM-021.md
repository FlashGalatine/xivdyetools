# TERM-021: Core's character-creation sheet names are typed by hand, and its limbal is "cornea" / "iris" in ja, ko and zh
**Tier:** P3 · **Locale(s):** ja ko zh de fr · **Deploy unit:** packages/core · **Term source:** none: no source is cited · **Origin:** MAIN

## Location
- `packages/core/scripts/build-locales.ts:872-937` `buildSheets` — e.g. ja タトゥー／角膜, ko 문신/홍채, zh 纹身/虹膜, de Tätowierung/Limbus, fr Tatouage/Limbe

## Evidence
- No row or comment cites the client. Neither app uses core's limbal word in ja, ko or zh (TERM-003, TERM-004).

## Fix
- Fix the generator once the dictionary table exists (never the generated JSON); publish core.

## Status
FIX COMMITTED, NOT DEPLOYED — `e48dd7ab`: buildSheets follows the dictionary's character-creation table; `290b1bb7` re-cuts the discord-worker and og-worker CJK subsets for the new names. (branch `fix/remediation-2026-10-04-sprint13`, core 5.10.0; PR #260, open, on PR #259).
