# TERM-013: Chinese `/manual` tip calls the Facewear dye category 面部装备
**Tier:** P2 · **Locale(s):** zh · **Deploy unit:** packages/bot-logic · **Term source:** core + dictionary *Dye Categories*: Facewear = 脸部配饰 · **Origin:** MAIN

## Location
- `packages/bot-logic/src/i18n/locales/zh.json:146` — "**面部装备：** 面部装备颜色…"

## Evidence
- Core `zh.json:153` and the dictionary say 脸部配饰. The sentence is about the color category, not the slot (面部配饰).

## Fix
- Replace both occurrences with 脸部配饰.

## Status
OPEN
