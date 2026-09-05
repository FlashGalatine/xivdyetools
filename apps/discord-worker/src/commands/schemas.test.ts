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
type Option = { name: string; options?: Option[]; choices?: Choice[]; max_length?: number };

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
