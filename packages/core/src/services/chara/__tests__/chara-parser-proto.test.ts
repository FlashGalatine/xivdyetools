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

  it.each(['constructor', '__proto__'])('rejects Race = %s and Gender = %s as unrecognised', (key) => {
    expect(() => parseCharaFile(JSON.stringify({ ...base, Race: key }))).toThrow(/unrecognised value/);
    expect(() => parseCharaFile(JSON.stringify({ ...base, Gender: key }))).toThrow(/unrecognised value/);
  });

  it('still accepts the real spellings', () => {
    expect(parseCharaFile(JSON.stringify(base)).tribe).toBe('Rava');
  });
});
