# [DEAD-016]: Dead `protected` API on `BaseComponent`/`BaseLitComponent` and a no-op method with six live callers (~90 lines)

## Category
Dead Code Path (unused class members)

## Location / Evidence
`grep -rn "\.name(" src` for every `protected`/`private` member across all 126 non-test files (`evidence/agent-report-ts-symbols.md` §E1-E2):

| file:line | member | callers | lines |
|---|---|---|---|
| `src/components/base-component.ts:550-555` | `addClass` | 0 | 6 |
| `src/components/base-component.ts:557-562` | `removeClass` | 0 | 6 |
| `src/components/base-component.ts:571-576` | `hasClass` | 0 | 6 |
| `src/components/base-component.ts:622-644` | `off` | 0 | 23 |
| `src/components/base-component.ts:702-707` + overrides `dye-selector.ts:705-715`, `market-board.ts:518-528` | `setState` | 0 (overrides also uncalled) | 27 |
| `src/components/v4/base-lit-component.ts:131-138` | `clearError` | 0 (`setError` is live — `share-button.ts:284,:312`) | 8 |
| `src/components/harmony-tool.ts:1384-1391` | `updateDrawerContent` | **6 callers** (`:931,:979,:2005,:2039,:2064,:2113`) — but the body is two comment lines; its JSDoc says *"no longer needed … Kept for backwards compatibility"* | 8 + 6 call lines |
| `src/components/base-component.ts:590` | `// console.log('BaseComponent.on called', …)` | commented-out code | 1 |

Kept (verified live or framework-invoked): `safeTimeout`, `clearSafeTimeout`, `setContent`, `toggleClass`, `emit`, `onCustom` (called from subclasses); `getState` (polymorphic via `getDebugInfo`, 7 overrides); `firstUpdated` (Lit lifecycle); private singleton constructors. Do **not** touch the same-named `updateDrawerContent` in accessibility/gradient/mixer tools — those have real bodies.

## Why It Exists
`BaseComponent` was written as a general-purpose DOM-component base with a jQuery-ish helper set; ~30 subclasses use a fraction of it. `updateDrawerContent` is a compatibility stub from when the harmony drawer was rebuilt with its own controls.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — base-class members with 0 callers; `updateDrawerContent` needs its 6 call lines removed too |
| **Reversibility** | EASY |
| **Hidden Consumers** | Subclasses outside `src/components/`? — none: `grep -rn "extends BaseComponent"` covers `src/components` only. |

## Recommendation
**REMOVE**

### If Removing
1. Delete each method with its JSDoc; for `setState` delete the base and both overrides together
2. Delete `updateDrawerContent` and its 6 call sites in `harmony-tool.ts`
3. `pnpm --filter xivdyetools-web-app run type-check test`
