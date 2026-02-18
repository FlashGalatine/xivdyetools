/**
 * Base64URL Encoding/Decoding Utilities
 *
 * RFC 4648 compliant Base64URL encoding for JWT and other cryptographic operations.
 * These functions use the URL-safe alphabet (+ → -, / → _) and omit padding.
 *
 * @module @xivdyetools/crypto/base64
 */

/**
 * Encode a string to Base64URL format (RFC 4648)
 *
 * @param str - The string to encode (UTF-8)
 * @returns Base64URL encoded string (no padding)
 *
 * @example
 * ```typescript
 * base64UrlEncode('Hello, World!') // 'SGVsbG8sIFdvcmxkIQ'
 * base64UrlEncode('{"alg":"HS256"}') // 'eyJhbGciOiJIUzI1NiJ9'
 * ```
 */
export function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return base64UrlEncodeBytes(bytes);
}

/**
 * Encode bytes to Base64URL format
 *
 * @param bytes - The bytes to encode
 * @returns Base64URL encoded string (no padding)
 *
 * @example
 * ```typescript
 * const signature = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
 * base64UrlEncodeBytes(signature) // 'SGVsbG8'
 * ```
 */
export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a Base64URL string to bytes
 *
 * @param str - The Base64URL string to decode
 * @returns Decoded bytes as Uint8Array
 *
 * @example
 * ```typescript
 * base64UrlDecodeBytes('SGVsbG8') // Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
 * ```
 */
export function base64UrlDecodeBytes(str: string): Uint8Array {
  // Convert from Base64URL to standard Base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  // Decode to binary string
  const binary = atob(base64);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Decode a Base64URL string to a UTF-8 string
 *
 * @param str - The Base64URL string to decode
 * @returns Decoded UTF-8 string
 *
 * @example
 * ```typescript
 * base64UrlDecode('SGVsbG8sIFdvcmxkIQ') // 'Hello, World!'
 * base64UrlDecode('eyJhbGciOiJIUzI1NiJ9') // '{"alg":"HS256"}'
 * ```
 */
export function base64UrlDecode(str: string): string {
  const bytes = base64UrlDecodeBytes(str);
  return new TextDecoder().decode(bytes);
}
