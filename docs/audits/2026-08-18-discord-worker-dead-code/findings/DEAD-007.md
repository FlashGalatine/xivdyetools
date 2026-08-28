# [DEAD-007]: Stale config — dead D1 `DB` binding in both wrangler envs, dead `Env` fields, stale vitest excludes/mocks, unused `@/*` alias

## Category
Dead Config / Stale Test

## Location
- `apps/discord-worker/wrangler.toml:30, 86` — `[[d1_databases]] binding = "DB"` (top-level dev + `[env.production]`); the comment claims it is "shared with production on purpose, so /preset renders real data"
- `apps/discord-worker/src/types/env.ts` — `Env.DB`, plus `Env.IMAGES?: R2Bucket` (83), `Env.ASSETS?: R2Bucket` (86)
- `apps/discord-worker/src/utils/env-validation.ts:76` — `if (!env.DB) errors.push(...)` (makes the dead binding *required*)
- `apps/discord-worker/vitest.config.ts` coverage.exclude — `src/locales/**`, `src/services/svg/dye-info-card.ts`, `src/services/svg/random-dyes-grid.ts`, `src/services/svg/budget-comparison.ts` (paths that do not exist); include glob `src/**/*.test.ts` also matches `budget-pipeline.integration.test.ts`, so `test:all` runs the integration suite twice
- `tsconfig.json`, `vitest.config.ts`, `vitest.integration.config.ts` — `@/*` → `./src/*` alias with 0 uses
- `handlers/commands/dye.test.ts:16-22` mocks `../../services/svg/dye-info-card.js` and `random-dyes-grid.js`; `handlers/commands/preset.test.ts:76-78` mocks `../../services/svg/preset-swatch.js` — modules that no longer exist (inert `vi.mock`)
- `index.ts:1107` — `ENVIRONMENT === 'development'` branch of `app.onError`; `ENVIRONMENT` is neither in wrangler vars nor in `Env` (index.ts:99 comment says so) → unreachable

## Evidence
`grep -rn "env\.DB\b|\.prepare(|D1Database" src --include=*.ts | grep -v test` → only the env-validation check. `git log -S"env.DB." -- apps/discord-worker/src` → nothing since the monorepo import (79e945a). All preset data flows through the `PRESETS_API` service binding. No R2 binding exists in wrangler.toml. `grep -rn "from '@/" src scripts` → 0. Stale `vi.mock` targets found by the script in track notes §8.

## Why It Exists
Pre-monorepo the bot read presets from D1 directly; presets-api absorbed that and the binding was never dropped. The svg mocks date from when the card generators lived in this app.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — but the D1 removal is a **deploy-visible** change (binding disappears from both workers; harmless since nothing reads it) |
| **Reversibility** | EASY (config) |
| **Hidden Consumers** | `env-validation` will stop requiring `DB` — that is the desired effect. `.github/workflows/deploy-discord-worker*.yml` run no `wrangler d1` step for this worker. |

## Recommendation
**REMOVE**

### If Removing
1. Delete both `[[d1_databases]]` blocks and the wrangler comment; delete `Env.DB`, `Env.IMAGES`, `Env.ASSETS`; delete the `DB` check in env-validation (+ its test case); drop `createMockD1` from `src/test-utils.ts` (DEAD-005).
2. Prune the 4 stale coverage excludes (and add none for files removed by DEAD-001/003); change the include glob to exclude `*.integration.test.ts`.
3. Remove the `@/*` alias ×3 and the 3 stale `vi.mock` calls; delete the unreachable `isDev` branch at index.ts:1107.
4. `wrangler deploy --dry-run` for both envs, then test + type-check.
