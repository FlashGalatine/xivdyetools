# DEAD-009: 4 state icons in state-icons.ts are reachable only from the 6 test-only EMPTY_STATE_PRESETS: 33 lines + 4 import lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Unused Export · **Origin:** MAIN · **Cascade of:** DEAD-008

## Location
- `apps/web-app/src/shared/state-icons.ts:29` — ICON_STATE_COINS, ICON_STATE_ALERT, ICON_DETAIL_EXTRACTOR, ICON_STATE_WAIT_ANIMATED

## Evidence
- The only importer is empty-state.ts:16-20. Each icon is used only inside one of the six test-only presets (lines 71, 88, 96, 105). All imports are named and static, and nothing else in apps/, packages/, scripts/ or e2e/ references them. They become dead when the DEAD-008 presets are removed.
  - Commands: git grep -n -w -E 'ICON_STATE_COINS|ICON_STATE_ALERT|ICON_STATE_WAIT_ANIMATED|ICON_DETAIL_EXTRACTOR' -- . ':!docs/audits/**' -> state-icons.ts defs, empty-state.ts imports/uses, and docs/projects/web-app/components.md:92 (prose); no `import * as`/dynamic import of state-icons anywhere; test files never name the four
- Origin: git grep -w at 8ecb878f gives the same hits (state-icons.ts:29,32,44,57 and empty-state.ts:16-20,71,88,96,105). git diff 8ecb878f HEAD shows no change to empty-state.ts or state-icons.ts, and pr-delta.txt lists neither file.

## Fix
**REMOVE WITH CAUTION.** Remove in the same change as the six presets of DEAD-008, never before them. First confirm with the designer that no error or loading empty state is planned. ICON_STATE_WAIT_ANIMATED is the only copy of the confirmed 2a animated hourglass (its keyframes are inline here), so recovering it later means going through git history. The coins/alert glyphs stay in the published @xivdyetools/svg.

Steps: 1) apps/web-app/src/shared/state-icons.ts: delete lines 28-29 (COINS), 31-32 (ALERT), 43-44 (EXTRACTOR) and 46-72 (the WAIT_ANIMATED doc block and template), with their blank separators. Keep the panelGlyph, toolGlyph and themedAccent imports, which SEARCH, FUNNEL, FOLDER, PRESETS_EMPTY and HARMONY still use. The matching names in empty-state.ts's import go with DEAD-008. 2) Update the icon list in docs/projects/web-app/components.md:92. 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app, then pnpm dead-code:check and pnpm docs:check-links.

## Status
REMOVED, NOT DEPLOYED — `60e89446` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
