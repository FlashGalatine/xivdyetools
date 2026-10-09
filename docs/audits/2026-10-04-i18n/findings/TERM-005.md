# TERM-005: German `glamour.fact.dye` "FARBE ×{n}" says color where it means dye
**Tier:** P2 · **Locale(s):** de · **Deploy unit:** apps/web-app · **Term source:** house register: German dye = Farbstoff, never Farbe · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/de.json:1390` (en "DYE ×{n}")

## Evidence
- Sibling keys already say "Farbstoffe" (:1372).

## Fix
- "FARBSTOFF ×{n}".

## Status
FIX COMMITTED, NOT DEPLOYED — `31c8914f` + `c88d51c6` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint6`, web-app 5.14.4, core 5.8.2; PR #248, open, stacked on #247).
