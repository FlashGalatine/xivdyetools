# DEAD-026: Dead Type Exports in discord-worker

## Category
Unused Type

## Location
- `apps/discord-worker/src/types/image.ts`:
  - `DiscordAttachment` interface (line ~52)
  - `ExtractedPaletteEntry` interface (line ~78)
- `apps/discord-worker/src/types/budget.ts`:
  - `SORT_DISPLAY` constant (line ~192)
  - `getDistanceQuality()` function (line ~210)
- `apps/discord-worker/src/types/preferences.ts`:
  - `getRaceForClan()` function (line ~159)
- `apps/discord-worker/src/types/preset.ts`:
  - `PresetPreviousValues` re-export (line ~24)
- `apps/discord-worker/src/utils/verify.ts`:
  - `VerificationResult` type alias (line ~20, comment says "For backwards compatibility")
- `apps/discord-worker/src/utils/response.ts`:
  - `embedResponse()` function (line ~116)

## Evidence
For each symbol, searched for import references across all of `apps/discord-worker/src/`:
- `DiscordAttachment` — zero imports
- `ExtractedPaletteEntry` — zero imports
- `SORT_DISPLAY` — zero imports outside definition
- `getDistanceQuality()` — zero imports outside definition
- `getRaceForClan()` — zero imports
- `PresetPreviousValues` — re-exported from @xivdyetools/types but never imported by any file
- `VerificationResult` — zero imports (comment explicitly acknowledges backward compat)
- `embedResponse()` — only imported by `response.test.ts`

## Why It Exists
These types/functions were defined for planned features or backward compatibility, then never integrated:
- `DiscordAttachment` / `ExtractedPaletteEntry`: Designed for image extraction pipeline types
- `SORT_DISPLAY` / `getDistanceQuality`: Budget command UI helpers
- `getRaceForClan`: Character preference lookups
- `VerificationResult`: Legacy type alias
- `embedResponse`: Convenience response builder

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — all confirmed zero production consumers |
| **Runtime Impact** | NONE |
| **Build Impact** | Minor (types are erased at compile time; functions are small) |
| **External Consumers** | None |

## Recommendation
**REMOVE** all 8 symbols. Low-effort, zero-risk cleanup.
