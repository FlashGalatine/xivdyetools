# Windows test loader correction — 2026-10-28

**Scope:** restore the repository test gate before continuing remediation sprints,
in [draft PR #347](https://github.com/FlashGalatine/xivdyetools/pull/347).
This adds test tooling to the pending presets API **2.8.1** release; it changes no
application behavior, dependencies, lockfile, workflow or production configuration.
Live `main` still reports presets API 2.6.1, so the existing unreleased version is retained.

## Cause and correction

Presets API's test alias matched every path ending in `.js`:

```ts
{ find: /^(.+)\.js$/, replacement: '$1' }
```

An actual Vite loader trace showed Hono's `/@fs/…/hono/dist/index.js` URL resolving
to the extensionless `…/hono/dist/index`. Filesystem loading was permitted, but
reading that nonexistent filename returned `ENOENT`. Vite emitted `ERR_LOAD_URL`,
which Vitest reported as `ERR_MODULE_NOT_FOUND`. The real `index.js` file existed.
This establishes an alias error; the earlier temporary-directory, Bun and path-length
hypotheses were not established causes.

The alias now matches only relative source imports:

```ts
{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }
```

Relative `.js` imports still resolve to TypeScript source; absolute and virtual
dependency paths retain their real filenames. A new integration test loads actual
Hono, the workspace KV fixture and `api-response.js` (implemented in TypeScript),
then checks the resulting HTTP status and response body.

Temporary loader instrumentation was confined to the local installed tool, written
atomically to avoid changing shared hardlinks, and restored byte-for-byte before
the final gates. Restored SHA-256:
`5d40302b2d86ff8f3501df6503a69908dce2c2eab4ce03c154cd8745c0bec5f2`.
Private diagnostic logs remain outside Git.

## Controlled proof and review

- Fresh original auth-file baseline and the new test before the fix both fail during
  module collection.
- With the fix, loader/auth/index suites pass **104/104 tests across three files**,
  twice after restoration.
- Reverting only the alias makes that same three-file command fail collection in
  **all three files**. The corrected config then restores byte-for-byte.
- A standalone new-test reversal passed after an earlier run. Detection depends on
  the loading workload; the matched three-file reversal supplies the causal control.
  The singleton result does not establish an optimizer-cache cause.
- Independent Sol verification confirms the alias boundary and compatibility. No
  timeout, coverage threshold, test exclusion, environment override or assertion is
  weakened. The technical changelog folds this tooling fix into pending 2.8.1.

## Full gate record

| Command | Result |
|---|---|
| `pnpm turbo run test --filter=xivdyetools-presets-api` | PASS: 1,397 tests /58 files; 6 tasks, 5 cached. |
| `pnpm turbo run build type-check lint` | PASS: 45/45 tasks, 40 cached. |
| `pnpm turbo run test --force --concurrency=1` | PASS: 25/25 tasks, 0 cached; **17,410/17,410 tests across 603 files in all 17 workspaces**, exit 0 in 4m7s. |
| `pnpm turbo run test --force --concurrency=2` | FAIL: 21 successful of 25 tasks, none cached. The first moderation environment-gate case timed out at five seconds; 845 other moderation tests passed. Turbo canceled other unfinished suites, so this was not a repository pass. |

The timed-out moderation case resets modules and imports the complete app inside
the test before sending its request. The first case exceeded five seconds; the
next took 1,711 ms and the later cases 60–97 ms. Cold initialization and resource
contention are plausible, but those observations do not locate the elapsed time.
Tests, fresh-module isolation and timeouts are retained. The fresh serialized graph
passes all 846 moderation tests and every other workspace. Serializing workspace
tasks bounds resource pressure; it does not change Vitest workers or test selection.
No aggregate skipped/todo count was emitted.

Configured coverage also passes: OAuth **95.35/93.99/94.28/96.04**, web
**88.06/78.81/85.64/89.46**, bot-logic **99.58/96.71/100/99.76**, Discord
**93.62/85.98/94.20/94.41** (statements/branches/functions/lines). Other workspace
`test` scripts do not emit aggregate coverage in this command.

The Windows whole-graph gate is resolved. The successful run uses the default
process environment, with no TEMP/TMP/NODE_OPTIONS overrides and no reduced
assertions, coverage thresholds, exclusions, budgets or timeouts.

Repository checks also pass: **167/167 script tests**, script type-checking,
reachability (**642 production /639 test files**), **34** version claims,
**1,063 links across 259 living documents**, and disabled logging in all **seven**
worker configurations. The 14 finding bodies before their Status sections are
unchanged; only their preparation/release-gate status is synchronized.

The earlier failed SVG and loader attempts remain in the
[A-WEB verification history](remediation-web-security-2026-10-28.md).
This work does not waive package publication, migrations, provider/consumer ordering,
separate activation or production acceptance. All 14 A-WEB security findings remain
OPEN pending production acceptance; nonsecurity A-WEB work stays deferred.
