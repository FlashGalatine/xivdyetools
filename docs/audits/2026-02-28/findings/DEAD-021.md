# DEAD-021: Orphaned Locale Files in discord-worker

## Category
Orphaned File

## Location
- `apps/discord-worker/src/locales/de.json` (737 lines)
- `apps/discord-worker/src/locales/en.json` (737 lines)
- `apps/discord-worker/src/locales/fr.json` (737 lines)
- `apps/discord-worker/src/locales/ja.json` (737 lines)
- `apps/discord-worker/src/locales/ko.json` (737 lines)
- `apps/discord-worker/src/locales/zh.json` (737 lines)

**Total: 4,422 lines of orphaned data**

## Evidence
- Zero `.ts` files in `apps/discord-worker/src/` import from `./locales/` or `../locales/`.
- These files are **byte-for-byte identical** to `packages/bot-i18n/src/locales/`.
- The `@xivdyetools/bot-i18n` package bundles these locales into `translator.ts` via static imports.
- Discord-worker's `services/bot-i18n.ts` re-exports from the `@xivdyetools/bot-i18n` package (which loads its own copies).
- `vitest.config.ts` excludes `src/locales/**` from coverage — confirming they're treated as inert data.

## Why It Exists
These locale files were the original data source before the bot-i18n package was extracted. When bot-i18n was created, the locales were copied into it, but the discord-worker copies were never cleaned up.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero code references |
| **Runtime Impact** | NONE — these JSON files are never loaded |
| **Build Impact** | Reduces build asset footprint |
| **External Consumers** | None |

## Recommendation
**REMOVE the entire `src/locales/` directory.** The canonical copies live in `packages/bot-i18n/src/locales/`.
