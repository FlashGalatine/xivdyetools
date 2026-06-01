# DEAD-089: my-submissions-panel.ts

## Category
Orphaned File

## Location
- File(s): `src/components/my-submissions-panel.ts` (443 lines)
- Symbol(s): `MySubmissionsPanel` class

## Evidence
The basename `my-submissions-panel` appears in **no other file** in the codebase (verified by whole-corpus grep) and the
import-graph traversal does not reach it from `main.ts` or any test. The "my submissions" feature in the v4 preset tool is
handled inline / via `preset-submission-service.ts` rather than this standalone panel.

- Git: last meaningful commit **2026-02-28**.

## Why It Exists
A standalone panel for a user's own preset submissions, extracted during v3. The v4 preset tool absorbed this functionality,
leaving the panel orphaned.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — basename appears nowhere else; zero importers |
| **Blast Radius** | NONE — isolated |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 443 lines removed.

### If Removing
1. Delete `src/components/my-submissions-panel.ts`.
2. `pnpm --filter xivdyetools-web-app run type-check && run test`.
