# DEAD-032: four workspaces switch off the base `noUnusedLocals` / `noUnusedParameters`, so the cheapest dead-code gate is off exactly where it is least watched

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** packages/svg · packages/bot-logic · apps/image-worker · apps/stoat-worker · **Semver:** NONE (config) · **Category:** Guardrail gap

## Location
- `tsconfig.base.json:19-20` sets `noUnusedLocals: true`, `noUnusedParameters: true`
- Overridden to `false` in `packages/svg/tsconfig.json`, `packages/bot-logic/tsconfig.json`, `apps/image-worker/tsconfig.json`, `apps/stoat-worker/tsconfig.json`

## Evidence
- `grep -H noUnused apps/*/tsconfig.json packages/*/tsconfig.json` — the four above are `false`; discord-worker, presets-api and web-app re-assert `true`; everyone else inherits it.
- Running the flags anyway across all 17 workspaces (`evidence/scripts/tsc-unused.sh` → `evidence/tsc-unused.txt`) produced **four** `TS6133` errors, all in stoat-worker tests. svg, bot-logic and image-worker are clean today — so turning the flags back on costs three of the four workspaces nothing.
- This is a re-opened guardrail: "noUnusedLocals ON" was one of the guardrails adopted after the 2026-08-16 web-app audit; it was never propagated to these four.

## Fix
**REMOVE the overrides** in `packages/svg`, `packages/bot-logic` and `apps/image-worker` (zero errors follow — verified). For `apps/stoat-worker`, either fix the four unused test imports listed in DEAD-030 and drop the override too, or leave the override with a one-line comment saying why, so it reads as a decision rather than drift.
Gate: `pnpm turbo run type-check` across the graph.

## Status
OPEN
