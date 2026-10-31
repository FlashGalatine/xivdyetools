import { describe, expect, it, vi } from 'vitest';
import ko from './data/item-names.ko.json';
import { loadRegionalNames, regionalNames } from './regional-names';

// Keep legacy unsafe input explicit after the generated tables have been cleaned.
vi.mock('./data/item-names.ko.json', () => ({
  default: {
    '1200': '구식 가죽 반장갑(황\u200f토색)',
    '1238': '구식 두꺼비 반장갑(황\u200f토색)',
  },
}));

describe('regional names boundary', () => {
  it('cleans legacy Korean RLM at lookup without mutating input tables', async () => {
    await loadRegionalNames();
    for (const id of [1200, 1238]) {
      const key = String(id) as keyof typeof ko;
      const original = ko[key];
      expect(original).toContain('\u200f');
      expect(regionalNames(id).ko).toBe(original.replace(/\u200f/g, ''));
      expect(ko[key]).toBe(original);
    }
    expect(regionalNames(999999999)).toEqual({});
  });
});
