import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
const source = readFileSync(
  resolve(import.meta.dirname, '../scripts/register-commands.ts'),
  'utf8',
);
const definition = source.slice(
  source.indexOf('const commands = ['),
  source.indexOf('// Registration Logic'),
);
const commands = runInNewContext(`${definition};commands`, {
  OptionType: { SUB_COMMAND: 1, STRING: 3 },
}) as Array<{
  options: Array<{
    name: string;
    options: Array<{ name: string; required: boolean; autocomplete?: boolean }>;
  }>;
}>;
describe('ban command registration contract', () => {
  it('has required user then optional independently autocompleted additional_user on ban only', () => {
    const subcommands = commands[0]!.options;
    expect(subcommands.find((command) => command.name === 'ban_user')!.options).toEqual([
      {
        name: 'user',
        description: 'User to ban (search by username)',
        type: 3,
        required: true,
        autocomplete: true,
      },
      {
        name: 'additional_user',
        description: 'Additional explicit account ID to review',
        type: 3,
        required: false,
        autocomplete: true,
      },
    ]);
    expect(
      subcommands
        .find((command) => command.name === 'unban_user')!
        .options.map((option) => option.name),
    ).toEqual(['user']);
  });
});
