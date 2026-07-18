# [REFACTOR-010]: preset-api.ts and discord-api.ts are near-duplicates across discord-worker and moderation-worker

## Priority
MEDIUM

## Category
Cross-worker duplication → shared package extraction (security-critical code path)

## Location
- `apps/discord-worker/src/services/preset-api.ts` (661 lines) vs `apps/moderation-worker/src/services/preset-api.ts` (513 lines) — identical `generateRequestSignature` (discord `:46-69` vs moderation `:65-89`) and identical `request()` core (discord `:89-187` vs moderation `:98-160+`)
- `apps/discord-worker/src/utils/discord-api.ts` (309 lines) vs `apps/moderation-worker/src/utils/discord-api.ts` (186 lines) — same `sendMessage`/`editMessage` bodies with the same 5 s `AbortSignal.timeout`s

## Current State
Both workers carry their own copy of: the HMAC-SHA256 request-signing implementation (message format `timestamp:userId:userName`), the service-binding-with-URL-fallback request core (headers, auth, error wrapping into `PresetAPIError`), and the Discord REST helpers (`sendMessage`, `editMessage`, follow-up/edit-original with multipart file support in discord-worker's larger copy). The pattern for sharing already exists: `verify.ts` in both workers is a one-line re-export from `@xivdyetools/auth` (`apps/discord-worker/src/utils/verify.ts:9-17`, REFACTOR-003 comment).

## Issues
- **Security-critical duplication:** two copies of the signer means any change to the signed message format must be coordinated across three codebases (both bots + the presets-api verifier) with no compiler help.
- **Divergence has already happened:** moderator-ID parsing differs (BUG-073); moderation's `isModerator` validates snowflakes, discord's doesn't; moderation logs signature generation, discord doesn't; discord's copy has multipart/file support the other lacks.
- **Bug-fix fan-out:** the systemic `.ok`-never-checked issue (BUG-035) must currently be fixed at 10+ call sites across two repos' worth of helpers instead of once.

## Proposed Refactoring
Extract into a shared package (e.g. `@xivdyetools/discord-client`, or a submodule of `@xivdyetools/bot-logic`):
1. `generateRequestSignature` + the `request()` core (parameterized by env-shaped config: binding, URL, secrets).
2. Discord REST helpers (`sendMessage`, `editMessage`, `editOriginalResponse`, `sendFollowUp`, incl. the multipart variants) with built-in timeout **and** `.ok` checking/logging (fixes BUG-035's enabler in one place).
3. `parseModeratorIds()` / `isModerator()` (fixes BUG-073).
Each worker keeps a thin typed wrapper exposing only its endpoint set, mirroring the `verify.ts` precedent.

## Benefits
- Single signing implementation; future REFACTOR-027 (signing method/path/body) becomes a one-package change plus the verifier.
- Consistent timeouts, error shapes, and response checking across both bots.
- ~500-700 lines of duplicated code removed; moderation-worker automatically gains the file-upload helpers if ever needed.

## Effort Estimate
Medium — 1-2 days: create package, move code + co-located tests, publish, two dependency bumps, delete duplicates.

## Risk Assessment
Low. Pure code motion with behavior pinned by existing tests in both workers; the HMAC format must not change during the move (byte-for-byte identical message string). Deploy both workers after the bump; no presets-api change required.

> Source: evidence/bot-workers-analysis.md (2026-07-18 deep-dive, bot-workers area)
