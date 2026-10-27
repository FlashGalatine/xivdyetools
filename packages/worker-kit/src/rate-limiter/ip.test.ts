/**
 * IP Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { getClientIp } from './ip.js';
import { MemoryRateLimiter } from './backends/memory.js';

describe('getClientIp', () => {
  describe('FINDING-004: opt-in IPv6 /64 keys', () => {
    const prefixCases = [
      ['2001:0DB8:abcd:1234:5678::1', '2001:db8:abcd:1234::'],
      ['2001:db8:abcd:1234:ffff:ffff:ffff:ffff', '2001:db8:abcd:1234::'],
      ['2001:db8:abcd:1235:5678::1', '2001:db8:abcd:1235::'],
      ['2001:db8:abcd:1234:5679::1', '2001:db8:abcd:1234::'],
      ['2001:db8::1', '2001:db8::'],
      ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::'],
      ['::', '::'],
      ['0:0:0:0:0:0:0:0', '::'],
      ['0:0:0:0:1:2:3:4', '::'],
      ['::1:2:3:4:5:6:7', '0:1:2:3::'],
      ['1::2:3:4:5:6:7', '1:0:2:3::'],
      ['1:2::3:4:5:6:7', '1:2:0:3::'],
      ['1:2:3::4:5:6:7', '1:2:3::'],
      ['1:2:3:4::5:6:7', '1:2:3:4::'],
      ['1:2:3:4:5::6:7', '1:2:3:4::'],
      ['1:2:3:4:5:6::7', '1:2:3:4::'],
      ['1:2:3:4:5:6:7::', '1:2:3:4::'],
      ['0:0:0:1:2:3:4:5', '0:0:0:1::'],
      ['192.0.2.1', '192.0.2.1'],
      ['::ffff:192.0.2.1', '192.0.2.1'],
      ['::FFFF:c000:0201', '192.0.2.1'],
      ['0:0:0:0:0:ffff:c000:202', '192.0.2.2'],
      ['::ffff:0.0.0.0', '0.0.0.0'],
      ['::ffff:255.255.255.255', '255.255.255.255'],
      ['::192.0.2.1', '::'],
      ['2001:db8:abcd:1234:0:0:192.0.2.1', '2001:db8:abcd:1234::'],
      ['2001:db8::192.0.2.1', '2001:db8::'],
      ['::ffff:0:192.0.2.1', '::'],
    ] as const;

    it.each(prefixCases)('normalizes CF address %s to %s', (input, expected) => {
      const request = new Request('https://example.com', {
        headers: { 'CF-Connecting-IP': `  ${input}  ` },
      });
      expect(getClientIp(request, { ipv6Prefix64: true })).toBe(expected);
    });

    it.each(prefixCases)('normalizes trusted first XFF address %s to %s', (input, expected) => {
      const request = new Request('https://example.com', {
        headers: { 'X-Forwarded-For': `  ${input}  , 2001:db8:ffff::1` },
      });
      expect(getClientIp(request, { ipv6Prefix64: true, trustXForwardedFor: true })).toBe(expected);
      expect(getClientIp(request, { ipv6Prefix64: true })).toBe('unknown');
    });

    it.each(prefixCases)('preserves default and false output for %s', (input) => {
      const request = new Request('https://example.com', {
        headers: { 'CF-Connecting-IP': `  ${input}  ` },
      });
      expect(getClientIp(request)).toBe(input.toLowerCase());
      expect(getClientIp(request, { ipv6Prefix64: false })).toBe(input.toLowerCase());
      const xff = new Request('https://example.com', {
        headers: { 'X-Forwarded-For': ` ${input} , 192.0.2.2` },
      });
      expect(getClientIp(xff, { trustXForwardedFor: true })).toBe(input.toLowerCase());
      expect(getClientIp(xff, { trustXForwardedFor: true, ipv6Prefix64: false })).toBe(
        input.toLowerCase(),
      );
    });

    it.each([
      '2001:DB8:::1',
      '2001::db8::1',
      '2001:db8:1:2:3:4:5',
      '2001:db8:1:2:3:4:5:6:7',
      '1:2:3:4:5:6:7:8::',
      ':1:2:3:4:5:6:7',
      '1:2:3:4:5:6:7:',
      '2001:DB8:gggg::1',
      '2001:db8:12345::1',
      '[2001:DB8::1]',
      '[2001:db8::1]:443',
      '2001:DB8::1%eth0',
      '2001:DB8::1/64',
      '2001:db8::1 trailing',
      '::ffff:256.0.2.1',
      '::ffff:192.0.2',
      '::ffff:192.0.2.1.2',
      '::ffff:0192.0.2.1',
      '::ffff:192.0.2.-1',
      '::ffff:192.0.2.1:1',
      '1:2:3:4:5:192.0.2.1',
      '1:2:3:4:5:6:7:192.0.2.1',
      '1:2:3:4:5:6::192.0.2.1',
      'NOT-AN-IP',
    ])('passes malformed input through without partial parsing: %s', (input) => {
      const request = new Request('https://example.com', {
        headers: { 'CF-Connecting-IP': ` ${input} `, 'X-Forwarded-For': '2001:db8::1' },
      });
      expect(getClientIp(request, { ipv6Prefix64: true, trustXForwardedFor: true })).toBe(
        input.toLowerCase(),
      );
      const xff = new Request('https://example.com', {
        headers: { 'X-Forwarded-For': `${input}, 192.0.2.1` },
      });
      expect(getClientIp(xff, { ipv6Prefix64: true, trustXForwardedFor: true })).toBe(
        input.toLowerCase(),
      );
    });

    it('keeps CF precedence and the unknown fallback with prefix mode', () => {
      const request = new Request('https://example.com', {
        headers: { 'CF-Connecting-IP': '2001:db8:1:2::1', 'X-Forwarded-For': '2001:db8:3:4::1' },
      });
      expect(getClientIp(request, { ipv6Prefix64: true, trustXForwardedFor: true })).toBe(
        '2001:db8:1:2::',
      );
      expect(getClientIp(new Request('https://example.com'), { ipv6Prefix64: true })).toBe(
        'unknown',
      );
    });

    it('shares an actual quota across hosts in one /64 but separates adjacent networks and mapped IPv4 clients', async () => {
      const limiter = new MemoryRateLimiter();
      const config = { maxRequests: 2, windowMs: 60_000 };
      const key = (ip: string) =>
        getClientIp(
          new Request('https://example.com', {
            headers: { 'CF-Connecting-IP': ip },
          }),
          { ipv6Prefix64: true },
        );

      expect((await limiter.check(key('2001:0DB8:abcd:1234::1'), config)).allowed).toBe(true);
      expect((await limiter.check(key('2001:db8:abcd:1234:ffff::2'), config)).remaining).toBe(0);
      expect((await limiter.check(key('2001:db8:abcd:1234::3'), config)).allowed).toBe(false);
      expect((await limiter.check(key('2001:db8:abcd:1235::1'), config)).allowed).toBe(true);
      expect((await limiter.check(key('::ffff:192.0.2.1'), config)).allowed).toBe(true);
      expect((await limiter.check(key('::ffff:c000:201'), config)).remaining).toBe(0);
      expect((await limiter.check(key('192.0.2.1'), config)).allowed).toBe(false);
      expect((await limiter.check(key('::ffff:192.0.2.2'), config)).allowed).toBe(true);
    });
  });

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
