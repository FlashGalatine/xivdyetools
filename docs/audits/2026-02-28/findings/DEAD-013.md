# DEAD-013: Unused Empty State Icons and Lookup Functions

## Category
Unused Export

## Location
- File(s): `src/shared/empty-state-icons.ts`
- Symbol(s): `EMPTY_STATE_ICONS` record, `getEmptyStateIcon()` function, `ICON_HARMONY`, `ICON_WARNING`, `ICON_LOADING`

## Evidence
- `EMPTY_STATE_ICONS` record — Only used internally by `getEmptyStateIcon()`. Never imported by other files.
- `getEmptyStateIcon()` — Never imported by any file. Dead export.
- `ICON_HARMONY` — Never imported outside the file.
- `ICON_WARNING` — Never imported outside the file.
- `ICON_LOADING` — Never imported outside the file.

The lookup function pattern (`getEmptyStateIcon(key)`) was never adopted; consumers import individual icon constants directly.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero external references |
| **Blast Radius** | NONE — isolated exports within the file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Removes ~30 lines of dead code
- Simplifies the icon file to only export the individual icons that are used

### If Removing
1. Remove `EMPTY_STATE_ICONS` record from `src/shared/empty-state-icons.ts`
2. Remove `getEmptyStateIcon()` function
3. Remove `ICON_HARMONY`, `ICON_WARNING`, `ICON_LOADING` constants
4. Keep `ICON_SEARCH`, `ICON_PALETTE`, `ICON_COINS`, `ICON_IMAGE`, `ICON_FOLDER`, `ICON_EMPTY_INBOX`
5. Run build + tests to verify
