import { describe, it, expect } from 'vitest';
import type { PresetCategory } from '@xivdyetools/types';
import { COMMAND_REGISTRY, registryCommandNames } from './registry.js';
import { commands, PRESET_CATEGORY_CHOICES } from './schemas.js';

describe('command registry', () => {
  it('has unique names', () => {
    const names = registryCommandNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches the registered schema set exactly (roster parity)', () => {
    const schemaNames = commands.map((c: { name: string }) => c.name).sort();
    expect(registryCommandNames().sort()).toEqual(schemaNames);
  });

  it('every entry has a category', () => {
    for (const entry of COMMAND_REGISTRY) {
      expect(entry.category, entry.name).toBeTruthy();
    }
  });

  it('carries no deprecated commands (the v4 set is deleted)', () => {
    expect(COMMAND_REGISTRY.filter((c) => c.deprecated)).toEqual([]);
  });
});

/**
 * BUG-001 regression cover.
 *
 * A registered choice list lives on Discord's side, so a value the backing
 * union no longer defines is invisible locally — Discord presents it to the
 * user as valid and the bot forwards a category the API cannot serve. These
 * assertions are the only thing standing between a dropped union member and a
 * dead menu entry in every Discord client.
 */
describe('registered /preset category choices', () => {
  it('offers exactly the live PresetCategory members', () => {
    // Spelled out rather than derived: a type cannot be enumerated at runtime,
    // so this literal IS the tripwire. Updating it is the deliberate act that
    // acknowledges the registered contract changed.
    const liveMembers: PresetCategory[] = [
      'aesthetics',
      'appearance',
      'events',
      'grand-companies',
      'jobs',
      'raids-trials',
      'seasons',
      'zones',
    ];

    expect([...PRESET_CATEGORY_CHOICES].map((c) => c.value).sort()).toEqual(liveMembers.sort());
  });

  it('routes every registered category option through the shared constant', () => {
    // Guards the *class*, not the instance: the type binding only protects
    // PRESET_CATEGORY_CHOICES itself. A future hand-rolled choice block would
    // be a fresh literal typed as `string` and would slip past it — this walks
    // the schema tree that actually ships to Discord.
    type Option = { name: string; choices?: ReadonlyArray<{ name: string; value: string }> };
    type Command = { name: string; options?: Option[] };

    const preset = (commands as Command[]).find((c) => c.name === 'preset');
    expect(preset, 'the /preset command must exist').toBeDefined();

    const expected = [...PRESET_CATEGORY_CHOICES].map((c) => c.value);
    const categoryOptions = (preset?.options ?? [])
      .flatMap((sub) => (sub as unknown as Command).options ?? [])
      .filter((opt) => opt.name === 'category');

    // list, random, submit
    expect(categoryOptions).toHaveLength(3);

    for (const opt of categoryOptions) {
      expect(opt.choices?.map((c) => c.value)).toEqual(expected);
    }
  });
});

describe('/extractor schema promises only what the handler reads', () => {
  type Opt = { name: string; options?: Opt[] };
  const extractor = commands.find((c) => c.name === 'extractor') as unknown as Opt;
  const sub = (name: string) => (extractor.options ?? []).find((o) => o.name === name) as Opt;
  const optionNames = (name: string) => (sub(name).options ?? []).map((o) => o.name);

  it('color: color/count/matching — no prevent_duplicates (nearest-N of distinct dyes cannot repeat)', () => {
    expect(optionNames('color')).toEqual(['color', 'count', 'matching']);
  });

  it('image: image/colors/matching/prevent_duplicates — vibrancy_boost is gone (never implemented)', () => {
    expect(optionNames('image')).toEqual(['image', 'colors', 'matching', 'prevent_duplicates']);
  });
});
