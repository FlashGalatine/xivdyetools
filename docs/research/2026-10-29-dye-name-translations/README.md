# Dye names from XIVAPI — 2026-10-29

Status: adopted in the source CSV and generated German/French locales; PR review pending.

The maintainer approved XIVAPI as authoritative when our game-data translations disagree. This refresh uses the matching `Stain.Name` field for color names, rather than the different grammatical forms in consumable `Item.Name` labels. Regional Korean and Chinese sources remain in place.

## Capture and adoption

The complete [pre-change capture](manifest.json) enumerated 129 Stain rows, including the terminal empty page, and matched all 125 bundled dyes with no additions or missing identities. The resolved pins are game `0874aee069e1e7c4` and schema `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`. Capture timestamps use UTC; the folder date is the maintainer's America/New_York date.

[Raw pages](raw/stain-page-0001.json), original [local inputs](inputs/dyenames.csv), and the [original report](REPORT.md) are preserved. The report describes the baseline, not the adopted state. [adoption.json](adoption.json) records every changed CSV cell and the before/after CSV hashes.

Rows were joined by canonical `stainID`, then the existing `legacyItemID ?? stainID` CSV key. All four global-language cells were checked against upstream before generating locales.

| Locale | Applied CSV changes | Display-name result |
|---|---|---|
| en | 125 surrounding-whitespace cleanups | No display change |
| ja | None | Already matches |
| de | 118 wording changes and 6 whitespace cleanups | Official color forms, e.g. `Schneeweißer` → `Schneeweiß` |
| fr | 125 capitalization changes | Official case, e.g. `blanc neige` → `Blanc neige` |
| ko / zh | None | Regional sources preserved |

The locale generator already trims surrounding whitespace. That rule remains: upstream has trailing spaces on the English names for Stains 99, 122 and 123. The CSV stores the trimmed names, and the English database and generated English locale remain unchanged. Internal spelling, accents and capitalization follow upstream.

Only German and French generated locale payloads change. Dye count, order, IDs, English database names, colors, acquisition/category policy, consolidation mappings, all Facewear data and regional translations are preserved. The baseline's 22 color differences remain a separate decision.

## Reproduction

From the repository root, choose a new output directory:

```powershell
pnpm --filter @xivdyetools/core run audit:dyes --snapshot docs/research/2026-10-29-dye-name-translations --out <new-baseline-replay-directory>
pnpm --filter @xivdyetools/core run audit:dyes --version 0874aee069e1e7c4 --schema exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb --out <new-current-comparison-directory>
pnpm --filter @xivdyetools/core run build:locales
```

Snapshot replay validates the manifest and reproduces both saved upstream and saved baseline inputs. The pinned live comparison uses today's CSV, so the remaining name differences should be only the three upstream English trailing spaces. `build:locales` must be idempotent after adoption.

This is a maintenance data refresh. It adds no runtime network requests, automatic updates, package publication or deployment.

## Validation

- [verification.json](verification.json): all 500 global names match normalized upstream values; all 250 regional cells and the listed database/Facewear/locale files are unchanged. A fresh pinned comparison leaves only the original 22 color differences and three upstream English trailing spaces, with no source issues.
- Baseline snapshot replay with `fetch` blocked reproduces the saved report exactly. Staged capture bytes also match every manifest digest, so Git newline normalization does not corrupt replay.
- Full workspace gate: 62/62 build, type-check, lint and test tasks; 16,193 tests across 17 workspaces. Existing lint and development-tool warnings remain.
- Root checks: 167/167 script tests, script types, reachability, 34 version claims, 1,037 documentation links and seven Worker log configurations pass.
- Both CJK subset scripts completed; all six before/after cmap sets are identical. Existing committed font bytes are retained to avoid timestamp-only binary changes. The full workspace tests cover font coverage and German/French card layout.
- Independent source/provenance/release review found no blocking issues. Core receives a patch bump because the public npm registry confirmed its prior version was already published.
