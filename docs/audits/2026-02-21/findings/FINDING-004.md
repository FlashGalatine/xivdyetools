# FINDING-004: `hexToBytes` Silent Data Corruption on Invalid Input

## Severity
MEDIUM

## Category
CWE-20: Improper Input Validation

## Location
- File: `packages/crypto/src/hex.ts`
- Line(s): ~19-24
- Function: `hexToBytes()`

## Description
`hexToBytes()` accepts invalid hex input without throwing. Odd-length strings silently drop the last nibble. Non-hex characters (e.g., `"zzzz"`) produce `NaN` which becomes `0` in a `Uint8Array`. This feeds into `hmacVerifyHex` where malformed hex signatures are silently converted to zeroes before comparison.

## Evidence
```typescript
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
```

Issues:
1. `hexToBytes("abc")` → parses `"ab"`, silently ignores `"c"`
2. `hexToBytes("zzzz")` → `parseInt("zz", 16)` returns `NaN` → stored as `0` in Uint8Array → returns `[0, 0]`

## Impact
While malformed signatures would fail HMAC verification, the silent data corruption masks programming errors. No error is logged or thrown, making debugging difficult.

## Recommendation
```typescript
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex character');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
```

## References
- [CWE-20: Improper Input Validation](https://cwe.mitre.org/data/definitions/20.html)
