/**
 * Tests for Hex Encoding/Decoding Utilities
 */
import { describe, it, expect } from 'vitest';
import { hexToBytes, bytesToHex } from './hex.js';

describe('hex.ts', () => {
  describe('hexToBytes', () => {
    it('should convert valid lowercase hex to bytes', () => {
      const result = hexToBytes('48656c6c6f');
      expect(result).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it('should convert valid uppercase hex to bytes', () => {
      const result = hexToBytes('DEADBEEF');
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle mixed case hex', () => {
      const result = hexToBytes('DeAdBeEf');
      expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle empty string', () => {
      const result = hexToBytes('');
      expect(result).toEqual(new Uint8Array([]));
    });

    it('should throw on odd-length hex string (FINDING-004)', () => {
      expect(() => hexToBytes('abc')).toThrow('Hex string must have even length');
    });

    it('should throw on single character (FINDING-004)', () => {
      expect(() => hexToBytes('a')).toThrow('Hex string must have even length');
    });

    it('should throw on invalid hex characters (FINDING-004)', () => {
      expect(() => hexToBytes('zzzz')).toThrow('Invalid hex character');
    });

    it('should throw on hex string with spaces (FINDING-004)', () => {
      expect(() => hexToBytes('abcd  ef')).toThrow('Invalid hex character');
    });

    it('should throw on hex string with special characters (FINDING-004)', () => {
      expect(() => hexToBytes('not-hex!')).toThrow('Invalid hex character');
    });
  });

  describe('bytesToHex', () => {
    it('should convert bytes to lowercase hex string', () => {
      const result = bytesToHex(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
      expect(result).toBe('48656c6c6f');
    });

    it('should convert bytes to lowercase hex', () => {
      const result = bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      expect(result).toBe('deadbeef');
    });

    it('should handle empty array', () => {
      const result = bytesToHex(new Uint8Array([]));
      expect(result).toBe('');
    });

    it('should pad single-digit hex values', () => {
      const result = bytesToHex(new Uint8Array([0x00, 0x01, 0x0f]));
      expect(result).toBe('00010f');
    });
  });

  describe('roundtrip', () => {
    it('should roundtrip hex → bytes → hex', () => {
      const original = 'deadbeef01234567';
      expect(bytesToHex(hexToBytes(original))).toBe(original);
    });

    it('should roundtrip bytes → hex → bytes', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255]);
      expect(hexToBytes(bytesToHex(original))).toEqual(original);
    });
  });
});
