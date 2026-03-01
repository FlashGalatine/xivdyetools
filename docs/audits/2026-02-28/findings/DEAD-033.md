# DEAD-033: Unused Type Exports in bot-i18n

## Category
Unused Type

## Location
- `packages/bot-i18n/src/types.ts`:
  - `TranslatorLogger` type alias
  - `LocaleData` type alias

## Evidence
Monorepo-wide search:
- `TranslatorLogger`: re-exported in discord-worker's bot-i18n.ts, but zero files import it from there. Zero imports in bot-logic or any other package.
- `LocaleData`: same pattern — re-exported but never consumed.

The `Translator` class constructor accepts `TranslatorLogger` as an option type, but consumers pass logger objects directly without importing the type (TypeScript infers the shape structurally).

## Why It Exists
Exported for type-safe consumption by users of the Translator class. Since TypeScript's structural typing allows passing compatible objects without importing the exact type, these exports were never needed.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero explicit imports |
| **Runtime Impact** | NONE (types are erased) |
| **Build Impact** | None |
| **External Consumers** | Published npm package — minor risk |

## Recommendation
**KEEP** but mark as `@internal` in JSDoc. These types are part of a published package's API surface and removing them would be a breaking change for any external consumers who might reference them.
