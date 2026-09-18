/**
 * `validateStructure` — SEC-003 depth + prototype-pollution rules.
 *
 * These assert the exact messages, because both consumers put the returned
 * string straight into a response body (REFACTOR-009 parity).
 */

import { describe, it, expect } from 'vitest';
import { validateStructure } from './structure.js';

/**
 * Build a value whose deepest leaf sits at exactly `depth`.
 *
 * `validateStructure(v, max, 0)` starts the root at 0, so `nestToDepth(11)`
 * places its leaf one level past a budget of 10.
 */
function nestToDepth(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let i = 0; i < depth; i++) {
    value = { level: value };
  }
  return value;
}

describe('validateStructure', () => {
  describe('depth', () => {
    it('accepts a leaf sitting exactly at the budget', () => {
      expect(validateStructure(nestToDepth(10), 10, 0)).toBeNull();
    });

    it('rejects a leaf one level past the budget', () => {
      expect(validateStructure(nestToDepth(11), 10, 0)).toBe(
        'JSON nesting exceeds maximum depth of 10'
      );
    });

    it('names the configured budget in the message, not a hard-coded 10', () => {
      expect(validateStructure(nestToDepth(3), 2, 0)).toBe(
        'JSON nesting exceeds maximum depth of 2'
      );
    });

    it('counts array nesting the same as object nesting', () => {
      expect(validateStructure(nestToDepth(4), 10, 0)).toBeNull();
      expect(validateStructure([[[['leaf']]]], 3, 0)).toBe(
        'JSON nesting exceeds maximum depth of 3'
      );
      expect(validateStructure([[[['leaf']]]], 4, 0)).toBeNull();
    });

    it('honours a non-zero starting depth', () => {
      // Same value, same budget — only the starting offset differs.
      expect(validateStructure(nestToDepth(5), 10, 0)).toBeNull();
      expect(validateStructure(nestToDepth(5), 10, 6)).toBe(
        'JSON nesting exceeds maximum depth of 10'
      );
    });
  });

  describe('prototype pollution', () => {
    it('rejects an own __proto__ key', () => {
      // A literal `{ __proto__: … }` sets the prototype instead of creating an
      // own key, so the value has to come through JSON.parse to be realistic.
      const parsed: unknown = JSON.parse('{"__proto__": {"isAdmin": true}}');
      expect(validateStructure(parsed, 10, 0)).toBe('Invalid JSON structure');
    });

    it('rejects an own constructor key', () => {
      const parsed: unknown = JSON.parse('{"constructor": {"prototype": {"isAdmin": true}}}');
      expect(validateStructure(parsed, 10, 0)).toBe('Invalid JSON structure');
    });

    it('rejects an own prototype key', () => {
      const parsed: unknown = JSON.parse('{"prototype": {"isAdmin": true}}');
      expect(validateStructure(parsed, 10, 0)).toBe('Invalid JSON structure');
    });

    it('rejects a dangerous key nested below the root', () => {
      const parsed: unknown = JSON.parse('{"a": {"b": {"__proto__": {"isAdmin": true}}}}');
      expect(validateStructure(parsed, 10, 0)).toBe('Invalid JSON structure');
    });

    it('rejects a dangerous key inside an array element', () => {
      const parsed: unknown = JSON.parse('{"items": [{"__proto__": {}}]}');
      expect(validateStructure(parsed, 10, 0)).toBe('Invalid JSON structure');
    });

    it('accepts an ordinary key that merely contains a dangerous word', () => {
      const parsed: unknown = JSON.parse('{"constructorName": "Dye", "prototypeId": 3}');
      expect(validateStructure(parsed, 10, 0)).toBeNull();
    });
  });

  describe('values that are never structures', () => {
    it.each([
      ['null', null],
      ['a string', 'hello'],
      ['a number', 42],
      ['a boolean', true],
    ])('accepts %s at the root', (_label, value) => {
      expect(validateStructure(value, 10, 0)).toBeNull();
    });

    it('accepts an ordinary nested payload', () => {
      expect(validateStructure({ items: [1, 2, 3, { nested: true }] }, 10, 0)).toBeNull();
    });
  });
});
