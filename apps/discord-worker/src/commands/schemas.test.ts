/**
 * Schema ↔ runtime parity checks for option choice lists that the handlers
 * resolve against a data table at run time. A choice Discord offers that the
 * table does not know is a guaranteed "could not find …" error for the user.
 */

import { describe, it, expect } from 'vitest';
import { HARMONY_TYPES } from '@xivdyetools/bot-logic';
import { commands as COMMAND_SCHEMAS } from './schemas.js';
import { QUICK_PICKS } from '../services/budget/quick-picks.js';
import { WORLD_NAME_MAX_LENGTH } from '../services/preferences.js';

type Choice = { name: string; value: string | number };
type Option = {
  name: string;
  description?: string;
  type?: number;
  options?: Option[];
  choices?: Choice[];
  min_length?: number;
  max_length?: number;
};

/** Discord's STRING option type (schemas.ts `OptionType.STRING`). */
const STRING = 3;

function findOption(path: string[], options: Option[] | undefined): Option | undefined {
  const [head, ...rest] = path;
  const hit = options?.find((o) => o.name === head);
  return rest.length === 0 ? hit : findOption(rest, hit?.options);
}

describe('/budget quick preset choices', () => {
  it('offer exactly the QUICK_PICKS the handler can resolve (getQuickPickById)', () => {
    const budget = COMMAND_SCHEMAS.find((c) => c.name === 'budget') as unknown as Option;
    const preset = findOption(['quick', 'preset'], budget.options);
    expect(preset?.choices, '/budget quick preset has no choices').toBeDefined();

    const offered = preset!.choices!.map((c) => String(c.value)).sort();
    const resolvable = QUICK_PICKS.map((p) => p.id).sort();
    expect(offered).toEqual(resolvable);
    // Discord caps a choice list at 25 entries.
    expect(offered.length).toBeLessThanOrEqual(25);
  });
});

/**
 * FINDING-019 (2026-08-29 security audit): a STRING option with no
 * `max_length` accepts up to 6000 characters, and `/preferences set world:`
 * stored whatever arrived. The cap belongs in the registered schema (Discord
 * rejects the input client-side) AND in the service guard behind it — the two
 * must agree, or the schema silently admits values the guard then refuses.
 */
describe('world options carry the length cap', () => {
  const WORLD_OPTIONS: Array<{ command: string; path: string[] }> = [
    { command: 'preferences', path: ['set', 'world'] },
    { command: 'budget', path: ['find', 'world'] },
    { command: 'budget', path: ['set_world', 'world'] },
    { command: 'budget', path: ['quick', 'world'] },
  ];

  it.each(WORLD_OPTIONS)('/$command $path.0 world: is capped', ({ command, path }) => {
    const schema = COMMAND_SCHEMAS.find((c) => c.name === command) as unknown as Option;
    const option = findOption(path, schema.options);

    expect(option, `/${command} ${path.join(' ')} option missing`).toBeDefined();
    expect(option!.max_length).toBe(WORLD_NAME_MAX_LENGTH);
  });

  it('caps every registered world option — none may be added uncapped', () => {
    const uncapped: string[] = [];
    const walk = (commandName: string, trail: string[], options?: Option[]): void => {
      for (const option of options ?? []) {
        if (option.name === 'world' && option.max_length === undefined) {
          uncapped.push(`/${commandName} ${[...trail, option.name].join(' ')}`);
        }
        walk(commandName, [...trail, option.name], option.options);
      }
    };
    for (const command of COMMAND_SCHEMAS as unknown as Option[]) {
      walk(command.name, [], command.options);
    }

    expect(uncapped).toEqual([]);
  });

  it('pins the cap the registered schema publishes', () => {
    expect(WORLD_NAME_MAX_LENGTH).toBe(32);
  });
});

/**
 * `compound` and `shades` reached core's `HARMONY_OFFSETS`, bot-logic's roster
 * and all six locale files, but never reached the registered choice list — so
 * the changelog announced ten harmony types while Discord went on offering
 * eight, and six new locale strings could not be reached by any user. The
 * choices are derived from a `Record<HarmonyType, string>` now, which makes
 * that a compile error; this pins the runtime end of it.
 */
