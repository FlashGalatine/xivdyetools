# DEAD-009: CharaResolveUnavailableError.status is never read and no caller checks the error type — ~7 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/chara-resolve-service.ts:93-101 (constructor param `public readonly status?: number`), :204-207 (only call site passing response.status)`
- `apps/web-app/src/services/__tests__/chara-resolve-service.test.ts:92 (only .status read)`

## Evidence
- git grep -n -w CharaResolveUnavailableError: production refs are only chara-resolve-service.ts (class + 3 throws at 197/204/223); rest are the test, CLAUDE.md/docs and audit evidence. Its .status is read only at chara-resolve-service.test.ts:92. Consumers: glamour-block.ts:401-406 rejection handler ignores the error and logs fixed text; item-links-menu.ts:187-188 catch passes it to logger.warn, which is dev-only. serialiseArg (shared/logger.ts:111-115) keeps only name and message, so status is never logged. extractor-tool.ts:2095 duck-types `status`, but only for market errors. No instanceof checks in production, nothing in e2e, scripts or functions. Status stays in the message (204) and in the warn at 203. Ap…
- Only the `status` field is dead. The class itself is live: it is thrown on every failure path and its name reaches the dev warn log. No production code reads `.status`, neither directly nor through the logger, which keeps only name and message. Removing it loses no diagnostics, because the HTTP code is still in the error message and the warn on line 203. Checks before removing: no PR in flight adds a status-based branch, for example retrying on 429/503. If one does, keep the field. web-app is not published, so semver is NONE.
- Still live: None for `.status`. The class itself is live: it is thrown at chara-resolve-service.ts:197, 204 and 223, and its name is logged in dev at item-links-menu.ts:188.

## Fix
- **REMOVE WITH CAUTION** — 1) chara-resolve-service.ts:94-97: replace the constructor with `constructor(message: string) {`. Keep the class, its name and the 3 throws. 2) :204-207: replace with a one-line `throw new CharaResolveUnavailableError(\`api-worker answered ${response.status}\`);` (86 chars, within printWidth 100). 3) chara-resolve-service.test.ts: delete line 92 and keep the toBeInstanceOf assertions. 4) Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` and `pnpm dead-code:check`.
- Cascade: One test assertion goes (test.ts:92). Nothing else reads the field, and neither docs nor CLAUDE.md mention `status`.

## Status
OPEN — remaining A-WEB implementation and regression proof prepared in web 5.16.4 (draft #347); production acceptance pending. [A-WEB evidence](../../2026-10-26-deep-dive/evidence/remediation-web-2026-10-28.md).
