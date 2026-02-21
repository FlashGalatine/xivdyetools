# FINDING-007: Logger Array Elements Not Redacted Recursively

## Severity
MEDIUM

## Category
CWE-532: Information Exposure Through Log Files

## Location
- File: `packages/logger/src/core/base-logger.ts`
- Line(s): ~169-185
- Function: `redactSensitiveFields()`

## Description
The redaction logic explicitly skips arrays. If a consumer logs `{ users: [{ token: 'secret' }] }`, the `token` field inside the array element is **not** redacted.

## Evidence
```typescript
if (
  redacted[key] !== '[REDACTED]' &&
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)  // ← Arrays are skipped entirely
) {
```

A test explicitly confirms this is the intended behavior (but it's a dangerous one):
```typescript
it('should not recurse into arrays', () => {
  expect(result.items).toEqual([{ token: 'in-array' }]);  // ← token NOT redacted
});
```

## Impact
Any sensitive data nested inside arrays in log context objects will be written to log outputs in plaintext.

## Recommendation
Recurse into array elements that are objects:

```typescript
if (Array.isArray(value)) {
  redacted[key] = value.map(item =>
    typeof item === 'object' && item !== null
      ? this.redactSensitiveFields(item as LogContext, depth + 1)
      : item
  );
} else if (...) { ... }
```

## References
- [CWE-532: Information Exposure Through Log Files](https://cwe.mitre.org/data/definitions/532.html)
