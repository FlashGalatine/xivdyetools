# DEAD-009: presets-api `notifyModerators` — 74 lines of webhook + owner-DM notification with no caller, keeping four `Env` fields and three production secrets alive (PAPI-16)

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/presets-api · **Semver:** NONE (app-internal) · **Category:** Dead Path + Unused Config

## Location
- `apps/presets-api/src/services/moderation-service.ts:395-468` — `notifyModerators`, exported, **0 call sites**
- `apps/presets-api/src/types.ts:126-128,144` — `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN` (read only inside the dead function) and `DISCORD_BOT_WEBHOOK_URL` (**read nowhere at all**)
- `apps/presets-api/tests/services/moderation-service.test.ts:680-850` — ~170 test lines that exercise nothing else

## Evidence
- `evidence/symrefs-presets-api.txt`: `notifyModerators prod=1 tests=12` — the single prod hit is its own `export` line. Re-checked against `scripts/`, config and workflows (`evidence/recheck-nonsrc.txt`): no hits.
- `git ls-files apps packages | xargs grep -n MODERATION_WEBHOOK_URL\|OWNER_DISCORD_ID\|DISCORD_BOT_TOKEN` → every production read is inside `moderation-service.ts:420-457`, i.e. inside the dead function. `DISCORD_BOT_WEBHOOK_URL` appears only in the `Env` type and `tests/test-utils.ts:54`.
- Already known and unblocked: `docs/operations/POST_MERGE_CHECKLIST.md` §3 lists this row with **Gate: none — dead today**. Notifications now run through moderation-worker and the announcement webhook. `PERSPECTIVE_API_KEY` in the same file is **live** (`:249-262`) — do not remove it.

## Fix
**REMOVE.** Delete the function, its `ModerationAlert`-shaped parameter type if unshared, the four `Env` fields, the `tests/test-utils.ts` defaults and the ~170 test lines; drop the vars from `docs/developer-guides/environment-variables.md`. Then the ops step already queued in §3: `wrangler secret delete MODERATION_WEBHOOK_URL|OWNER_DISCORD_ID|DISCORD_BOT_TOKEN --env production` from `apps/presets-api` once a day of clean tail proves nothing reads them.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
FIXED 2026-09-01 `e09b462d` — function, its `ModerationAlert` type, four `Env` fields, the ~197-line test block and the wrangler/CLAUDE/env-guide rows removed. **Ops step outstanding:** delete the three orphaned production secrets after a day of clean tail.

