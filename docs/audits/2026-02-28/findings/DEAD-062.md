# DEAD-062: All localization types — zero direct consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/localization/index.ts`
- Line(s): 1–178 (entire file)
- Symbol(s): `LocaleCode`, `TranslationKey`, `HarmonyTypeKey`, `JobKey`, `GrandCompanyKey`, `RaceKey`, `ClanKey`, `LocaleData`, `LocalePreference`

## Evidence
Monorepo-wide grep for each symbol (excluding `packages/types/` and `packages/core/src/types/`):

| Symbol | External Consumers | Notes |
|--------|-------------------|-------|
| `LocaleCode` | 0 direct from types | Apps get it from `@xivdyetools/bot-i18n` or define locally. Core uses it internally from its own types import. |
| `TranslationKey` | 0 | Only in core's `LocalizationService` |
| `HarmonyTypeKey` | 0 | Only in core's `TranslationProvider` |
| `JobKey` | 0 | Only in core's `TranslationProvider` |
| `GrandCompanyKey` | 0 | Only in core's `TranslationProvider` |
| `RaceKey` | 0 as type import | web-app uses `raceKey` as a property name string, never imports the type |
| `ClanKey` | 0 as type import | Same pattern as `RaceKey` |
| `LocaleData` | 0 direct from types | Apps get it from `@xivdyetools/bot-i18n` or core |
| `LocalePreference` | 0 | Only in core's `LocalizationService` |

**Key nuance:** These types ARE consumed by `packages/core` internally (imported from `@xivdyetools/types` in core's services and re-exported through core's deprecated barrel). Removing them from types would break core's build. However, no app or non-core package imports them directly from `@xivdyetools/types`.

## Why They Exist
The localization types define the contract for the 6-language i18n system. Core's `LocalizationService` and `TranslationProvider` use them extensively. The types are architecturally correct — they just happen to be consumed only by one package (core).

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — types are consumed by core, just not directly by apps |
| **Blast Radius** | HIGH if removed — core would break |
| **Reversibility** | EASY |
| **Hidden Consumers** | core is a real consumer (not dead) |

## Recommendation
**KEEP — but reconsider barrel export strategy**

### Rationale
These types serve their purpose: they define the localization contract consumed by core. The issue is not that the types are dead, but that the `localization/` subpath export has zero direct consumers (see DEAD-065). The types should remain in the barrel since core depends on them, but the dedicated subpath export `@xivdyetools/types/localization` could be removed to reduce API surface.

### Notes
- If `@xivdyetools/bot-i18n` were refactored to import `LocaleCode` from types instead of defining its own, these would gain direct consumers
- The specialized key types (`HarmonyTypeKey`, `JobKey`, etc.) are consumed only by core's internal services — they could be moved to core if the goal is to minimize types' API surface
