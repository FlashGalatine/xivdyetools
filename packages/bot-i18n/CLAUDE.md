# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/bot-i18n` is the **translation engine for bot UI strings** — error messages, help text, command descriptions, status messages, and other bot-facing chrome. It is deliberately **separate from `@xivdyetools/core`'s localization service**: `core` translates **dye and category names** (FFXIV in-game data sourced from XIVAPI + manual ko/zh entries), while this package translates **the bot's own English chrome** into the same six languages. The two services run side-by-side in command handlers — a single response often combines a dye name from `core` with a status string from this package.

The implementation is intentionally minimal: 6 bundled JSON locale files, a `Translator` class with dot-notation key lookup, English fallback, `{variable}` interpolation, and missing-key warnings. There is no I/O — locales are static imports, which works in both Node and Cloudflare Workers without filesystem access.

## Commands

```bash
pnpm --filter @xivdyetools/bot-i18n run build
pnpm --filter @xivdyetools/bot-i18n run test
pnpm --filter @xivdyetools/bot-i18n run test:coverage
pnpm --filter @xivdyetools/bot-i18n run type-check
pnpm --filter @xivdyetools/bot-i18n run lint
pnpm --filter @xivdyetools/bot-i18n run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/bot-i18n
pnpm turbo run test --filter=@xivdyetools/bot-i18n
pnpm --filter @xivdyetools/bot-i18n exec vitest run src/translator.test.ts
```

## Architecture

The package is a single class (`Translator`) plus a factory (`createTranslator`) and a `LocaleCode` type. Locale data is loaded via 6 static JSON imports (`./locales/{en,ja,de,fr,ko,zh}.json`) at module-evaluation time — no `fetch`, no `fs.readFile`, no dynamic `import()`. This keeps the package compatible with the Cloudflare Workers V8 isolate model where a static-import bundle is the only safe way to ship locale files.

### Key Directories

```
src/
├── index.ts          # Re-exports
├── types.ts          # LocaleCode, LocaleData, TranslatorLogger
├── translator.ts     # Translator class + createTranslator factory + static locale imports
└── locales/
    ├── en.json       # Source of truth — every key must exist here
    ├── ja.json
    ├── de.json
    ├── fr.json
    ├── ko.json
    └── zh.json
```

`locales.test.ts` enforces locale-completeness: it walks every dot-path in `en.json` and asserts each non-English locale has a value at the same path. New keys added to English break CI for whichever locales haven't been translated yet — a deliberate tripwire.

## Public API

```ts
type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

interface LocaleData {
  meta: { locale: string; name: string; nativeName: string; flag: string };
  [key: string]: unknown;     // arbitrary nested keys
}

interface TranslatorLogger {
  warn: (msg: string) => void;
}

class Translator {
  constructor(locale: LocaleCode, logger?: TranslatorLogger);
  t(key: string, variables?: Record<string, string | number>): string;
  getLocale(): LocaleCode;
  getMeta(): LocaleData['meta'];
}

function createTranslator(locale: LocaleCode, logger?: TranslatorLogger): Translator;
```

### Usage

```ts
import { createTranslator } from '@xivdyetools/bot-i18n';

const t = createTranslator('ja');
t.t('errors.dyeNotFound', { name: 'Snow White' });
// → 'Could not find a dye named "Snow White".' (interpolated, English fallback if key missing)

t.getMeta(); // → { locale: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' }
```

## Key Patterns / Algorithms

### Lookup + fallback
`t(key)` splits on `.` and walks the locale data object. If the resolved value is `undefined` (or not a string) **and** the active locale isn't already English, it retries against the bundled `en.json`. If both lookups fail it logs a warning via the supplied `TranslatorLogger` (compatible with `@xivdyetools/logger`'s `ExtendedLogger`) and returns the **raw key** so missing translations surface visibly in dev rather than silently rendering as empty strings.

### `{variable}` interpolation
Templates use `{name}` placeholders. The interpolator falls back to leaving `{name}` literal when a variable is missing rather than printing `undefined`. Numbers are coerced via `.toString()`.

### Locale completeness as a CI gate
`locales.test.ts` is the contract: en.json is canonical, every other locale must mirror its key shape. Adding a key in English without translating it elsewhere fails CI.

### Static imports = Workers-safe
The locale JSON files are bundled into the compiled output via static `import` statements. There is no runtime I/O, no async initialization, and no `setLocale()` mutation — `Translator` is constructed once per locale and is fully thread-safe under the CF Worker concurrency model.

## Adding a new translation key

1. Add the key + English value to `src/locales/en.json`.
2. Add translations (or a copy of the English string as a placeholder) to `ja.json`, `de.json`, `fr.json`, `ko.json`, `zh.json`. The `locales.test.ts` completeness check fails otherwise.
3. Run `pnpm --filter @xivdyetools/bot-i18n run test`.
4. Use it: `t.t('your.new.key', { vars })` from any consumer.

## Consumers

- `@xivdyetools/bot-logic` — every `execute*` command function uses a `Translator` for error / status text and re-exports the `LocaleCode` type.
- `apps/discord-worker` — directly imports `createTranslator` for top-level interaction handlers.
- `apps/stoat-worker` — same usage pattern as the Discord worker.

This package has **no internal dependencies** — it is intentionally Level 0 in the workspace dependency graph, so adding a translation key never triggers a cascading rebuild of `core` / `svg` / etc.

## Internal Dependencies

None. (devDependencies only: `vitest`, `@vitest/coverage-v8`.)

## Publishing

```bash
# 1. Bump version in packages/bot-i18n/package.json
# 2. Build + test (the locale-completeness test runs here)
pnpm turbo run build test --filter=@xivdyetools/bot-i18n

# 3. Publish
pnpm --filter @xivdyetools/bot-i18n publish --provenance --access public --no-git-checks
```
