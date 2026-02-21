# FINDING-008: Custom `redactFields` Replaces Defaults Instead of Extending

## Severity
MEDIUM

## Category
CWE-532: Information Exposure Through Log Files

## Location
- File: `packages/logger/src/core/base-logger.ts`
- Line(s): ~30-37
- Function: Constructor

## Description
When a consumer provides custom `redactFields`, the spread operator replaces the entire default field list instead of extending it. A consumer adding one custom field inadvertently disables redaction of `password`, `token`, `secret`, `apiKey`, and all other default sensitive fields.

## Evidence
```typescript
constructor(config: Partial<LoggerConfig> = {}) {
  this.config = {
    redactFields: [...DEFAULT_REDACT_FIELDS],
    ...config,  // ← config.redactFields REPLACES the spread above
  };
}
```

A test confirms the side effect:
```typescript
const customLogger = new TestLogger({ redactFields: ['customField'] });
expect(result.password).toBe('visible');  // ← Password is no longer redacted!
```

## Impact
Any consumer that adds custom redaction fields unknowingly disables all default security-critical redaction. This could expose passwords, tokens, and API keys in production logs.

## Recommendation
Merge custom fields with defaults:

```typescript
this.config = {
  ...defaults,
  ...config,
  redactFields: [
    ...DEFAULT_REDACT_FIELDS,
    ...(config.redactFields ?? []),
  ],
};
```

Or provide a separate `additionalRedactFields` config option.

## References
- [CWE-532: Information Exposure Through Log Files](https://cwe.mitre.org/data/definitions/532.html)
