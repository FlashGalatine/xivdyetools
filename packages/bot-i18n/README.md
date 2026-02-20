# @xivdyetools/bot-i18n

> Platform-agnostic translation engine for XIV Dye Tools bot UI strings — error messages, help text, command descriptions, and status messages in 6 languages.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/bot-i18n)](https://www.npmjs.com/package/@xivdyetools/bot-i18n)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@xivdyetools/bot-i18n` provides a lightweight translation engine for bot-facing UI strings (not dye names — those come from `@xivdyetools/core`). Locale data is bundled as static JSON imports, making it compatible with Cloudflare Workers, Node.js, and browsers.

**Supported locales:** English (`en`), Japanese (`ja`), German (`de`), French (`fr`), Korean (`ko`), Chinese (`zh`)

## Installation

```bash
npm install @xivdyetools/bot-i18n
```

## Usage

### Translator Class

```typescript
import { createTranslator } from '@xivdyetools/bot-i18n';

const t = createTranslator('ja');

// Simple key lookup (dot notation)
t.t('common.footer');
// → "XIV Dye Tools"

// With variable interpolation
t.t('errors.dyeNotFound', { name: 'Snow White' });
// → 'Could not find a dye named "Snow White".'

// Falls back to English for missing keys
t.t('some.key.only.in.english');
// → English value (with a warning if logger is provided)
```

### Stateless Translation

```typescript
import { translate } from '@xivdyetools/bot-i18n';

// One-off translation without creating an instance
const text = translate('en', 'dye.info.detailedInfo', { category: 'Red' });
```

### Locale Utilities

```typescript
import { getAvailableLocales, isLocaleSupported } from '@xivdyetools/bot-i18n';

getAvailableLocales();
// → ['en', 'ja', 'de', 'fr', 'ko', 'zh']

isLocaleSupported('ja');  // → true
isLocaleSupported('es');  // → false
```

## API

| Export | Kind | Description |
|--------|------|-------------|
| `Translator` | class | Locale-bound translator with fallback to English |
| `createTranslator(locale)` | function | Factory for `Translator` instances |
| `translate(locale, key, vars?)` | function | Stateless one-off translation |
| `getAvailableLocales()` | function | Returns array of supported locale codes |
| `isLocaleSupported(code)` | function | Type guard for locale validation |

### Types

| Export | Description |
|--------|-------------|
| `LocaleCode` | `'en' \| 'ja' \| 'de' \| 'fr' \| 'ko' \| 'zh'` |
| `LocaleData` | Shape of a locale's translation JSON |
| `TranslatorLogger` | Optional logger interface for missing-key warnings |

## Translation Keys

Translation keys use dot notation to navigate the JSON structure:

```
common.footer            → Footer text
errors.dyeNotFound       → Dye not found message
dye.info.detailedInfo    → Dye info card description
harmony.title            → Harmony wheel title
gradient.title           → Gradient bar title
```

## Adding Translations

Locale files are in `src/locales/*.json`. Each file mirrors the English (`en.json`) structure. Missing keys automatically fall back to English at runtime.

## License

MIT
