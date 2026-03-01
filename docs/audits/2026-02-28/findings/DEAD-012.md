# DEAD-012: ~30 Unused Constants in shared/constants.ts

## Category
Unused Export

## Location
- File(s): `src/shared/constants.ts` (421 lines)
- Symbol(s): See full list below

## Evidence
Knip flagged these constants as unused exports. Manual import tracing confirms none of these are imported by any file:

| Constant | Line | Original Purpose |
|----------|------|-----------------|
| `APP_DESCRIPTION` | ~21 | Meta description string |
| `FFXIV_DYES_COUNT` | ~28 | Static count of FFXIV dyes (136) |
| `FFXIV_DATA_CENTER_COUNT` | ~29 | Static count of data centers |
| `FFXIV_SERVERS_PER_DATA_CENTER` | ~30 | Average servers per DC |
| `THEME_COUNT` | ~90 | Number of themes (12) |
| `THEME_DISPLAY_NAMES` | ~97 | Theme display name map |
| `VISION_TYPES` | ~147 | Colorblindness vision type array |
| `VISION_TYPE_LABELS` | ~155 | Vision type display labels |
| `BRETTEL_MATRICES` | ~171 | Colorblindness simulation matrices |
| `UNIVERSALIS_API_TIMEOUT` | ~227 | API timeout value |
| `UNIVERSALIS_API_RETRY_COUNT` | ~228 | API retry count |
| `UNIVERSALIS_API_RETRY_DELAY` | ~229 | API retry delay |
| `API_CACHE_TTL` | ~234 | Cache time-to-live |
| `API_DEBOUNCE_DELAY` | ~235 | API debounce delay |
| `API_CACHE_VERSION` | ~236 | Cache version string |
| `API_MAX_RESPONSE_SIZE` | ~237 | Max API response size |
| `API_RATE_LIMIT_DELAY` | ~238 | Rate limit delay |
| `COLOR_DISTANCE_MAX` | ~263 | Max color distance |
| `CARD_CLASSES` (non-compact) | ~272 | Non-compact card CSS classes |
| `SAMPLE_SIZE_MIN/MAX/DEFAULT` | ~281-283 | Palette extraction sample sizes |
| `ZOOM_MIN/MAX/DEFAULT/STEP` | ~288-291 | Image zoom parameters |
| `CHART_WIDTH/HEIGHT/RESOLUTION_REDUCTION` | ~296-298 | Chart dimensions |
| `COLOR_WHEEL_RADIUS/CENTER_X/CENTER_Y` | ~303-305 | Color wheel geometry |
| `MAX_DYES_COMPARISON` | ~310 | Max dyes in comparison tool |
| `MAX_DYES_ACCESSIBILITY` | ~315 | Max dyes in accessibility tool |
| `KEYBOARD_SHORTCUTS` | ~333 | Keyboard shortcut definitions |
| `SUCCESS_MESSAGES` | ~362 | Success message strings |
| `DEBOUNCE_DELAYS` | ~405 | Debounce timing values |
| `ANIMATION_DURATIONS` | ~416 | Animation duration values |

## Why It Exists
These constants were defined during the v2/v3 architecture as a centralized config. Individual components migrated to using inline values, `@xivdyetools/core` constants, or tool-specific config objects, but the central constants were never cleaned up.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import references for each |
| **Blast Radius** | NONE — isolated exports |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possibly referenced by string in external docs, but not in code |

## Recommendation
**REMOVE**

### Rationale
- Removes ~200 lines of unused constants
- Reduces cognitive overhead when reading the constants file
- Centralizes only the constants that are actually shared

### If Removing
1. Remove each unused constant from `src/shared/constants.ts`
2. Run build + tests to verify
3. Keep the file with remaining used constants (~15 exports)
