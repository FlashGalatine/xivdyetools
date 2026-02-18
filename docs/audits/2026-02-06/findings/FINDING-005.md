# FINDING-005: Logger Secret Redaction Regex Patterns Incomplete

## Severity
MEDIUM

## Category
CWE-532: Insertion of Sensitive Information into Log File

## Location
- File: `xivdyetools-logger/src/core/base-logger.ts`
- Line(s): 131-151
- Function/Component: `BaseLogger.sanitizeErrorMessage()`

## Description
The error message sanitization function uses a hardcoded set of regex patterns to redact sensitive values from error messages. Several common secret-related keywords are missing from the pattern list, which could allow sensitive values to pass through to logs unsanitized.

## Evidence
```typescript
// base-logger.ts:137-150 - Current sanitization patterns
return message
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
  .replace(/token[=:]\s*(?:...)/gi, 'token=[REDACTED]')
  .replace(/secret[=:]\s*(?:...)/gi, 'secret=[REDACTED]')
  .replace(/password[=:]\s*(?:...)/gi, 'password=[REDACTED]')
  .replace(/api[_-]?key[=:]\s*(?:...)/gi, 'api_key=[REDACTED]')
  .replace(/authorization[=:]\s*(?!Bearer)(?:...)/gi, 'authorization=[REDACTED]')
  .replace(/access[_-]?token[=:]\s*(?:...)/gi, 'access_token=[REDACTED]')
  .replace(/refresh[_-]?token[=:]\s*(?:...)/gi, 'refresh_token=[REDACTED]');
```

**Missing patterns that could leak secrets:**
- `auth_token` / `authtoken` — common variant not covered
- `private_key` / `privateKey` — cryptographic key material
- `client_secret` / `clientSecret` — OAuth client secrets
- `signing_key` / `signingKey` — HMAC/JWT signing keys
- `webhook_secret` — webhook authentication
- `credential` / `credentials` — generic credential patterns

**Example leakage scenario:**
```typescript
// This error message would NOT be redacted:
throw new Error('OAuth failed: client_secret=NSFTLiJM0Sb_atWCiUmejDr0jHqMCuUU');
// Logged as-is: "OAuth failed: client_secret=NSFTLiJM0Sb_atWCiUmejDr0jHqMCuUU"
```

Note: The field-level redaction (`CORE_REDACT_FIELDS` in constants.ts) is separate and only applies to context object keys, not to string content within error messages.

## Impact
**Practical risk: Medium.** Error messages from third-party libraries or runtime exceptions may contain secret values in formats not covered by the current patterns. In Cloudflare Workers, logs are typically short-lived (only accessible via `wrangler tail`), but in other environments they may persist.

## Recommendation
Add additional patterns to `sanitizeErrorMessage()`:

```typescript
.replace(/client[_-]?secret[=:]\s*(?:...)/gi, 'client_secret=[REDACTED]')
.replace(/private[_-]?key[=:]\s*(?:...)/gi, 'private_key=[REDACTED]')
.replace(/signing[_-]?(?:key|secret)[=:]\s*(?:...)/gi, 'signing_key=[REDACTED]')
.replace(/webhook[_-]?secret[=:]\s*(?:...)/gi, 'webhook_secret=[REDACTED]')
.replace(/credential[s]?[=:]\s*(?:...)/gi, 'credential=[REDACTED]')
```

Consider also adopting a more generic approach that catches `*_secret`, `*_token`, `*_key` patterns:
```typescript
.replace(/\b\w*(?:secret|token|key|password|credential)\w*[=:]\s*(?:["'][^"']*["']|[^\s,;]+)/gi, '$&'.replace(/[=:].*/, '=[REDACTED]'))
```

## References
- CWE-532: https://cwe.mitre.org/data/definitions/532.html
- OWASP: Logging Cheat Sheet
- Related: `xivdyetools-logger/src/constants.ts` (field-level redaction list)
