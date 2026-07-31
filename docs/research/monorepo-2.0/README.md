# XIV Dye Tools — Monorepo 2.0 / Web-App 5.0

Research and planning documents for the version 5.0 upgrade of the XIV Dye Tools web app and the second-generation cleanup of the monorepo. The organizing principle is **"trim the fat"**: rebuild components from the ground up where that is simpler than carrying them forward, deprecate packages and apps whose purpose has lapsed, and align the data model with the game's own data model rather than our historical one.

> **Status:** Research phase. No code changes are made by these documents.
> **Started:** 2026-07-30

## Decisions Already Made

These were decided at the start of this effort and are treated as fixed inputs by the documents below:

| Decision | Choice | Notes |
|----------|--------|-------|
| `maintainer` app | **Deprecate** | Dye additions become a documented, Claude-assisted workflow driven by game data (`Stain.csv`, `StainTransient.csv`, Glamourer/companion plugin sources) instead of a bespoke Vue editing UI. |
| Web-app themes | **Light + Dark only** | Novelty themes are removed. The two remaining themes are being redesigned in Claude Design (in progress, outside this research). |
| Dye identity | **stainID-first** | Future dyes may ship without individual itemIDs — only a `consolidationType` resolving to a consolidated "Spectrum" dye item. `stainID` (the game's Stain sheet row ID) becomes the canonical identifier; itemIDs become a market-board resolution concern. |
| Web-app UI | Mobile-friendly redesign | In progress by the maintainer (Claude Design); out of scope for these documents except where backend/API shape is affected. |
| Backend | Leaner and more efficient | Candidate worker/package consolidation is researched here. |

## Decisions Resolved During Research (2026-07-30)

| Question | Decision |
|----------|----------|
| B-type consolidated dye price | **100 Skybuilders' Scrips** (confirmed in game). `consolidated-ids.ts:72` is wrong on both value and spelling — see doc 01 §6 ledger. |
| Metallic filter semantics | **Gloss** — adopt the Stain sheet's `IsMetallic` set (16 dyes, incl. Gunmetal Black + Pearl White), not name-prefix inference (14). |
| `isCosmic` / `isIshgardian` semantics | Derived flags: cosmic ≡ `consolidationType === 'C'`, ishgardian ≡ `consolidationType === 'B'`. Fixes the current Firmament-pollution bug in "Exclude Cosmic". |
| Package consolidation | **Tier 1 merges approved** (12 → 8 packages): crypto→auth, bot-i18n→bot-logic, worker-middleware+rate-limiter→worker-kit, color-blending→`core/blending`; unpublish test-utils. See doc 05 §6. |
| `stoat-worker` | **Parked** — kept in repo, no 5.0 investment; no current demand. Revisit if Discord privacy concerns grow. |
| Facewear colors | **Moved out of the dye table** into a small separate collection (`facewear_colors.json`); tools use a `Dye \| FacewearColor` discriminated union. The synthetic negative-ID hack is retired (one-time mapping for persisted IDs — doc 02). |

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [Dye Data Format](./01-dye-data-format.md) | Analysis of `colors_xiv.json`, per-field usage audit, the game's Stain/StainTransient model, and a proposed stainID-keyed schema v2 |
| 02 | [stainID Migration](./02-stainid-migration.md) | Every boundary where an itemID is serialized today, what must stay itemID (Universalis), and a phased migration plan |
| 03 | [Maintainer Deprecation](./03-maintainer-deprecation.md) | What the maintainer app does, what must be preserved as a documented workflow, and the cleanup checklist |
| 04 | [Theme Consolidation](./04-theme-consolidation.md) | Current theme inventory and the scope of reducing to Light + Dark |
| 05 | [Package & App Audit](./05-package-and-app-audit.md) | All 12 packages and 11 apps: size, consumers, overlap, merge/deprecate candidates, and the web-app backend dependency map |

## Reference Material (external to the repo)

| Source | Location | What it provides |
|--------|----------|------------------|
| `Stain.csv` | `C:\dev\ClonedProjects\Stain.csv` | Game Stain sheet export: stainID → name, packed RGB color, Shade (category group), SubOrder (display order), IsMetallic, IsHousingApplicable. 125 real rows + row 0 ("No Color") + empty rows 126–128. |
| `StainTransient.csv` | `C:\dev\ClonedProjects\StainTransient.csv` | Game stain→item mapping: stainID → Item1 (and Item2 for the 20 Venture Coffer specials). This is the game's own version of our consolidation resolution. |
| Glamourer / Glamourer.Api | `C:\dev\ClonedProjects\Glamourer*` | How the Dalamud plugin ecosystem models stains (stainID-native, two dye channels per slot). |
| Penumbra.GameData | `C:\dev\ClonedProjects\Penumbra.GameData` | The `StainId` primitive and Stain sheet access used by Glamourer. |

## Related Prior Research

- [`../monorepo-consolidation/`](../monorepo-consolidation/README.md) — the original 15-repos→monorepo migration (Monorepo 1.0). Its structure decisions (pnpm, Turborepo, shared tsconfig) carry forward.
- [`../patch-7.5/dye-consolidation.md`](../patch-7.5/dye-consolidation.md) — the dye consolidation research that introduced `consolidationType` and `getMarketItemID()`.
- [`../api/`](../api/README.md) — public API design research (api-worker). Relevant to itemID compatibility in public endpoints.
