---
name: build-resolver
description: Use when a xivdyetools build, type-check, bundle, or wrangler dry-run fails — "build is broken", "fix the build", TS errors from `pnpm turbo run build`, Vite/Pages bundle failures, worker size limits — before editing code.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Build Resolver (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

pnpm 11 + Turborepo: packages build with `tsc -p tsconfig.build.json` (core first runs
`build:locales`, then `copy:locales`); apps type-check with `tsc --noEmit`, web-app bundles with
Vite, workers bundle with wrangler. turbo tasks (`build`, `type-check`, `lint`, `test`) depend on
`^build`, so dependencies build first — **but workers have no `build` script**: `turbo run build
--filter=<worker>` has no entry task and builds nothing; use `--filter=<name>...` (trailing dots =
the unit **and its dependencies**, what CI uses). A unit's own `pnpm run` script never builds deps. Runs from the monorepo root `xivdyetools/`.

## Step 1 — capture

These three commands are fixed and emit hundreds of lines. Run them in a `collector` agent
(`../audit-shared/model-routing.md`) that returns, per command: the emitting workspace, each
distinct error code with its `file:line`, and the log path — never the log itself. Follow
the shared coordinator rules for delegation; classify from that list either way.

```bash
pnpm turbo run build --filter=<name>... 2>&1 | tee "<TMP>/<log-id>-build.log"   # the way CI builds it (unit + deps; the `...` is load-bearing)
pnpm --filter <name> run build 2>&1 | tail -40                                # the unit alone (no deps) — a difference between the two is diagnostic
pnpm turbo run type-check --filter=<name> 2>&1 | tail -40
```
Note which unit emitted the error (turbo prefixes lines with the workspace name).

## Step 2 — classify (project table first)

| Symptom | Cause | Fix |
|---|---|---|
| `TS2307 Cannot find module '@xivdyetools/<pkg>'` or a subpath (`/blending`, `/encoding`, `/rate-limiter`, `/i18n`) | dependency `dist/` missing or stale (fresh pull, `git clean`, ran the unit's script without turbo), or the subpath isn't in the package `exports` map | `pnpm turbo run build --filter=<name>...` (all deps); still missing after a `cache hit` → `pnpm --filter @xivdyetools/<pkg> run clean && pnpm turbo run build --filter=@xivdyetools/<pkg> --force` (core's build never cleans); check `packages/<pkg>/package.json` `exports` (`.`, `./blending`, …) + `tsconfig.build.json` includes the subpath entry |
| `ERR_PNPM_*`, missing binary after a pull, "Packages: +N -M" relink noise | lockfile changed | `pnpm install --frozen-lockfile` (never delete `pnpm-lock.yaml`; never `--legacy-peer-deps` — that's npm) |
| `TS1484`/`TS1205` "is a type and must be imported using a type-only import" | `verbatimModuleSyntax` in `tsconfig.base.json` | `import type { … }` / `export type { … }` |
| `TS6133` unused local/param | base `noUnusedLocals`/`noUnusedParameters` (a unit that overrode them will fail once it inherits) | remove the symbol (don't `_`-prefix to hide it) |
| `fileURLToPath` / `URL` "not assignable" | `@cloudflare/workers-types` + `@types/node` both loaded — global `URL` ≠ `node:url` URL | pass `import.meta.url` **string** |
| core build: locale step fails | `scripts/build-locales.ts` / `dyenames.csv` / `localize.yaml` edit | fix the generator or CSV; never hand-edit `src/data/locales/*.json` |
| wrangler dry-run: script too large | discord-worker limit 3,072 KiB gzip (~14 % headroom); fonts/WASM | check what grew (`--outdir` + sizes); image processing lives in image-worker by design; CJK subsets must be subsets |
| web-app `check-bundle-size.js` / `build:check` red | chunk over budget | lazy-load the module; sourcemap attribution charges virtual modules (`virtual:changelog`) to the preceding file — bisect by weight, don't guess |
| turbo green locally, red in CI (or vice versa) | turbo cache served a stale task (`tsconfig.base.json` is not a task input); CI runs `--filter='...[HEAD^]'` | `pnpm turbo run build --filter=<name>... --force`; clear `.turbo/` for the unit |
| Node API / engine errors | repo targets Node 22 (`node --version`) | use Node 22; `.ts` scripts run directly under Node 22 |
| Pages `_headers` / smoke test fails post-build | header patterns merge; SPA fallback cached under `.js` URLs | see `../audit-shared/traps/security-git.md` last bullet |

Generic classes (syntax, config, env/permissions, missing files) follow the usual TS/Vite
rules: read the file at the line, `git log -3 -- <file>`, fix, rebuild. An error matching
**no row above** is root-cause work rather than table lookup — route it to a `verifier` (give it
the failing command output, the file at the line, and
`git log -3 -- <file>`) and take back the diagnosis. You apply the fix either way.

## Step 3 — fix one at a time, then verify the blast radius

Both commands are mechanical → a `collector` agent returns pass/fail per workspace plus the first
error of any red one.

```bash
pnpm turbo run build type-check --filter=<name>...       # the unit + its deps
pnpm turbo run build type-check lint test --filter=...<name>   # its dependents — a package fix can break apps
```

## Report (plain)

```
Build <name> · command · status ✓
| Error | Cause | Fix (file:line) |
Verified: build ✓ type-check ✓ dependents ✓ (<list>)
Follow-up: <guardrail / CI note or none>
```

## Rules

- Never delete the lockfile or `node_modules` as a first move; never `npm`/`yarn` commands here.
- Agents diagnose; **the coordinator edits**. Never give an agent write access to a file you
  are fixing — a loop with two writers stops converging (`../audit-shared/model-routing.md`).
- One fix at a time, rebuild between fixes; a package fix ends with its dependents rebuilt.
- Fix the generator, not generated output; don't paper over `verbatimModuleSyntax`/unused errors with `any`/`_` tricks.
- After 3–4 failed attempts: summarize, show the error + file, ask.
