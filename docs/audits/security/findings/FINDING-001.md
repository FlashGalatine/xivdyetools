# [FINDING-001]: Console Output in Production Code

## Severity
LOW

## Category
Information Disclosure (CWE-532)

## Location
- File: [src/utils/index.ts](../../xivdyetools-core/src/utils/index.ts)
- Line(s): 669
- Function: retry()

- File: [src/services/dye/DyeSearch.ts](../../xivdyetools-core/src/services/dye/DyeSearch.ts)
- Line(s): 280, 402
- Functions: findClosestDye(), findDyesWithinDistance()

- File: [src/__tests__/integration/dye-matching-workflow.test.ts](../../xivdyetools-core/src/__tests__/integration/dye-matching-workflow.test.ts)
- Line(s): 85
- Context: Test file

## Description
Direct console.warn() calls are present in production source code. While not as severe as console.log() for sensitive data, these calls bypass the logger abstraction and can leak implementation details or timing information in production environments.

## Evidence
```typescript
// src/utils/index.ts:669
if (isAbortError(error)) {
  console.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
}

// src/services/dye/DyeSearch.ts:280
console.warn(
  `Delta-E method "${deltaEFormula}" requires ColorConverter for hex→LAB conversion.`
);

// src/services/dye/DyeSearch.ts:402
console.warn(
  `Delta-E method "${deltaEFormula}" requires ColorConverter for hex→LAB conversion.`
);
```

## Impact
**Low Impact:**
- Information leakage: Reveals retry attempts and internal API behavior
- Bypasses structured logging system
- Cannot be disabled or configured in production
- May expose implementation details to browser console in web applications

**Not Critical Because:**
- Does not leak sensitive data (API keys, tokens, user data)
- Information is timing/diagnostic rather than confidential
- Limited to error scenarios

## Recommendation
Replace direct console calls with the logger abstraction:

```typescript
// Current (problematic):
console.warn(`Request timed out (attempt ${i + 1}/${attempts})`);

// Recommended:
if (this.logger) {
  this.logger.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
}
```

**Implementation Steps:**
1. Pass logger instance to retry() function via options parameter
2. Use logger.warn() instead of console.warn()
3. Update DyeSearch class to use injected logger instead of console.warn()
4. Ensure logger defaults to NoOpLogger for production builds

**Alternative (if logger injection is complex):**
- Remove console.warn() entirely from retry() - let calling code handle logging
- Use DEBUG environment variable to control diagnostic output

## References
- CWE-532: Insertion of Sensitive Information into Log File
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
