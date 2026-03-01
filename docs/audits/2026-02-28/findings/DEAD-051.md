# DEAD-051: Orphaned `compare-scrapes.js` script

## Category
Orphaned Files

## Location
- File(s): `packages/core/scripts/compare-scrapes.js`
- Line(s): 1–171
- Symbol(s): N/A (script)

## Evidence
`compare-scrapes.js` (171 lines) is an ESM script that compares HTML scrapes stored in a `scrapes/` directory. However:

1. **No `scrapes/` directory exists** anywhere in the repository
2. **Not referenced** by any `package.json` script or CI pipeline
3. **Only mention** is a historical entry in `CHANGELOG.md`
4. Last modified: 2026-02-18 (initial commit alongside all other scripts)

The script parses HTML files from a `scrapes/` directory and compares dye data between different scrape dates. This was a manual web-scraping comparison tool.

## Why It Exists
Historical utility for comparing XIVAPI or game data scrapes during dye database updates. The scrape data it processed has been deleted (or was never committed).

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — depends on non-existent directory |
| **Blast Radius** | NONE |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
171 lines referencing a non-existent `scrapes/` directory. Cannot be run without manual setup of missing data. Git history preserves it if ever needed.

### If Removing
1. Delete `scripts/compare-scrapes.js`
2. Update `scripts/README.md` if it references this script
