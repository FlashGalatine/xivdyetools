# [DEAD-037]: Live duplicate implementations across the scope — consolidation register (not dead code)

## Category
Duplicate (live) — KEEP / consolidation ticket

## Location
Everything here has ≥1 live caller on each side; nothing is removable today. Recorded because four tracks independently hit these and several explain why knip called a package export "unused".

**Cross-package copies of package exports**
| Concept | Package owner | Local copies |
|---|---|---|
| `SUPPORTED_LOCALES` | `@xivdyetools/core` | web-app `shared/constants.ts:59`; discord-worker `services/i18n.ts:48` (test-only, DEAD-004); moderation-worker `services/i18n.ts:34` |
| `VISION_TYPES` | core (dead, DEAD-030) | bot-logic `commands/accessibility.ts:30`; web-app `accessibility-tool.ts:110` |
| `MATCHING_METHODS` | core (bare tuple) | discord-worker `types/preferences.ts:140` (value/name/description) |
| `CATEGORY_DISPLAY` | svg (dead, DEAD-014) | discord-worker `types/preset.ts:165`; moderation-worker `types/preset.ts:62` |
| `isValidSnowflake` | `@xivdyetools/types` | bot-logic `isValidDiscordSnowflake` (moderators.ts:18); moderation-worker private copy (`preset-api.ts:258`) |
| race→clan tables | types (dead, DEAD-024) | 4 app tables |
| HMAC sign/verify | auth (dead, DEAD-019) | 4 app implementations |
| `MODERATION_LIMITS` | worker-kit (dead, DEAD-023) | moderation-worker `RATE_LIMIT_CONFIGS` |
| `formatRateLimitMessage` | worker-kit (dead) | discord-worker's is a *different* message — not a duplicate |
| Discord Ed25519 verification / preset types | auth / types | **not** duplicates — the bot workers' `utils/verify.ts` and `types/preset.ts` are re-export shims (DEAD-006) |

**Colour math**
| svg | core equivalent |
|---|---|
| `hexToRgb`, `rgbToHex` (test-only), `rgbToHsv` (dead) | `ColorService.*` |
| `getLuminance` | `getPerceivedLuminance` (both WCAG relative luminance) |
| `contrastRatio` | `ColorService.getContrastRatio` |
| `interpolateColor` (test-only) | `mixColorsRgb` / `lerp` |
| bot-logic `isValidHex`/`normalizeHex` | core `isValidHexColor`/`ColorService.normalizeHex` — semantics differ (bare `FF0000` accepted, `allowShorthand`) so not a drop-in |
| discord-worker `gradient.ts:176-180` quality ladder (10/25/50) | core `classifyMatchDistance` (different thresholds) — see DEAD-012 |

**Inside core**
- `src/blending/conversions.ts` (307 lines) vs `ColorConverter`/`RybColorMixer` — already an open checkbox at `DEPRECATIONS.md:244`
- `DeltaEFormula` `'cie2000'` vs `MatchingMethod` `'ciede2000'` — two spellings of one algorithm; switch statements in `DyeSearch.ts:67-74`, `ColorService.ts:182-186`, `CharacterColorService.ts:294-305`
- `METHOD_DISPLAY_DP` vs `BAND_METHOD_DP` (DEAD-032)
- Rec.709 luminance coefficients in `ColorAccessibility.ts:34`, `MACHADO_MATRICES.achromatopsia`, `ColorConverter.ts:548`, `blending/conversions.ts:23` (different precisions)
- 12 inline `Math.max(0, Math.min(255, …))` clamps next to the exported `clamp()`
- inline `/^#[A-Fa-f0-9]{6}$/` in `DyeDatabase.ts:139,225` — deliberately stricter than `isValidHexColor` (accepts 3-digit); note only

**Inside discord-worker**: `DiscordInteraction` ×2 (DEAD-009); 9 local `createMockKV` (DEAD-005).

## Recommendation
**KEEP** as code; open one consolidation ticket per row-group. The adopt-or-delete findings (DEAD-019, 023, 024, 014's `CATEGORY_DISPLAY`) are where a decision unblocks removal.
