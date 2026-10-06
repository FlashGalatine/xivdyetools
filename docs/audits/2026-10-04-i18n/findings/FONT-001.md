# FONT-001: `/glamour` cards draw English item names for 62.5 % of items in Korean and 97.3 % in Chinese: the CJK subsets hold no item names
**Tier:** P2 · **Locale(s):** ko zh (ja not measurable) · **Deploy unit:** apps/discord-worker · **Origin:** MAIN

## Location
- `packages/bot-logic/src/commands/glamour.ts:431` — `name: canDraw(p.name) ? p.name : p.nameEn`
- `apps/discord-worker/src/handlers/commands/glamour.ts:152-153` — `canDraw` = no glyph dropped by the subset ("Item names arrive at run time; the CJK fonts are subsets")

## Evidence
- Against the 2,486-codepoint union: ko 18,120 / 28,986 equippable items fall back, zh 28,223 / 28,992 (`item-names.{ko,zh}.json`). No tofu is drawn and the embed keeps the localized name.
- The mechanism is deliberate (the 2026-09-02 BUG-030 pattern), but nothing records or accepts these rates.

## Fix
- Decide: widen discord-worker's subset inputs with the item names (about +363 Hangul and +1,171 hanzi; measure the gzip bundle against the 3,072 KiB limit first, as nobody has), or record the English card as accepted with these numbers.

## Status
FIX COMMITTED, NOT DEPLOYED — `00390333`: Option A. The CJK subsets are cut from api-worker's ko / zh item-name tables (KR +364, SC +1,167); English fallback 18,326 → 2 (ko, a stray U+200F in the source table) and 28,217 → 0 (zh); bundle 2,626.8 KiB, 85.5 % of the cap. `item-name-coverage.test.ts` gates a missing re-cut. ja has no in-repo item table and is not covered. (branch `fix/remediation-2026-10-04-sprint30`, discord-worker 5.8.9; PR #263, open, on PR #262).
