# DEAD-060: auth barrel re-export of hmacSignHex is test-only in-repo and lacks @public — 1 line
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/auth · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/auth/src/index.ts:65` — hmacSignHex (barrel re-export)

## Evidence
- Barrel line index.ts:65 has no production importer outside auth; only apps/presets-api/tests/middleware/auth-v2.test.ts:20 imports it. hmacSignHex itself is live via createBotSignatureV2 (hmac.ts:309); bot-worker env-validation hits are comments.
  - Commands: git grep -n -w hmacSignHex -- . : prod only hmac.ts:147 def + :309 internal use; external import only presets-api tests/middleware/auth-v2.test.ts:20.; discord-worker env-validation.ts:86, moderation-worker env-validation.ts:114 are comments.; npm view @xivdyetools/auth version = 2.0.2 = local.
- Origin: git grep -n -w hmacSignHex 8ecb878f -- apps: only presets-api test + changelog/comments (preset-api.ts already off it); git log 8ecb878f..HEAD -S hmacSignHex: only e2a8058b (#226 docs).

## Fix
**KEEP.** Published in auth 2.0.2 (= npm; ef555e57 index.ts:65) and also reachable via ./hmac subpath. Add /** @public */ to index.ts:65 now: otherwise auth lint:dead (includeEntryExports) goes red the moment the presets-api test stops importing it. Revisit at next auth major.

Steps: Now: prefix packages/auth/src/index.ts:65 with /** @public */ (no semver). Removal (major only): delete index.ts:65; switch apps/presets-api/tests/middleware/auth-v2.test.ts:20 to import from '@xivdyetools/auth/hmac'. Then pnpm turbo run build type-check lint test --filter=...@xivdyetools/auth && pnpm dead-code:check

## Status
KEEP (register) — revisit on the trigger above
