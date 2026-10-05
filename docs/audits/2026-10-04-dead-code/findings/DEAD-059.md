# DEAD-059: auth verifier tuning options never passed by any app — ~27 src lines + 74 test lines (bot-signature knobs untested)
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/auth · **Semver:** MAJOR · **Category:** Dead Path · **Origin:** MAIN

## Location
- `packages/auth/src/discord.ts:28` — DiscordVerifyOptions (maxBodySize/maxTimestampAgeSeconds/maxFutureSkewSeconds) + BotSignatureOptions (maxAgeMs/clockSkewMs)

## Evidence
- Both production verifyDiscordRequest calls (discord-worker index.ts:736, moderation-worker index.ts:160) and the only verifyBotSignatureV2 call (presets-api auth.ts:311) pass no options. maxAgeMs/clockSkewMs are not passed even by any test; only the Discord knobs are tested.
  - Commands: git grep -n -E 'verifyDiscordRequest\(|verifyBotSignatureV2\(' -- apps packages: prod calls index.ts:736, moderation index.ts:160, presets-api auth.ts:311, all without options.; git grep -E 'clockSkewMs|maxAgeMs' -- apps: none; packages/auth tests: only jwt.test.ts (different function).; npm view @xivdyetools/auth version = 2.0.2 = local.
- Re-verified independently in the completeness re-sweep: No production caller passes options (discord-worker index.ts:736, moderation-worker index.ts:160, presets-api auth.ts:311), so only the override path is unused, and removing the fields is a type break.
- Origin: git log 8ecb878f..HEAD -G 'maxBodySize|maxTimestampAgeSeconds|maxFutureSkewSeconds|clockSkewMs|maxAgeMs': only e2a8058b (#226 docs/audits); no PR touches packages/auth; call sites identical at main.

## Fix
**KEEP.** Published API in auth 2.0.2 (= npm; present at ef555e57), types re-exported from index.ts:79/:97. Revisit at next auth major; consider adding a verifyBotSignatureV2 test that passes maxAgeMs/clockSkewMs rather than removing.

Steps: Major only: packages/auth/src/discord.ts:25-39 (DiscordVerifyOptions), options param :73 and reads :75,:101-102 replaced by constants; hmac.ts:17-30 (BotSignatureOptions), param :321, :323; index.ts:79 and :97 type re-exports; tests discord-freshness.test.ts:56-61, discord-stream.test.ts:58-94 & 113-126 (rewrite with default-cap bodies), discord.test.ts:137-155. Then pnpm turbo run build type-check lint test --filter=...@xivdyetools/auth && pnpm dead-code:check

## Status
KEEP (register) — revisit on the trigger above
