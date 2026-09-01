# DEAD-016: moderation-worker `toBannedUser` and `InteractionResponseBody` — exported, never referenced, not even by a test

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/moderation-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export / Unused Type

## Location
- `src/types/ban.ts:114-129` — `toBannedUser(row: BannedUserRow): BannedUser` (16 lines)
- `src/types/env.ts:162` — `interface InteractionResponseBody`

## Evidence
- knip reports both (`evidence/knip-root.txt`, *Unused exports* and *Unused exported types*).
- `evidence/symrefs-moderation-worker.txt`: `toBannedUser prod=1 tests=0 other=0` — the export line is its only occurrence in the repo. `InteractionResponseBody prod=1 tests=0`; its 13 "other" hits are discord-worker's **own** identically-named type, not imports of this one.
- The live row→model conversion happens inline in `services/ban-service.ts`; nothing routes through this helper.

## Fix
**REMOVE** both. Check whether `BannedUserRow`/`BannedUser` keep other consumers before touching them (they do — `ban-service.ts`). moderation-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN
