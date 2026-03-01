# DEAD-034: Unused Locale Key Sections in bot-i18n

## Category
Dead Code Path

## Location
- `packages/bot-i18n/src/locales/en.json` (and all 5 other locale files):
  - `buttons.*` section (~6 keys)
  - `pagination.*` section (~5 keys)
  - `components.*` section (~8 keys)
  - `status.*` section (~5 keys)
  - `matching.*` partial section (~6 keys)

**Total: ~30+ unused locale keys per language × 6 languages = ~180+ dead key-value pairs**

## Evidence
- Cross-referenced every `t('...')` call in both `packages/bot-logic/src/` and `apps/discord-worker/src/` against the locale key inventory.
- The `buttons`, `pagination`, `components`, and `status` namespaces have **zero** `t()` calls referencing them.
- The `matching` namespace has some used keys but ~6 that are never referenced.
- These correspond to the unused UI infrastructure in discord-worker (pagination system from DEAD-020, component builders from DEAD-025).

## Why It Exists
Locale keys were pre-created for planned V4 features:
- `buttons.*`: For interactive button labels (pagination, refresh, etc.)
- `pagination.*`: For pagination chrome ("Page X of Y", navigation)
- `components.*`: For select menu labels (blending modes, matching methods)
- `status.*`: For progress/processing messages (ties to DEAD-020's progress.ts)
- `matching.*` extras: For match quality descriptions never surfaced

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero `t()` references to these keys |
| **Runtime Impact** | NONE — unused keys are loaded but never accessed |
| **Build Impact** | Reduces bundle size for all 6 locale files |
| **External Consumers** | Published npm package — check external usage |

## Recommendation
**REMOVE** unused key sections from all 6 locale JSON files. Coordinate with DEAD-020 (pagination/progress) and DEAD-025 (component builders) removals.
