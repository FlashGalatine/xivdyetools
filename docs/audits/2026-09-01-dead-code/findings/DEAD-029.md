# DEAD-029: discord-worker `registryCommandNames` and `InteractionResponseBody` — test-only survivors of the 2026-08-18 cleanup

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
- `apps/discord-worker/src/commands/registry.ts:61-64` — `registryCommandNames(): string[]` (4 lines)
- `apps/discord-worker/src/types/env.ts:244` — `interface InteractionResponseBody`

## Evidence
- `evidence/symrefs-discord-worker.txt`: `registryCommandNames prod=1 tests=3`; `InteractionResponseBody prod=1 tests=202` — the type is the return annotation tests use everywhere, but no production file references it.
- `evidence/scripts/callsites.sh apps/discord-worker …` printed only the declaration line for each; `evidence/recheck-nonsrc.txt` confirms no use from `scripts/` or config.
- Contrast with two symbols in the same sweep that **are** live and were nearly mis-filed: `countLocalizations` and `LOCALE_CODES` (`src/commands/localize.ts`) are imported by `scripts/register-commands.ts:25`.

## Fix
- `registryCommandNames`: **REMOVE** with its test block.
- `InteractionResponseBody`: **KEEP** — 202 test references make it the de-facto assertion type for every handler's return value, and deleting it would mean re-typing them inline. Move it next to the tests, or leave it and stop treating it as a finding.
  **Revisit trigger:** if handler return types are ever annotated with it in production code, the KEEP resolves itself; if a future sweep still shows `prod=1`, move it under `src/types/testing.ts` so its status is explicit.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker`.

## Status
OPEN
