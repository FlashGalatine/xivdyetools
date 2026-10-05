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
OPEN
