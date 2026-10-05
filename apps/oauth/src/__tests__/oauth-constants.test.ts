/**
 * XIV Dye Tools OAuth - redirect origin allowlist
 *
 * The allowlist is the only thing standing between the OAuth flow and an open
 * redirect, so its contents are asserted rather than assumed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

  // FINDING-006 (2026-10-03) - the exact production allowlist, read from the
  // real wrangler.toml top level (the development env's vars are inline, so the
  // anchored regexes only match the top-level lines), so a re-added entry fails.
  // FRONTEND_URL is appended, so xivdyetools.app is listed twice.
  it('lists exactly the production allowlist from wrangler.toml', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const toml = readFileSync(join(here, '..', '..', 'wrangler.toml'), 'utf-8').replace(/\r\n/g, '\n');
    const FRONTEND_URL = toml.match(/^FRONTEND_URL = "(.+)"$/m)?.[1] ?? '';
    const ENVIRONMENT = toml.match(/^ENVIRONMENT = "(.+)"$/m)?.[1] ?? '';
    expect(getAllowedRedirectOrigins({ FRONTEND_URL, ENVIRONMENT })).toEqual([
      'https://xivdyetools.app',
      'https://beta.xivdyetools.app',
      'https://xivdyetools.app',
    ]);
  });

  it('allows no projectgalatine origin in production', () => {
    expect(getAllowedRedirectOrigins(PROD).some((o) => o.includes('projectgalatine'))).toBe(false);
  });
});
