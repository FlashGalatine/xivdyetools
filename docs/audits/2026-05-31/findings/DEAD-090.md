# DEAD-090: tools-dropdown.ts (v3 Tool Navigation)

## Category
Orphaned File

## Location
- File(s): `src/components/tools-dropdown.ts` (282 lines)
- Symbol(s): `ToolsDropdown` class

## Evidence
The basename `tools-dropdown` appears in no other file; not reached from `main.ts` or any test. Tool navigation in v4 is owned
by `v4/v4-app-header.ts` + `v4/v4-layout-shell.ts` + `RouterService`, not a dropdown component.

- Git: last meaningful commit **2026-02-18** (frozen at the migration commit).

## Why It Exists
The v3 header's "Tools" dropdown menu. The v4 shell replaced top-nav with a header + sidebar navigation model, orphaning it.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — basename appears nowhere else; zero importers |
| **Blast Radius** | NONE — isolated |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — no `<tools-dropdown>` tag in any prod template |

## Recommendation
**REMOVE**

### Rationale
- 282 lines removed.

### If Removing
1. Delete `src/components/tools-dropdown.ts`.
2. `pnpm --filter xivdyetools-web-app run type-check && run test`.
