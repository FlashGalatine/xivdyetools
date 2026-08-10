/**
 * XIV Dye Tools OAuth - redirect origin allowlist
 *
 * The allowlist is the only thing standing between the OAuth flow and an open
 * redirect, so its contents are asserted rather than assumed.
 */

import { describe, it, expect } from 'vitest';
import { getAllowedRedirectOrigins } from '../constants/oauth';

const PROD = { FRONTEND_URL: 'https://xivdyetools.app', ENVIRONMENT: 'production' };
const DEV = { FRONTEND_URL: 'http://localhost:5173', ENVIRONMENT: 'development' };

describe('getAllowedRedirectOrigins', () => {
  it('allows the beta web app in production', () => {
    expect(getAllowedRedirectOrigins(PROD)).toContain('https://beta.xivdyetools.app');
  });

  it('still allows production itself', () => {
    expect(getAllowedRedirectOrigins(PROD)).toContain('https://xivdyetools.app');
  });

  it('drops loopback origins outside development', () => {
    const origins = getAllowedRedirectOrigins(PROD);
    expect(origins.some((o) => o.includes('localhost'))).toBe(false);
    expect(origins.some((o) => o.includes('127.0.0.1'))).toBe(false);
  });

  it('keeps loopback origins in development', () => {
    expect(getAllowedRedirectOrigins(DEV)).toContain('http://localhost:5173');
  });
});
