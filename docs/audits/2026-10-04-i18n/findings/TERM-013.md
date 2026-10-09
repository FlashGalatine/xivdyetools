# TERM-013: Chinese `/manual` tip calls the Facewear dye category 面部装备
**Tier:** P2 · **Locale(s):** zh · **Deploy unit:** packages/bot-logic · **Term source:** core + dictionary *Dye Categories*: Facewear = 脸部配饰 · **Origin:** MAIN

## Location
- `packages/bot-logic/src/i18n/locales/zh.json:146` — "**面部装备：** 面部装备颜色…"

## Evidence
- Core `zh.json:153` and the dictionary say 脸部配饰. The sentence is about the color category, not the slot (面部配饰).

## Fix
- Replace both occurrences with 脸部配饰.

## Status
FIX COMMITTED, NOT DEPLOYED — `f538b4f5` + `159a1dd5` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint2`, bot-logic 4.6.0 + discord-worker 5.8.2; PR #246, open, stacked on #244). Uses the client's 面部配饰 (SDO patch notes, Addon 16050), not the finding's 脸部配饰; the ja/de/ko facewear tips follow the client's word too.
