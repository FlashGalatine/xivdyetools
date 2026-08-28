# [DEAD-022]: Unused dependency declarations — `@xivdyetools/logger` ×3 apps, `@xivdyetools/test-utils` ×2, `@testing-library/dom`, `typedoc-plugin-markdown`, stoat-worker's `@xivdyetools/svg`

## Category
Unused Dependency

## Location
| package.json | Dependency | Evidence |
|---|---|---|
| `apps/api-worker`, `apps/oauth`, `apps/presets-api` | `@xivdyetools/logger` (dep) | none of the three imports it — they reach `ExtendedLogger` only through `getLogger()` from `@xivdyetools/worker-kit`, which declares logger as its own dependency (`git grep "@xivdyetools/logger" apps/{api-worker,oauth,presets-api}` → package.json only) |
| `packages/bot-logic`, `apps/stoat-worker` | `@xivdyetools/test-utils` (devDep) | never imported by either |
| `packages/test-utils` | `@testing-library/dom` (devDep) | not imported in src or tests |
| `packages/core` | `typedoc-plugin-markdown` (devDep) | `typedoc.json` has no `plugin` key and `theme: default` — never loaded (see DEAD-031 for the whole typedoc setup) |
| `apps/stoat-worker` | `@xivdyetools/svg` (dep) | zero imports (parked app; also flagged: `@xivdyetools/core`, `@xivdyetools/worker-kit` — verify when the app is next touched) |

Not flagged / justified: discord-worker's `wrangler` devDep pins the deploy tool for `cloudflare/wrangler-action`; `@cloudflare/workers-types` in discord-worker `dependencies` is a hygiene move to devDependencies, not dead.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (three apps' logger and both test-utils devDeps grep-verified) |
| **Blast Radius** | NONE at runtime — pnpm's hoisting means the packages are still installed transitively where needed |
| **Reversibility** | EASY |
| **Hidden Consumers** | Type-only usage would show as an import; none found |

## Recommendation
**REMOVE** (one `pnpm install` + turbo type-check across the workspace).
