# TERM-012: The bot's dye-problem chip says "FARBEN" (colors) in German and "TEINTES" (shades) in French
**Tier:** P2 · **Locale(s):** de fr · **Deploy unit:** packages/bot-logic · **Term source:** house register: de Farbstoff, fr teinture · **Origin:** MAIN

## Location
- `packages/bot-logic/src/i18n/locales/de.json:618` "FARBEN", `fr.json:618` "TEINTES" (`card.glamourStatusDye`, en "DYES")

## Evidence
- Shown when a piece fails on dye (`glamour.ts:234`; `chara-game-rules.ts:146`). The same de file says "{n} Farbstoffe" (:612); fr uses "teinte" for hue ("Teinte OKLCH", :60).

## Fix
- "FARBSTOFFE" and "TEINTURES", naming the category as en does ("NICHT FÄRBBAR" is longer and changes the label's job). FARBSTOFFE is about 66 px against a 72 px column, and `fitText` shrinks it (`glamour-card.ts:278`). Re-cut the discord-worker subsets in the same PR.

## Status
FIX COMMITTED, NOT DEPLOYED — `f538b4f5` + `159a1dd5` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint2`, bot-logic 4.6.0 + discord-worker 5.8.2; PR #246, open, stacked on #244).
