# [DEAD-030]: `HarmonyType` component never constructed — `harmony-type.ts` (369 lines) and its only dependant `info-tooltip.ts` (118) were dead, plus their tests (578)

## Category
Orphaned File (module imported only as a type)

## Location
- `apps/web-app/src/components/harmony-type.ts` (369 lines) — `export class HarmonyType extends BaseComponent`
- `apps/web-app/src/components/info-tooltip.ts` (118 lines) — its only production importer was `harmony-type.ts`
- `apps/web-app/src/components/__tests__/harmony-type.test.ts` (322), `info-tooltip.test.ts` (256)
- `apps/web-app/src/components/harmony-tool.ts` — `import { HarmonyType }` used only as the value type of `private harmonyDisplays: Map<string, HarmonyType> = new Map()`
- `apps/web-app/src/styles/themes.css:257-283` — the `.harmony-header/-title/-description/-deviance-info/-icon` rules (the audit's DEAD-020 had classified these as *unreachable*; they were simply dead)

## Evidence
- `grep -rn "new HarmonyType" src` → **0 hits**. The class is imported by `harmony-tool.ts` but only as a type annotation.
- `harmonyDisplays` is a `Map` that is **never `.set()`**: its only uses are `for (const display of this.harmonyDisplays.values()) display.destroy()` + `.clear()` in `destroy()`, and the same empty iteration in `updateHarmonyDisplayPrices()`. Both loops iterate an always-empty map.
- `grep -rln "info-tooltip" src` (non-test) → `harmony-type.ts` and `info-tooltip.ts` only.
- knip did **not** flag either file because a *type* import counts as a reference; this is the "imported-only-as-a-type" blind spot — worth remembering for future sweeps (`import type` would have exposed it; the code used a value import for a type-only use).

## Why It Exists
`HarmonyType` was the pre-5.0 per-harmony-type result panel (header + deviance info + `info-tooltip` explainers). 5.0 replaced it with `harmony-result-panel.ts` + `v4-result-card`; the map and its teardown loops survived the rewrite.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — one field + two empty loops in `harmony-tool.ts`; two modules; two tests; five CSS rules |
| **Reversibility** | EASY |
| **Hidden Consumers** | `HARMONY_ICONS` (`shared/harmony-icons.ts`) is still consumed by `harmony-tool.ts` directly — kept. `TOOLTIP_CONTENT` / `addInfoIconTo` had no other consumer. |

## Recommendation
**REMOVE** — **executed in Wave 3** (2026-08-16): both modules and tests deleted, `harmony-tool.ts` trimmed, `.harmony-*` rules deleted from `themes.css`, docs (`components.md`, `tools.md`) corrected. Verification: tsc clean, 87/87 test files pass, 18 before/after screenshots pixel-identical apart from the intended `.number` change.

### Method note
Found while deciding DEAD-020's "move `.harmony-*` shadow-side" step: checking *where the consumer mounts* revealed the consumer was never mounted at all. Whenever an "unreachable" rule is about to be relocated, first prove the element that carries the class actually exists at runtime.
