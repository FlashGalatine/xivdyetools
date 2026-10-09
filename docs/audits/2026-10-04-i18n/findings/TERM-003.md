# TERM-003: web-app names character-creation sheets two ways within one file: highlights, tattoo, face paint, limbal ring
**Tier:** P2 · **Locale(s):** ja ko de fr zh · **Deploy unit:** apps/web-app · **Term source:** none: core `sheets` is typed by hand (`build-locales.ts:872-937`), and the limbal noun was already unpinned (2026-09-20) · **Origin:** MAIN

## Location
- ja: `tools.character.highlightColors` メッシュの色 vs `swatch.slotHighlights` ハイライト; `tattooColors` タトゥー vs `slotTattoo` / `palTattoo` 刺青; リムバル (:94) vs リンバル (:1232, :1239)
- ko: 하이라이트 (:91) vs 브릿지 (:1229, :1237, :1245); 림발 (:94) vs 림벌 (:1232, :1239). de: Strähnchen (:91) vs Strähnen (:1229, :1237, :1245); Gesichtsbemalung (:95) vs Schminke (:1234, :1241, :1246)
- zh: 纹身 (:94) vs 刺青 (:1231, :1239); 轮环 (:94) vs 角膜环 (:1232, :1239). fr: "limbal" (:94, :1239) vs "Anneau limbal" (:1232)

## Evidence
- Every pair names one sheet. Core cannot settle it: its ja / ko / zh limbal is 角膜 / 홍채 / 虹膜 (cornea / iris), which neither app uses, and its values cite no source.

## Fix
- First add a character-creation sheet table (nine sheets × six locales) to `ffxiv-terminology.md` from the client's own text, read raw (Sprint 0 decision). Then one label per sheet here; the bot and core follow (TERM-004, TERM-021).

## Status
FIX COMMITTED, NOT DEPLOYED — `31c8914f` + `c88d51c6` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint6`, web-app 5.14.4, core 5.8.2; PR #248, open, stacked on #247).
