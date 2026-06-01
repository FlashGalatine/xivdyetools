# DEAD-099: loading-spinner.ts (test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/loading-spinner.ts` (149 lines),
  `src/components/__tests__/loading-spinner.test.ts` (246 lines)
- Symbol(s): `SPINNER_SVG` const + helper exports

## Evidence
Only its own test imports the source (`__tests__/loading-spinner.test.ts:27: } from '../loading-spinner'`). No production
module imports it. The one place that shows a spinner, `market-board.ts:344`, builds an **inline** SVG with its own
`loading-spinner` CSS class rather than importing this module:
```typescript
// market-board.ts:344
const spinnerSvg = `<svg class="loading-spinner w-4 h-4" viewBox="0 0 24 24" fill="none">…`;
```

- Git: last meaningful commit **2026-02-18**.

## Why It Exists
A v3 shared spinner module. Consumers inlined their own spinner markup, leaving this module unused but still tested.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test; the CSS class is reused inline, not the module |
| **Blast Radius** | NONE — the `.loading-spinner` CSS rule (in styles) stays; only the TS module goes |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 395 lines removed (149 source + 246 test). Note: the test is *larger* than the source it covers.

### If Removing
1. Delete `src/components/loading-spinner.ts` and its test.
2. Leave the `.loading-spinner` CSS rule (used by the inline spinner in `market-board.ts`).
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
