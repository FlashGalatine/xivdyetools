/**
 * IP Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { getClientIp } from './ip.js';

describe('getClientIp', () => {
  it('returns CF-Connecting-IP when present', () => {
    const request = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'X-Forwarded-For': '5.6.7.8, 9.10.11.12',
      },
    });

    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('returns first X-Forwarded-For IP when opted in and CF-Connecting-IP is absent', () => {
    const request = new Request('https://example.com', {
      headers: {
        'X-Forwarded-For': '1.2.3.4, 5.6.7.8, 9.10.11.12',
      },
    });

    expect(getClientIp(request, { trustXForwardedFor: true })).toBe('1.2.3.4');
  });

  it('trims whitespace from IPs', () => {
    const request = new Request('https://example.com', {
      headers: {
        'CF-Connecting-IP': '  1.2.3.4  ',
      },
    });

    expect(getClientIp(request)).toBe('1.2.3.4');
  });

  it('trims whitespace from X-Forwarded-For IPs', () => {
    const request = new Request('https://example.com', {
      headers: {
        'X-Forwarded-For': '  1.2.3.4  , 5.6.7.8',
      },
    });

    expect(getClientIp(request, { trustXForwardedFor: true })).toBe('1.2.3.4');
  });

  it('returns "unknown" when no IP headers present', () => {
    const request = new Request('https://example.com');

    expect(getClientIp(request)).toBe('unknown');
  });

  it('returns "unknown" when X-Forwarded-For is empty', () => {
    const request = new Request('https://example.com', {
      headers: {
        'X-Forwarded-For': '',
      },
    });

    expect(getClientIp(request)).toBe('unknown');
  });

  describe('FINDING-003: trustXForwardedFor option', () => {
    it('ignores X-Forwarded-For when trustXForwardedFor is false', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Forwarded-For': '1.2.3.4, 5.6.7.8',
        },
      });

      expect(getClientIp(request, { trustXForwardedFor: false })).toBe('unknown');
    });

    it('still uses CF-Connecting-IP when trustXForwardedFor is false', () => {
      const request = new Request('https://example.com', {
        headers: {
          'CF-Connecting-IP': '10.0.0.1',
          'X-Forwarded-For': '1.2.3.4',
        },
      });

      expect(getClientIp(request, { trustXForwardedFor: false })).toBe('10.0.0.1');
    });

    it('ignores X-Forwarded-For by default (FINDING-006)', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Forwarded-For': '1.2.3.4',
        },
      });

      // FINDING-006: Default changed to false for security
      expect(getClientIp(request)).toBe('unknown');
    });

    it('trusts X-Forwarded-For when explicitly opted in', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Forwarded-For': '1.2.3.4',
        },
      });

      expect(getClientIp(request, { trustXForwardedFor: true })).toBe('1.2.3.4');
    });
  });

  describe('FINDING-006: IP normalization', () => {
    it('normalizes IPv6 addresses to lowercase from CF-Connecting-IP', () => {
      const request = new Request('https://example.com', {
        headers: {
          'CF-Connecting-IP': '2001:DB8::1',
        },
      });

      expect(getClientIp(request)).toBe('2001:db8::1');
    });

    it('normalizes IPv6 addresses to lowercase from X-Forwarded-For', () => {
      const request = new Request('https://example.com', {
        headers: {
          'X-Forwarded-For': '2001:DB8:ABCD::1, 2001:DB8::2',
        },
      });

      expect(getClientIp(request, { trustXForwardedFor: true })).toBe('2001:db8:abcd::1');
    });

    it('does not alter lowercase IPv4 addresses', () => {
      const request = new Request('https://example.com', {
        headers: {
          'CF-Connecting-IP': '192.168.1.1',
        },
      });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });
  });
});
