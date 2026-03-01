# DEAD-052: Stale `response.json` debug artifact

## Category
Orphaned Files

## Location
- File(s): `packages/core/scripts/response.json`
- Line(s): 1 (single line)

## Evidence
`response.json` contains a single XIVAPI response for item ID 13115 (GP Jet Black Dye). It is:
- Not referenced by any script, test, or build process
- Not imported by any source file
- A single-line minified JSON blob

This is a manual debug artifact — likely saved during development of `fetch_dye_names.py` or the build-locales pipeline.

## Why It Exists
Manual debugging — developer saved an API response for inspection.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — obvious debug artifact |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
Debug artifact with zero references. 1 line, trivial.

### If Removing
1. Delete `scripts/response.json`
