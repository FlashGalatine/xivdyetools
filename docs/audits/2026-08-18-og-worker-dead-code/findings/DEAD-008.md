# [DEAD-008]: `tsconfig.json` switches off the base config's `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns`

## Category
Legacy Code (guardrail regression)

## Location
- File: `apps/og-worker/tsconfig.json` lines 7–9

## Evidence
`tsconfig.base.json:18-20` sets all three `true`. og-worker (like `image-worker` and `stoat-worker`) overrides them to `false`, while `discord-worker`, `presets-api` and `web-app` keep them on. Result: DEAD-007's unused imports ship silently. Enabling costs exactly the four TS6133 fixes in `evidence/tsc-unused.txt`; `noImplicitReturns` produced no errors at all.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE after DEAD-007 |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST → enable.** After DEAD-007, delete the three override lines so the app inherits the base. This is the guardrail that stops this class of finding recurring (the web-app audit did the same on 2026-08-16). Consider the same for `image-worker` (out of scope here).
