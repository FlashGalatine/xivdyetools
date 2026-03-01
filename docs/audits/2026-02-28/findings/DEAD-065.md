# DEAD-065: 5 subpath exports with zero or near-zero consumers

## Category
Unused Exports (Package Configuration)

## Location
- File(s): `packages/types/package.json` (exports map)
- Symbol(s): Subpath exports `./color`, `./character`, `./api`, `./error`, `./localization`

## Evidence
Consumer analysis of all 8 subpath exports:

| Subpath | Direct Consumers | Who |
|---------|:---:|-----|
| `./color` | **0** | Nobody. Apps import `VisionType`, `HexColor` etc. from the main barrel. |
| `./dye` | **2** | discord-worker `test-utils.ts`, packages/test-utils `factories/dye.ts` |
| `./character` | **0** | Nobody. Apps import `SubRace`, `Gender` etc. from the main barrel. |
| `./preset` | **2** | discord-worker `test-utils.ts`, packages/test-utils `factories/preset.ts` |
| `./auth` | **2** | packages/test-utils `auth/context.ts`, `factories/user.ts` |
| `./api` | **0** | Nobody. |
| `./error` | **0** | Nobody. Apps import `ErrorCode`, `AppError` from the main barrel. |
| `./localization` | **0** | Nobody. |

The main barrel (`@xivdyetools/types`) has 60+ import sites. The 3 used subpaths (`./dye`, `./preset`, `./auth`) are only used by test utility code.

**5 subpath exports have zero consumers:** `./color`, `./character`, `./api`, `./error`, `./localization`.

## Why They Exist
Subpath exports enable tree-shaking and targeted imports. They were created when the package was restructured into sub-modules. However, the types package is small enough (~2.5KB source) that tree-shaking provides negligible benefit, and consumers prefer the convenience of the main barrel.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — exhaustive grep for all import patterns |
| **Blast Radius** | LOW — removing subpath exports is a breaking change, but no one uses them |
| **Reversibility** | EASY — add exports back to package.json |
| **Hidden Consumers** | UNLIKELY — workspace-internal package |

## Recommendation
**KEEP** (low cost to maintain, breaking change to remove)

### Rationale
Subpath exports in `package.json` have near-zero maintenance cost (a few lines of JSON). Removing them is technically a breaking change and provides no real benefit. The 3 used subpaths (`./dye`, `./preset`, `./auth`) serve test utilities well by enabling targeted imports.

The 5 unused subpaths could be removed at the next major version to simplify the package, but this is low priority.

### Notes
- If adopting the subpath-first pattern, consider deprecating the main barrel and directing consumers to subpaths
- If keeping main-barrel-first pattern, document that subpaths are optional for tree-shaking scenarios
