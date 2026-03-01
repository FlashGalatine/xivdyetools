# DEAD-045: 13 utility functions exported but unused by any service or consumer

## Category
Unused Exports

## Location
- File(s): `packages/core/src/utils/index.ts`
- Line(s): Various (see table below)
- Symbol(s): `lerp`, `distance`, `unique`, `groupBy`, `sortByProperty`, `filterNulls`, `isString`, `isNumber`, `isArray`, `isObject`, `isNullish`, `AsyncLRUCache`, `isAbortError`

## Evidence
Cross-referencing all internal service files (`src/services/**/*.ts`, excluding tests) and all external consumers in the monorepo:

| Utility | Internal Service Usage | External Consumer Usage | Test Coverage |
|---------|----------------------|------------------------|---------------|
| `lerp` | None | None | Yes |
| `distance` | None | None | Yes |
| `unique` | None | None | Yes |
| `groupBy` | None | None | Yes |
| `sortByProperty` | None | None | Yes |
| `filterNulls` | None | None | Yes |
| `isString` | None | None | Yes |
| `isNumber` | None | None | Yes |
| `isArray` | None | None | Yes |
| `isObject` | None | None | Yes |
| `isNullish` | None | None | Yes |
| `AsyncLRUCache` | None | None | Yes |
| `isAbortError` | None | None | **No** |

For reference, utilities that **are** used internally:
- `LRUCache` → ColorConverter.ts, ColorblindnessSimulator.ts
- `clamp` → ColorConverter.ts, ColorblindnessSimulator.ts, ColorManipulator.ts, RybColorMixer.ts
- `round` → ColorConverter.ts, ColorblindnessSimulator.ts
- `isValidHexColor` → ColorConverter.ts
- `isValidRGB` → ColorConverter.ts, ColorblindnessSimulator.ts
- `isValidHSV` → ColorConverter.ts
- `retry` → APIService.ts
- `sleep` → APIService.ts
- `generateChecksum` → APIService.ts (also used by web-app externally)

Total lines for 13 unused utilities: ~600 lines (including JSDoc, implementations, and type guards).

## Why It Exists
These were created as a general-purpose utility library when the package was built. The vision was that consumers would use them, but all consumers either have their own utils or don't need these functions.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — no current consumers, but as a public npm package, unknown external consumers outside the monorepo could exist |
| **Blast Radius** | LOW — removing from barrel export doesn't break internal code |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible — package is published to npm; unknown external consumers may use these |

## Recommendation
**KEEP (Mark as @internal candidates)**

### Rationale
As a published npm library, removing public exports is a breaking change. The safest approach is:
1. Add `@internal` JSDoc tags to signal these are not part of the intended public API
2. Stop exporting them from `src/index.ts` in the next major version (v2.0.0)
3. `isAbortError` specifically should either get test coverage or be removed — it's the only untested export in the entire package

### Interim Action
- Add `@internal` markers to the 13 unused utility exports
- Add test coverage for `isAbortError`
- Plan removal for v2.0.0 breaking change release
