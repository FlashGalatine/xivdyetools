/**
 * F-03 (2026-08-20 i18n audit): the registered schema carries Discord
 * localizations for every top-level command description and for the choice
 * lists that already have localized labels in the locale files.
 *
 * Extended by I18N-001/I18N-002 (2026-09-19 i18n audit): description
 * localizations now recurse into every subcommand/group/option, a per-command
 * character budget guards Discord's 8,000-char cap, a drift gate keeps
 * en.json's `commands.*.options` subtree in sync with `schemas.ts`, and
 * `/manual topic` picks up localized choice names.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { initializeLocale } from '@xivdyetools/bot-logic';
import { commands } from './schemas.js';
import {
  localizeCommands,
  countLocalizations,
  commandCharCount,
  LOCALE_CODES,
  DISCORD_LOCALE_MAP,
} from './localize.js';
import { buildOptionDescriptionTree, type SchemaOption } from '../../scripts/gen-option-description-keys.js';

const DISCORD_TAGS = DISCORD_LOCALE_MAP.map(([d]) => d);

/** A raw locale key never registered (Translator miss / never resolved). */
const RAW_KEY_PATTERN = /^[a-z0-9]+(\.[A-Za-z0-9]+)+$/;

interface WalkableOption {
  name: string;
  description_localizations?: Record<string, string>;
  choices?: ReadonlyArray<{ value: string | number; name_localizations?: Record<string, string> }>;
  options?: ReadonlyArray<WalkableOption>;
}

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
      expect(v, `${where}: raw key leaked`).not.toMatch(RAW_KEY_PATTERN);
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

  // I18N-002: /manual topic choices.
  it('localizes all six /manual topic choices in every Discord locale with a name distinct from the raw key', () => {
    const manual = localized.find((c) => c.name === 'manual')!;
    const topic = manual.options!.find((o) => o.name === 'topic')!;
    const values = [
      'match_image',
      'color_vision',
      'contrast',
      'matching_methods',
      'spectrum_prices',
      'character_file',
    ];
    for (const value of values) {
      const choice = topic.choices!.find((c) => c.value === value);
      expect(choice, `no choice for ${value}`).toBeDefined();
      for (const tag of DISCORD_TAGS) {
        const v = choice!.name_localizations?.[tag];
        expect(v, `${value} missing ${tag}`).toBeTruthy();
        expect(v, `${value} ${tag} leaked the raw value`).not.toBe(value);
      }
    }
  });

  it('reports a non-trivial count', () => {
    const { descriptions, choiceNames } = countLocalizations(localized);
    // I18N-001: this used to be pinned to `descriptions === commands.length`
    // (17) — the gate that hid 134 untranslated option/subcommand tooltips
    // instead of catching them. It is now a floor: the 17 top-level
    // descriptions are always localized (F-03), and the total only grows as
    // description_localizations is attached recursively. See the "coverage"
    // describe block below for the exhaustive, per-locale assertion.
    expect(descriptions).toBeGreaterThanOrEqual(commands.length);
    // +6 over the pre-I18N-002 floor for the /manual topic choices.
    expect(choiceNames).toBeGreaterThanOrEqual(16 + 2 + 2 + 8 + 5 * 2 + 8 + 6);
  });

  // ==========================================================================
  // I18N-001: exhaustive coverage. Two layers:
  //
  // 1. The BUILT Discord payload: every (path, Discord-locale-tag) either
  //    carries a value or is absent — never a raw key, never over 100 chars.
  //    This alone is a weak gate: bot-logic's `Translator.t()` falls back to
  //    English when a locale is MISSING a key entirely (by design, so a
  //    partially-translated locale still shows English rather than nothing),
  //    so a locale file with no `commands.*.options` subtree at all still
  //    produces a full, valid `description_localizations` map here — just one
  //    full of English text. That masks exactly the gap I18N-001 exists to
  //    close, so it cannot be the whole test.
  // 2. Layer 2 reads each locale's OWN source JSON directly (bypassing the
  //    Translator's fallback) and checks whether IT has authored the key —
  //    this is what is RED until the five locale agents finish adding
  //    `commands.*.options.*.description` to their own files, and the
  //    failure message reports exactly which (locale, path) pairs are still
  //    missing at the time this suite ran.
  // ==========================================================================
  describe('coverage: description_localizations for every level, every Discord locale', () => {
    it('the built payload never carries a raw key, an empty value or an over-long value', () => {
      const gaps: string[] = [];
      const walk = (opts: ReadonlyArray<WalkableOption> | undefined, path: string): void => {
        for (const o of opts ?? []) {
          const p = `${path}/${o.name}`;
          for (const [tag, v] of Object.entries(o.description_localizations ?? {})) {
            if (!v || v.length === 0 || v.length > 100 || RAW_KEY_PATTERN.test(v)) {
              gaps.push(`${p} [${tag}]: ${JSON.stringify(v)}`);
            }
          }
          walk(o.options, p);
        }
      };
      for (const cmd of localized as unknown as WalkableOption[]) {
        walk(cmd.options, cmd.name);
      }
      expect(gaps, `${gaps.length} attached option description_localizations were invalid`).toEqual([]);
    });

    it('every locale file has authored its OWN commands.*.options.*.description (not just the English fallback)', () => {
      const HERE = dirname(fileURLToPath(import.meta.url));
      const localesDir = join(HERE, '..', '..', '..', '..', 'packages', 'bot-logic', 'src', 'i18n', 'locales');
      const getAtPath = (obj: unknown, path: string): unknown =>
        path
          .split('.')
          .reduce<unknown>(
            (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
            obj,
          );

      const gaps: string[] = [];
      for (const lc of LOCALE_CODES) {
        const data = JSON.parse(readFileSync(join(localesDir, `${lc}.json`), 'utf-8')) as Record<string, unknown>;
        const walk = (opts: ReadonlyArray<SchemaOption> | undefined, path: string): void => {
          for (const o of opts ?? []) {
            const p = `${path}.options.${o.name}`;
            const v = getAtPath(data, `${p}.description`);
            if (typeof v !== 'string' || v.length === 0) gaps.push(`${lc}: ${p}.description`);
            walk(o.options, p);
          }
        };
        for (const cmd of commands as ReadonlyArray<SchemaOption>) {
          walk(cmd.options, `commands.${cmd.name}`);
        }
      }
      if (gaps.length > 0) {
        console.warn(
          `I18N-001: ${gaps.length} per-locale gap(s) in commands.*.options.*.description — ` +
            `expected for any locale file the agents are still editing:\n` +
            `${gaps.slice(0, 80).join('\n')}${gaps.length > 80 ? `\n… +${gaps.length - 80} more` : ''}`,
        );
      }
      expect(gaps, 'see console.warn above for the exact per-locale list of missing keys').toEqual([]);
    });
  });

  // ==========================================================================
  // I18N-001: Discord's 8,000-character per-command payload cap.
  // ==========================================================================
  it('keeps every localized command under Discord\'s 8,000-character payload cap', () => {
    const totals = localized
      .map((cmd) => ({ name: cmd.name, total: commandCharCount(cmd) }))
      .sort((a, b) => b.total - a.total);
    console.log(
      'Per-command character totals (name + description + every option/choice + all localizations), largest first:\n' +
        totals.map(({ name, total }) => `  /${name}: ${total}`).join('\n'),
    );
    const over = totals.filter((t) => t.total > 8000);
    expect(over, `over Discord's 8000-char cap: ${JSON.stringify(over)}`).toEqual([]);
  });

  // ==========================================================================
  // I18N-001: drift gate — en.json's commands.*.options subtree must match
  // what schemas.ts yields (same shape + same English strings), so a schema
  // edit without re-running scripts/gen-option-description-keys.ts fails here
  // instead of silently drifting.
  // ==========================================================================
  it('matches en.json\'s commands.*.options subtree against schemas.ts (drift gate)', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const enPath = join(HERE, '..', '..', '..', '..', 'packages', 'bot-logic', 'src', 'i18n', 'locales', 'en.json');
    const en = JSON.parse(readFileSync(enPath, 'utf-8')) as {
      commands: Record<string, { options?: unknown }>;
    };
    for (const cmd of commands as ReadonlyArray<SchemaOption>) {
      const expected = buildOptionDescriptionTree(cmd.options);
      const actual = en.commands[cmd.name]?.options;
      expect(
        actual,
        `commands.${cmd.name}.options drifted from schemas.ts — re-run scripts/gen-option-description-keys.ts`,
      ).toEqual(expected);
    }
  });
});
