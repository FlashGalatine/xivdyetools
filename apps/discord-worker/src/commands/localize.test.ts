/**
 * F-03 (2026-08-20 i18n audit): the registered schema carries Discord
 * localizations for every top-level command description and for the choice
 * lists that already have localized labels in the locale files.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initializeLocale } from '@xivdyetools/bot-logic';
import { commands } from './schemas.js';
import { localizeCommands, countLocalizations, LOCALE_CODES, DISCORD_LOCALE_MAP } from './localize.js';

const DISCORD_TAGS = DISCORD_LOCALE_MAP.map(([d]) => d);

describe('localizeCommands', () => {
  let localized: ReturnType<typeof localizeCommands>;

  beforeAll(async () => {
    await Promise.all(LOCALE_CODES.map((l) => initializeLocale(l)));
    localized = localizeCommands(commands);
  });

  it('does not mutate the source schema', () => {
    expect(commands.some((c) => 'description_localizations' in c)).toBe(false);
  });

  it('attaches description_localizations for every top-level command in all six Discord locales', () => {
    for (const cmd of localized) {
      const loc = cmd.description_localizations;
      expect(loc, `${cmd.name} has no description_localizations`).toBeDefined();
      for (const tag of DISCORD_TAGS) {
        expect(loc?.[tag], `${cmd.name} missing ${tag}`).toBeTruthy();
      }
    }
  });

  it('never registers a raw locale key or an over-long string', () => {
    const check = (v: string, where: string): void => {
      expect(v.length, `${where}: ${v}`).toBeLessThanOrEqual(100);
      expect(v, `${where}: raw key leaked`).not.toMatch(/^[a-z0-9]+(\.[A-Za-z0-9]+)+$/);
    };
    const walk = (opts: ReadonlyArray<{ name: string; choices?: ReadonlyArray<{ name_localizations?: Record<string, string> }>; options?: ReadonlyArray<never> }> | undefined, path: string): void => {
      for (const o of opts ?? []) {
        for (const c of o.choices ?? []) {
          for (const [tag, v] of Object.entries(c.name_localizations ?? {})) check(v, `${path}/${o.name} ${tag}`);
        }
        walk(o.options as never, `${path}/${o.name}`);
      }
    };
    for (const cmd of localized) {
      for (const [tag, v] of Object.entries(cmd.description_localizations ?? {})) check(v, `${cmd.name} ${tag}`);
      walk(cmd.options as never, cmd.name);
    }
  });

  it('localizes the /preferences reset key choices from preferences.keys.*', () => {
    const prefs = localized.find((c) => c.name === 'preferences')!;
    const reset = prefs.options!.find((o) => o.name === 'reset')!;
    const key = reset.options!.find((o) => o.name === 'key')!;
    const showHex = key.choices!.find((c) => c.value === 'show_hex')!;
    expect(showHex.name_localizations?.ja).toBeTruthy();
    expect(showHex.name_localizations?.['zh-TW']).toBe(showHex.name_localizations?.['zh-CN']);
  });

  it('localizes harmony types, vision lenses and dye categories; leaves method tags and endonyms alone', () => {
    const harmony = localized.find((c) => c.name === 'harmony')!;
    const type = harmony.options!.find((o) => o.name === 'type')!;
    expect(type.choices!.find((c) => c.value === 'split-complementary')!.name_localizations?.de).toBeTruthy();
    const matching = harmony.options!.find((o) => o.name === 'matching')!;
    expect(matching.choices!.every((c) => !c.name_localizations)).toBe(true);

    const a11y = localized.find((c) => c.name === 'accessibility')!;
    const vision = a11y.options!.find((o) => o.name === 'vision')!;
    expect(vision.choices!.find((c) => c.value === 'all')!.name_localizations?.ko).toBeTruthy();

    const dye = localized.find((c) => c.name === 'dye')!;
    const list = dye.options!.find((o) => o.name === 'list')!;
    const category = list.options!.find((o) => o.name === 'category')!;
    expect(category.choices!.find((c) => c.value === 'Reds')!.name_localizations?.ja).toBe('赤系');

    const prefs = localized.find((c) => c.name === 'preferences')!;
    const set = prefs.options!.find((o) => o.name === 'set')!;
    const language = set.options!.find((o) => o.name === 'language')!;
    expect(language.choices!.every((c) => !c.name_localizations)).toBe(true);
  });

  it('reports a non-trivial count', () => {
    const { descriptions, choiceNames } = countLocalizations(localized);
    expect(descriptions).toBe(commands.length);
    expect(choiceNames).toBeGreaterThanOrEqual(16 + 2 + 2 + 8 + 5 * 2 + 8);
  });
});
