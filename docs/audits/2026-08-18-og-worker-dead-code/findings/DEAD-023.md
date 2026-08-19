# [DEAD-023]: Exports with no production importer (test-only or internal-only)

## Category
Unused Export (test-only tier — kept for testability unless noted)

## Location / Evidence (`symrefs-out.txt`)
| Symbol | File | prod refs | test refs | Note |
|---|---|---|---|---|
| `generateHarmonyOGData` … `generateAccessibilityOGData` (×6) | og-data-generator.ts | self only | 5–7 each | index.ts imports only `generateOGDataForTool` / `generateOGHTML` |
| `detectCrawler` | crawler-detector.ts | self only | 19 | `detectCrawlerFromRequest` is the prod entry |
| `initRenderer`, `renderSvgToPng` | renderer.ts | self only | **0** | coverage-excluded file; nothing outside uses them |
| `X_STRIP_SCALE` | band.ts | self only | 0 | `xStrip()` is the API |
| `harmonyToKey` | translator.ts | 0 external | 0 | og-data-generator has its own copy (DEAD-011) |
| `DyeMatch`, `OgDeckStrings` | dye-helpers.ts / og-strings.ts | internal | 0 | return/record types — fine to export |
| `OG_DECK`, `TOOL_TAG`, `OG_DECK_LINE` | og-strings.ts | self only | 3–5 | also parsed *textually* by `subset-cjk-fonts.py` — must stay `export const` at two-space indent |

## Recommendation
**KEEP** the `generate*OGData` ×6 and `detectCrawler` (unit-tested units; making them private would force testing through the router). **REMOVE the `export`** on `initRenderer`, `renderSvgToPng`, `X_STRIP_SCALE` (zero consumers of any kind), and on translator's `harmonyToKey` once DEAD-011 makes it the shared one — then it *is* used, keep. Net ~0 lines; this is hygiene so knip stays quiet after DEAD-008/013.
