# DEAD-032: Unused Function Exports in bot-i18n

## Category
Unused Export

## Location
- `packages/bot-i18n/src/translator.ts`:
  - `translate()` standalone function (~20 lines)
  - `getAvailableLocales()` function (~5 lines)
  - `isLocaleSupported()` function (~5 lines)

## Evidence
Monorepo-wide search for import consumers:

### `translate()`
- `apps/discord-worker/src/services/bot-i18n.ts`: **re-exports** `translate` from `@xivdyetools/bot-i18n`, but zero files in discord-worker import it from bot-i18n.ts
- `packages/bot-logic/`: zero imports
- All other apps: zero imports
- **Pattern**: All consumers use `Translator` class instances (created via `createTranslator()`) rather than the standalone `translate()` function

### `getAvailableLocales()`
- Same pattern: re-exported in discord-worker's bot-i18n.ts, zero consumers
- All locale enumeration is handled via Discord's built-in locale system

### `isLocaleSupported()`
- Same pattern: re-exported in discord-worker's bot-i18n.ts, zero consumers
- Locale validation is handled at the Discord API layer

## Why It Exists
These are convenience functions exported alongside the `Translator` class. The package was designed to offer both OOP (Translator class) and functional (standalone functions) APIs. Only the OOP API was adopted.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero non-test consumers across entire monorepo |
| **Runtime Impact** | NONE |
| **Build Impact** | Minor reduction in bundle size |
| **External Consumers** | Published npm package — check if any external consumers exist before removing |

## Recommendation
**REMOVE** if no external consumers depend on the npm package's functional API. Since this workspace is the only known consumer, removal is safe. Update the package's public API docs and re-export index accordingly.
