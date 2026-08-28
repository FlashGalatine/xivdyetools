# Orphaned Files & Modules — Summary

## Overview
- **Total Findings:** 8
- **Recommended for Removal:** 8 (DEAD-001 has an explicit "or re-park and fix the docs" alternative)
- **Estimated removable:** ~2,700 source lines + ~3,300 test lines + **11.4 MB** of tracked data/assets

## Findings

| ID | Location | What | Confidence | Recommendation |
|----|----------|------|------------|----------------|
| DEAD-001 | discord-worker `services/component-context.ts` | 326-line service, 0 non-test importers (+359 test lines; 3 docs call it live) | HIGH | **REMOVE** (or keep + fix docs) |
| DEAD-003 | discord-worker `services/svg/index.ts`, `types/image.ts`, `handlers/modals/index.ts` | 8 + 54 + 10 lines (+17 test) | HIGH | **REMOVE** |
| DEAD-008 | discord-worker `fonts-src/NotoSansSC-Regular.ttf` | 10.6 MB tracked font the subset script refuses to use | HIGH | **REMOVE** |
| DEAD-012 | bot-logic `color-math.ts` | 72 lines + 63 test; twin of the retired emoji ladder | HIGH | **REMOVE** |
| DEAD-026 | test-utils `dom/*`, `assertions/*`, `cloudflare/analytics.ts`, `factories/user.ts`, `factories/vote.ts`, `constants/secrets.ts`, `auth/context.ts`, `auth/signature.ts` | 1,565 src + 2,752 test lines, 0 external consumers | HIGH | **REMOVE** |
| DEAD-028 | core `src/data/character_colors.json` | 798 KB monolith, still hand-maintained, 0 importers | HIGH | **REMOVE** |
| DEAD-031 | core `test-build.mjs`, `typedoc.json` + `docs` script, `VERSION` machinery | 117 + 25 + 45 lines, 2 devDeps | HIGH | **REMOVE** (VERSION with caution) |
| DEAD-025 (part) | types `dye/database.ts` | 27-line `DyeDatabase` interface, 0 refs, name-collides with core's class | HIGH | **REMOVE** |
