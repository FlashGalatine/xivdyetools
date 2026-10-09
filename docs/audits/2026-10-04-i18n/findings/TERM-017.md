# TERM-017: Korean share errors say 염색약 (hair dye) where every other surface says 염료
**Tier:** P3 · **Locale(s):** ko · **Deploy unit:** apps/web-app · **Term source:** core `labels.dye` 염료 · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/ko.json:1185` `share.invalidDye` "인식할 수 없는 염색약", `share.legacyLink` "오래된 염색약 ID"

## Evidence
- Core `ko.json:9` `labels.dye` = 염료.

## Fix
- 염료 in both keys.

## Status
FIX COMMITTED, NOT DEPLOYED — `31c8914f` + `c88d51c6` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint6`, web-app 5.14.4, core 5.8.2; PR #248, open, stacked on #247).
