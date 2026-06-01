# DEAD-098: v4/glass-panel.ts (registered but unrendered)

## Category
Orphaned-in-Production / Stale Test Code

## Location
- File(s): `src/components/v4/glass-panel.ts` (203 lines),
  `src/components/__tests__/v4/glass-panel.test.ts` (95 lines)
- Symbol(s): `GlassPanel` Lit element (`@customElement('v4-glass-panel')`)

## Evidence
`glass-panel.ts` registers the custom element `<v4-glass-panel>`, but that tag appears in **no production template** — the only
references are the file's own JSDoc and its test, which dynamically imports it:
```typescript
// __tests__/v4/glass-panel.test.ts:41
const { GlassPanel } = await import('../../v4/glass-panel');
```
A registered-but-unrendered Lit element is invisible to "is the tag used?" checks; the import graph confirms no prod path
reaches it. (The `.glass-panel` CSS class in `v4/base-lit-component.ts:73` is an unrelated style token, not a use of this element.)

- Git: last meaningful commit **2026-02-18**.

## Why It Exists
An early v4 panel primitive. The v4 components settled on `glass-panel`-styled containers via shared CSS / `base-lit-component`
rather than this standalone element, so it was never adopted.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — no `<v4-glass-panel>` in any prod template; sole importer is its own test |
| **Blast Radius** | NONE |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — verify no future template adopts the tag before deleting |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 298 lines removed (203 source + 95 test).

### If Removing
1. Confirm `<v4-glass-panel` appears in no `.ts` template literal (grep).
2. Delete `src/components/v4/glass-panel.ts` and its test.
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
