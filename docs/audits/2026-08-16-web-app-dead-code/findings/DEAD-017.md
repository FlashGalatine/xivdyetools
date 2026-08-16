# [DEAD-017]: Always-true feature flags, completed-migration `@deprecated` fields, and a compat alias (~30 lines)

## Category
Legacy Code

## Location / Evidence
| file:line | item | evidence | lines |
|---|---|---|---|
| `src/shared/constants.ts:147-159` | `FEATURE_FLAGS` (7 members, `as const`) | `ENABLE_KEYBOARD_SHORTCUTS: true` — sole consumer `keyboard-service.ts:60` `if (!FEATURE_FLAGS.ENABLE_KEYBOARD_SHORTCUTS) { … return; }` → literal `true` makes the guard body **unreachable**. `ENABLE_PRICES`, `ENABLE_PRICE_HISTORY`, `ENABLE_SAVED_PALETTES`, `ENABLE_EXPORT_FORMATS`, `ENABLE_DARK_MODE`, `DEBUG_MODE` → **0 consumers**. `keyboard-service.test.ts:37-38` mocks the flag `true` (never exercises `false`). | 13 + 4 guard + import + mock ≈ 19 |
| `src/shared/tool-config-types.ts:59-67` | `HarmonyConfig.showHex/showRgb/showHsv/showLab` — 4× `@deprecated Use displayOptions.showX` | every repo hit for those names is `displayOptions.showX`, `comparisonOptions.showX`, a `STORAGE_KEYS` entry, or `card.showHex`; nothing reads or writes `HarmonyConfig.showX`; `DEFAULT_CONFIGS.harmony` (`:427-435`) does not set them. Migration complete. | 9 |
| `src/components/extractor-tool.ts:94-95` | `const ICON_UPLOAD = ICON_IMAGE; // Alias for backward compatibility` | 1 use (`:639`); `ICON_IMAGE` used directly at `:992,:1127` | 2 |

Not removable (verified live): `EVERCOLD_DEPRECATED_CATEGORIES` (game data, `swatch-tool.ts:1661`); `collection-service.ts:213-397` and `extractor-tool.ts:455-464` storage migrations (must survive until every user's localStorage has been read once); `LEGACY_ROUTE_REDIRECTS` (`router-service.ts:72,358-362`, serves inbound `/matcher` links); `TOOL_ICONS` legacy keys; `migrateLegacyThemeName` (12→2 theme retirement); the stainID-vs-itemID guards (`share-service.ts:318-331`, `preset-submission-service.ts:141-145`); `showDeltaE` (`@deprecated` but still read by 3+ tools).

## Why It Exists
`FEATURE_FLAGS` was scaffolded for an A/B-rollout mechanism that never materialised. The `HarmonyConfig` fields were the pre-`displayOptions` shape, kept optional for a migration that has since completed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW |
| **Reversibility** | EASY |
| **Hidden Consumers** | Persisted `HarmonyConfig` objects in localStorage may still carry `showHex` etc. — TypeScript types do not affect runtime reads, and nothing reads them; extra keys are ignored. |

## Recommendation
**REMOVE**

### If Removing
1. Delete `FEATURE_FLAGS` (`constants.ts:147-159`), the guard block (`keyboard-service.ts:58-62`), its import (`:11`), and the mock stanza (`keyboard-service.test.ts:37-38`)
2. Delete `tool-config-types.ts:59-67`
3. Inline `ICON_IMAGE` at `extractor-tool.ts:639`; delete `:94-95`
4. `pnpm --filter xivdyetools-web-app run type-check test`
