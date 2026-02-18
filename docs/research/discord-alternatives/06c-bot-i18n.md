# Shared Libraries — `@xivdyetools/bot-i18n`

**Parent document:** [06-shared-libraries.md](./06-shared-libraries.md)

Covers: Translation engine, locale data structure, separation from core localization, extraction plan.

---

## Purpose

Platform-agnostic translation engine for bot-facing UI strings — error messages, help text, command descriptions, button labels, and status messages. This is **separate** from `@xivdyetools/core`'s `LocalizationService`, which handles dye name translations.

**Why two localization systems?**

| System | What It Translates | Source | Example |
|--------|-------------------|--------|---------|
| `@xivdyetools/core` `LocalizationService` | Dye names, category names, harmony type names | Game data from XIVAPI + manual CSV | "Snow White" → "スノウホワイト" |
| `@xivdyetools/bot-i18n` `Translator` | Bot UI strings | Hand-written JSON locale files | "Could not find a dye named \"{name}\"." → "「{name}」というダイは見つかりませんでした。" |

Both bots need the same translated UI strings. Without extraction, the Stoat Bot would need to duplicate all 6 locale JSON files and the Translator class.

---

## Current Location

**Source:** `xivdyetools-discord-worker/src/services/bot-i18n.ts` (233 lines)

**Locale files:** `xivdyetools-discord-worker/src/locales/{en,ja,de,fr,ko,zh}.json`

**Current imports:**
- `LocaleCode` type from `./i18n.js` — the locale union `'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'`
- `resolveUserLocale` from `./i18n.js` — KV-based locale resolution (Discord-specific)
- `ExtendedLogger` from `@xivdyetools/logger` — optional structured logging

**Current consumers (in Discord Worker):**
- Every command handler via `createUserTranslator()` or `createTranslator()`
- Error response formatting
- Help/manual command
- Preferences display

---

## What Gets Extracted vs. What Stays

### Moves to `@xivdyetools/bot-i18n`:

| Component | Purpose |
|-----------|---------|
| `Translator` class | Dot-notation key lookup with variable interpolation and English fallback |
| `createTranslator(locale)` | Factory for a given locale (no I/O) |
| `translate(locale, key, vars)` | Quick one-off translation helper |
| `getAvailableLocales()` | Returns locale metadata array |
| `isLocaleSupported(locale)` | Type guard for locale codes |
| `getNestedValue()` | Internal dot-notation path traversal |
| `interpolate()` | Internal `{variable}` replacement |
| `LocaleData` interface | Locale JSON file structure |
| `LocaleCode` type | `'en' \| 'ja' \| 'de' \| 'fr' \| 'ko' \| 'zh'` |
| Locale JSON files | All 6 language files with bot UI strings |

### Stays in Discord Worker:

| Component | Purpose | Why |
|-----------|---------|-----|
| `createUserTranslator(kv, userId, discordLocale)` | Resolves locale from KV prefs + Discord interaction locale | Depends on `KVNamespace` (CF Workers API) |
| `resolveUserLocale(kv, userId, discordLocale)` | Locale resolution chain: user pref → Discord locale → default | KV-dependent |
| Locale imports (static `import enLocale from ...`) | Bundling mechanism | CF Workers require static imports for JSON |

### Stoat Bot equivalent (new code):

| Component | Purpose |
|-----------|---------|
| `createUserTranslator(db, userId)` | Resolves locale from SQLite preferences |
| `resolveUserLocale(db, userId)` | Locale resolution: user pref → default |

---

## Package API

### Types

```typescript
/**
 * Supported locale codes.
 * Matches XIVAPI languages plus Korean and Chinese (from manual data).
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

/**
 * Structure of a locale JSON file.
 */
export interface LocaleData {
  meta: {
    locale: string;
    name: string;         // e.g., "Japanese"
    nativeName: string;   // e.g., "日本語"
    flag: string;         // e.g., "🇯🇵"
  };
  [key: string]: unknown; // Nested translation keys
}
```

### Translator Class

```typescript
export class Translator {
  constructor(locale: LocaleCode, logger?: ExtendedLogger);

  /**
   * Get a translated string by dot-notation key.
   * Falls back to English if key missing in current locale.
   * Returns the raw key if not found in any locale.
   *
   * @example
   * t.t('errors.dyeNotFound', { name: 'Snow White' })
   * // → 'Could not find a dye named "Snow White".'
   */
  t(key: string, variables?: Record<string, string | number>): string;

  /** Get the current locale code */
  getLocale(): LocaleCode;

  /** Get locale metadata (name, nativeName, flag) */
  getMeta(): LocaleData['meta'];
}
```

### Factory Functions

