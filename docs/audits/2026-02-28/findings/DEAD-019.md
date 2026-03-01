# DEAD-019: Deprecated HarmonyConfig Legacy Fields

## Category
Legacy Code

## Location
- File(s): `src/shared/tool-config-types.ts`
- Line(s): ~52-58
- Symbol(s): `showHex?`, `showRgb?`, `showHsv?`, `showLab?` on `HarmonyConfig` interface

## Evidence
These interface fields are marked `@deprecated` as legacy migration fields. They exist solely for type compatibility during migration from old storage format. If migration is complete, these fields are dead weight.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — need to verify migration is complete |
| **Blast Radius** | LOW — interface field removal |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possibly used in storage-service migration code |

## Recommendation
**REMOVE WITH CAUTION**

### Rationale
- Minor cleanup (~6 lines)
- Verify that no config migration code still reads these fields

### If Removing
1. Check if `src/services/config-controller.ts` still references these fields for migration
2. If not referenced, remove the deprecated fields from `HarmonyConfig`
3. Run build + tests to verify
