# DEAD-035: Unused Re-exports in discord-worker bot-i18n.ts

## Category
Unused Export

## Location
- `apps/discord-worker/src/services/bot-i18n.ts`:
  - `translate` re-export (from `@xivdyetools/bot-i18n`)
  - `getAvailableLocales` re-export
  - `isLocaleSupported` re-export
  - `LocaleData` type re-export
  - `TranslatorLogger` type re-export

## Evidence
- The file re-exports these 5 symbols from `@xivdyetools/bot-i18n` to provide a single import location for discord-worker code.
- However, zero files in `apps/discord-worker/src/` import any of these 5 symbols from `./services/bot-i18n`.
- The only re-exports that ARE consumed are `createTranslator` and `Translator` (used in handler setup).

## Why It Exists
The bot-i18n.ts service was created as a facade/barrel file during the bot-i18n package extraction. It re-exports everything from the package for convenience. Five of the re-exports were never adopted because the underlying functions themselves are unused (see DEAD-032, DEAD-033).

## Dependency Chain
This finding is downstream of DEAD-032 and DEAD-033:
- If the bot-i18n package removes `translate`, `getAvailableLocales`, `isLocaleSupported` → these re-exports would fail to compile
- If bot-i18n keeps them → these re-exports are harmless but noisy

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero consumers |
| **Runtime Impact** | NONE |
| **Build Impact** | Negligible |
| **External Consumers** | None |

## Recommendation
**REMOVE** the 5 unused re-exports from `bot-i18n.ts`. Keep `createTranslator` and `Translator` re-exports which are actively used.
