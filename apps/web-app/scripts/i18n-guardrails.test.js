/**
 * Unit tests for the i18n guardrail scripts' load-bearing pieces.
 *
 * Both gates hinge on one non-obvious claim each, and neither is provable by
 * reading the code:
 *
 *   - `parseJsonWithDuplicates` must agree with `JSON.parse` on every real
 *     locale file (it is a hand-written parser; if it disagreed, the parity
 *     report would be about a different document than the app loads) while
 *     ALSO seeing the duplicate keys `JSON.parse` silently discards.
 *   - `reorderNode` must be a pure permutation: same leaves, same values, only
 *     the order changes. That is the promise the reorder commit made.
 *
 * @module scripts/i18n-guardrails.test
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

import { parseJsonWithDuplicates, flattenEntries, placeholders } from './i18n-parity.mjs';
import { reorderNode, serializeLocale } from './reorder-locales.mjs';

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');
const LOCALE_FILES = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

describe('parseJsonWithDuplicates', () => {
  it('agrees with JSON.parse on every locale file', () => {
    expect(LOCALE_FILES.length).toBe(6);
    for (const file of LOCALE_FILES) {
      const raw = readFileSync(join(LOCALES_DIR, file), 'utf-8');
      const { value, duplicates } = parseJsonWithDuplicates(raw);
      expect(value, file).toEqual(JSON.parse(raw));
      expect(duplicates, file).toEqual([]);
    }
  });

  it('reports a duplicate key that JSON.parse discards', () => {
    const raw = '{\n  "a": {\n    "b": "first",\n    "b": "second"\n  }\n}';
    expect(Object.keys(JSON.parse(raw).a)).toEqual(['b']); // the defect is invisible here
    const { value, duplicates } = parseJsonWithDuplicates(raw);
    expect(duplicates).toEqual([{ path: 'a.b', line: 4 }]);
    expect(value).toEqual({ a: { b: 'second' } }); // last one wins, as at runtime
  });

  it('is not fooled by braces or quotes inside string values', () => {
    const raw = '{ "a": "a \\" quote and a { brace", "b": "{n} left" }';
    expect(parseJsonWithDuplicates(raw).duplicates).toEqual([]);
    expect(parseJsonWithDuplicates(raw).value).toEqual(JSON.parse(raw));
  });
});

describe('placeholders', () => {
  it('extracts interpolation tokens, sorted and de-duplicated', () => {
    expect(placeholders('{b} then {a} then {b}')).toEqual(['a', 'b']);
    expect(placeholders('no tokens here')).toEqual([]);
    expect(placeholders(42)).toEqual([]);
  });
});

describe('reorderNode', () => {
  it('permutes keys without touching values', () => {
    const reference = { z: { a: 1, b: 2 }, y: 3 };
    const target = { y: 'trois', z: { b: 'deux', a: 'un' } };
    const reordered = reorderNode(reference, target);
    expect(Object.keys(reordered)).toEqual(['z', 'y']);
    expect(Object.keys(reordered.z)).toEqual(['a', 'b']);
    expect(reordered).toEqual(target);
  });

  it('keeps keys en.json does not have, and reports them', () => {
    const extras = [];
    const reordered = reorderNode({ a: 1 }, { b: 2, a: 1 }, extras);
    expect(Object.keys(reordered)).toEqual(['a', 'b']);
    expect(extras).toEqual(['b']);
  });

  it('leaves every shipped locale file byte-identical (they are already sorted)', () => {
    const reference = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf-8'));
    for (const file of LOCALE_FILES) {
      const raw = readFileSync(join(LOCALES_DIR, file), 'utf-8');
      expect(serializeLocale(reorderNode(reference, JSON.parse(raw))), file).toBe(raw);
    }
  });
});

describe('flattenEntries', () => {
  it('preserves file order and treats arrays as leaves', () => {
    const flat = flattenEntries({ b: { d: 1, c: [1, 2] }, a: 'x' });
    expect([...flat.keys()]).toEqual(['b.d', 'b.c', 'a']);
    expect(flat.get('b.c')).toEqual([1, 2]);
  });
});
