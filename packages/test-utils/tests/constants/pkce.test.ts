/**
 * Tests for PKCE constants and validators
 */
import { describe, it, expect } from 'vitest';
import {
  VALID_CODE_VERIFIER,
  VALID_CODE_CHALLENGE,
  INVALID_SHORT_VERIFIER,
  INVALID_CHARS_VERIFIER,
  INVALID_SHORT_CHALLENGE,
  MIN_VERIFIER_LENGTH,
  MAX_VERIFIER_LENGTH,
  S256_CHALLENGE_LENGTH,
  VERIFIER_PATTERN,
  isValidVerifierFormat,
  isValidChallengeFormat,
  generateCodeChallenge,
} from '../../src/constants/pkce.js';

describe('PKCE constants', () => {
  it('has valid code verifier of correct length', () => {
    expect(VALID_CODE_VERIFIER.length).toBeGreaterThanOrEqual(MIN_VERIFIER_LENGTH);
    expect(VALID_CODE_VERIFIER.length).toBeLessThanOrEqual(MAX_VERIFIER_LENGTH);
  });

  it('valid code verifier matches pattern', () => {
    expect(VERIFIER_PATTERN.test(VALID_CODE_VERIFIER)).toBe(true);
  });

  it('has valid code challenge of expected length', () => {
    expect(VALID_CODE_CHALLENGE.length).toBeGreaterThanOrEqual(S256_CHALLENGE_LENGTH);
  });

  it('invalid short verifier is too short', () => {
    expect(INVALID_SHORT_VERIFIER.length).toBeLessThan(MIN_VERIFIER_LENGTH);
  });

  it('invalid chars verifier contains invalid characters', () => {
    expect(VERIFIER_PATTERN.test(INVALID_CHARS_VERIFIER)).toBe(false);
  });

  it('invalid short challenge is too short', () => {
    expect(INVALID_SHORT_CHALLENGE.length).toBeLessThan(S256_CHALLENGE_LENGTH);
  });

  it('length constants are RFC 7636 compliant', () => {
    expect(MIN_VERIFIER_LENGTH).toBe(43);
    expect(MAX_VERIFIER_LENGTH).toBe(128);
    expect(S256_CHALLENGE_LENGTH).toBe(43);
  });
});

describe('isValidVerifierFormat', () => {
  it('returns true for valid verifier', () => {
    expect(isValidVerifierFormat(VALID_CODE_VERIFIER)).toBe(true);
  });

  it('returns false for too short verifier', () => {
    expect(isValidVerifierFormat(INVALID_SHORT_VERIFIER)).toBe(false);
  });

  it('returns false for too long verifier', () => {
    const tooLong = 'a'.repeat(MAX_VERIFIER_LENGTH + 1);
    expect(isValidVerifierFormat(tooLong)).toBe(false);
  });

  it('returns false for verifier with invalid characters', () => {
    expect(isValidVerifierFormat(INVALID_CHARS_VERIFIER)).toBe(false);
  });

  it('accepts minimum length verifier', () => {
    const minLength = 'a'.repeat(MIN_VERIFIER_LENGTH);
    expect(isValidVerifierFormat(minLength)).toBe(true);
  });

  it('accepts maximum length verifier', () => {
    const maxLength = 'a'.repeat(MAX_VERIFIER_LENGTH);
    expect(isValidVerifierFormat(maxLength)).toBe(true);
  });

  it('accepts verifier with all valid character types', () => {
    const allChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP0123456789-._~';
    expect(isValidVerifierFormat(allChars)).toBe(true);
  });
});

describe('isValidChallengeFormat', () => {
  it('returns true for valid challenge', () => {
    expect(isValidChallengeFormat(VALID_CODE_CHALLENGE)).toBe(true);
  });

  it('returns false for too short challenge', () => {
    expect(isValidChallengeFormat(INVALID_SHORT_CHALLENGE)).toBe(false);
  });

  it('returns false for challenge with invalid characters', () => {
    const invalidChars = 'a'.repeat(S256_CHALLENGE_LENGTH - 1) + '@';
    expect(isValidChallengeFormat(invalidChars)).toBe(false);
  });

  it('accepts minimum length challenge', () => {
    const minLength = 'a'.repeat(S256_CHALLENGE_LENGTH);
    expect(isValidChallengeFormat(minLength)).toBe(true);
  });

  it('accepts longer challenges', () => {
    const longer = 'a'.repeat(S256_CHALLENGE_LENGTH + 10);
    expect(isValidChallengeFormat(longer)).toBe(true);
  });
});

describe('generateCodeChallenge', () => {
  it('generates a base64url encoded string', async () => {
    const challenge = await generateCodeChallenge('test-verifier-string-at-least-43-chars-long!');

    // Base64URL has only these characters: A-Z, a-z, 0-9, -, _
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates 43 character challenge for S256', async () => {
    const challenge = await generateCodeChallenge('test-verifier-string-at-least-43-chars-long!');

    // SHA256 produces 32 bytes = 43 base64url characters (no padding)
    expect(challenge.length).toBe(43);
  });

  it('is deterministic', async () => {
    const verifier = 'same-verifier-string-for-both-calls-43chars!';
    const challenge1 = await generateCodeChallenge(verifier);
    const challenge2 = await generateCodeChallenge(verifier);

    expect(challenge1).toBe(challenge2);
  });

  it('produces different challenges for different verifiers', async () => {
    const challenge1 = await generateCodeChallenge('verifier-one-with-at-least-43-characters!!!');
    const challenge2 = await generateCodeChallenge('verifier-two-with-at-least-43-characters!!!');

    expect(challenge1).not.toBe(challenge2);
  });

  it('does not include padding characters', async () => {
    const challenge = await generateCodeChallenge('test-verifier-string-at-least-43-chars-long!');

    expect(challenge).not.toContain('=');
  });

  it('uses URL-safe base64 encoding', async () => {
    // Generate multiple challenges to increase chance of seeing + or /
    for (let i = 0; i < 10; i++) {
      const challenge = await generateCodeChallenge(`test-verifier-${i}-with-at-least-43-chars!!`);

      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
    }
  });
});
