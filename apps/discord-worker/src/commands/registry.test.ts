import { describe, it, expect } from 'vitest';
import { COMMAND_REGISTRY, registryCommandNames } from './registry.js';
import { commands } from './schemas.js';

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

  it('marks only /language as deprecated (v5 removes it)', () => {
    expect(COMMAND_REGISTRY.filter((c) => c.deprecated).map((c) => c.name)).toEqual(['language']);
  });
});
