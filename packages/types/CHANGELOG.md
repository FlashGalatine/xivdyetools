# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This package is now gated on the monorepo's `knip` dead-code check (`pnpm run lint:dead`, folded
into `lint`; root `knip.jsonc`). Because `@xivdyetools/types` sits at its registry version (2.0.0),
nothing was removed — the first run found 43 barrel exports (2 values, 41 types) with no in-repo
consumer, spread across the root barrel and every domain sub-barrel (`auth`, `color`, `dye`,
`error`, `preset`). Each is tagged `@public` on its export specifier (published `.d.ts` contract,
deliberately kept without an in-repo consumer) rather than removed.

## [2.0.0] - 2026-08-16

Monorepo 2.0 / Web-App 5.0 release. The intermediate **1.16.0** bump (2026-07-31, schema v2 types + `CMYK`) was never published — npm still has 1.15.0 — so it is folded into this entry rather than listed separately.

### ⚠️ BREAKING

- **`createDyeId()` validates the stainID window (1–254)** — a `DyeId` is now a stainID, the canonical key of the schema-v2 dye table. The old 1–200 window and the pre-v2 synthetic negative Facewear range (`<= -1000`) are rejected (Facewear colours are `FacewearColor`s, not dyes; the frozen legacy map lives in `@xivdyetools/core`). No production caller existed; if you minted `DyeId`s from itemIDs or the negative range, stop — use `dye.stainID`
- **`SubRace` `'Helion'` → `'Helions'`** (the identifier now matches the game's plural and the `.chara` character files; a rename was chosen over an alias). `RACE_SUBRACES.Hrothgar` and `SUBRACE_TO_RACE` follow, and the localization `ClanKey` `'helion'` → `'helions'`. **Migration:** consumers persisting a subrace (localStorage, KV, URL state) must map the stored `'Helion'` to `'Helions'` on read — `@xivdyetools/core`'s `parseCharaFile` and the web app already do; the Discord bot's clan preferences stored the display plural, so no KV rewrite is needed there.
- **`PresetCategory` loses `'community'`** — community-ness is a *source*, not a category — and gains **`'appearance'`**, **`'zones'`**, **`'raids-trials'`**: `'jobs' | 'grand-companies' | 'seasons' | 'events' | 'aesthetics' | 'appearance' | 'zones' | 'raids-trials'`. `appearance` is deliberately not `character` (`kind: 'character'` is the CollectionService record type); `raids-trials` excludes dungeons and must never be called "duties". Exhaustive `Record<PresetCategory, …>` maps must add the three new keys and drop `community`. Operator step: presets-api D1 migration `0007_drop_community_category.sql` removes the stored category.
- **`PresetPalette.dyes` is documented as stainIDs (3–6 per palette)** — was itemIDs (2–5). The field type is unchanged (`number[]`), but the meaning is: `@xivdyetools/core`'s `presets.json` 2.0.0 stores stainIDs and resolves via `getByStainId`; anything treating a curated palette's `dyes` as itemIDs is now wrong. (Community presets in `CommunityPreset.dyes` / `PresetSubmission.dyes` are migrated to stainIDs by presets-api's `scripts/migrate-dyes-to-stainids.ts` in the same release, and the API's 2–5 range guard became 3–6 with a loud legacy-range rejection.)
- **`CommunityPreset` gains two required fields** — `secondary_categories: PresetCategory[]` and `preview_image_status: 'none' | 'pending' | 'approved'` — so every object literal typed as `CommunityPreset` (fixtures, mocks, serialisers) must supply them.

### Added

- **`FacewearColor`** (`dye/facewear.ts`, exported from the root and `@xivdyetools/types/dye`) — `{ id: string slug; name: string; hex: string }`. Facewear glasses colours are **not** dyes: schema v2 (2026-07-31) moved the 11 entries out of the dye database into `@xivdyetools/core`'s `facewearColors` collection, and tools that accept both take a discriminated union (a `FacewearColor` has a string `id`; a `Dye` has numeric identifiers). The `Dye` interface itself is unchanged — the runtime dye object keeps its full 16-field shape and `Dye.itemID` is still always a `number` (`createDyeId` still accepts the frozen legacy `<= -1000` synthetic range for persisted references).
- **`CMYK`** colour interface (`{ c, m, y, k }`, 0–100 %) — naive device-independent conversion, display/reference values, not print production. Exported from the root and `@xivdyetools/types/color`.
- **`Race`** is now re-exported from the package root (previously subpath-only) because `@xivdyetools/core`'s `.chara` parser needs it in its public API.
- **`HarmonyTypeKey`** gains `'invertedTetradic'` (the mirror rectangle of tetradic; core's `findInvertedTetradicDyes`).
- **Community preset multi-category + preview-image + example-link fields:**
  - `CommunityPreset.secondary_categories: PresetCategory[]` (required; up to two extra categories, never containing `category_id` — the gallery matches on either slot) and `PresetSubmission.secondary_categories?` / `PresetEditRequest.secondary_categories?` (`[]` clears).
  - `PresetEditRequest.category_id?` — the edit form can now change the primary category.
  - `CommunityPreset.example_link?: string | null`, `PresetSubmission.example_link?`, `PresetEditRequest.example_link?` (null clears) — a page URL on an allowlisted host (glamour destinations such as Eorzea Collection, Mirapri, the Lodestone, and social posts on X, Bluesky, Reddit, Instagram, pixiv, Misskey; raw image hosts deliberately excluded — `EXAMPLE_LINK_HOSTS` in presets-api's validation-service is authoritative). Stored as a link, never a copy of the image. Operator step: presets-api D1 migration `0008_add_example_link.sql`.
  - `CommunityPreset.preview_image_url?: string | null` — present **only** when a moderator has approved the author-uploaded picture (the serialiser omits it for every other status; that omission is the moderation gate) — and `CommunityPreset.preview_image_status` (required; a status label safe to serialise everywhere so the edit form can say "under review"). Operator step: presets-api D1 migrations `0009_add_preview_image.sql` and `0010_add_secondary_categories.sql` back the two new required fields.
  - `CommunityPreset.rejection_reason?: string | null` — the latest moderation reject reason, populated only on the author's own-submissions listing (8S My Submissions); null elsewhere.
- **`PresetSortOption`** (`'popular' | 'recent' | 'name'`, `preset/request.ts`) — restored after the 2026-08-18 dead-code audit (DEAD-025) flagged it chain-dead; web-app had kept two local copies instead of importing it (`services/hybrid-preset-service.ts`, `shared/tool-config-types.ts`) and now imports this export from both. `PresetFilters.sort` uses it in place of the inline literal union.

### Changed

- `README.md` / `CLAUDE.md` refreshed for the branch state: `FacewearColor` in the module map, the synthetic Facewear ID range documented as a frozen legacy range rather than a live scheme, `stainID` described as the canonical key, subpath table completed (`/character`, full colour set), JWT issuer example updated to `auth.xivdyetools.app`, licensing / Square Enix legal notice added, Blog link dropped — docs only.

### Removed (2026-08-18 dead-code audit)

- `createSnowflake()` / `DiscordSnowflake` (`auth/discord-snowflake.ts`) — zero adoption since the Feb audit already dropped them from the main barrel; `isValidSnowflake()` is untouched and still exported (from the root and `/auth`).
- The whole `dye/database.ts` file and its `DyeDatabase` interface — zero references, and the name collided with `@xivdyetools/core`'s real `DyeDatabase` class in every grep. `README.md:103`'s example import fixed to drop it.
- `OAuthState` (`auth/jwt.ts`) — oauth's real OAuth-flow state shape is `StateData` in `apps/oauth/src/utils/state-signing.ts`, with different fields; this type was never actually shared. Trimmed the matching re-export line from `apps/oauth/src/types.ts`.
- `PresetSortOption` — only reached the discord/moderation-worker `types/preset.ts` shims as a dead re-export (discord-worker's copy was already trimmed in an earlier Wave 3 task); web-app defines its own two copies independently (out of scope here, recorded in the report). Its one real use — `PresetFilters.sort` — now has the union `'popular' | 'recent' | 'name'` inlined directly instead of a separately-exported alias nothing imported by name. Trimmed the re-export line from `apps/moderation-worker/src/types/preset.ts`.
- `ModerationResponse` + its `ModerationSuccessResponse`/`ModerationErrorResponse` constituents, and `CategoryListResponse` (`preset/response.ts`) — presets-api's handlers never typed their responses with any of the four; only reached presets-api's `types.ts` shim as a dead re-export, which is trimmed too.
- `CharacterColorCategory` + `COLOR_GRID_DIMENSIONS` (`character/index.ts`) — zero consumers; every app that renders a character-color grid computes its row/column position dynamically from array length rather than reading a static dimensions table, so there was no local duplicate to adopt this into. `SharedColorCategory` / `RaceSpecificColorCategory` (still consumed by core's `CharacterColorService`) are unaffected.
- **`MODERATION_LIMITS`, `RACE_SUBRACES`/`SUBRACE_TO_RACE` — kept, adopted instead of removed** (see `@xivdyetools/worker-kit`'s and this same date's entries below): `RACE_SUBRACES`/`SUBRACE_TO_RACE` had zero importers at audit time; `apps/discord-worker/src/types/preferences.ts` (`CLANS_BY_RACE`), `apps/og-worker/src/services/svg/dye-helpers.ts` (`ALL_SUBRACES`), and web-app's `swatch-tool.ts` / `v4/config-sidebar.ts` (`RACE_GROUPS`) now derive their race/clan sets from these tables via thin per-app display-name/order adapters, instead of hand-rolling their own copies of the same game-data fact.
- **Not removed — kept as internal-only, matching the existing `AuthUser` precedent:** `XIVAuthSocialIdentity` (`auth/xivauth.ts`) is structurally required as the array element type of `XIVAuthUser.social_identities`, which `apps/oauth/src/handlers/xivauth.ts` reads at runtime (`social_identities?.length`, `.find(...)`) — the finding's "chain-dead" call only reflects that nothing imports the type *by name* outside this package, the same situation `AuthUser` (a field of the live `AuthSuccessResponse`) is already in.
- **`JobKey` / `GrandCompanyKey`** (`localization/index.ts`) and the corresponding `LocaleData.jobNames` / `LocaleData.grandCompanyNames` fields (DEAD-036, in lockstep with `@xivdyetools/core`) — fed only `LocalizationService.getJobName()` / `getGrandCompanyName()`, which had zero external consumers; the FFXIV job/Grand-Company locale sections they described are dropped from core's generated locale JSON in the same sweep.

## [1.15.0] - 2026-07-19

2026-07-18 audit remediation (Sprints 4 & 6).

### Added

- **Shared match-quality tiers (REFACTOR-004)**: `MATCH_QUALITY_TIERS`, `classifyMatchDistance()`, and `MatchQualityKey` in the color module — the single source of truth for the RGB-distance quality thresholds previously duplicated four times across `@xivdyetools/bot-logic` and `@xivdyetools/svg` with inconsistent boundary operators (a distance of exactly 10 was "excellent" in one copy and "good" in another). Semantics standardized on inclusive `<=` boundaries.

## [1.14.0] — 2026-04-29

### Removed

- **DyeTypeFilters.excludeAlliedSocietyDyes**: The Allied Society dye filter has been removed. All dyes flagged by this filter (Amalj'aa / Ixali / Sahagin / Kobold / Sylphic vendors) no longer exist as distinct acquisition rows in `colors_xiv.json` — the Patch 7.5 dye consolidation collapsed them into the standard Dye Vendor / Firmament / Cosmic Exploration sources. The filter was already a no-op against current data; removing the field eliminates the dead surface. Stored preferences referencing this key are silently ignored.

### Added

- **REFACTOR-001** (2026-04-28 audit): New key types `ToolKey` and `SheetKey` for og-worker / web-app display-name localization, alongside three new optional fields on `LocaleData`:
  - `tools?: Record<ToolKey, string>` — six web-app tool display names (e.g. "Harmony Explorer" / "ハーモニーエクスプローラー")
  - `visions?: Record<VisionType, string>` — compact vision-name forms for OG embed titles, sibling to the existing verbose `visionTypes`
  - `sheets?: Record<SheetKey, string>` — Swatch Matcher color-sheet category labels (eye colors, lip colors, etc.)

  All three fields are optional so older locale JSONs without them remain valid; `TranslationProvider` falls back to `formatKey()` when the field is absent.

---

## [1.13.0] - 2026-04-07

### Changed

- **REFACTOR-003**: Removed `@internal` annotations from `DiscordSnowflake` type and `createSnowflake` function — both are now part of the public API and will appear in published `.d.ts` declarations
- **REFACTOR-006**: Added `stripInternal: true` to `tsconfig.build.json` — all remaining `@internal`-annotated symbols are now excluded from the published `.d.ts` output

---

## [1.12.0] - 2026-04-03

### Added

- `DyeTypeFilters` interface with 9 optional boolean fields for dye type and acquisition source filtering
- Re-exported `DyeTypeFilters` from `dye/index.ts` and package index

---

## [1.10.0] - 2026-03-14

### Added

- `consolidationType` field on `Dye` interface (`'A' | 'B' | 'C' | null`) for Patch 7.5 dye consolidation market board lookups
- `isIshgardian` field on `Dye` interface (`boolean`) for Ishgardian Restoration dye identification

---

## [1.9.0] - 2026-03-01

### Removed

- **DEAD-061**: Entire utility module — `Result<T,E>`, `AsyncResult<T,E>`, `Nullable<T>`, `Optional<T>`, `isOk()`, `isErr()` (zero consumers; Rust-inspired Result pattern never adopted)
- **DEAD-063**: Generic API response types — `APISuccessResponse<T>`, `APIErrorResponse`, `APIResponse<T>` (zero consumers; each worker defines its own response types)
- **DEAD-060**: Orphaned preset types — `ResolvedPreset` (migrated to `@xivdyetools/core` PresetService), `AuthenticatedPresetSubmission` (zero consumers; auth handled via middleware)
- **DEAD-057**: 11 preset response sub-types removed from main barrel — `PresetSubmitCreatedResponse`, `PresetSubmitDuplicateResponse`, `PresetSubmitErrorResponse`, `PresetEditDuplicateInfo`, `PresetEditSuccessResponse`, `PresetEditDuplicateResponse`, `PresetEditErrorResponse`, `VoteSuccessResponse`, `VoteErrorResponse`, `ModerationSuccessResponse`, `ModerationErrorResponse` (consumers use union types; still accessible via `@xivdyetools/types/preset`)
- **DEAD-058**: 7 auth response sub-types removed from main barrel — `AuthSuccessResponse`, `AuthErrorResponse`, `RefreshSuccessResponse`, `RefreshErrorResponse`, `UserInfoData`, `UserInfoSuccessResponse`, `UserInfoErrorResponse` (consumers use union types; still accessible via `@xivdyetools/types/auth`)
- **DEAD-059**: `DiscordSnowflake` branded type and `createSnowflake()` removed from main barrel (zero adoption; `isValidSnowflake()` still exported; still accessible via `@xivdyetools/types/auth`)
- **DEAD-060**: `CharacterColorCategory` removed from main barrel (zero direct consumers; still accessible via `@xivdyetools/types/character`)
- **DEAD-064**: 6 core-only types removed from main barrel — `Matrix3x3`, `Race`, `SharedColorCategory`, `RaceSpecificColorCategory`, `LocalizedDye`, `DyeDatabase` (only consumed by core internals; still accessible via subpath imports)

### Changed

- Marked 31 symbols `@internal` in source files (DEAD-057, DEAD-058, DEAD-059, DEAD-060, DEAD-064)

---

## [1.8.0] - 2026-02-19

### Added

- **FINDING-002**: `DiscordSnowflake` branded type with `isValidSnowflake()` and `createSnowflake()` validation utilities
  - Replaces inline `/^\d{17,19}$/` regex scattered across 4 consumer files
  - Accepts 17-20 digit numeric strings (future-proofed for Discord snowflake growth)
  - Exported from `@xivdyetools/types` auth module

---

## [1.7.0] - 2026-01-19

### Changed

- **TYPES-REF-002**: Implemented discriminated unions for all response types using `success: true` / `success: false` literal types for proper TypeScript type narrowing
  - `AuthResponse`, `RefreshResponse`, `UserInfoResponse` - Auth module responses
  - `APIResponse<T>` - Generic API wrapper
  - `PresetSubmitResponse`, `PresetEditResponse`, `VoteResponse`, `ModerationResponse` - Preset module responses
  - Consumers now get full type safety with `if (response.success)` narrowing

---

## [1.6.0] - 2026-01-17

### Added

- **OKLAB Color Type**: Modern perceptually uniform color space (Björn Ottosson, 2020)
  - `L`: Perceived lightness (0 to 1)
  - `a`: Green-Red axis (approximately -0.4 to 0.4)
  - `b`: Blue-Yellow axis (approximately -0.4 to 0.4)
  - Fixes CIELAB's blue color distortion for better color mixing

- **OKLCH Color Type**: Cylindrical form of OKLAB
  - `L`: Perceived lightness (0 to 1)
  - `C`: Chroma - colorfulness (0 to ~0.4)
  - `h`: Hue angle (0-360 degrees)
  - Ideal for gradient interpolation and hue-based operations

- **LCH Color Type**: Cylindrical form of CIE LAB
  - `L`: Lightness (0-100)
  - `C`: Chroma - colorfulness (0 to ~150)
  - `h`: Hue angle (0-360 degrees)
  - Useful for hue-based interpolation with direction control

- **HSL Color Type**: Hue-Saturation-Lightness
  - `h`: Hue (0-360 degrees)
  - `s`: Saturation (0-100 percent)
  - `l`: Lightness (0-100 percent)
  - Common in design tools (Photoshop, Figma, CSS)

---

## [1.5.0] - 2026-01-11

### Added

- **Market Listing Source**: Added world identification fields to `PriceData` interface
  - `worldId?: number` - World ID where the minimum price listing is from (Universalis worldId)
  - `worldName?: string` - World name where the minimum price listing is from
  - Enables displaying which specific world has the cheapest listing when fetching data center prices
  - Can be mapped to world name using worlds.json data

---

## [1.4.0] - 2026-01-11

### Added

- **LAB Color Type**: New `LAB` interface for CIE LAB perceptually uniform color space
  - `L`: Lightness (0-100)
  - `a`: Green-Red axis (approximately -128 to 127)
  - `b`: Blue-Yellow axis (approximately -128 to 127)
  - Enables DeltaE color difference calculations in `@xivdyetools/core`
  - Used for perceptually accurate color matching in harmony generation

---

## [1.3.0] - 2026-01-08

### Added

- **Character Color Types**: New `@xivdyetools/types/character` module for FFXIV character customization colors
  - `CharacterColor` interface: Represents a single color option in the character creator
  - `CharacterColorMatch` interface: Result from matching a character color to dyes
  - `SubRace` type: All 16 playable subraces (Midlander, Highlander, Wildwood, etc.)
  - `Gender` type: Character gender options ('Male' | 'Female')
  - `Race` type: All 8 playable races
  - `SharedColorCategory` / `RaceSpecificColorCategory` types for color palette categories
  - `RACE_SUBRACES` constant: Mapping of races to their subraces
  - `SUBRACE_TO_RACE` constant: Mapping of subraces to parent race
  - `COLOR_GRID_DIMENSIONS` constant: Grid dimensions for color palettes

---

## [1.2.0] - 2026-01-08

### Added

- **StainID Field**: Added `stainID: number | null` field to the `Dye` interface
  - Contains the game's internal stain table ID (1-125) from Stain.exh
  - Value is `null` for Facewear dyes which don't have stain table entries
  - Enables lookup by game data stain ID for integration with other tools

---

## [1.1.1] - 2025-12-24

### Documentation

- **TYPES-101**: Added documentation about branded types runtime validation limitation
  - Clarified that TypeScript cannot enforce use of `create*` helper functions
  - Added best practices guidance to avoid bypassing validation with type assertions
  - Updated module header in `src/color/branded.ts`

- **TYPES-103**: Added documentation about Dye field presence guarantee
  - Clarified all Dye interface fields are required and non-nullable
  - Added guidance for consumers about safe field access
  - Updated module header in `src/dye/dye.ts`

---

## [1.1.0] - 2025-12-24

### Added

- **TYPES-102**: Extended `createDyeId` to support synthetic Facewear dye IDs
  - Regular FFXIV dye IDs (1-200) continue to be supported
  - Synthetic IDs (<= -1000) are now accepted for Facewear dyes
  - Synthetic IDs are generated by DyeDatabase for Facewear dyes lacking real itemIDs
  - Updated documentation to explain the ID ranges

### Changed

- Updated `DyeId` type documentation to clarify valid ID ranges:
  - Regular dyes: 1-200
  - Synthetic Facewear dyes: negative numbers <= -1000

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of `@xivdyetools/types`
- Core color types: `RGB`, `HSV`, `OKLCH`, `LAB`
- Branded types for type safety:
  - `HexColor` with `createHexColor()` validator
  - `DyeId` with `createDyeId()` validator
  - `Hue` with `createHue()` normalizer
  - `Saturation` with `createSaturation()` clamper
  - `Brightness` with `createBrightness()` clamper
  - `Lightness` with `createLightness()` clamper
- Dye-related types:
  - `Dye` interface with comprehensive dye data
  - `DyeCategory` union type
  - `LocalizedDye` for multi-language support
- Preset types:
  - `Preset` and `PresetDye` interfaces
  - `GearSlot` union type
- Authentication types:
  - `User` and `AuthToken` interfaces
  - OAuth-related types
- API types:
  - `PriceData` and `MarketBoardData`
  - Request/response types for various endpoints
- Error types:
  - `AppError` class with error codes
  - `ErrorCode` union type
- Localization types:
  - `Locale` union type
  - Translation interfaces
