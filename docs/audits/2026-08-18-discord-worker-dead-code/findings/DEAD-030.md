# [DEAD-030]: core — dead constants (`VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`, `SEPARATION_TIER_KEYS`) and `@internal` symbols leaking onto the public barrel

## Category
Unused Export (DEAD) / Barrel hygiene

## Location
**DEAD (0 references anywhere):**
- `packages/core/src/constants/index.ts:42` `VISION_TYPES` (`@internal`, 8 lines) — only `test-build.mjs:106` (itself orphaned, DEAD-031) + docs; bot-logic and web-app define their own
- `constants/index.ts:51` `VISION_TYPE_LABELS` (`@internal`, 8 lines) — English-only labels superseded by the locale `visionTypes` section
- `constants/index.ts:159` `API_DEBOUNCE_DELAY` (`@internal`, 2 lines)
- `config/band-vocabulary.ts:128` `SEPARATION_TIER_KEYS` (5 lines) — comment claims "locale strings key off these"; no locale file or app uses `merged/tight/workable/clear` as keys
- `constants/index.ts:137` `PATTERNS.RGB_COLOR` member — 0 uses (`HEX_COLOR` is live via `isValidHexColor`)

**`@internal` yet barrel-exported (drop from barrel, keep code):** `COLOR_DISTANCE_MAX` (constants:34; used by band-vocabulary/ColorConverter/DyeSearch)

**INTERNAL-ONLY, optional barrel trim (low value; each is used inside core; several are DOCUMENTED — leave unless doing a deliberate API tightening):** `DYE_CATEGORIES`, `DYE_ACQUISITIONS` (only derive types), `deriveDistinguishCuts`, `classifyBandTierWithCuts` (kept "for the ΔE2000-with-user-slider case" — no app uses that yet), `OFF_GRID_DELTA_E2000`, `LODESTONE_BY_REGION`, `XIVDYETOOLS_DOCS_URL`, `BRETTEL_MATRICES`/`MACHADO_MATRICES`, `RGB_*`/`HUE_*`/`SATURATION_*`/`VALUE_*` bounds, `UNIVERSALIS_API_*`/`API_*` tunables, `MemoryCacheBackend`, `SUPPORTED_LOCALES`, `resolveLocaleFromPreference`, `MATCHING_METHODS`, `ACQUISITION_META`, `METALLIC_STAIN_IDS`, `facewearColors`, `getFacewearColor`, `LEGACY_FACEWEAR_ITEM_IDS` (frozen; read by `getFacewearColorByLegacyItemID` ← api-worker `routes/dyes.ts:230` → LIVE), the utils survivors — all **KEEP**.

**Types**: the 30 flagged `export type`s (`ParsedCharaFile`, `DeltaEFormula`, `RYB`, chara/palette/band types, …) are companions of live functions → DOCUMENTED-PUBLIC-API, **KEEP**; exceptions ride with their finding (`CacheMetrics` → DEAD-034, calibration types → DEAD-032, `/blending` `RGB`/`LAB` duplicate `@xivdyetools/types` → DEPRECATIONS.md:244 refactor).

## Evidence
`evidence/track-B-core.md` §1a per-symbol same/core/test/scripts/docs table.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for the DEAD block |
| **Blast Radius** | NONE (`@internal` symbols carry no compatibility promise) |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** the five dead items; drop `COLOR_DISTANCE_MAX` from the barrel; leave the rest.
