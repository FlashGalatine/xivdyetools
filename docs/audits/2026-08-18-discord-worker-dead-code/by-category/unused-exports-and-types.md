# Unused Exports, Types & Class Members — Summary

## Overview
- **Total Findings:** 15
- **Recommended for Removal:** 8 REMOVE · 5 REMOVE WITH CAUTION (npm-published, documented API) · 2 REFACTOR FIRST (adopt-or-delete)
- **Estimated removable:** ~2,300 source lines + ~1,900 test lines

Two tiers the tool sees differently:
- **DEAD** — zero references anywhere (knip reports these when they are not on a package entry barrel; with `--include-entry-exports` it reports the barrel ones too).
- **TEST-ONLY** — referenced only by `*.test.ts` files. **knip cannot see this tier** (tests are entries), and it is the larger one here: `component-context.ts`, the preset-api moderation client, ~40 core class methods, `perf`, `AsyncLRUCache`, the svg gradient helpers were all found by hand.

## Findings

| ID | Location | What | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-002 | discord-worker `services/preset-api.ts` | 10 moderation/misc client fns, ~191 lines + 260 test | HIGH | **REMOVE** |
| DEAD-004 | discord-worker services/utils | 20 dead/test-only exports, ~300 lines + tests | HIGH | **REMOVE** |
| DEAD-006 | discord-worker `utils/color.ts`, `utils/verify.ts`, `budget/index.ts`, `types/preset.ts` | re-export shims + redundant barrel lines + a 220-line test of a mock | HIGH | **REMOVE** / REFACTOR FIRST (shims) |
| DEAD-013 | bot-logic mixer/translator/barrel | `MixerResult.matches` runtime work, `getMeta()`, 3 core-type re-exports | HIGH | **REMOVE** |
| DEAD-014 | svg `arcPath`, `truncateText`, `rgbToHsv`, `DisplayOptions`, `AllVisionTypes`, `CATEGORY_DISPLAY` | ~125 lines + ~100 test | HIGH | **REMOVE** / WITH CAUTION (3 documented) |
| DEAD-015 | svg `interpolateColor`, `generateGradientColors`, `rgbToHex`, `LEDGER_GROUP_H`/`ROW_H`, `GLYPH_SETS` | ~63 lines + ~30 test | HIGH | **REMOVE WITH CAUTION** |
| DEAD-018 | svg `GLYPH_ACCENT_LIGHT` | token unused; literal hard-coded ×3 | MED | **REFACTOR FIRST** (wire it) |
| DEAD-019 | auth `hmacSign`/`hmacVerify`/`hmacSignHex` | ~64 lines + 120 test; 4 app copies (~90 lines) | HIGH | **REFACTOR FIRST** (adopt or delete) |
| DEAD-020 | auth `isJWTExpired`, `getJWTTimeToExpiry`, `timingSafeEqualBytes` | ~45 lines, documented | HIGH | **REMOVE WITH CAUTION** |
| DEAD-021 | logger `perf`, `getRequestId(request)`, `createSimpleLogger` | 156 lines + ~200 test; false CHANGELOG claim | HIGH | **REMOVE** |
| DEAD-023 | worker-kit `formatRateLimitMessage`, `MODERATION_LIMITS`, `UNIVERSALIS_PROXY_LIMITS`, `EndpointRateLimitConfig` | ~59 lines + 40 test | HIGH | **REMOVE WITH CAUTION** (adopt `MODERATION_LIMITS`) |
| DEAD-024 | types `RACE_SUBRACES`/`SUBRACE_TO_RACE`/`COLOR_GRID_DIMENSIONS` | ~85 lines; 4 app re-rolls | HIGH | **REFACTOR FIRST** (adopt or delete) |
| DEAD-025 | types `createSnowflake`/`DiscordSnowflake`, `DyeDatabase`, 5 chain-dead contract types | ~125 lines | HIGH | **REMOVE** |
| DEAD-027 | test-utils partial extras + `utils/crypto.ts` + `randomId` dup path | ~520 lines | HIGH | **REMOVE** |
| DEAD-029 | core `utils/index.ts` 11 helpers + `AsyncLRUCache` | ~516 lines + ~436 test | HIGH | **REMOVE** / WITH CAUTION (documented) |
| DEAD-030 | core dead constants + `@internal` on barrel | ~23 lines | HIGH | **REMOVE** |
| DEAD-033 | core `/blending` `getBlendingModeDescription`, `rgbToLab` | 16 lines + 15 test | HIGH | **REMOVE** |
| DEAD-034 | core ~40 class methods (APIService, DyeService chain, ColorService mix/spectral, PresetService, CharacterColorService, …) | ~655 lines + ~790 test | HIGH | **REMOVE WITH CAUTION** |

## Explicitly KEPT (documented public API / structurally live)
- The `*Options`/`*Labels`/`*Input`/`*Result` types of svg and bot-logic (parameter types of live functions — consumers pass literals).
- svg frame primitives (`cardShell`, `cardText`, `fitText`, …) — README tells consumers to build with them.
- logger `BaseLogger`, adapters, `createBrowserLogger`; auth root `/encoding` re-exports (DEPRECATIONS-documented alias); worker-kit option types and preserved subpaths; types union constituents.
- core: 30 companion types, `facewearColors`/`LEGACY_FACEWEAR_ITEM_IDS` (frozen), the colour-science converter surface, INTERNAL-ONLY constants (barrel trim optional — DEAD-030).
