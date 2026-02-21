# FINDING-009: No Minimum Secret Length Enforcement for HMAC

## Severity
MEDIUM

## Category
CWE-326: Inadequate Encryption Strength

## Location
- File: `packages/auth/src/hmac.ts`
- Line(s): ~43-59
- Function: `createHmacKey()`

## Description
`createHmacKey()` accepts any string as an HMAC secret, including empty strings or single characters. HMAC-SHA256 with a 1-byte key is trivially brute-forceable. The Web Crypto API does not enforce minimum key lengths for HMAC.

## Evidence
```typescript
export async function createHmacKey(
  secret: string,
  usage: 'sign' | 'verify' | 'both' = 'both'
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  // No length check on keyData!
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ...);
}
```

## Impact
If a consumer accidentally passes an empty string or a short key (e.g., from a missing env variable that defaults to empty), all HMAC signatures become trivially forgeable.

## Recommendation
Enforce minimum key length:

```typescript
const keyData = encoder.encode(secret);
if (keyData.length < 32) {
  throw new Error('HMAC secret must be at least 32 bytes (256 bits)');
}
```

## References
- [CWE-326: Inadequate Encryption Strength](https://cwe.mitre.org/data/definitions/326.html)
- [NIST SP 800-107: Key Length Recommendations](https://csrc.nist.gov/publications/detail/sp/800-107/rev-1/final)
