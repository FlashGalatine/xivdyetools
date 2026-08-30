# FINDING-025: `@xivdyetools/logger` value-shape redaction never reaches string items inside arrays or the `message` / `error.message` text — a bare JWT or Discord token there logs verbatim
**Severity:** LOW · **Exposure:** every Worker (package) · **Deploy unit:** logger (package) → all consumers · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `packages/logger/src/core/base-logger.ts:242-248` — array items are recursed only when they are objects; string items pass through unscanned
- `packages/logger/src/core/base-logger.ts:66-69,143-193,411-421` — the key-name and value-shape scans apply to context values, not to `message` or `error.message`

## Evidence
- `logger.info(\`token ${jwt}\`)` or `logger.warn('x', { tokens: ['eyJ…'] })` is emitted unredacted; `packages/logger/src/__tests__/hardening.test.ts` covers nested objects and `token = …` pairs only.

## Fix
- Run the value-shape scan over string array items and over `message` / `error.message`; add the three cases to `hardening.test.ts`; logger patch release.

## Status
OPEN
