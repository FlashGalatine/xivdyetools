import { describe, it, expect } from 'vitest';
import {
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeBytes,
  base64UrlDecodeBytes,
} from './base64.js';

describe('base64UrlEncode', () => {
  it('encodes a simple string', () => {
    expect(base64UrlEncode('Hello')).toBe('SGVsbG8');
  });

  it('encodes JSON for JWT', () => {
    expect(base64UrlEncode('{"alg":"HS256"}')).toBe('eyJhbGciOiJIUzI1NiJ9');
  });

  it('handles UTF-8 characters', () => {
    const encoded = base64UrlEncode('Hello, World! 🌍');
    const decoded = base64UrlDecode(encoded);
    expect(decoded).toBe('Hello, World! 🌍');
  });
});

describe('base64UrlDecode', () => {
  it('decodes a simple string', () => {
    expect(base64UrlDecode('SGVsbG8')).toBe('Hello');
  });

  it('decodes JWT payload', () => {
    expect(base64UrlDecode('eyJhbGciOiJIUzI1NiJ9')).toBe('{"alg":"HS256"}');
  });

  it('handles strings without padding', () => {
    // 'Hello!' base64 = 'SGVsbG8h' (no padding needed)
    expect(base64UrlDecode('SGVsbG8h')).toBe('Hello!');
  });

  it('handles strings needing padding', () => {
    // 'Hi' base64 = 'SGk=' (needs 1 padding char)
    expect(base64UrlDecode('SGk')).toBe('Hi');
  });
});

describe('base64UrlEncodeBytes / base64UrlDecodeBytes', () => {
  // Removing canonical validation must admit these byte-equivalent aliases again.
  it.each([
    'Zg==',
    'Zm8=',
    '+/8',
    '-/8',
    '+_8',
    ' Zg',
    'Zg ',
    'Z\tg',
    'Z\ng',
    'Z\rg',
    'Z\fg',
    'Zh',
    'Zm9',
    'A',
  ])('rejects noncanonical input %j in both decoder APIs', (input) => {
    expect(() => base64UrlDecodeBytes(input)).toThrow();
    expect(() => base64UrlDecode(input)).toThrow();
  });

  it.each([
    ['', []],
    ['Zg', [102]],
    ['Zm8', [102, 111]],
    ['Zm9v', [102, 111, 111]],
    ['-_8', [251, 255]],
  ] as const)('preserves canonical bytes for %j', (input, expected) => {
    expect(Array.from(base64UrlDecodeBytes(input))).toEqual(expected);
  });

  it('preserves the empty string codec', () => {
    expect(base64UrlDecode('')).toBe('');
    expect(base64UrlEncode('')).toBe('');
  });

  it('roundtrips bytes correctly', () => {
    const original = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // 'Hello'
    const encoded = base64UrlEncodeBytes(original);
    const decoded = base64UrlDecodeBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('handles empty array', () => {
    const empty = new Uint8Array(0);
    const encoded = base64UrlEncodeBytes(empty);
    const decoded = base64UrlDecodeBytes(encoded);
    expect(decoded.length).toBe(0);
  });

  it('handles binary data', () => {
    const binary = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
    const encoded = base64UrlEncodeBytes(binary);
    const decoded = base64UrlDecodeBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(binary));
  });
});
