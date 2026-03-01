# DEAD-014: Unused UI Icons and Lookup Functions

## Category
Unused Export

## Location
- File(s): `src/shared/ui-icons.ts` (630 lines)
- Symbol(s): `UI_ICONS` record, `getUIIcon()` function, and 12 individual icon constants

## Evidence
- `UI_ICONS` record and `getUIIcon()` — Only used in `icons.test.ts`. Never in production code. Dead exports.
- Individual unused icons (never directly imported by any production file):
  - `ICON_TEST_TUBE`
  - `ICON_BEAKER_PIPE`
  - `ICON_INFO`
  - `ICON_LOGO`
  - `ICON_ZAP`
  - `ICON_CHART`
  - `ICON_KEYBOARD`
  - `ICON_SAVE`
  - `ICON_SHARE`
  - `ICON_ZOOM_FIT`
  - `ICON_ZOOM_WIDTH`
  - `ICON_SEARCH` (note: the one in empty-state-icons.ts IS used, but the one in ui-icons.ts is not)

These icons are all included in the `UI_ICONS` map (which is dead), so they exist solely to populate an unused lookup table.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — only used in icon completeness test |
| **Blast Radius** | LOW — need to update test |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Removes ~120 lines of unused icon constants and lookup code
- Large SVG strings carry non-trivial weight

### If Removing
1. Remove `UI_ICONS` record and `getUIIcon()` from `src/shared/ui-icons.ts`
2. Remove unused individual icon constants
3. Update `src/shared/__tests__/icons.test.ts` to reflect the actual exports
4. Run build + tests to verify
