# DEAD-050: types: ToolKey and LocaleData.tools outlive core's getToolName — 13 source lines, for the types major after DEAD-049
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/types · **Semver:** MAJOR · **Category:** Legacy · **Origin:** MAIN · **Cascade of:** DEAD-049

## Location
- `packages/types/src/localization/index.ts:54` — ToolKey (+ core getToolName x3, LocaleData.tools)

## Evidence
- Only core tests call getToolName (LocalizationService static+instance :499/:507, TranslationProvider :354); ToolKey feeds only those and LocaleData.tools. og-worker's getToolName (og-data-generator.ts:179) is an unrelated local fn whose name masks these from the dead-code gate.
  - Commands: git grep -n -w getToolName -- apps packages: prod hits are only core defs + og-worker local function; callers only in core __tests__.; git grep -E 'LocalizationService\[|translator\[|provider\[' -- apps: none (no dynamic dispatch).; npm view: types 3.2.0, core 5.8.0 = local; ToolKey/getToolName present at 8ecb878f and fc11c8b2 (core 5.8.0).
- Re-verified independently in the completeness re-sweep: Only core tests call getToolName; og-worker's getToolName is a local function (og-data-generator.ts:179). ToolKey cannot go first because core LocalizationService.ts:15,499,507 and TranslationProvider.ts:15,354 import it.
- Origin: git grep -n -w getToolName 8ecb878f -- apps packages: identical refs (core defs + tests + og-worker local fn); git log 8ecb878f..HEAD -G 'getToolName|ToolKey' hits only e2a8058b (#226, docs/audits only).

## Fix
**KEEP.** Published API: types 3.2.0 and core 5.8.0 (= npm) both ship it; already @deprecated with 'removal is a core major'. Revisit at next core + types major (same trigger as 2026-09-15-dead-code/DEAD-018). Note gate blind spot: renaming og-worker's local getToolName would surface these as test-only.

Steps: At the types major, after core has shipped DEAD-049: delete packages/types/src/localization/index.ts:46-54 (ToolKey) and :145-147 (LocaleData.tools), and the ToolKey line in the barrel at packages/types/src/index.ts:145. Update packages/types/CLAUDE.md:118 and og-worker's CLAUDE.md:325, and add a BREAKING CHANGELOG entry. Then pnpm turbo run build type-check lint test --filter=...@xivdyetools/types && pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
