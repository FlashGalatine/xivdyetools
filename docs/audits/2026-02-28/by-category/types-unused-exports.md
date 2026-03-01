# @xivdyetools/types — Unused Exports Summary

## Overview
- **Package:** @xivdyetools/types v1.8.0
- **Total Exports:** 88
- **Externally Consumed:** 40 (45.5%)
- **Dead (zero consumers):** 25 truly dead symbols
- **Core-only (consumed only by core):** 23 symbols (not dead, but not app-facing)
- **Findings:** DEAD-057 – DEAD-065

## Finding Summary

| ID | Title | Dead Symbols | Recommendation |
|----|-------|:---:|----------------|
| DEAD-057 | Preset response sub-types | 11 | Mark @internal |
| DEAD-058 | Auth response sub-types | 7 | Mark @internal |
| DEAD-059 | DiscordSnowflake + createSnowflake | 2 | Mark @internal |
| DEAD-060 | Orphaned preset/character types | 3 | Remove 2, mark 1 @internal |
| DEAD-061 | Utility module (Result pattern) | 6 | Remove |
| DEAD-062 | Localization types (all 9) | 9* | Keep (consumed by core) |
| DEAD-063 | API generic response types | 3 | Remove |
| DEAD-064 | Character/dye core-only types | 6* | Keep, mark @internal |
| DEAD-065 | 5 unused subpath exports | — | Keep (low cost) |

\* These symbols have legitimate internal consumers (core) but zero app-level consumers.

## Dead Code by Module

| Module | Total Exports | Consumed by Apps | Core-Only | Truly Dead |
|--------|:---:|:---:|:---:|:---:|
| `color/` | 10 | 5 | 1 (`Matrix3x3`) | 0 |
| `dye/` | 4 | 2 | 2 (`LocalizedDye`, `DyeDatabase`) | 0 |
| `character/` | 11 | 5 | 5 | 1 (`CharacterColorCategory`) |
| `auth/` | 16 | 6 | 0 | 10 |
| `preset/` | 24 | 14 | 0 | 13 |
| `api/` | 7 | 3 | 1 (`CachedData`) | 3 |
| `localization/` | 9 | 0 | 9 | 0 |
| `error/` | 3 | 3 | 0 | 0 |
| `utility/` | 6 | 0 | 0 | 6 |
| **Total** | **88** | **40** | **15** | **25+8** |

## Key Pattern: Union-vs-Subtypes
The largest category of dead code (18 types across DEAD-057 and DEAD-058) follows the same pattern: discriminated union sub-types that consumers never import. Consumers use the union type (`PresetSubmitResponse`, `AuthResponse`, etc.) and narrow via property checks, never importing the constituent sub-types.

**Recommendation:** Mark all sub-types `@internal` and remove from barrel. Keep type definitions in source files where they compose the unions.

## Actionable Quick Wins
1. Remove `utility/index.ts` module entirely (DEAD-061) — 6 dead symbols, 72 lines
2. Remove 3 API types (DEAD-063) — 3 dead symbols, ~40 lines
3. Remove `ResolvedPreset` + `AuthenticatedPresetSubmission` (DEAD-060) — 2 dead symbols, ~30 lines
4. Mark 18 response sub-types `@internal` (DEAD-057 + DEAD-058)
5. Mark `DiscordSnowflake` + `createSnowflake` `@internal` (DEAD-059)
