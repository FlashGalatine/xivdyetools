/**
 * OAuth Validation Utility Tests
 *
 * Unit coverage for utils/oauth-validation.ts. The redirect allowlist and the
 * parameter bounds are the worker's only guard against open redirects and
 * unbounded attacker-chosen data in the signed state (FINDING-012, 2026-08-21
 * security audit), so they are asserted directly rather than only through the
 * handlers.
 */

import { describe, it, expect } from 'vitest';
import {
  validateCodeChallenge,
  validateCodeVerifier,
  validateRedirectUri,
  validateReturnPath,
  validateScopes,
  validateStateParam,
  MAX_RETURN_PATH_LENGTH,
  MAX_STATE_LENGTH,
} from '../utils/oauth-validation.js';
import { REDIRECT_CALLBACK_PATH } from '../constants/oauth.js';

const ALLOWED = ['https://xivdyetools.app', 'http://localhost:5173', 'not a url'];

describe('validateRedirectUri', () => {
  it('accepts the exact callback path on an allowed origin', () => {
    expect(() => validateRedirectUri('https://xivdyetools.app/auth/callback', ALLOWED)).not.toThrow();
    expect(() => validateRedirectUri('http://localhost:5173/auth/callback', ALLOWED)).not.toThrow();
  });

  it('pins the path to the SPA callback route', () => {
    expect(REDIRECT_CALLBACK_PATH).toBe('/auth/callback');
    expect(() => validateRedirectUri('https://xivdyetools.app/', ALLOWED)).toThrow(/path/i);
    expect(() => validateRedirectUri('https://xivdyetools.app/auth/callback/', ALLOWED)).toThrow(/path/i);
    expect(() => validateRedirectUri('https://xivdyetools.app/other', ALLOWED)).toThrow(/path/i);
  });

  it('rejects a query string or fragment on the callback URL', () => {
    expect(() => validateRedirectUri('https://xivdyetools.app/auth/callback?x=1', ALLOWED)).toThrow(/path/i);
    expect(() => validateRedirectUri('https://xivdyetools.app/auth/callback#x', ALLOWED)).toThrow(/path/i);
  });

  it('rejects origins outside the allowlist, including lookalikes', () => {
    for (const uri of [
      'https://xivdyetools.app.evil.com/auth/callback',
      'https://xivdyetools.app@evil.com/auth/callback',
      'https://evil.com/auth/callback',
      'http://xivdyetools.app/auth/callback', // scheme differs
      'https://xivdyetools.app:8443/auth/callback', // port differs
    ]) {
      expect(() => validateRedirectUri(uri, ALLOWED), uri).toThrow('Redirect URI not in allowlist');
    }
  });

  it('rejects values that do not parse as URLs', () => {
    expect(() => validateRedirectUri('//evil.com/auth/callback', ALLOWED)).toThrow('Invalid redirect URI format');
    expect(() => validateRedirectUri('not a url', ALLOWED)).toThrow('Invalid redirect URI format');
  });
});

describe('validateReturnPath', () => {
  it('accepts a normal relative path with query and hash', () => {
    expect(validateReturnPath('/')).toBe(true);
    expect(validateReturnPath('/presets')).toBe(true);
    expect(validateReturnPath('/presets?tab=mine#top')).toBe(true);
    expect(validateReturnPath('/' + 'a'.repeat(MAX_RETURN_PATH_LENGTH - 1))).toBe(true);
  });

  it('rejects paths over the cap', () => {
    expect(MAX_RETURN_PATH_LENGTH).toBe(256);
    expect(validateReturnPath('/' + 'a'.repeat(MAX_RETURN_PATH_LENGTH))).toBe(false);
  });

  it('requires a single leading slash', () => {
    expect(validateReturnPath('')).toBe(false);
    expect(validateReturnPath('presets')).toBe(false);
    expect(validateReturnPath('//evil.com')).toBe(false);
    expect(validateReturnPath('https://evil.com/')).toBe(false);
  });

  it('rejects backslashes, whitespace, control and non-ASCII characters', () => {
    expect(validateReturnPath('/\\evil.com')).toBe(false);
    expect(validateReturnPath('/a\\b')).toBe(false);
    expect(validateReturnPath('/a b')).toBe(false);
    expect(validateReturnPath('/a\nb')).toBe(false);
    expect(validateReturnPath('/a' + String.fromCharCode(0) + 'b')).toBe(false);
    expect(validateReturnPath('/a' + String.fromCharCode(0x7f) + 'b')).toBe(false);
    expect(validateReturnPath('/a' + String.fromCharCode(0xa0) + 'b')).toBe(false); // non-breaking space
    expect(validateReturnPath('/café')).toBe(false);
  });
});

describe('validateStateParam', () => {
  it('accepts printable ASCII up to the cap', () => {
    expect(MAX_STATE_LENGTH).toBe(256);
    expect(validateStateParam('f'.repeat(64))).toBe(true); // SPA form: 32 random bytes as hex
    expect(validateStateParam('x'.repeat(MAX_STATE_LENGTH))).toBe(true);
    expect(validateStateParam('a-b_c.d~e!')).toBe(true);
  });

  it('rejects empty, oversized, control-character and non-ASCII values', () => {
    expect(validateStateParam('')).toBe(false);
    expect(validateStateParam('x'.repeat(MAX_STATE_LENGTH + 1))).toBe(false);
    expect(validateStateParam('a\nb')).toBe(false);
    expect(validateStateParam('a b')).toBe(false);
    expect(validateStateParam('état')).toBe(false);
  });
});

describe('validateScopes', () => {
  it('throws when the token response has no scope field', () => {
    expect(() => validateScopes(undefined, ['user'])).toThrow('missing scope field');
    expect(() => validateScopes('', ['user'])).toThrow('missing scope field');
  });

  it('throws naming the missing scopes', () => {
    expect(() => validateScopes('user refresh', ['user', 'character'])).toThrow('character');
  });

  it('passes when every required scope is present', () => {
    expect(() => validateScopes('user user:social character refresh', ['user', 'character'])).not.toThrow();
  });
});

describe('PKCE format validators', () => {
  it('validateCodeChallenge enforces the base64url charset and 43-128 length', () => {
    expect(validateCodeChallenge('a'.repeat(43))).toBe(true);
    expect(validateCodeChallenge('a'.repeat(42))).toBe(false);
    expect(validateCodeChallenge('a'.repeat(129))).toBe(false);
    expect(validateCodeChallenge('a'.repeat(42) + '+')).toBe(false);
  });

  it('validateCodeVerifier enforces the unreserved charset and 43-128 length', () => {
    expect(validateCodeVerifier('a'.repeat(43) + '-._~')).toBe(true);
    expect(validateCodeVerifier('a'.repeat(42))).toBe(false);
    expect(validateCodeVerifier('a'.repeat(42) + '+')).toBe(false);
  });
});
