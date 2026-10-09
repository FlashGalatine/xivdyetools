# TERM-004: The bot names character-creation sheets differently from its own card labels and from web-app
**Tier:** P2 · **Locale(s):** ja ko de fr zh · **Deploy unit:** packages/bot-logic · **Term source:** none yet (as TERM-003) · **Origin:** MAIN

## Location
- de `packages/bot-logic/src/i18n/locales/de.json:72`, `:690` — "Highlights", "Tattoo/Limbalring", while the card says STRÄHN / TÄTOW. / LIMBUS
- ja `:72`, `:690` メッシュ, 刺青／リムバル; ko 브릿지, 림벌 링; zh 角膜环 (`:72`, `:593`, `:690`); fr "tatouage/anneau limbal" (`:72`, `:690`) vs card LIMBE (`:593`)

## Evidence
- Same family as TERM-003, inside `commands.swatch.description`, `manual5.topics.characterFile.body` and `card.slot*`.

## Fix
- After the dictionary table, align the three key families. Drawn text: re-cut the discord-worker subsets in the same PR.

## Status
FIX COMMITTED, NOT DEPLOYED — `f538b4f5` + `159a1dd5` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint2`, bot-logic 4.6.0 + discord-worker 5.8.2; PR #246, open, stacked on #244).
