# Unused Dependencies, Dead Config, i18n, Stale Tests & Docs — Summary

## Overview
- **Total Findings:** 8
- **Recommended for Removal:** 7 REMOVE · 1 KEEP (design)
- **Estimated removable:** 8 dependency lines · ~35 config lines · **249 locale keys (~67 KB ×6 languages)** + 3 core locale sections ×6 · ~50 duplicated test lines · 1 stale test file (220 lines) · 1.5 KB glyph data (design decision)

## Findings

| ID | Location | What | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-005 | discord-worker `src/test-utils.ts` | 4 dead factories (~70 lines); file duplicates `@xivdyetools/test-utils`; 9 local `createMockKV` | HIGH | **REMOVE** (factories) / REFACTOR FIRST (adopt package) |
| DEAD-007 | discord-worker `wrangler.toml`, `types/env.ts`, `env-validation.ts`, vitest/tsconfig | dead D1 `DB` binding ×2 envs, dead `IMAGES`/`ASSETS` fields, 4 stale coverage excludes, `@/*` alias ×3, 3 stale `vi.mock`s, integration suite run twice | HIGH | **REMOVE** |
| DEAD-011 | bot-logic `i18n/locales/*.json` | **211 orphan keys (34 %) + 38 test-only**, ~67 KB ×6, ships in the bot bundle | HIGH | **REMOVE** + add orphan-key gate |
| DEAD-016 | svg `PANEL` glyphs | 9/20 never requested (1.5 KB in web-app bundle) | HIGH (usage) | **KEEP** / design decision |
| DEAD-017 | svg `base.test.ts`, README/CLAUDE, stoat-worker package.json | duplicated `describe` blocks (~50 lines); stale consumer docs; unused svg dep | HIGH | **REMOVE** |
| DEAD-022 | 7 package.json files | `@xivdyetools/logger` ×3 apps, `@xivdyetools/test-utils` ×2, `@testing-library/dom`, `typedoc-plugin-markdown`, stoat-worker `@xivdyetools/svg` | HIGH | **REMOVE** |
| DEAD-036 | core `data/locales/*.json` + LocalizationService + build-locales + types | `metallicDyeIds`, `jobNames`, `grandCompanyNames` sections ×6 with uncalled accessors (~150 lines) | HIGH | **REMOVE WITH CAUTION** |
| DEAD-006 (part) | discord-worker `utils/verify.test.ts` | 220-line test that mocks the function it tests | HIGH | **REMOVE** |

## Stale docs surfaced along the way (fix with the related finding)
- `apps/discord-worker/CLAUDE.md:111`, `docs/projects/discord-worker/{interactions,overview}.md` — describe `component-context` as live (DEAD-001)
- `packages/core/CLAUDE.md:20` (TypeDoc), `:52` (`character_colors.json`), `:176` (utils list) (DEAD-031/028/029)
- `packages/svg/README.md`, `CLAUDE.md` — list stoat-worker as a consumer (DEAD-017)
- `packages/bot-logic/CLAUDE.md` §"Shared types & helpers" — documents `color-math.ts` (DEAD-012)
- `packages/logger/CHANGELOG.md` DEAD-070 note — false claim about `getRequestId` (DEAD-021); `presets/library.ts` examples use the pre-scope package name
- `packages/types/README.md:103` — imports the dead `DyeDatabase` interface (DEAD-025)
- `apps/discord-worker/wrangler.toml` — comment about the D1 binding's purpose is wrong (DEAD-007)
