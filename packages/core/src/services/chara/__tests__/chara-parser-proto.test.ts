/**
 * Prototype-chain lookups on untrusted keys (FINDING-027, 2026-08-21 audit).
 *
 * `mapNamed` used `table[value]` on plain object literals, so a .chara file
 * naming `"Tribe": "constructor"` / `"__proto__"` / `"toString"` passed
 * validation with a Function / Object.prototype as the "mapped" value.
 * Lookups must be own-property only.
 */
import { describe, it, expect } from 'vitest';
import { parseCharaFile } from '../chara-parser.js';

const base = { Race: 'Viera', Tribe: 'Rava', Gender: 'Feminine', Skintone: 1 };

describe('parseCharaFile prototype-key hardening', () => {
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'rejects Tribe = %s as unrecognised',
    (key) => {
      expect(() => parseCharaFile(JSON.stringify({ ...base, Tribe: key }))).toThrow(/unrecognised value/);
    },
  );

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'rejects Gender = %s as unrecognised',
    (key) => {
      expect(() => parseCharaFile(JSON.stringify({ ...base, Gender: key }))).toThrow(/unrecognised value/);
    },
  );

  // Race is derived from the tribe and no longer throws on a value we do not
  // know (spec 10a, "Tribe, not Race"), so the guarantee here is narrower and
  // stricter than a refusal: a prototype key must never become the race.
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'never resolves Race = %s to anything off the prototype chain',
    (key) => {
      // With a tribe present the key is not consulted at all.
      expect(parseCharaFile(JSON.stringify({ ...base, Race: key })).race).toBe('Viera');
      // Without one it goes through the fallback table, which is own-property only.
      const { Tribe: _omitted, ...tribeless } = base;
      expect(parseCharaFile(JSON.stringify({ ...tribeless, Race: key })).race).toBeNull();
    },
  );

  it('still accepts the real spellings', () => {
    expect(parseCharaFile(JSON.stringify(base)).tribe).toBe('Rava');
  });
});
