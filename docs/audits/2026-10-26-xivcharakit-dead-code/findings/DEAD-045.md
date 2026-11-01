# DEAD-045: chara-concurrency.test.mjs is run by no CI job or turbo task (manual workerd check, deliberately kept)
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast LOW->NONE: a manual test file plus its script and doc mentions. No production code is involved.

## Location
- `apps/api-worker/tests/chara-concurrency.test.mjs (201 lines)`
- `apps/api-worker/package.json:22 (test:chara-runtime script)`
- `apps/api-worker/CLAUDE.md:202`

## Evidence
- git grep -E 'test:chara-runtime|chara-concurrency': only package.json:22, api-worker CLAUDE.md:202, docs/projects/api-worker/overview.md:72, plus frozen audit docs (2026-10-20 REMEDIATION_PLAN.md:147/172/182 prescribes it as a hand-run check; IMPLEMENTATION_VERIFICATION.md:17 records 2/2 passing). git grep over .github/workflows + turbo.json: no hit. vitest.config.ts:5 include = tests/**/*.test.ts, src/**/*.test.ts, so .mjs is excluded. Test still targets live code: index.ts:160 /health, index.ts:176 route /v1/chara, router.ts:192 POST /resolve, router.ts:220 new CharaLookupLoader. git log d1d46ad5..HEAD -- lookup-loader.ts: no later change, so the test is current, not stale.
- This file is the only check of real Workers request ownership in workerd (coalesced lookups surviving an owner disconnect). The 2026-10-20 remediation plan made it a deliberate hand-run check because a Node/Vitest mock cannot verify this behavior. Two docs point at it, and it targets routes and a loader that are still live and unchanged. It is not part of the gate but it is not dead. Removing it would lose the only workerd-level check of CharaLookupLoader concurrency. A wrong removal breaks no runtime, so blast is LOW.
- Still live: Manual only: pnpm --filter xivdyetools-api-worker run test:chara-runtime (package.json:22), which apps/api-worker/CLAUDE.md:202 and docs/projects/api-worker/overview.md:72 point to. No CI or turbo consumer.

## Fix
- **KEEP** — revisit trigger: The next commit that touches apps/api-worker/src/chara/lookup-loader.ts or the POST /resolve handler in apps/api-worker/src/chara/router.ts, or the next wrangler major bump in apps/api-worker/package.json. When that happens, run pnpm --filter xivdyetools-api-worker run test:chara-runtime in that PR. If it passes, add it as a ci.yml step. If it cannot pass or be maintained, delete it along with its two doc mentions.
- Cascade: If deleted later, also remove: the package.json:22 script, the run sentence in apps/api-worker/CLAUDE.md:202, and the one in docs/projects/api-worker/overview.md:72. Leave the frozen audit docs as they are.

## Status
OPEN