```typescript
/**
 * Create a translator for a specific locale.
 * This is the primary way consumers create translators.
 * No I/O — locale data is bundled with the package.
 */
export function createTranslator(locale: LocaleCode, logger?: ExtendedLogger): Translator;

/**
 * Quick translate function for one-off translations.
 * Creates a throwaway Translator internally.
 */
export function translate(
  locale: LocaleCode,
  key: string,
  variables?: Record<string, string | number>,
  logger?: ExtendedLogger
): string;

/**
 * Get all available locales with metadata.
 * Used by language selection commands to show available options.
 */
export function getAvailableLocales(): Array<LocaleData['meta']>;

/**
 * Type guard: check if a string is a supported locale code.
 */
export function isLocaleSupported(locale: string): locale is LocaleCode;
```

---

## Locale JSON Structure

Each locale file follows a nested key structure. The `en.json` serves as the source of truth:

```json
{
  "meta": {
    "locale": "en",
    "name": "English",
    "nativeName": "English",
    "flag": "🇺🇸"
  },
  "common": {
    "dye": "Dye",
    "dyes": "Dyes",
    "color": "Color",
    "category": "Category",
    "footer": "XIV Dye Tools",
    "error": "Error",
    "success": "Success",
    "marketBoard": "Market Board"
  },
  "errors": {
    "dyeNotFound": "Could not find a dye named \"{name}\".",
    "invalidColor": "Could not resolve \"{input}\" to a color.\n\nPlease provide a valid hex code (e.g., `#FF0000`) or dye name.",
    "missingInput": "Please provide a color (hex code or dye name).",
    "noMatchFound": "Could not find any matching dyes in the database.",
    "generationFailed": "An error occurred while generating the visualization."
  },
  "harmony": {
    "title": "{type} Harmony",
    "baseColor": "Base Color",
    "triadic": "Triadic",
    "complementary": "Complementary",
    "analogous": "Analogous"
  },
  "quality": {
    "perfect": "Perfect",
    "excellent": "Excellent",
    "good": "Good"
  },
  "manual": {
    "title": "XIV Dye Tools Manual",
    "welcome": "Welcome to **XIV Dye Tools**!"
  }
}
```

**Translation interpolation:** Variables use `{variableName}` syntax. The `interpolate()` function replaces `{name}` with the provided value, leaving unmatched placeholders as-is.

---

## Locale Loading Strategy

The current Discord Worker uses **static imports** for locale files because Cloudflare Workers disallow dynamic `import()` or filesystem access:

```typescript
// Current (Discord Worker — static imports required by wrangler)
import enLocale from '../locales/en.json';
import jaLocale from '../locales/ja.json';
// ... etc.
```

For the shared package, locale data needs to be accessible in both environments:

### Option A: Bundle locale data into the package (Recommended)

The locale JSON files are part of the package's source. Bundlers (wrangler, esbuild, Vite) inline them at build time. The package exports them as a pre-loaded map:

```typescript
// Inside @xivdyetools/bot-i18n
import enLocale from './locales/en.json';
import jaLocale from './locales/ja.json';
import deLocale from './locales/de.json';
import frLocale from './locales/fr.json';
import koLocale from './locales/ko.json';
import zhLocale from './locales/zh.json';

