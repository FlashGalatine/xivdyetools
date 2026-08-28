/**
 * XIV Dye Tools - Category icon lookup tests
 *
 * `getCategoryIcon()` is keyed by an API-controlled value (`category_id` /
 * `secondary_categories`) and its result feeds Lit `unsafeHTML()`. A
 * prototype-chain hit (`constructor`, `__proto__`, `toString`, …) must yield
 * the neutral fallback glyph, never an inherited function — Lit throws on a
 * non-string and the preset detail view fails to render
 * (2026-08-21 security audit, FINDING-027 / WEB-12).
 *
 * @module shared/__tests__/category-icons.test
 */

import { describe, it, expect } from 'vitest';
import { getCategoryIcon } from '../category-icons';

const SUBMITTABLE_CATEGORIES = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'appearance',
  'zones',
  'raids-trials',
];

const PROTOTYPE_KEYS = [
  '__proto__',
  'constructor',
  'toString',
  'hasOwnProperty',
  'valueOf',
  'isPrototypeOf',
  '__defineGetter__',
];

describe('getCategoryIcon', () => {
  const fallback = getCategoryIcon('not-a-category');

  it('returns an SVG string for an unknown category', () => {
    expect(typeof fallback).toBe('string');
    expect(fallback.trimStart().startsWith('<svg')).toBe(true);
  });

  it('returns a dedicated SVG glyph for each of the eight submittable categories', () => {
    for (const name of SUBMITTABLE_CATEGORIES) {
      const icon = getCategoryIcon(name);
      expect(typeof icon, name).toBe('string');
      expect(icon.trimStart().startsWith('<svg'), name).toBe(true);
      expect(icon, name).not.toBe(fallback);
    }
  });

  it('returns the fallback glyph — a string — for prototype-chain keys', () => {
    for (const key of PROTOTYPE_KEYS) {
      const icon = getCategoryIcon(key);
      expect(typeof icon, key).toBe('string');
      expect(icon, key).toBe(fallback);
    }
  });

  it('returns the fallback glyph for the empty string', () => {
    expect(getCategoryIcon('')).toBe(fallback);
  });
});
