# DEAD-036: decodeJWT wrapper in apps/oauth jwt-service.ts is test-only: 8 src lines + 31-line describe block
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/oauth · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/oauth/src/services/jwt-service.ts:193` — decodeJWT

## Evidence
- The only references are in jwt-service.test.ts (:10 import, :149/160/167/174 mintToken payload checks, the :259-289 describe). No oauth production file calls it. The repo gate stays quiet only because web-app's unrelated private this.decodeJWT (auth-service.ts:813) matches the name as raw text.
  - Commands: git grep -n -w decodeJWT -- apps packages: oauth hits are only jwt-service.ts:21 (import alias), :193 (decl) and jwt-service.test.ts; the other app hits are web-app's private method at auth-service.ts:305/456/813; wrangler main = src/index.ts; no dynamic or bracket access in oauth
- Origin: git grep -n -w decodeJWT 8ecb878f -- apps/oauth gives the same hits (jwt-service.ts:21,193 + tests). git log 8ecb878f..HEAD -SdecodeJWT -- apps/oauth is empty, and PR #228 touched only constants/oauth-flow/wrangler.

## Fix
**REMOVE WITH CAUTION.** Removing the wrapper also removes the only in-repo production import of the shared @xivdyetools/auth decodeJWT, which is NOT @public-tagged in packages/auth/src/index.ts:41. After the change, the oauth test must import decodeJWT from '@xivdyetools/auth', or the barrel entry needs a /** @public */ tag, or packages/auth lint (knip includeEntryExports) fails. The auth JWTPayload has username/global_name/avatar, so repointing type-checks.

Steps: 1) apps/oauth/src/services/jwt-service.ts: delete :189-195 (doc comment + function) and :21 (`decodeJWT as sharedDecodeJWT,`).
2) apps/oauth/src/__tests__/jwt-service.test.ts: drop `decodeJWT` from the :10 import, add `import { decodeJWT } from '@xivdyetools/auth';` for the four mintToken checks (:149,160,167,174), and delete the describe('decodeJWT') block at :259-289 (already covered by packages/auth/src/jwt.test.ts).
3) Optionally add /** @public */ before decodeJWT in packages/auth/src/index.ts:41, since it now has no in-repo production consumer.
4) Fix the now-stale 'oauth consumes decodeJWT' lines in packages/auth/CLAUDE.md:234 and packages/auth/README.md:202.
5) Run pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker, then pnpm --filter @xivdyetools/auth run lint, then pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `35f502db`, `1fbff533` (branch `fix/remediation-2026-10-04-sprint10`, oauth 3.1.3; PR #272, open).
