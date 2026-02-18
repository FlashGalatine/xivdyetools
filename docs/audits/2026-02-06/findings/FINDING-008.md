# FINDING-008: Logger Does Not Redact Secrets Embedded in JSON String Values

## Severity
LOW

## Category
CWE-532: Insertion of Sensitive Information into Log File

## Location
- File: `xivdyetools-logger/src/core/base-logger.ts`
- Line(s): 156-167
- Function/Component: `BaseLogger.redactSensitiveFields()`

## Description
The field-level redaction in `redactSensitiveFields()` only checks top-level field names in the context object. If a sensitive value is embedded within a nested JSON string or a deeply nested object, it will not be redacted.

## Evidence
```typescript
// base-logger.ts:156-167
protected redactSensitiveFields(context: LogContext): LogContext {
  const redacted = { ...context };
  const fieldsToRedact = this.config.redactFields || DEFAULT_REDACT_FIELDS;

  for (const field of fieldsToRedact) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';  // Only checks top-level keys
    }
  }

  return redacted;
}
```

**Unredacted scenarios:**
```typescript
// Scenario 1: Secret in nested object
logger.info('API response', {
  response: { token: 'eyJ...' }  // NOT redacted (nested under "response")
});

// Scenario 2: Secret in stringified JSON
logger.info('Error details', {
  rawBody: '{"access_token":"secret123"}'  // NOT redacted (it's a string value)
});

// Scenario 3: Secret in array
logger.info('Headers', {
  headers: [['Authorization', 'Bearer secret']]  // NOT redacted (array value)
});
```

## Impact
**Practical risk: Low.** The current codebase follows good practices of not logging raw API responses. The error message sanitization (FINDING-005) provides a secondary defense for error strings. However, future code changes could inadvertently log nested sensitive data.

## Recommendation
1. **Recursive field redaction** — walk nested objects:
   ```typescript
   protected redactSensitiveFields(context: LogContext, depth = 0): LogContext {
     if (depth > 5) return context; // Prevent infinite recursion
     const redacted = { ...context };
     for (const [key, value] of Object.entries(redacted)) {
       if (fieldsToRedact.includes(key.toLowerCase())) {
         redacted[key] = '[REDACTED]';
       } else if (typeof value === 'object' && value !== null) {
         redacted[key] = this.redactSensitiveFields(value, depth + 1);
       }
     }
     return redacted;
   }
   ```

2. **Document the limitation** — make it clear in the API docs that only top-level context fields are redacted, so consumers know to avoid nesting sensitive data.

## References
- CWE-532: https://cwe.mitre.org/data/definitions/532.html
- Related: FINDING-005 (error message regex gaps)
