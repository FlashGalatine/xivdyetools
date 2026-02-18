/**
 * Tests for crypto utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  base64UrlEncode,
  base64UrlEncodeBytes,
  base64UrlDecode,
  hexToBytes,
  bytesToHex,
} from '../../src/utils/crypto.js';

describe('base64UrlEncode', () => {
  it('encodes simple strings', () => {
    const result = base64UrlEncode('hello');
    expect(result).toBe('aGVsbG8');
  });

  it('encodes empty string', () => {
    const result = base64UrlEncode('');
    expect(result).toBe('');
  });

  it('encodes strings with special characters', () => {
    const result = base64UrlEncode('hello world!');
    expect(result).toBeDefined();
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('uses URL-safe characters', () => {
    // Characters that would produce + or / in standard base64
    const testString = 'test>string?with+special/chars';
    const result = base64UrlEncode(testString);

    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
  });

  it('removes padding', () => {
    const result = base64UrlEncode('a');
    expect(result).not.toContain('=');
  });
});

describe('base64UrlEncodeBytes', () => {
  it('encodes Uint8Array', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
    const result = base64UrlEncodeBytes(bytes);
    expect(result).toBe('aGVsbG8');
  });

  it('encodes empty array', () => {
    const bytes = new Uint8Array([]);
    const result = base64UrlEncodeBytes(bytes);
    expect(result).toBe('');
  });

  it('encodes binary data', () => {
    const bytes = new Uint8Array([0, 255, 128, 64, 32]);
    const result = base64UrlEncodeBytes(bytes);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('uses URL-safe characters', () => {
    // Binary data that would produce + or / in standard base64
    const bytes = new Uint8Array([251, 255, 254, 253]);
    const result = base64UrlEncodeBytes(bytes);

    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
  });
});

describe('base64UrlDecode', () => {
  it('decodes simple strings', () => {
    const result = base64UrlDecode('aGVsbG8');
    expect(result).toBe('hello');
  });

  it('decodes empty string', () => {
    const result = base64UrlDecode('');
    expect(result).toBe('');
  });

  it('roundtrips with base64UrlEncode', () => {
    const original = 'Hello, World! 123';
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);

    expect(decoded).toBe(original);
  });

  it('handles URL-safe characters', () => {
    const original = 'test>string?with+special/chars';
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);

    expect(decoded).toBe(original);
  });

  it('handles strings without padding', () => {
    // Base64 URL encoding removes padding
    const decoded = base64UrlDecode('YQ'); // 'a' without padding
    expect(decoded).toBe('a');
  });
});

describe('hexToBytes', () => {
  it('converts hex string to bytes', () => {
    const result = hexToBytes('48656c6c6f'); // 'Hello'
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('converts empty hex string', () => {
    const result = hexToBytes('');
    expect(result).toEqual(new Uint8Array([]));
  });

  it('handles lowercase hex', () => {
    const result = hexToBytes('ff00ff');
    expect(result).toEqual(new Uint8Array([255, 0, 255]));
  });

  it('handles uppercase hex', () => {
    const result = hexToBytes('FF00FF');
    expect(result).toEqual(new Uint8Array([255, 0, 255]));
  });

  it('handles mixed case hex', () => {
    const result = hexToBytes('FfaA00');
    expect(result).toEqual(new Uint8Array([255, 170, 0]));
  });

  it('converts all byte values correctly', () => {
    const result = hexToBytes('000102fdfeff');
    expect(result).toEqual(new Uint8Array([0, 1, 2, 253, 254, 255]));
  });
});

describe('bytesToHex', () => {
  it('converts bytes to hex string', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const result = bytesToHex(bytes);
    expect(result).toBe('48656c6c6f');
  });

  it('converts empty array', () => {
    const result = bytesToHex(new Uint8Array([]));
    expect(result).toBe('');
  });

  it('pads single-digit hex values', () => {
    const bytes = new Uint8Array([0, 1, 2, 10, 15]);
    const result = bytesToHex(bytes);
    expect(result).toBe('0001020a0f');
  });

  it('handles all byte values', () => {
    const bytes = new Uint8Array([0, 128, 255]);
    const result = bytesToHex(bytes);
    expect(result).toBe('0080ff');
  });

  it('produces lowercase hex', () => {
    const bytes = new Uint8Array([171, 205, 239]); // 0xAB, 0xCD, 0xEF
    const result = bytesToHex(bytes);
    expect(result).toBe('abcdef');
  });

  it('roundtrips with hexToBytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const hex = bytesToHex(original);
    const restored = hexToBytes(hex);

    expect(restored).toEqual(original);
  });
});

describe('roundtrip conversions', () => {
  it('base64 roundtrip for ASCII strings', () => {
    const testCases = [
      'simple',
      'with spaces',
      'Special!@#$%^&*()',
      'a',
      'ab',
      'abc',
      'abcd',
    ];

    for (const testCase of testCases) {
      const encoded = base64UrlEncode(testCase);
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toBe(testCase);
    }
  });

  it('hex roundtrip for various byte arrays', () => {
    const testCases = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([255]),
      new Uint8Array([0, 128, 255]),
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    ];

    for (const testCase of testCases) {
      const hex = bytesToHex(testCase);
      const restored = hexToBytes(hex);
      expect(restored).toEqual(testCase);
    }
  });
});
