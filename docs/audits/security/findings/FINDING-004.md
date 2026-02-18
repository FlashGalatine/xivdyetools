# [FINDING-004]: API Response Size Limits (Good Practice)

## Severity
INFORMATIONAL (Positive Security Control)

## Category
Denial of Service Protection (CWE-400)

## Location
- File: [src/services/APIService.ts](../../xivdyetools-core/src/services/APIService.ts)
- Line(s): 646-663
- Function: fetchWithTimeout()

- File: [src/constants/index.ts](../../xivdyetools-core/src/constants/index.ts)
- Line(s): 117
- Constant: API_MAX_RESPONSE_SIZE

## Description
The APIService implements response size limits to prevent DoS attacks via large payloads. This is a security best practice that protects against malicious or misconfigured APIs sending extremely large responses.

## Evidence
```typescript
// src/constants/index.ts:117
export const API_MAX_RESPONSE_SIZE = 1024 * 1024; // 1 MB maximum response size

// src/services/APIService.ts:646-663
// Check content-length header if available
const contentLength = response.headers.get('content-length');
if (contentLength) {
  const size = parseInt(contentLength, 10);
  if (!isNaN(size) && size > API_MAX_RESPONSE_SIZE) {
    throw new Error(
      `Response too large: ${size} bytes (max: ${API_MAX_RESPONSE_SIZE} bytes)`
    );
  }
}

// Read response text and validate size
const text = await response.text();
if (text.length > API_MAX_RESPONSE_SIZE) {
  throw new Error(
    `Response too large: ${text.length} bytes (max: ${API_MAX_RESPONSE_SIZE} bytes)`
  );
}
```

## Impact
**Positive Security Impact:**
- ✅ Prevents memory exhaustion from large API responses
- ✅ Protects against malicious upstream APIs
- ✅ Dual validation: checks Content-Length header AND actual body size
- ✅ 1MB limit is reasonable for price data API
- ✅ Clear error messages for debugging

**Defense-in-Depth:**
- Content-Length header check (early rejection)
- Actual body size check (catches misreported sizes)
- AbortController timeout (prevents slow-read DoS)

## Recommendation

**Status: EXCELLENT PRACTICE - Working as Designed**

This implementation demonstrates multiple layers of defense:

1. **Timeout Protection** (5 seconds): Prevents slow-read attacks
2. **Content-Length Validation**: Rejects large responses before downloading
3. **Body Size Validation**: Catches cases where Content-Length is missing or incorrect
4. **Configurable Limit**: 1MB constant can be adjusted if needed

**Optional Enhancements (not urgent):**

### 1. Add Streaming Response Option for Large Data
```typescript
interface APIServiceOptions {
  // ... existing options
  maxResponseSize?: number; // Allow customization
  enableStreaming?: boolean; // For large batch operations
}
```

### 2. Add Response Size Metrics
```typescript
this.logger.debug(`Received response: ${text.length} bytes`);
if (text.length > API_MAX_RESPONSE_SIZE * 0.8) {
  this.logger.warn(`Response size near limit: ${text.length}/${API_MAX_RESPONSE_SIZE} bytes`);
}
```

### 3. Document the Limit
```typescript
/**
 * Maximum API response size (1 MB)
 *
 * Rationale:
 * - Typical batch price requests: ~100 items × ~200 bytes = 20KB
 * - Maximum batch size: 100 items (Universalis limit)
 * - 1MB provides 50x safety margin
 * - Protects against malicious/misconfigured upstream APIs
 */
export const API_MAX_RESPONSE_SIZE = 1024 * 1024;
```

## References
- CWE-400: Uncontrolled Resource Consumption
- OWASP API Security Top 10: API4:2023 Unrestricted Resource Consumption
- https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html

## Conclusion
This is a textbook example of proper API security controls. No changes required.
