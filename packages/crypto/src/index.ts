/**
 * @xivdyetools/crypto
 *
 * Shared cryptographic utilities for the xivdyetools ecosystem.
 * Provides encoding/decoding functions for JWT, HMAC, and other crypto operations.
 *
 * @module @xivdyetools/crypto
 *
 * @example
 * ```typescript
 * import { base64UrlEncode, base64UrlDecode } from '@xivdyetools/crypto';
 *
 * // Encode a JWT payload
 * const payload = base64UrlEncode(JSON.stringify({ sub: '12345' }));
 *
 * // Decode a JWT payload
 * const decoded = JSON.parse(base64UrlDecode(payload));
 * ```
 */

// Base64URL encoding/decoding (RFC 4648)
export {
  base64UrlEncode,
  base64UrlEncodeBytes,
  base64UrlDecode,
  base64UrlDecodeBytes,
} from './base64.js';

// Hexadecimal encoding/decoding
export { hexToBytes, bytesToHex } from './hex.js';
