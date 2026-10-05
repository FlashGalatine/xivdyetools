# DEAD-052: PresetService.getPresetWithDyes in core is test-only published API — 34 lines + 145-line test
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/core/src/services/PresetService.ts:254` — PresetService.getPresetWithDyes

## Evidence
- Test-only. This is core PresetService.getPresetWithDyes, not web-app HybridPresetService.getPresetWithDyes (DEAD-012). Its only non-test hits are the def at :254 and JSDoc at :19/:243.
  - Commands: git grep -n -w getPresetWithDyes -- apps packages ':!*.md': core prod = :254 + JSDoc :19,:243; web-app hybrid-preset-service.ts:422 is its own method; createMockDyeService is used only at PresetService.test.ts:553-586
- Origin: At 8ecb878f: def PresetService.ts:254 plus JSDoc and core tests only. Present in published 5.8.0 (fc11c8b2:PresetService.ts:254). No PR touches the file.

## Fix
**KEEP.** Published core API (barrel index.ts:27, and CHANGELOG 689 documents the contract). Revisit trigger: the next core major (2026-09-15-dead-code/DEAD-018 family). Tag it `@public` now. On removal, ResolvedPreset (the @public type at index.ts:28) loses its only producer. IDyeService stays because searchPresets at :176 uses it.

Steps: At the core major: delete PresetService.ts 228-265 (section header, JSDoc and method) and the class @example at :18-19. Delete PresetService.test.ts 551-595 (the describe) and the now-unused createMockDyeService helper at 144-243 (otherwise lint fails). Decide whether ResolvedPreset (PresetService.ts:36, index.ts:28) goes too. Add a core CHANGELOG entry. Run `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check`.

## Status
KEEP (register) — revisit on the trigger above
