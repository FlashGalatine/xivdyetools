/**
 * Tests for scopeRateLimitKey — the shared redaction helper behind
 * FINDING-010 (2026-08-29 security audit): every fail-open / backend-error
 * log line must learn the bucket class, never the client.
 */

import { describe, it, expect } from 'vitest';
import { scopeRateLimitKey } from './key-scope.js';

describe('scopeRateLimitKey', () => {
  describe('with a configured keyPrefix', () => {
    it('returns the prefix trimmed of its trailing separator, discarding the key entirely', () => {
      expect(scopeRateLimitKey('1.2.3.4', 'public:ip:')).toBe('public:ip');
    });

    it('never contains the raw key value, even as a substring', () => {
      const scope = scopeRateLimitKey('1.2.3.4', 'api:ip:');
      expect(scope).not.toContain('1.2.3.4');
      expect(scope).toBe('api:ip');
    });

    it('trims a `|`-terminated prefix the same way (kv.ts window-suffix delimiter)', () => {
      expect(scopeRateLimitKey('user1', 'ratelimit:|')).toBe('ratelimit');
    });

    it('discards a compound raw key (userId:scope) once a prefix is configured', () => {
      // discord-worker / moderation-worker shape: `${userId}:${scope}`.
      // The identifying part sits in the MIDDLE of the key here, not at a
      // fixed edge, so the only safe move is to never look at `key` at all
      // once a prefix says which bucket class this is.
      const scope = scopeRateLimitKey('123456789012345678:global', 'ratelimit:');
      expect(scope).toBe('ratelimit');
      expect(scope).not.toContain('123456789012345678');
    });

    it('falls back to shape classification when the prefix is the empty string', () => {
      expect(scopeRateLimitKey('1.2.3.4', '')).toBe('ip');
    });
  });

  describe('without a keyPrefix (bare key, classified by shape)', () => {
    it('classifies a bare IPv4 address as "ip"', () => {
      expect(scopeRateLimitKey('1.2.3.4')).toBe('ip');
    });

    it('classifies a bare IPv6 address as "ip"', () => {
      expect(scopeRateLimitKey('2001:db8::1')).toBe('ip');
    });

    it('classifies a bare Discord snowflake as "id"', () => {
      expect(scopeRateLimitKey('123456789012345678')).toBe('id');
    });

    it('classifies a snowflake-prefixed compound key as "id" without keeping the suffix', () => {
      const scope = scopeRateLimitKey('123456789012345678:global');
      expect(scope).toBe('id');
      expect(scope).not.toContain('123456789012345678');
    });

    it('passes through the "unknown" sentinel unchanged (already non-identifying)', () => {
      expect(scopeRateLimitKey('unknown')).toBe('unknown');
    });

    it('classifies an empty key as "empty" rather than returning ""', () => {
      expect(scopeRateLimitKey('')).toBe('empty');
    });

    it('classifies anything else as "unscoped" rather than the raw value', () => {
      expect(scopeRateLimitKey('some-opaque-key')).toBe('unscoped');
    });

    it('never returns the input value itself for any identifying shape', () => {
      // 'unknown' is deliberately excluded: it is getClientIp()'s own
      // non-identifying sentinel, so passing it through unchanged is safe
      // (see the dedicated test above) — every OTHER shape here carries a
      // real client identifier and must never be echoed back.
      const inputs = [
        '1.2.3.4',
        '2001:db8::1',
        '123456789012345678',
        '123456789012345678:global',
        'some-opaque-key',
      ];
      for (const input of inputs) {
        expect(scopeRateLimitKey(input)).not.toBe(input);
      }
    });
  });
});
