# DEAD-062: handleModal and the unsupportedComponent fallback in index.ts are unreachable defensive router branches: 24 lines + 12 locale lines + 59 test lines
**Confidence:** MEDIUM · **Blast radius:** MEDIUM · **Deploy unit:** apps/discord-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/discord-worker/src/index.ts:1378` — handleModal / errors.unknownModal / non-button component fallback

## Evidence
- The worker never emits a modal (the MODAL response type was removed in 2026-08-18-discord-worker-dead-code/DEAD-004) or any non-button component. git history since the monorepo migration shows such payloads only in tests, and no other worker posts with DISCORD_TOKEN. Both branches are reached only by synthetic test payloads.
  - Commands: git log -G'(type: 3, *//|StringSelect|select_menu|type: 9|ResponseType.MODAL,)' -- apps/discord-worker/src -> only 79e945ac, whose hits are test payloads; git grep DISCORD_TOKEN apps/*/src outside discord-worker (non-test) -> none; index.test.ts:2451-2477 and 2480-2511 exercise them with synthetic payloads
- Origin: git show 8ecb878f:apps/discord-worker/src/index.ts has handleModal dispatch at :780, the unsupportedComponent fallback at :1355, and handleModal at :1377.

## Fix
**KEEP.** Confidence is MEDIUM because Discord, not this repo, sends the payloads, and pre-monorepo messages that might carry select menus cannot be checked. Removing the branches turns a polite ephemeral reply into a 400. The fallback cannot simply be deleted because handleComponent must return something, and the two locale keys live in the published bot-logic package. Revisit if the router is restructured.

Steps: Only if the owner wants the router trimmed: delete index.ts 779-782 (the MODAL_SUBMIT branch, which then falls to 'Unknown interaction type' 400) and 1375-1390 (handleModal). Replace the fallback at 1354-1357 with an explicit response, since handleComponent must still return. Delete the errors.unknownModal and errors.unsupportedComponent keys (12 lines) from all six packages/bot-logic/src/i18n/locales/*.json, which needs a bot-logic version bump and changelog. Delete or adjust index.test.ts 2451-2477 and 2480-2511. Then run pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic --filter=...xivdyetools-discord-worker && pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
