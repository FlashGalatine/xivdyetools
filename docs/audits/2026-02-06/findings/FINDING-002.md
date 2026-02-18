# FINDING-002: HMAC Base64URL Verification Uses Non-Constant-Time Comparison

## Severity
LOW

## Category
CWE-208: Observable Timing Discrepancy

## Location
- File: `xivdyetools-auth/src/hmac.ts`
- Line(s): 114
- Function/Component: `hmacVerify()`

## Description
The `hmacVerify()` function compares HMAC-SHA256 signatures using JavaScript's `===` operator, which is not constant-time. The comment on line 113 states "Use timing-safe comparison" but the implementation uses a standard equality check.

Notably, the hex-encoded variant `hmacVerifyHex()` (line 128-147) correctly uses `crypto.subtle.verify()` which is inherently timing-safe.

## Evidence
```typescript
// hmac.ts:106-118
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSignature = await hmacSign(data, secret);
    // Use timing-safe comparison  <-- Comment says timing-safe, but uses ===
    return expectedSignature === signature;
  } catch {
    return false;
  }
}
```

Contrast with the timing-safe hex variant:
```typescript
// hmac.ts:128-147 (hmacVerifyHex - this IS safe)
export async function hmacVerifyHex(...): Promise<boolean> {
  // ...
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
}
```

## Impact
**Practical risk: Very Low.** This function is used less frequently than `hmacVerifyHex()`, and the same network-latency mitigations apply as FINDING-001. The `verifyBotSignature()` function (line 174) uses `hmacVerifyHex()` (the safe variant), so bot request authentication is not affected.

## Recommendation
Align `hmacVerify()` with `hmacVerifyHex()` by using `crypto.subtle.verify()`:

```typescript
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await createHmacKey(secret, 'verify');
    const encoder = new TextEncoder();
    const signatureBytes = base64UrlDecodeBytes(signature);
    return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
  } catch {
    return false;
  }
}
```

## References
- CWE-208: https://cwe.mitre.org/data/definitions/208.html
- Related: FINDING-001 (same class of vulnerability)
