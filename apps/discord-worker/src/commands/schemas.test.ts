/**
 * Schema ↔ runtime parity checks for option choice lists that the handlers
 * resolve against a data table at run time. A choice Discord offers that the
 * table does not know is a guaranteed "could not find …" error for the user.
 */

import { describe, it, expect } from 'vitest';
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
