# DEAD-086: preset-tool.ts (v3 Preset Tool)

## Category
Orphaned File

## Location
- File(s): `src/components/preset-tool.ts` (1524 lines)
- Symbol(s): `PresetTool` class

## Evidence
Import-graph traversal from `main.ts` does not reach this file via any path (static or dynamic). No production module imports
it, and **no test imports it either** — it is fully orphaned. The live preset tool is `src/components/v4/preset-tool.ts`
(first added 2026-02-18), routed by `RouterService` / `v4-layout.ts`.

`preset-tool.ts` is the *only* importer of `auth-button.ts`:
```typescript
// src/components/preset-tool.ts:14
import { AuthButton } from '@components/auth-button';
```
so removing it also strands DEAD-091.

- Git: last meaningful commit **2026-03-01**; frozen since the v4 migration.
- The 2026-02-28 audit (DEAD-004) still described this file as live ("the preset tool and v4 preset tool handle featured
  presets inline"), so the v3 stack was not yet orphaned at that snapshot.

## Why It Exists
The original v3 "Community Presets" tool. The v4 glassmorphism redesign replaced it with `v4/preset-tool.ts` +
`v4/preset-detail.ts` + `v4/preset-card.ts`, but the v3 trio was never deleted.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero importers (prod or test); live replacement is `v4/preset-tool.ts` |
| **Blast Radius** | LOW — isolated; only cascade is auth-button.ts (DEAD-091) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — no dynamic import, no custom-element tag in any prod template |

## Recommendation
**REMOVE**

### Rationale
- 1,524 lines removed — the single largest dead file in the app.
- Eliminates ambiguity about which preset tool is active.
- Unblocks removal of `auth-button.ts` (DEAD-091).

### If Removing
1. Delete `src/components/preset-tool.ts`.
2. Then remove `src/components/auth-button.ts` (DEAD-091 — its only consumer is this file).
3. `pnpm --filter xivdyetools-web-app run type-check && run test && run build`.
