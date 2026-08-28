/**
 * Encoding utilities (Base64URL + hex)
 *
 * Shared encoding/decoding primitives for JWT, HMAC, and other crypto operations.
 * Absorbed verbatim from `@xivdyetools/crypto` v1.1.2 (Monorepo 2.0 Tier 1 merge).
 *
 * @module @xivdyetools/auth/encoding
 *
 * @example
 * ```typescript
 * import { base64UrlEncode, base64UrlDecode } from '@xivdyetools/auth/encoding';
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