const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale as LocaleData,
  ja: jaLocale as LocaleData,
  de: deLocale as LocaleData,
  fr: frLocale as LocaleData,
  ko: koLocale as LocaleData,
  zh: zhLocale as LocaleData,
};
```

This works for both CF Workers (wrangler bundles JSON imports) and Node.js (TypeScript resolves JSON imports natively with `resolveJsonModule`).

### Option B: Lazy-load locale data

Pass locale data to the `Translator` constructor. Consumers load it however they want:

```typescript
// Consumer provides data
const data = JSON.parse(fs.readFileSync('./locales/ja.json', 'utf-8'));
const t = new Translator('ja', data, enFallbackData);
```

**Trade-off:** More flexible but puts the loading burden on every consumer. Not worth it since the total locale data is ~50 KB — negligible in any bundle.

**Decision: Option A.** Bundle locale data directly. Simplest API, works everywhere, minimal size impact.

---

## Integration with Each Bot

### Discord Worker (after extraction)

```typescript
// bot-i18n.ts (simplified — only platform-specific glue remains)
import { Translator, createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { resolveUserLocale } from './i18n.js';

export { Translator, createTranslator } from '@xivdyetools/bot-i18n';

/**
 * Create a translator for a user, resolving their locale from KV.
 * This is the only Discord-specific function.
 */
export async function createUserTranslator(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string,
  logger?: ExtendedLogger
): Promise<Translator> {
  const locale = await resolveUserLocale(kv, userId, discordLocale);
  return createTranslator(locale, logger);
}
```

### Stoat Bot

```typescript
// src/services/bot-i18n.ts
import { Translator, createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import type { Database } from 'better-sqlite3';

export { Translator, createTranslator } from '@xivdyetools/bot-i18n';

/**
 * Create a translator for a user, resolving their locale from SQLite.
 */
export function createUserTranslator(
  db: Database,
  userId: string,
  logger?: ExtendedLogger
): Translator {
  // Synchronous SQLite query (better-sqlite3 is sync)
  const row = db.prepare('SELECT language FROM preferences WHERE user_id = ?').get(userId);
  const locale = (row as any)?.language ?? 'en';
  return createTranslator(locale, logger);
}
```

**Key difference:** Discord's version is `async` (KV is async), Stoat's is **synchronous** (better-sqlite3 is sync). The `Translator` class itself is always synchronous — only the locale *resolution* step differs.

---

## Dependencies

```
@xivdyetools/bot-i18n
  (optional) @xivdyetools/logger  — for ExtendedLogger type in Translator constructor
```

**Note:** The `ExtendedLogger` dependency is optional. If the logger is not passed, the Translator silently swallows missing key warnings. This could be made a peer dependency or replaced with a simpler callback.

---

## Package Structure

```
xivdyetools-bot-i18n/
  src/
    index.ts              ← Re-exports public API
    translator.ts         ← Translator class, createTranslator(), translate()
    types.ts              ← LocaleCode, LocaleData
    locales/
      en.json
      ja.json
      de.json
      fr.json
      ko.json
      zh.json
  tests/
    translator.test.ts
    locales.test.ts       ← Completeness checks (all keys present in all locales)
  package.json
  tsconfig.json
  vitest.config.ts
```

---

## Extraction Plan

### Step 1: Create the package

1. Create `xivdyetools-bot-i18n/` with the structure above
2. Copy `Translator` class, helper functions, types from `bot-i18n.ts`
3. Copy all 6 locale JSON files from `discord-worker/src/locales/`
4. Move `LocaleCode` type here (currently defined in `discord-worker/src/services/i18n.ts`)

### Step 2: Update Discord Worker

1. `bot-i18n.ts` becomes a thin wrapper: re-exports from `@xivdyetools/bot-i18n`, adds `createUserTranslator(kv, ...)`
2. Remove locale JSON files from `discord-worker/src/locales/` (they live in the package now)
3. Update `i18n.ts` to import `LocaleCode` from `@xivdyetools/bot-i18n` instead of defining it locally

### Step 3: Verify Discord Worker builds

Since wrangler bundles `@xivdyetools/bot-i18n`'s JSON imports transitively, the static import requirement is satisfied. The locale files become part of the bundle via the package.

---

## Testing

### Unit Tests

```typescript
describe('Translator', () => {
  test('returns translated string for known key', () => {
    const t = createTranslator('en');
    expect(t.t('common.error')).toBe('Error');
  });

  test('interpolates variables', () => {
    const t = createTranslator('en');
    expect(t.t('errors.dyeNotFound', { name: 'Snow White' }))
      .toBe('Could not find a dye named "Snow White".');
  });

  test('falls back to English for missing keys', () => {
    const t = createTranslator('ja');
    // Assuming 'some.new.key' exists in en.json but not ja.json
    expect(t.t('common.error')).toBeTruthy(); // Falls back to English if missing
  });

  test('returns raw key if not found in any locale', () => {
    const t = createTranslator('en');
    expect(t.t('nonexistent.key')).toBe('nonexistent.key');
  });

  test('getLocale returns the configured locale', () => {
    const t = createTranslator('ja');
    expect(t.getLocale()).toBe('ja');
  });

  test('getMeta returns locale metadata', () => {
    const t = createTranslator('ja');
    const meta = t.getMeta();
    expect(meta.nativeName).toBe('日本語');
    expect(meta.flag).toBe('🇯🇵');
  });
});
```

### Locale Completeness Tests

Automated tests ensure all locale files have the same keys as `en.json`:

```typescript
describe('locale completeness', () => {
  const enKeys = getAllKeys(enLocale);

  for (const [code, data] of Object.entries(locales)) {
    if (code === 'en') continue;

    test(`${code}.json has all English keys`, () => {
      const localeKeys = getAllKeys(data);
      const missing = enKeys.filter(key => !localeKeys.includes(key));
      expect(missing).toEqual([]);
    });
  }
});

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return getAllKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}
```

This catches missing translations early — when a new key is added to `en.json`, tests fail for any locale file that doesn't have it yet.

---

## Future: Stoat-Specific UI Strings

Some Stoat Bot messages will differ from Discord:

| Context | Discord | Stoat |
|---------|---------|-------|
| Copy button label | "HEX" (button text) | 🎨 (reaction emoji — no text label needed) |
| Ephemeral hint | "Only you can see this." | "Sent via DM." |
| Autocomplete prompt | "Start typing a dye name..." | (not applicable — prefix commands) |
| Slash command description | "Look up a dye's color values" | (not applicable) |

**Approach:** Add Stoat-specific keys alongside Discord keys in the same locale files:

```json
{
  "discord": {
    "ephemeralHint": "Only you can see this."
  },
  "stoat": {
    "dmHint": "Sent via DM."
  }
}
```

Each bot reads only its relevant keys. Unused keys are dead code but cause no harm — they're just JSON strings.

Alternatively, keep truly platform-specific strings in each bot's own locale files and only share the common strings via this package. This is a decision to make when the Stoat Bot is actually being built.
