/**
 * XIV Dye Tools - Application constants tests
 */

import { describe, it, expect } from 'vitest';
import { APP_ENV, APP_NAME, resolveAppName } from '../constants';

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

describe('APP_ENV', () => {
  it('falls back to production when __APP_ENV__ is not defined', () => {
    // Vitest has no `define` block, so the guard in constants.ts is what runs
    // here. This asserts the fallback, which is also what a plain `vite build`
    // without VITE_APP_ENV produces.
    expect(APP_ENV).toBe('production');
    expect(APP_NAME).toBe('XIV Dye Tools');
  });
});
