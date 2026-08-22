import { describe, it, expect } from 'vitest';
import { cutOnLineBoundary } from './text.js';

const lines = (n: number, width = 40): string =>
  Array.from({ length: n }, (_, i) => `• line ${i} ${'x'.repeat(width)}`).join('\n');

describe('cutOnLineBoundary', () => {
  it('returns the text untouched when it fits the budget', () => {
    const text = lines(3);

    expect(cutOnLineBoundary(text, 1000, '\n…')).toBe(text);
  });

  it('keeps whole lines only and fits the tail inside the budget', () => {
    const text = lines(200);
    const tail = '\n\n*Summary shown — [full notes](https://example.test/notes)*';

    const result = cutOnLineBoundary(text, 1000, tail);

    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result.endsWith(tail)).toBe(true);
    const kept = result.slice(0, -tail.length);
    // Every kept line is one of the original whole lines — nothing torn.
    const original = new Set(text.split('\n'));
    for (const line of kept.split('\n')) expect(original.has(line), line).toBe(true);
    // …and it kept as much as it could: one more line would not have fit.
    const next = text.split('\n')[kept.split('\n').length];
    expect(kept.length + 1 + next.length + tail.length).toBeGreaterThan(1000);
  });

  it('hard-cuts a single line longer than the budget rather than returning nothing', () => {
    const text = 'y'.repeat(5000);

    const result = cutOnLineBoundary(text, 100, '…');

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith('…')).toBe(true);
    expect(result.startsWith('yyyy')).toBe(true);
  });
});
