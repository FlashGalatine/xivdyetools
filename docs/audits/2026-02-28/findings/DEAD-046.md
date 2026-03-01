# DEAD-046: 4 constants exported but unused internally and externally

## Category
Unused Exports

## Location
- File(s): `packages/core/src/constants/index.ts`
- Symbol(s): `COLOR_DISTANCE_MAX`, `VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`

## Evidence
Cross-referencing all internal service files and all monorepo consumer imports:

| Constant | Defined At | Internal Service Usage | External Consumer Usage |
|----------|-----------|----------------------|------------------------|
| `COLOR_DISTANCE_MAX` | Line 33 | None | None |
| `VISION_TYPES` | Line 39 | None | None |
| `VISION_TYPE_LABELS` | Line 47 | None | None |
| `API_DEBOUNCE_DELAY` | Line 115 | None | None |

For reference, all other exported constants are used by at least one internal service or one external consumer.

`COLOR_DISTANCE_MAX` is the theoretical max Euclidean RGB distance (~441.67). It was likely intended for normalizing color distances but is never referenced.

`VISION_TYPES` and `VISION_TYPE_LABELS` provide the list of supported colorblind vision types and their human-readable labels. The `ColorblindnessSimulator` uses `BRETTEL_MATRICES` directly but never references `VISION_TYPES` or `VISION_TYPE_LABELS`.

`API_DEBOUNCE_DELAY` (500ms) was intended for Universalis API debouncing but `APIService.ts` uses its own constructor options pattern instead.

## Why It Exists
Created as part of the constants system for potential consumer use. Three of the four relate to color accessibility features that are consumed through the `ColorService` facade instead.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — no current consumers, but published npm package |
| **Blast Radius** | NONE — no internal code uses them |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible — external npm consumers |

## Recommendation
**KEEP (Schedule for v2.0.0 removal)**

### Rationale
Same reasoning as DEAD-045: public API removal is a breaking change. These constants are low-maintenance (no logic, just values). Mark for v2.0.0 removal.

### Interim Action
- Add `@internal` or `@deprecated` markers
- Remove from `src/index.ts` in v2.0.0