describe('/harmony type choices', () => {
  const harmony = COMMAND_SCHEMAS.find((c) => c.name === 'harmony') as unknown as Option;
  const typeOption = findOption(['type'], harmony.options);

  it('offers exactly the harmony types the shared table defines', () => {
    expect(typeOption?.choices, '/harmony type has no choices').toBeDefined();
    const registered = typeOption!.choices!.map((c) => String(c.value)).sort();
    expect(registered).toEqual([...HARMONY_TYPES].sort());
  });

  it('includes compound and shades', () => {
    const registered = (typeOption?.choices ?? []).map((c) => String(c.value));
    expect(registered).toContain('compound');
    expect(registered).toContain('shades');
  });

  it("gives every choice a non-empty label inside Discord's cap", () => {
    const choices = typeOption?.choices ?? [];
    expect(choices.length).toBeLessThanOrEqual(25);
    for (const c of choices) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.name.length).toBeLessThanOrEqual(100);
    }
  });

  /**
   * `color_space` was withdrawn and REPLACED: choosing the geometry a harmony
   * is measured on is now the `wheel` option, which the page, the card and the
   * OG image all read from the same core registry. `color_space` asked a
   * different question — which colour space to rotate hue in, abandoning the
   * base's saturation and value — and bot-logic discarded the value with a
   * `void`, so the option was accepted and changed nothing. It is not coming
   * back: `wheel` is where that choice lives.
   */
  it('registers the wheel option in place of the colour space it never honoured', () => {
    const names = (harmony.options ?? []).map((o) => o.name);
    expect(names).not.toContain('color_space');
    expect(names).toContain('wheel');
  });

  it('still registers the options that do something', () => {
    const names = (harmony.options ?? []).map((o) => o.name);
    expect(names).toContain('strict_matching');
    expect(names).toContain('prevent_duplicates');
    expect(names).toContain('companions');
  });
});

/**
 * REFACTOR-003: submit/edit documented "2-50" / "10-200" character bounds
 * only in the option description text — Discord never enforced them, so an
 * out-of-range name or description reached presets-api and failed there
 * instead of at the client.
 */
describe('/preset submit|edit length bounds', () => {
  const preset = COMMAND_SCHEMAS.find((c) => c.name === 'preset') as unknown as Option;

  const PRESET_LENGTH_OPTIONS: Array<{ path: string[]; min: number; max: number }> = [
    { path: ['submit', 'preset_name'], min: 2, max: 50 },
    { path: ['submit', 'description'], min: 10, max: 200 },
    { path: ['edit', 'name'], min: 2, max: 50 },
    { path: ['edit', 'description'], min: 10, max: 200 },
  ];

  it.each(PRESET_LENGTH_OPTIONS)(
    '/preset $path.0 $path.1 carries its documented bounds',
    ({ path, min, max }) => {
      const option = findOption(path, preset.options);

      expect(option, `/preset ${path.join(' ')} option missing`).toBeDefined();
      expect(option!.min_length).toBe(min);
      expect(option!.max_length).toBe(max);
    },
  );
});

/**
 * BUG-044 (2026-10-04 deep dive): a STRING option with no `max_length` accepts
 * up to 6000 characters. The colour/dye options had none, so `/harmony
 * color:<4000+ characters>` reached the handler, which echoed it into an
 * `errors.invalidColor` description past Discord's 4096-character embed cap —
 * the reply was rejected and the user saw "The application did not respond".
 * The handlers now cap the echo; the schema caps the input itself, so Discord
 * refuses an over-long value in the client before it is ever sent.
 *
 * The rule covers every free-text STRING option — one with no `choices` list —
 * not only the colour/dye ones, so a new free-text option cannot be added
 * uncapped. The default cap is 100: Discord caps an autocomplete choice's
 * `value` at 100 characters, so no pick from an autocomplete list can be
 * refused by it, and the longest dye name in any of the six locales is a
 * fraction of it.
 */
