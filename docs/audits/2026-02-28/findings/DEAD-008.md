# DEAD-008: Components Barrel File (index.ts) — Mostly Dead

## Category
Unused Export

## Location
- File(s): `src/components/index.ts` (79 lines)
- Symbol(s): ~35+ re-exports

## Evidence
This barrel re-exports ~35+ components. Only **one import from the barrel exists** in the entire codebase:

- `main.ts` (line 22): `import { offlineBanner } from '@components/index';`

All other consumers import directly from the source file (e.g., `from '@components/base-component'`). This means essentially all re-exports except `offlineBanner` are unused barrel exports.

Knip flagged 30+ of these re-exports as unused.

## Why It Exists
Standard barrel file pattern for convenient imports. In practice, direct imports are preferred in this project.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — only 1 consumer out of ~35 re-exports |
| **Blast Radius** | LOW — need to update main.ts's import of `offlineBanner` |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Eliminates 79-line barrel that causes unnecessary module evaluation in dev
- Simplifies import graph
- After removing dead component files (DEAD-001 through DEAD-007), even more re-exports become invalid

### If Removing
1. Update `main.ts` to import `offlineBanner` directly: `import { offlineBanner } from '@components/offline-banner'`
2. Delete `src/components/index.ts`
3. Run build + tests to verify
