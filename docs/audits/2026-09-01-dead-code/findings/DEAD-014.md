# DEAD-014: moderation-worker — 13 exported helpers with zero production call sites, spread across six files it copied from discord-worker — 191 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
Spans measured in `evidence/measure.txt`:
- `src/utils/response.ts` — `autocompleteResponse` (:167-177), `embedResponse` (:147-155), `infoEmbed` (:201-210), `hexToDiscordColor` (:212-218), `encodeBase64Url` (:293-307) — 52 lines
- `src/utils/discord-api.ts` — `sendFollowUp` (:32-63), `deleteOriginalResponse` (:97-117) — 53 lines
- `src/services/preset-api.ts` — `getModerationHistory` (:391-406), `isApiEnabled` (:192-197) — 22 lines
- `src/middleware/rate-limit.ts` — `getRateLimitInfo` (:250-290) — 41 lines
- `src/services/i18n.ts` — `getLocaleInfo` (:53-58); `src/services/bot-i18n.ts` — `createTranslator` (:205-210); `src/handlers/buttons/preset-moderation.ts` — `isPresetModerationButton` (:308-317) — 23 lines

## Evidence
- `evidence/scripts/callsites.sh apps/moderation-worker …` printed only the declaration line for each of the 13; every other reference is a test (`evidence/symrefs-moderation-worker.txt` gives the per-symbol test counts, 3–14 each).
- Re-checked against `scripts/`, config and workflows — `evidence/recheck-nonsrc.txt`, no hits.
- Not holes, just surplus: the live equivalents exist and are used — `createUserTranslator` (`index.ts:248`) replaces `createTranslator`, `decodeBase64Url` is live in `handlers/modals/ban-reason.ts:78` while its `encode` twin is not, and `handleButtonInteraction` matches `custom_id` prefixes directly instead of calling `isPresetModerationButton`.

## Fix
**REMOVE**, one file per commit, deleting each symbol's test block with it. Where a file drops below a couple of live exports (`utils/discord-api.ts` keeps 2 of 4), consider whether the file still earns its place. Do **not** delete `resetRateLimiterInstance` — that is a test-isolation hook (KEEP register).
Gate per commit: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN
