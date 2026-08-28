/**
 * Tests for PKCE constants
 */
import { describe, it, expect } from 'vitest';
import { VALID_CODE_VERIFIER, VALID_CODE_CHALLENGE } from '../../src/constants/pkce.js';

describe('PKCE constants', () => {
  it('has valid code verifier of correct length', () => {
    // RFC 7636: 43-128 characters
    expect(VALID_CODE_VERIFIER.length).toBeGreaterThanOrEqual(43);
    expect(VALID_CODE_VERIFIER.length).toBeLessThanOrEqual(128);
  });

  it('valid code verifier matches the RFC 7636 character set', () => {
    expect(/^[A-Za-z0-9\-._~]+$/.test(VALID_CODE_VERIFIER)).toBe(true);
  });

  it('has valid code challenge of expected length', () => {
    // S256 challenges are 43 characters (base64url encoded SHA256)
    expect(VALID_CODE_CHALLENGE.length).toBeGreaterThanOrEqual(43);
  });
});
