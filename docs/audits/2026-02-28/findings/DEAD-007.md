# DEAD-007: ToolHeader Component

## Category
Orphaned File

## Location
- File(s): `src/components/tool-header.ts` (57 lines)
- Symbol(s): `ToolHeader` class, `ToolHeaderOptions` interface

## Evidence
Knip flagged as unused file. Manual verification confirms `ToolHeader` and `ToolHeaderOptions` are never imported by any file. The only matches for "tool-header" are CSS class names (`.tool-header`) in other files, which are unrelated CSS strings not imports. The component is also not re-exported from the barrel.

## Why It Exists
A generic tool header component that was likely superseded by the v4 `ToolBanner` Lit component.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import references |
| **Blast Radius** | NONE — isolated file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 57 lines removed

### If Removing
1. Delete `src/components/tool-header.ts`
2. Run build + tests to verify
