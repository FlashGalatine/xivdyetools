import { describe, expect, it } from 'vitest';
import ko from './data/item-names.ko.json';
import { loadRegionalNames, regionalNames } from './regional-names';

describe('regional names boundary', () => {
  it('cleans legacy Korean RLM at lookup without changing historical data', async () => {
    await loadRegionalNames();
    for (const id of [1200, 1238]) {
      expect(ko[String(id) as keyof typeof ko]).toContain('\u200f');
      expect(regionalNames(id).ko).toBe(ko[String(id) as keyof typeof ko].replace(/\u200f/g, ''));
    }
    expect(regionalNames(999999999)).toEqual({});
  });
});
