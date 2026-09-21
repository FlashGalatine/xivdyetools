---
name: unit-test-writer
description: Use when asked to write or add tests, raise or reach a coverage target, "test this file", or close coverage gaps for a xivdyetools app, worker, or package.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Unit Test Writer (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Vitest 4 everywhere (web-app jsdom + lit; workers/packages node). Target the unit's own
thresholds (`vitest.config.ts`; web-app is a ratchet 71/55/65/72, packages aim at 90 %).
Write tests that **can fail**; never cover dead code to move a number. Runs from the monorepo
root `xivdyetools/`.

## Parameters

| Param | Values |
|---|---|
| TARGET | file(s) or directory inside one deploy unit |
| METRIC / BASELINE | `branches` (default) · `statements` · `functions` · `lines`; default baseline = the unit's threshold |
| MAX_ITERATIONS | default 5 before reporting a plateau |

## Step 1 — baseline

The coverage run and the zero-hit arm extraction are mechanical → a `collector` agent
(`../audit-shared/model-routing.md`) runs them and returns the per-file percentages plus the
`file:line` arm list, not the coverage dump. Follow the coordinator rules for delegation.

```bash
pnpm --filter <name> run test:coverage 2>&1 | tail -40                    # unit thresholds; json-summary under <unit>/coverage/
# per-target branch detail (v8 counts ?? ?. ternaries and default params as branches)
pnpm --filter <name> exec vitest run --coverage --coverage.reporter=html --coverage.include=<src/file.ts> [<more>]
# zero-hit arms: coverage/coverage-final.json → c.b / branchMap (or open coverage/index.html)
```
Read the target source and its existing test file(s) — **extend the existing file** where the
unit keeps one (`*.test.ts` beside the source, `__tests__/`, or `tests/`); follow its naming,
`describe` layout, and helpers.

## Step 2 — plan (one table in chat)

`| file:line arm | what makes it run | test name | assertion | mock |` — prioritize public-contract
arms; an arm unreachable from the public contract (dead fallback, impossible `?? default`) is
reported as **uncoverable → delete the dead arm** (dead-code-finder territory), not tested via
private access or fabricated inputs. That uncoverable call is a dead-code verdict — `verifier`
work; follow the coordinator rules for whether it runs inline or is delegated.

## Step 3 — write, per unit conventions

TARGET spanning several source files → bounded `worker` assignments per **test file**, in
parallel within the runtime's capacity when useful (`../audit-shared/model-routing.md`).
Each prompt carries: the one target source,
the existing test file to extend, its unit's row from the table below, and the *Rules —
shapes that are rejected* section verbatim. One agent per file and never two on the same
file. A single target file stays inline unless the coordinator rules require delegation.

| Unit | Env / helpers | Mock convention |
|---|---|---|
| **workers with bindings** (api, discord, moderation, oauth, presets-api) | node; `@xivdyetools/test-utils` (`cloudflare/`: `d1`, `kv`, `r2`, `fetcher`, `analytics`; `auth/`, `factories/`, `constants/`) | mock bindings via test-utils, `vi.spyOn(globalThis, 'fetch')`; core/auth stay real |
| **og-worker, image-worker** | node; no test-utils dep | `vi.mock('./services/renderer')` (WASM), `vi.spyOn(globalThis,'fetch')`, `vi.spyOn(dyeService,'getAllDyes')`; core is real and inlined (`server.deps.inline`) — never mock `@xivdyetools/core` |
| **web-app** | jsdom, lit; `src/__tests__/mocks/` (e.g. `virtual-changelog.ts`) | `vi.mock('@services/index' \| '@shared/logger' \| '@services/language-service')` as the suites already do; render panels with lit `render()` (full `<v4-config-sidebar>` can't mount); `await vi.waitFor()` for async UI — no `setTimeout(0)` flush counts |
| **packages** | node | pure functions — no mocks; `LocaleLoader` for locale strings; k-d tree vs linear-scan paths both exercised |

Interpolation/locale tests: use the six locale codes; Discord handlers respect the 25-choice
autocomplete cap and embed limits; `Translator.t()` returns the key, never falsy.

## Step 4 — iterate

Run the file (`pnpm --filter <name> exec vitest run <test file>`), then the narrowed coverage
command, then after each batch the unit's `test:coverage`. Stop when baseline met, or after two
iterations that move the metric < 2 points (plateau → report what's left and why; web-app
browser-only branches escalate to Playwright `pnpm --filter xivdyetools-web-app run test:e2e`,
knowing the mobile-chrome project carries ~28 pre-existing reds).

Finish with `pnpm turbo run type-check lint --filter=<name>` (unused imports fail
`noUnusedLocals`; knip gates in og-worker/web-app/core/svg/bot-logic).

## Rules — shapes that are rejected

- `expect(typeof x).toBe('function')`, bare `not.toThrow()`, `toContain('<svg')`-only, a loop
  that only asserts truthiness across six locales, guarded bodies (`if (count >= 2) {…}` with no
  else), asserting a value captured *before* the action, arithmetic the test computed itself —
  ask "what source edit would make this fail?"; if none, rewrite against observable output.
- No whole-SVG snapshots for coverage; no exact ΔE/dye-name assertions that break on data
  patches; no coverage-config excludes to hit a number (propose, don't apply).
- Keep tests independent; no network; no `.only`.

## Report (plain)

```
Target <files> · metric <col> · before <x>% → after <y>% (baseline <b>%) · <MET|PLATEAU>
| Test file | tests added | arms closed |
Uncoverable (recommend removal): <file:line arms, or none>
Gates: type-check ✓ lint ✓ unit test:coverage ✓
```
