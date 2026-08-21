/**
 * Slash-command localization (2026-08-20 i18n audit, F-03).
 *
 * Discord renders the command picker, option tooltips and choice dropdowns
 * from `description_localizations` / `name_localizations` on the registered
 * schema — the runtime Translator never reaches that surface. Until 5.0.x the
 * bot registered 17 commands / 152 descriptions / 166 choice labels in
 * English only, even for users with `/preferences set language:ja`.
 *
 * `localizeCommands()` deep-copies the schema and attaches, per Discord locale:
 *   - `description_localizations` on every top-level command from
 *     `commands.<name>.description` (bot-logic locale files);
 *   - `name_localizations` on choice lists whose values already have
 *     localized labels elsewhere in the suite (preferences reset keys,
 *     gender / theme values, harmony types, vision lenses, dye categories).
 *
 * A locale is only attached when the key resolves (the Translator returns the
 * raw key on a miss, which must never be registered) and the value fits
 * Discord's 100-character limit. Discord wants both `zh-CN` and `zh-TW`; the
 * bot ships one `zh`, so both map to it. English needs no entry — the base
 * `description` / `name` IS the English.
 *
 * The runtime never imports this module; only `scripts/register-commands.ts`
 * (run by CI on merge) does, after `initializeLocale()` for every locale so
 * the category lookups resolve.
 */

import { createTranslator, type LocaleCode, type Translator } from '@xivdyetools/bot-logic/i18n';
import { getLocalizedCategory } from '@xivdyetools/bot-logic';

/** Discord locale tag → bot locale. en-US / en-GB need no entry (base text is English). */
export const DISCORD_LOCALE_MAP: ReadonlyArray<readonly [discord: string, locale: LocaleCode]> = [
  ['ja', 'ja'],
  ['de', 'de'],
  ['fr', 'fr'],
  ['ko', 'ko'],
  ['zh-CN', 'zh'],
  ['zh-TW', 'zh'],
];

/** The bot locales the map above draws from (for `initializeLocale`). */
export const LOCALE_CODES: readonly LocaleCode[] = ['ja', 'de', 'fr', 'ko', 'zh'];

/** Discord's limit for command/option descriptions and choice names. */
const MAX_LEN = 100;

type Localizations = Record<string, string>;

interface Choice {
  name: string;
  value: string | number;
  name_localizations?: Localizations;
}

interface Option {
  name: string;
  description: string;
  type: number;
  choices?: ReadonlyArray<Choice>;
  options?: ReadonlyArray<Option>;
  description_localizations?: Localizations;
  [key: string]: unknown;
}

interface Command {
  name: string;
  description: string;
  options?: ReadonlyArray<Option>;
  description_localizations?: Localizations;
  [key: string]: unknown;
}

const translators = new Map<LocaleCode, Translator>();
function tFor(locale: LocaleCode): Translator {
  let t = translators.get(locale);
  if (!t) {
    t = createTranslator(locale);
    translators.set(locale, t);
  }
  return t;
}

/**
 * Build a localizations map from a resolver. A locale is skipped when the
 * resolver returns nothing, returns the key itself (Translator miss), or the
 * text is over Discord's limit.
 */
function buildLocalizations(
  resolve: (t: Translator, locale: LocaleCode) => string | undefined,
  key?: string,
): Localizations | undefined {
  const out: Localizations = {};
  for (const [discord, locale] of DISCORD_LOCALE_MAP) {
    const value = resolve(tFor(locale), locale);
    if (!value || value === key || value.length > MAX_LEN) continue;
    out[discord] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `t.t(key)` guarded against the raw-key miss. */
function keyed(key: string): Localizations | undefined {
  return buildLocalizations((t) => t.t(key), key);
}

const snakeToCamel = (s: string): string => s.replace(/[-_]([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** Option values whose preference key is not the plain camelCase of the value. */
const PREF_KEY_ALIASES: Record<string, string> = { show_deltae: 'showDeltaE' };

/**
 * Choice-name localizer per (command, option). Returns the localizations for
 * one choice value, or undefined when that list is intentionally not
 * localized (matching-method tags, language endonyms, preset categories…).
 */
function choiceLocalizations(command: string, option: string, value: string): Localizations | undefined {
  if (command === 'preferences' && option === 'key') {
    return keyed(`preferences.keys.${PREF_KEY_ALIASES[value] ?? snakeToCamel(value)}`);
  }
  if (command === 'preferences' && option === 'gender') {
    return keyed(`preferences.values.${value}`);
  }
  if (command === 'preferences' && option === 'theme') {
    const emoji = value === 'light' ? '☀️' : '🌙';
    const key = value === 'light' ? 'preferences.values.themeLight' : 'preferences.values.themeDark';
    return buildLocalizations((t) => {
      const v = t.t(key);
      return v === key ? undefined : `${emoji} ${v}`;
    });
  }
  if (command === 'harmony' && option === 'type') {
    return keyed(`harmony.${snakeToCamel(value)}`);
  }
  if ((command === 'accessibility' || command === 'a11y') && option === 'vision') {
    return keyed(value === 'all' ? 'accessibility.allLenses' : `accessibility.${value}`);
  }
  if (command === 'dye' && option === 'category') {
    // Core locale `categories` (Reds → 赤系 / Rot / …) — needs initializeLocale()
    return buildLocalizations((_t, locale) => {
      const v = getLocalizedCategory(value, locale);
      return v === value ? undefined : v;
    });
  }
  return undefined;
}

function localizeOption(command: string, option: Option): Option {
  const out: Option = { ...option };
  if (option.choices) {
    out.choices = option.choices.map((c) => {
      const loc = typeof c.value === 'string' ? choiceLocalizations(command, option.name, c.value) : undefined;
      return loc ? { ...c, name_localizations: loc } : { ...c };
    });
  }
  if (option.options) {
    out.options = option.options.map((o) => localizeOption(command, o));
  }
  return out;
}

/**
 * Deep-copy the command schema with Discord localizations attached.
 * Pure: the input array is never mutated.
 */
export function localizeCommands<T extends readonly Command[]>(commands: T): Command[] {
  return commands.map((cmd) => {
    const out: Command = { ...cmd };
    const desc = keyed(`commands.${cmd.name}.description`);
    if (desc) out.description_localizations = desc;
    if (cmd.options) out.options = cmd.options.map((o) => localizeOption(cmd.name, o));
    return out;
  });
}

/** Count attached localizations (for the register script's summary line). */
export function countLocalizations(commands: readonly Command[]): {
  descriptions: number;
  choiceNames: number;
} {
  let descriptions = 0;
  let choiceNames = 0;
  const walk = (opts?: ReadonlyArray<Option>): void => {
    for (const o of opts ?? []) {
      if (o.description_localizations) descriptions++;
      for (const c of o.choices ?? []) if (c.name_localizations) choiceNames++;
      walk(o.options);
    }
  };
  for (const c of commands) {
    if (c.description_localizations) descriptions++;
    walk(c.options);
  }
  return { descriptions, choiceNames };
}