describe('free-text STRING options carry a length cap', () => {
  const FREE_TEXT_MAX_LENGTH = 100;

  /**
   * Free-text options whose cap is deliberately NOT the default, keyed by
   * `/command path…`. Each one must still be a registered free-text STRING
   * option whose cap differs from the default — a stale entry fails below.
   */
  const DELIBERATE_CAPS: Record<string, { max: number; reason: string }> = {
    '/preferences set world': {
      max: WORLD_NAME_MAX_LENGTH,
      reason: 'FINDING-019: matches the WORLD_NAME_MAX_LENGTH guard in services/preferences.ts',
    },
    '/budget find world': {
      max: WORLD_NAME_MAX_LENGTH,
      reason: 'FINDING-019: the same world-name cap as /preferences set world',
    },
    '/budget set_world world': {
      max: WORLD_NAME_MAX_LENGTH,
      reason: 'FINDING-019: the same world-name cap as /preferences set world',
    },
    '/budget quick world': {
      max: WORLD_NAME_MAX_LENGTH,
      reason: 'FINDING-019: the same world-name cap as /preferences set world',
    },
    '/preset submit preset_name': {
      max: 50,
      reason: "REFACTOR-003: presets-api's name rule is 2-50 characters",
    },
    '/preset edit name': {
      max: 50,
      reason: "REFACTOR-003: presets-api's name rule is 2-50 characters",
    },
    '/preset submit description': {
      max: 200,
      reason: "REFACTOR-003: presets-api's description rule is 10-200 characters",
    },
    '/preset edit description': {
      max: 200,
      reason: "REFACTOR-003: presets-api's description rule is 10-200 characters",
    },
    '/preset submit tags': {
      max: 400,
      reason:
        "presets-api accepts 10 tags of up to 30 characters; joined by ', ' that is 318 characters, so 100 would refuse a valid tag list",
    },
    '/preset edit tags': {
      max: 400,
      reason: 'the same tag list as /preset submit tags',
    },
  };

  /** Every registered STRING option with no `choices`, by `/command path…`. */
  function freeTextOptions(): Map<string, Option> {
    const found = new Map<string, Option>();
    const walk = (trail: string[], options?: Option[]): void => {
      for (const option of options ?? []) {
        const path = [...trail, option.name];
        if (option.type === STRING && option.choices === undefined) {
          found.set(`/${path.join(' ')}`, option);
        }
        walk(path, option.options);
      }
    };
    for (const command of COMMAND_SCHEMAS as unknown as Option[]) {
      walk([command.name], command.options);
    }
    return found;
  }

  it('finds the colour and dye options the finding names, nested ones included', () => {
    const paths = [...freeTextOptions().keys()];
    expect(paths).toEqual(
      expect.arrayContaining([
        '/harmony color',
        '/dye search query',
        '/dye info name',
        '/extractor color color',
        '/gradient start_color',
        '/gradient end_color',
        '/mixer dye1',
        '/mixer dye2',
        '/comparison dye4',
        '/contrast dye4',
        '/accessibility dye2',
        '/a11y dye2',
        '/budget find target_dye',
        '/preset edit dye6',
      ]),
    );
  });

  it('declares max_length on every one of them', () => {
    const uncapped = [...freeTextOptions()]
      .filter(([, option]) => option.max_length === undefined)
      .map(([path]) => path);

    expect(uncapped).toEqual([]);
  });

  it('caps each at the default unless the cap is a listed deliberate one', () => {
    const wrong: string[] = [];
    for (const [path, option] of freeTextOptions()) {
      const expected = DELIBERATE_CAPS[path]?.max ?? FREE_TEXT_MAX_LENGTH;
      if (option.max_length !== expected) {
        wrong.push(`${path}: max_length ${String(option.max_length)}, expected ${expected}`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it('keeps every deliberate cap live: a registered free-text option, a non-default cap, a reason', () => {
    const registered = freeTextOptions();
    const stale: string[] = [];
    for (const [path, { max, reason }] of Object.entries(DELIBERATE_CAPS)) {
      if (!registered.has(path)) stale.push(`${path}: not a registered free-text STRING option`);
      if (max === FREE_TEXT_MAX_LENGTH) stale.push(`${path}: the default cap needs no exception`);
      if (reason.trim().length === 0) stale.push(`${path}: no reason`);
    }

    expect(stale).toEqual([]);
  });

  it("stays inside Discord's 1-6000 range for max_length", () => {
    for (const [path, option] of freeTextOptions()) {
      expect(option.max_length, path).toBeGreaterThanOrEqual(1);
      expect(option.max_length, path).toBeLessThanOrEqual(6000);
    }
  });
});

/**
 * BUG-049 (2026-10-04 deep dive): the clan and gender options said "Default
 * clan/gender for /swatch", but /swatch reads both from the `.chara` file and
 * nothing reads the stored values. The description must not name a command
 * that does not read the setting.
 */
describe('/preferences set clan|gender descriptions', () => {
  const preferences = COMMAND_SCHEMAS.find((c) => c.name === 'preferences') as unknown as Option;

  it.each(['clan', 'gender'])('%s: names no consumer and says nothing reads it', (name) => {
    const option = findOption(['set', name], preferences.options);

    expect(option, `/preferences set ${name} option missing`).toBeDefined();
    const description = option!.description ?? '';
    expect(description).not.toMatch(/\/[a-z]/);
    expect(description).toMatch(/no command reads it yet/);
    // Discord's limit for an option description.
    expect(description.length).toBeLessThanOrEqual(100);
  });
});
