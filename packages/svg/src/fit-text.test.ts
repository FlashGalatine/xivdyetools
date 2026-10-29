import { describe, expect, it } from 'vitest';
import { fitText, textWidth } from './frame.js';

type Font = 'mono' | 'body' | 'display';
const fonts: Font[] = ['mono', 'body', 'display'];

// Frozen pre-A-SVG implementation: deliberately retain the descending loop.
function legacyFitText(content: string, maxPx: number, size: number, font: Font): string {
  if (textWidth(content, size, font) <= maxPx) return content;
  const chars = [...content];
  while (chars.length > 1 && textWidth(chars.join('') + '…', size, font) > maxPx) {
    chars.pop();
  }
  return chars.join('').trimEnd() + '…';
}

// Immediate representable neighbours, including zero/subnormal and overflow edges.
function neighbours(value: number): number[] {
  if (Number.isNaN(value)) return [value];
  if (value === 0) return [-Number.MIN_VALUE, value, Number.MIN_VALUE];
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, bits - 1n);
  const before = view.getFloat64(0);
  view.setBigUint64(0, bits + 1n);
  return [before, value, view.getFloat64(0)];
}

describe('fitText legacy contract', () => {
  it('bounds actual string-iteration work linearly and restores instrumentation', () => {
    const content = 'A界😀 '.repeat(512);
    const codePoints = [...content].length;
    const budget = 8 * codePoints + 32;
    const descriptor = Object.getOwnPropertyDescriptor(String.prototype, Symbol.iterator)!;
    const original = String.prototype[Symbol.iterator];
    let visits = 0;
    let result: string;
    try {
      Object.defineProperty(String.prototype, Symbol.iterator, {
        ...descriptor,
        value: function* (this: string) {
          const iterator = original.call(this);
          for (let next = iterator.next(); !next.done; next = iterator.next()) {
            visits++;
            if (visits > budget) throw new Error(`fitText exceeded linear visit budget ${budget}`);
            yield next.value;
          }
        },
      });
      result = fitText(content, 0, 12, 'body');
    } finally {
      Object.defineProperty(String.prototype, Symbol.iterator, descriptor);
    }
    expect(result).toBe('A…');
    expect(visits).toBeGreaterThan(codePoints);
    expect(visits).toBeLessThanOrEqual(budget);
    expect(String.prototype[Symbol.iterator]).toBe(original);
  });

  it.each([
    ['fast-path trailing whitespace', 'A \t\n', 100, 10, 'A \t\n'],
    ['measure before trimming', 'A   Z', 16.2, 10, 'A…'],
    ['trim selected whitespace', ' \tZ', 0, 10, '…'],
    ['first code point fallback', '界AB', -1, 10, '界…'],
    ['valid surrogate pair fallback', '😀AB', 0, 10, '😀…'],
    ['astral CJK remains narrow', '𠀀AB', 10.8, 10, '𠀀…'],
    ['lone surrogate preserved', '\ud800AB', 0, 10, '\ud800…'],
    ['empty finite budget', '', 0, 10, ''],
    ['empty negative budget', '', -1, 10, '…'],
    ['NaN budget keeps full prefix', 'AB ', NaN, 10, 'AB…'],
    ['NaN size keeps full prefix', 'AB ', 0, NaN, 'AB…'],
    ['empty NaN budget', '', NaN, 10, '…'],
    ['positive zero size', 'AB ', 0, 0, 'AB '],
    ['negative zero size', 'AB ', -0, -0, 'AB '],
    ['negative size nonmonotonic selection', 'abcd', -24, -10, 'abcd…'],
    ['positive infinite size fallback', 'AB', 100, Infinity, 'A…'],
    ['infinite size and budget fast path', 'AB ', Infinity, Infinity, 'AB '],
    ['negative infinite budget fallback', 'AB', -Infinity, 10, 'A…'],
    ['negative infinite size fast path', 'AB ', 0, -Infinity, 'AB '],
    ['overflow fallback', 'AB', 1, Number.MAX_VALUE, 'A…'],
  ])('%s', (_label, content, budget, size, expected) => {
    expect(fitText(content, budget, size, 'body')).toBe(expected);
  });

  it.each(fonts)('matches the frozen legacy loop across text and numeric edges (%s)', (font) => {
    const texts = [
      '',
      'A',
      'ASCII label',
      'A   Z',
      ' \t\n',
      'A\u00a0\u3000Z',
      '界漢字',
      '한글ᄀ',
      'Ａ：￦',
      'ｶﾀｶﾅ',
      '𠀀😀AB',
      '😀界 🧑‍🎨Z',
      '\ud800A\udc00Z',
      'A\udc00\ud800',
      'e\u0301Z',
      'a界😀 '.repeat(12),
    ];
    const sizes = [
      0,
      -0,
      0.1,
      10,
      12.5,
      -10,
      Number.MIN_VALUE,
      -Number.MIN_VALUE,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      NaN,
      Infinity,
      -Infinity,
    ];
    const budgets = [
      0,
      -0,
      -1,
      1,
      16.2,
      100,
      Number.MIN_VALUE,
      -Number.MIN_VALUE,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      NaN,
      Infinity,
      -Infinity,
    ];
    for (const content of texts) {
      for (const size of sizes) {
        const boundaries = [...neighbours(textWidth(content, size, font))];
        const chars = [...content];
        for (let count = 1; count <= chars.length; count++) {
          boundaries.push(
            ...neighbours(textWidth(chars.slice(0, count).join('') + '…', size, font)),
          );
        }
        for (const budget of [...budgets, ...boundaries]) {
          expect(
            fitText(content, budget, size, font),
            JSON.stringify({ content, budget: String(budget), size: String(size), font }),
          ).toBe(legacyFitText(content, budget, size, font));
        }
      }
    }
  });
});
