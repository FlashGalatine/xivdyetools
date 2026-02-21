# FINDING-005: Bot Signature Accepts Missing User Fields — Ambiguous Message Format

## Severity
MEDIUM

## Category
CWE-287: Improper Authentication

## Location
- File: `packages/auth/src/hmac.ts`
- Line(s): ~192-223
- Function: `verifyBotSignature()`

## Description
`verifyBotSignature` allows `userDiscordId` and `userName` to be `undefined` for "system-level bot requests," constructing the HMAC message as `"timestamp::"`. This creates message format ambiguity — two different callers (one system-level, one user-level with empty strings) produce indistinguishable signatures. An attacker obtaining a system-level signature could replay it without proper user context.

## Evidence
```typescript
if (!signature || !timestamp) {
  return false;
}
// userDiscordId and userName are NOT checked!

const message = `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}`;
// Result: "12345::" for both system calls and calls with empty userId/userName
```

## Impact
An attacker who obtains a signature for `"timestamp::"` (system-level) could use it as if authenticated with any (or no) user identity. The message format provides no way to distinguish between intentionally missing fields and actual system-level requests.

## Recommendation
Option A — Require all fields:
```typescript
if (!signature || !timestamp || !userDiscordId || !userName) {
  return false;
}
```

Option B — Distinct message format for system-level requests:
```typescript
const message = userDiscordId && userName
  ? `user:${timestamp}:${userDiscordId}:${userName}`
  : `system:${timestamp}`;
```

## References
- [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html)
