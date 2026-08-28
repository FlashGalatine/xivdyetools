/**
 * XIV Dye Tools - Application constants tests
 */

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES as CORE_SUPPORTED_LOCALES } from '@xivdyetools/core';
import {
  APP_ENV,
  APP_NAME,
  resolveAppName,
  SUPPORTED_LOCALES,
  LOCALE_DISPLAY_INFO,
} from '../constants';

describe('resolveAppName', () => {
  it('returns the plain product name for production', () => {
    expect(resolveAppName('production')).toBe('XIV Dye Tools');
  });

  it('marks beta builds', () => {
    expect(resolveAppName('beta')).toBe('[BETA] XIV Dye Tools');
  });

  it('treats an unknown environment as production rather than guessing', () => {
    expect(resolveAppName('staging')).toBe('XIV Dye Tools');
  });
});

describe('SUPPORTED_LOCALES', () => {
  it("is exactly @xivdyetools/core's SUPPORTED_LOCALES (DEAD-037 Wave 4a)", () => {
    // Derived directly from core's constant, so this is really a guard
    // against a future edit reintroducing a locally-duplicated literal.
    expect(SUPPORTED_LOCALES).toEqual(CORE_SUPPORTED_LOCALES);
  });

  it('has the same code set as LOCALE_DISPLAY_INFO, in the same order', () => {
    expect(LOCALE_DISPLAY_INFO.map((l) => l.code)).toEqual(SUPPORTED_LOCALES);
  });
});

describe('APP_ENV', () => {
  it('falls back to production when __APP_ENV__ is not defined', () => {
    // Vitest has no `define` block, so the guard in constants.ts is what runs
    // here. This asserts the fallback, which is also what a plain `vite build`
    // without VITE_APP_ENV produces.
    expect(APP_ENV).toBe('production');
    expect(APP_NAME).toBe('XIV Dye Tools');
  });
});
