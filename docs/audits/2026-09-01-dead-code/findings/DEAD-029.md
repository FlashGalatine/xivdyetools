# DEAD-029: discord-worker `registryCommandNames` and `InteractionResponseBody` — both test-only by reference count, both KEEP

**Confidence:** HIGH (test-only) · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
- `apps/discord-worker/src/commands/registry.ts:61-64` — `registryCommandNames(): string[]`
- `apps/discord-worker/src/types/env.ts:244` — `interface InteractionResponseBody`

## Evidence
- `evidence/symrefs-discord-worker.txt`: `registryCommandNames prod=1 tests=3`; `InteractionResponseBody prod=1 tests=202`. `evidence/recheck-nonsrc.txt` confirms neither is used from `scripts/` or config.
- **But the reference count is the wrong measure here.** `registryCommandNames` backs the roster-parity gate in `commands/registry.test.ts:13-15` — `expect(registryCommandNames().sort()).toEqual(schemaNames)` — which is the only thing tying `COMMAND_REGISTRY` to the schemas that ship to Discord. Its own docstring says "Names only, for parity checks."
- The 2026-08-18 audit reached this conclusion first: `apps/discord-worker/CHANGELOG.md:141` records `resetRateLimiterInstance` and `registryCommandNames` as **deliberately kept test hooks** while 20 neighbouring exports were deleted.

## Fix
**KEEP both.** Removing `registryCommandNames` would inline `COMMAND_REGISTRY.map(c => c.name)` into the test: four lines saved, a named intent lost, and a decision reversed that a previous audit made on purpose. `InteractionResponseBody`'s 202 test references make it the de-facto handler-return assertion type.
**Revisit trigger:** if the roster-parity test is ever deleted, `registryCommandNames` goes with it. If `InteractionResponseBody` still shows `prod=1` in a future sweep, move it to `src/types/testing.ts` so its test-only status is declared rather than inferred.

## Status
OPEN (KEEP) — recommendation reversed during execution: `registryCommandNames` backs the registry↔schema roster-parity gate and the 2026-08-18 audit had already kept it deliberately.

