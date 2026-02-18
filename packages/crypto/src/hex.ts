/**
 * Hexadecimal Encoding/Decoding Utilities
 *
 * @module @xivdyetools/crypto/hex
 */

/**
 * Convert a hex string to Uint8Array
 *
 * @param hex - The hex string (lowercase or uppercase)
 * @returns Uint8Array of bytes
 *
 * @example
 * ```typescript
 * hexToBytes('48656c6c6f') // Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
 * hexToBytes('DEADBEEF') // Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
 * ```
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 *
 * @param bytes - The bytes to convert
 * @returns Lowercase hex string
 *
 * @example
 * ```typescript
 * bytesToHex(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])) // '48656c6c6f'
 * bytesToHex(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])) // 'deadbeef'
 * ```
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
