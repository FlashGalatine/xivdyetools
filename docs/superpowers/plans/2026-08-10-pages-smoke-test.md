# Pages Smoke Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tested script, shared by both web-app deploy workflows, that proves the build CI just produced is live at the public URL with the robots policy its environment requires.

**Architecture:** `apps/web-app/scripts/smoke-test-pages.js` runs three phases — reachability against the immutable `deployment-url` from `wrangler-action`, then polling the custom domain until its `index.html` sha256 matches the alias's, then asserting `x-robots-tag` on that matched response. The middle phase is what makes the third trustworthy; without it the robots assertion could describe the previous deployment. Both workflows call the same script, differing only in `--domain` and `--expect-robots`.

**Tech Stack:** Node 22 ESM (`"type": "module"`), global `fetch`, `node:crypto` for sha256, Vitest 4 with `globals: true`, pnpm 11 workspace, GitHub Actions + `cloudflare/wrangler-action@v4`.

**Spec:** `docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md`

## Global Constraints

- Node `>=22.13.0`; pnpm `11.17.0`. All commands run from the monorepo root unless stated.
- `apps/web-app` is `"type": "module"` — every new `.js` file uses ESM `import`/`export`, never `require`.
- `wrangler` version for web-app is exactly `^4.120.0`, matching all 7 worker apps verbatim.
- Phase budgets: reachability 6 attempts, convergence 36 attempts, both at 5000 ms delay (= ~30 s and ~180 s).
- `--expect-robots` accepts only the literal strings `noindex` and `none`.
- Failure messages must distinguish "the domain never answered" from "the domain serves stale bytes". These must never share wording — a 522 reported as "serves a different build" is the misdirection this work exists to remove.
- `vitest.config.ts` sets `environment: 'jsdom'` and a `setupFiles` entry under `src/`. Do **not** add a `// @vitest-environment node` directive: `setupFiles` runs regardless of environment and the existing setup file expects a DOM. Instead, avoid globals jsdom may not provide — test fakes supply a plain `{ get() }` object for response headers rather than constructing `Headers`.
- Existing conventions to match (see `scripts/check-beta-build.js`): a `failures[]` accumulator, a bulleted list on failure, `process.exit(1)`, and one summary line on success.
- Commit messages: conventional-commit prefix, and end with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `apps/web-app/scripts/smoke-test-pages.js` (create) | Arg parsing, the three phases, and a guarded CLI entry point. Exports `parseArgs` and `smokeTestPages` for tests. |
| `apps/web-app/scripts/smoke-test-pages.test.js` (create) | Unit tests driving the module with an injected fetch and a no-op sleep. |
| `apps/web-app/vitest.config.ts` (modify, line 86) | Widen `include` so `scripts/**` tests run. |
| `apps/web-app/package.json` (modify, devDependencies) | Declare `wrangler`. |
| `pnpm-lock.yaml` (modify) | Regenerated. |
| `.github/workflows/deploy-web-app-beta.yml` (modify, lines 90–128) | Replace two smoke steps with one script call. |
| `.github/workflows/deploy-web-app.yml` (modify, lines 49–65) | Add `id: deploy`; replace the smoke step with the inverse script call. |
| `apps/web-app/scripts/README.md` (modify) | Document the script. |
| `apps/web-app/CLAUDE.md` (modify, line 248) | Note where the end-to-end robots assertion lives and why not on the alias. |

---

### Task 1: Declare `wrangler` as a web-app devDependency

Independent of everything else, and independently verifiable from a deploy log.

**Files:**
- Modify: `apps/web-app/package.json` (devDependencies)
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. `wrangler-action` picks this up implicitly at deploy time.

- [ ] **Step 1: Confirm the current state — wrangler is absent from web-app and present in all 7 workers**

```bash
cd /c/dev/XIVProjects/xivdyetools
python -c "
import json, glob
for p in sorted(glob.glob('package.json') + glob.glob('apps/*/package.json')):
    d = json.load(open(p, encoding='utf-8'))
    dd = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
    print(f'{p:45s} wrangler {dd.get(\"wrangler\", \"ABSENT\")}')
"
```

Expected: `apps/web-app/package.json` shows `ABSENT`; the 7 workers show `^4.120.0`.

- [ ] **Step 2: Add the devDependency**

`devDependencies` in `apps/web-app/package.json` is alphabetically ordered, so `wrangler` goes last, after `vitest`. Edit the `"vitest"` line to add the new entry after it:

```json
    "vitest": "^4.1.10",
    "wrangler": "^4.120.0"
```

Note that `"vitest"` was previously the last entry and therefore had no trailing comma; it needs one now.

- [ ] **Step 3: Regenerate the lockfile**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm install --lockfile-only
```

Expected: succeeds without downloading a new wrangler version — `^4.120.0` is already resolved for the 7 workers, so this only adds an importer entry. If pnpm reports fetching a *new* wrangler version, stop: `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` means a fresh release may be blocked, and the version must stay pinned to what the workers use.

- [ ] **Step 4: Verify the lockfile change is confined to the web-app importer**

```bash
cd /c/dev/XIVProjects/xivdyetools
git diff --stat pnpm-lock.yaml
git diff pnpm-lock.yaml | grep -E "^[+-]" | grep -v "^[+-][+-]" | head -20
```

Expected: a small diff adding `wrangler` under the `apps/web-app` importer. No changes to other importers, and no new package entries in the packages section.

- [ ] **Step 5: Verify `--frozen-lockfile` still passes**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm install --frozen-lockfile
```

Expected: succeeds. This is exactly what CI runs; if it fails here, CI fails.

- [ ] **Step 6: Verify wrangler resolves from the web-app directory**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec wrangler --version
```

Expected: prints `4.120.x`. This is the exact command `wrangler-action` runs to decide whether to install wrangler itself; it previously failed with `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "wrangler" not found`.

- [ ] **Step 7: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add apps/web-app/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
build(web-app): declare wrangler so deploys stop dirtying the tree

web-app was the only app of eight not declaring wrangler, because it is a
Vite/Pages app that never needed it locally. wrangler-action therefore ran
`pnpm add wrangler@4` on every deploy: ~9s, and it mutated package.json and
pnpm-lock.yaml mid-run. Wrangler then warned about uncommitted changes and
declined to attach commit metadata, which is why every web-app deployment in
this repo's history is unattributed in the Cloudflare dashboard.

^4.120.0 matches all 7 workers verbatim and is already resolved in the
lockfile, so this adds an importer entry and downloads nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Post-merge verification** (cannot be done locally): the next web-app deploy log should show the `🔍 Checking for existing Wrangler installation` group followed directly by `🚀 Running Wrangler Commands`, with no `📥 Installing Wrangler` group and no `Your working directory is a git repo and has uncommitted changes` warning. Compare against `deploy-og-worker`, which already behaves this way.

---

### Task 2: `parseArgs` — validate inputs, refuse an empty deployment URL

**Files:**
- Create: `apps/web-app/scripts/smoke-test-pages.js`
- Create: `apps/web-app/scripts/smoke-test-pages.test.js`
- Modify: `apps/web-app/vitest.config.ts:86`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ROBOTS_MODES: string[]` — the literal `['noindex', 'none']`.
  - `parseArgs(argv: string[]) => { deploymentUrl: string, domain: string, expectRobots: string }` — throws `Error` on any usage problem. `argv` is the arguments *after* the script path, i.e. `process.argv.slice(2)`.

- [ ] **Step 1: Widen the vitest include so `scripts/` tests are discovered**

In `apps/web-app/vitest.config.ts`, line 86 currently reads:

```typescript
    include: ['src/**/*.{test,spec}.ts'],
```

Replace it with:

```typescript
    // scripts/ holds the CI gates (check-bundle-size, check-beta-build,
    // smoke-test-pages). They are plain .js ESM, not .ts, so they need their own
    // pattern rather than an extension widened on the src glob.
    include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.js'],
```

- [ ] **Step 2: Write the failing test**

Create `apps/web-app/scripts/smoke-test-pages.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { parseArgs, ROBOTS_MODES } from './smoke-test-pages.js';

const ok = ['--deployment-url', 'https://abc.example.pages.dev', '--domain', 'https://site.test', '--expect-robots', 'noindex'];

describe('parseArgs', () => {
  it('accepts the three flags in space-separated form', () => {
    expect(parseArgs(ok)).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'noindex',
    });
  });

  it('accepts --flag=value form', () => {
    expect(
      parseArgs([
        '--deployment-url=https://abc.example.pages.dev',
        '--domain=https://site.test',
        '--expect-robots=none',
      ])
    ).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'none',
    });
  });

  it('rejects a missing --deployment-url by naming wrangler-action as the cause', () => {
    // The realistic failure: wrangler-action's output is empty, so the workflow
    // interpolates nothing. Blaming the site here would send the operator to the
    // wrong system.
    expect(() => parseArgs(['--domain', 'https://site.test', '--expect-robots', 'noindex'])).toThrow(
      /deployment-url.*wrangler-action/is
    );
  });

  it('rejects an empty --deployment-url the same way', () => {
    expect(() =>
      parseArgs(['--deployment-url=', '--domain', 'https://site.test', '--expect-robots', 'noindex'])
    ).toThrow(/deployment-url.*wrangler-action/is);
  });

  it('rejects a missing --domain', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://abc.example.pages.dev', '--expect-robots', 'noindex'])
    ).toThrow(/--domain/);
  });

  it('rejects an unrecognised --expect-robots value', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://a.test', '--domain', 'https://b.test', '--expect-robots', 'maybe'])
    ).toThrow(/--expect-robots.*noindex\|none.*maybe/s);
  });

  it('rejects a flag given no value', () => {
    expect(() => parseArgs(['--deployment-url', '--domain', 'https://b.test'])).toThrow(/needs a value/);
  });

  it('rejects a bare positional argument', () => {
    expect(() => parseArgs([...ok, 'stray'])).toThrow(/unexpected argument: stray/);
  });

  it('exposes exactly the two supported robots modes', () => {
    expect(ROBOTS_MODES).toEqual(['noindex', 'none']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec vitest run scripts/smoke-test-pages.test.js
```

Expected: FAIL — the module does not exist yet, so vitest reports a resolution error for `./smoke-test-pages.js`. If instead it reports "No test files found", the Step 1 config change did not take effect.

- [ ] **Step 4: Write the minimal implementation**

Create `apps/web-app/scripts/smoke-test-pages.js`:

```javascript
/**
 * Smoke-test a Cloudflare Pages deployment end to end.
 *
 * Runs after `pages deploy` in both web-app workflows. Three phases, each
 * guarding a failure mode the others cannot see:
 *
 *   1. The deployment alias returns 2xx           -> this build serves at all
 *   2. The custom domain serves the same bytes    -> the domain is on THIS build
 *   3. x-robots-tag matches the environment       -> beta hidden, production not
 *
 * Phase 2 exists to make phase 3 trustworthy. A Pages custom domain is a mutable
 * alias that keeps serving the PREVIOUS deployment until propagation finishes, so
 * without it phase 3 could describe the build before this one.
 *
 * Phase 3 cannot be asserted on the alias: Cloudflare injects
 * `x-robots-tag: noindex` onto every *.pages.dev hostname itself, so the header is
 * only build-determined on the custom domain. See
 * docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
 *
 * Usage:
 *   node scripts/smoke-test-pages.js \
 *     --deployment-url <url> --domain <url> --expect-robots noindex|none
 */

export const ROBOTS_MODES = ['noindex', 'none'];

export function parseArgs(argv) {
  const values = new Map();

  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z][a-z-]*)(?:=([\s\S]*))?$/.exec(argv[i]);
    if (!match) throw new Error(`unexpected argument: ${argv[i]}`);

    const [, name, inline] = match;
    if (inline !== undefined) {
      values.set(name, inline);
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`--${name} needs a value`);
    values.set(name, next);
    i++;
  }

  const deploymentUrl = values.get('deployment-url') ?? '';
  const domain = values.get('domain') ?? '';
  const expectRobots = values.get('expect-robots') ?? '';

  // Deliberately the first and loudest check. An empty value here means
  // wrangler-action produced no deployment URL, which would otherwise reduce this
  // whole gate to a silent no-op.
  if (!deploymentUrl) {
    throw new Error(
      '--deployment-url is empty or missing: wrangler-action produced no deployment URL, so there is nothing to smoke test'
    );
  }
  if (!domain) throw new Error('--domain is required');
  if (!ROBOTS_MODES.includes(expectRobots)) {
    throw new Error(`--expect-robots must be ${ROBOTS_MODES.join('|')}, got "${expectRobots}"`);
  }

  return { deploymentUrl, domain, expectRobots };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec vitest run scripts/smoke-test-pages.test.js
```

Expected: PASS, 9 tests.

- [ ] **Step 6: Verify the widened include did not break the existing suite**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm turbo run test --filter=xivdyetools-web-app
```

Expected: PASS. The baseline is 81 test files (from run `31360179537`), so expect 82 now.

- [ ] **Step 7: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add apps/web-app/scripts/smoke-test-pages.js apps/web-app/scripts/smoke-test-pages.test.js apps/web-app/vitest.config.ts
git commit -m "$(cat <<'EOF'
test(web-app): arg parsing for the Pages smoke test

An empty --deployment-url is the first and loudest failure: it means
wrangler-action produced no deployment URL, which would otherwise turn the whole
gate into a silent no-op that passes forever.

Widens the vitest include to scripts/**/*.test.js. The CI gates in that directory
(check-bundle-size, check-beta-build) have never had tests; this makes covering
them possible later.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The three phases

**Files:**
- Modify: `apps/web-app/scripts/smoke-test-pages.js` (append)
- Modify: `apps/web-app/scripts/smoke-test-pages.test.js` (append)

**Interfaces:**
- Consumes: `parseArgs`, `ROBOTS_MODES` from Task 2.
- Produces:
  - `smokeTestPages(options) => Promise<{ ok: boolean, failures: string[], summary: string }>`
    where `options` is `{ deploymentUrl, domain, expectRobots, fetchImpl?, sleep? }`.
    `fetchImpl` defaults to global `fetch`; `sleep` defaults to a real timer. Tests
    always inject both. The function never throws for a smoke-test failure — it
    reports through `failures` — so the CLI wrapper owns the exit code.

- [ ] **Step 1: Write the failing tests**

First extend the **existing** import at the top of `apps/web-app/scripts/smoke-test-pages.test.js` — do not add a second `import` from the same module:

```javascript
import { parseArgs, ROBOTS_MODES, smokeTestPages } from './smoke-test-pages.js';
```

Then append to the same file:

```javascript
const BODY = '<!doctype html><title>XIV Dye Tools</title>';
const OTHER = '<!doctype html><title>an older build</title>';

const ALIAS = 'https://abc.example.pages.dev';
const SITE = 'https://site.test';

/** A response double. `headers` is a plain object with get() rather than a real
 *  Headers instance, because these tests run under the jsdom environment the
 *  web-app vitest config sets and we do not rely on jsdom exposing Headers. */
function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

/** Queues responses per host. The final entry repeats once exhausted, so a test
 *  can describe "fails twice then succeeds" without listing 36 entries. */
function fakeFetch(byHost) {
  const queues = new Map(Object.entries(byHost).map(([host, list]) => [host, [...list]]));
  const calls = [];
  const impl = async (url) => {
    const { host } = new URL(url);
    calls.push(url);
    const queue = queues.get(host);
    if (!queue) throw new Error(`test fetch: no responses queued for host ${host}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  };
  impl.calls = calls;
  return impl;
}

const run = (overrides) =>
  smokeTestPages({
    deploymentUrl: ALIAS,
    domain: SITE,
    expectRobots: 'noindex',
    sleep: async () => {},
    ...overrides,
  });

describe('smokeTestPages', () => {
  it('passes when the domain serves this build and carries noindex', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex, nofollow' })],
      }),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary).toContain(SITE);
  });

  it('passes for production when the domain serves this build with no robots header', async () => {
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when the alias never returns 2xx, and blames the deployment not the domain', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(500, 'nope')],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain(ALIAS);
    expect(result.failures[0]).toMatch(/500/);
    // The domain must not be mentioned: it was never the problem.
    expect(result.failures[0]).not.toContain(SITE);
  });

  it('retries the alias and succeeds on a later attempt', async () => {
    const fetchImpl = fakeFetch({
      'abc.example.pages.dev': [response(522, ''), response(522, ''), response(200, BODY)],
      'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
    });
    const result = await run({ fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl.calls.filter((u) => u.includes('pages.dev'))).toHaveLength(3);
  });

  it('surfaces a transport error against the alias rather than crashing', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [new Error('getaddrinfo ENOTFOUND')],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/ENOTFOUND/);
  });

  it('fails distinctly when the domain never answers at all', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(522, '')],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/never returned 2xx/);
    expect(result.failures[0]).toMatch(/522/);
    // Must say the build is fine, so nobody debugs the deployment.
    expect(result.failures[0]).toContain(ALIAS);
    expect(result.failures[0]).not.toMatch(/different build/);
  });

  it('fails distinctly when the domain answers but serves a different build', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, OTHER, { 'x-robots-tag': 'noindex' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/different build/);
    expect(result.failures[0]).toMatch(/180s/);
    expect(result.failures[0]).not.toMatch(/never returned 2xx/);
  });

  it('waits for the domain to converge instead of failing on the first mismatch', async () => {
    const fetchImpl = fakeFetch({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [
        response(200, OTHER),
        response(200, OTHER),
        response(200, BODY, { 'x-robots-tag': 'noindex' }),
      ],
    });
    const result = await run({ fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl.calls.filter((u) => u.includes('site.test'))).toHaveLength(3);
  });

  it('fails when a beta domain is missing noindex', async () => {
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY)],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/without X-Robots-Tag: noindex/);
  });

  it('fails when a production domain carries noindex, naming the likely cause', async () => {
    const result = await run({
      expectRobots: 'none',
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex, nofollow' })],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/beta build/i);
  });

  it('does not mistake a header that merely contains the substring for noindex', async () => {
    // 'noindexing' must not satisfy the beta assertion.
    const result = await run({
      fetchImpl: fakeFetch({
        'abc.example.pages.dev': [response(200, BODY)],
        'site.test': [response(200, BODY, { 'x-robots-tag': 'noindexing' })],
      }),
    });
    expect(result.ok).toBe(false);
  });

  it('sends the CI user agent and asks the edge not to serve a cached answer', async () => {
    const seen = [];
    const base = fakeFetch({
      'abc.example.pages.dev': [response(200, BODY)],
      'site.test': [response(200, BODY, { 'x-robots-tag': 'noindex' })],
    });
    await run({
      fetchImpl: async (url, init) => {
        seen.push(init);
        return base(url, init);
      },
    });
    expect(seen).not.toHaveLength(0);
    for (const init of seen) {
      expect(init.headers['User-Agent']).toBe('xivdyetools-ci');
      expect(init.headers['Cache-Control']).toBe('no-cache');
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec vitest run scripts/smoke-test-pages.test.js
```

Expected: the 9 `parseArgs` tests still PASS; the 12 new `smokeTestPages` tests FAIL because `smokeTestPages` is not exported.

- [ ] **Step 3: Write the implementation**

Two placements matter here. Add the imports at the **top** of `apps/web-app/scripts/smoke-test-pages.js`, directly under the file's docblock and above `export const ROBOTS_MODES` — ESM hoists imports so appending them at the bottom would work, but it reads as a mistake and buries the module's dependencies:

```javascript
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
```

`pathToFileURL` is unused until Step 5; adding both now avoids touching the import block twice. Then append the rest below `parseArgs`:

```javascript
// Phase 1: the deployment alias is live the moment `wrangler pages deploy`
// returns, so this budget only absorbs edge warm-up.
const REACH_ATTEMPTS = 6;
// Phase 2: the custom domain has to pick up the new production deployment.
// Normally seconds; budgeted generously so ordinary alias lag never fails a
// deploy that actually worked.
const CONVERGE_ATTEMPTS = 36;
const DELAY_MS = 5000;

const REQUEST_INIT = {
  headers: {
    'User-Agent': 'xivdyetools-ci',
    // Phase 2 asks "has the alias moved yet?" — a cached answer is precisely the
    // wrong one, so ask the edge to revalidate.
    'Cache-Control': 'no-cache',
  },
  redirect: 'follow',
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** One GET, never throwing. `detail` is always a human-readable cause. */
async function attempt(fetchImpl, url) {
  try {
    const res = await fetchImpl(url, REQUEST_INIT);
    const body = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, detail: `HTTP ${res.status}`, body, headers: res.headers };
  } catch (error) {
    return { ok: false, detail: `request failed: ${error.message}`, body: null, headers: null };
  }
}

export async function smokeTestPages({
  deploymentUrl,
  domain,
  expectRobots,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const alias = new URL('/', deploymentUrl).toString();
  const site = new URL('/', domain).toString();
  const fail = (message) => ({ ok: false, failures: [message], summary: '' });

  // ---- Phase 1: the build we just uploaded serves at all -------------------
  let aliasBody = null;
  let aliasDetail = 'no attempt made';
  for (let i = 1; i <= REACH_ATTEMPTS; i++) {
    const result = await attempt(fetchImpl, alias);
    aliasDetail = result.detail;
    if (result.ok) {
      aliasBody = result.body;
      break;
    }
    if (i < REACH_ATTEMPTS) await sleep(DELAY_MS);
  }
  if (aliasBody === null) {
    // Deliberately does not mention the custom domain: the deployment itself
    // never served, so the domain is not the story.
    return fail(
      `deployment ${alias} never returned 2xx after ${REACH_ATTEMPTS} attempts (last: ${aliasDetail}); the upload succeeded but the deployment is not serving`
    );
  }
  const want = sha256(aliasBody);

  // ---- Phase 2: the custom domain has caught up to THIS build --------------
  let domainHeaders = null;
  let domainEverAnswered = false;
  let domainDetail = 'no attempt made';
  for (let i = 1; i <= CONVERGE_ATTEMPTS; i++) {
    const result = await attempt(fetchImpl, site);
    domainDetail = result.detail;
    if (result.ok) {
      domainEverAnswered = true;
      if (sha256(result.body) === want) {
        domainHeaders = result.headers;
        break;
      }
    }
    if (i < CONVERGE_ATTEMPTS) await sleep(DELAY_MS);
  }
  if (domainHeaders === null) {
    // Two different problems, two different sentences. A 522 reported as "serves
    // a different build" would send the operator to the wrong system.
    return domainEverAnswered
      ? fail(
          `${site} answered but still serves a different build than ${alias} after ${(CONVERGE_ATTEMPTS * DELAY_MS) / 1000}s; the deploy succeeded and the Pages alias has not picked it up`
        )
      : fail(
          `${site} never returned 2xx (last: ${domainDetail}); the deployment is live at ${alias}, so this is the domain, not the build`
        );
  }

  // ---- Phase 3: robots policy, on the only host where it is ours -----------
  const robots = domainHeaders.get('x-robots-tag');
  const hasNoindex = /\bnoindex\b/i.test(robots ?? '');
  const failures = [];

  if (expectRobots === 'noindex' && !hasNoindex) {
    failures.push(
      `${site} is served without X-Robots-Tag: noindex (got: ${robots ?? '<absent>'}); a beta build must not be indexable`
    );
  }
  if (expectRobots === 'none' && hasNoindex) {
    failures.push(
      `${site} is served WITH X-Robots-Tag: ${robots}; production must stay indexable — did a beta build reach production?`
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: `${site} serves this deployment (sha256 ${want.slice(0, 12)}), robots as expected for --expect-robots ${expectRobots}.`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec vitest run scripts/smoke-test-pages.test.js
```

Expected: PASS, 21 tests.

- [ ] **Step 5: Add the CLI entry point**

Append to the end of `apps/web-app/scripts/smoke-test-pages.js`. The `pathToFileURL` import was already added in Step 3, so this adds no imports:

```javascript
// Guarded so importing this module from tests does not run the CLI. Under vitest
// process.argv[1] is the vitest binary, so this is false.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::smoke-test-pages: ${error.message}`);
    process.exit(1);
  }

  console.log(`Smoke testing ${options.deploymentUrl} then ${options.domain}`);
  const { ok, failures, summary } = await smokeTestPages(options);

  if (!ok) {
    console.error('Pages smoke test FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(`::error::${failures[0]}`);
    process.exit(1);
  }
  console.log(summary);
}
```

Note: top-level `await` requires ESM, which this package already is.

- [ ] **Step 6: Verify the CLI works against the real live deployments**

These are the exact URLs the findings in the spec were established from. Beta must pass; production run with `--expect-robots none` must pass; and production run with the *wrong* mode must fail, which proves the assertion is not vacuous.

```bash
cd /c/dev/XIVProjects/xivdyetools/apps/web-app

echo '--- beta, expect noindex: must PASS ---'
node scripts/smoke-test-pages.js \
  --deployment-url https://ecc7fb76.xivdyetools-beta.pages.dev \
  --domain https://beta.xivdyetools.app \
  --expect-robots noindex; echo "exit=$?"

echo '--- production, expect none: must PASS ---'
node scripts/smoke-test-pages.js \
  --deployment-url https://66496174.xiv-colorexplorer.pages.dev \
  --domain https://xivdyetools.app \
  --expect-robots none; echo "exit=$?"

echo '--- production, expect noindex: must FAIL (proves the check bites) ---'
node scripts/smoke-test-pages.js \
  --deployment-url https://66496174.xiv-colorexplorer.pages.dev \
  --domain https://xivdyetools.app \
  --expect-robots noindex; echo "exit=$? (1 is correct here)"

echo '--- empty deployment url: must FAIL fast ---'
node scripts/smoke-test-pages.js \
  --deployment-url= --domain https://xivdyetools.app --expect-robots none; echo "exit=$? (1 is correct here)"
```

Expected: exit 0, exit 0, exit 1, exit 1. If either PASS case fails on convergence, the live deployments have moved on since this plan was written — fetch the current alias from `gh run list --workflow=deploy-web-app.yml --limit 1` and its log, then retry.

- [ ] **Step 7: Run the full web-app suite and type-check**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm turbo run test type-check --filter=xivdyetools-web-app
```

Expected: PASS. `type-check` is `tsc --noEmit` over `src/`, so the new `.js` script is outside its scope; this step is confirming nothing regressed.

- [ ] **Step 8: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add apps/web-app/scripts/smoke-test-pages.js apps/web-app/scripts/smoke-test-pages.test.js
git commit -m "$(cat <<'EOF'
feat(web-app): smoke-test script that proves the domain serves THIS build

Three phases: the deployment alias returns 2xx, the custom domain converges to
the same index.html sha256, then x-robots-tag is asserted on that matched
response. Phase 2 is what makes phase 3 mean anything -- a Pages custom domain
keeps serving the previous deployment until propagation finishes, so without it
the robots assertion could describe the build before this one.

Phase 3 deliberately runs on the custom domain only. Cloudflare injects
`x-robots-tag: noindex` onto every *.pages.dev hostname, so on the alias the
assertion is a tautology.

The two phase-2 failures get separate wording on purpose. A domain that never
answered is a different problem from one serving stale bytes, and reporting a 522
as "serves a different build" is the class of misdirection this script exists to
remove -- the same class as the old `curl -sI | grep` reporting a dropped packet
as a missing noindex header.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the beta workflow

**Files:**
- Modify: `.github/workflows/deploy-web-app-beta.yml:90-128`

**Interfaces:**
- Consumes: `scripts/smoke-test-pages.js` CLI from Task 3; `steps.deploy.outputs.deployment-url` (the deploy step already carries `id: deploy` from commit `c1af09c`).
- Produces: nothing.

- [ ] **Step 1: Replace both smoke steps with one script call**

Delete everything from the `# ARCH-002: Verify the deployment responds.` comment through the end of the file (the `Smoke test the deployment` and `Smoke test the custom domain` steps), and replace with:

```yaml
      # ARCH-002: Verify the deployment we just made is live on the public URL as
      # a beta build. See docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
      # for why the robots assertion cannot live on the *.pages.dev alias, and why
      # a check against beta.xivdyetools.app alone can pass against the old build.
      - name: Smoke test
        run: >
          pnpm --filter xivdyetools-web-app exec node scripts/smoke-test-pages.js
          --deployment-url "${{ steps.deploy.outputs.deployment-url }}"
          --domain https://beta.xivdyetools.app
          --expect-robots noindex
```

The `>` folded scalar joins the continuation lines with spaces into one command. Do not use `|`, which would keep the newlines and break the command.

- [ ] **Step 2: Verify the YAML parses and the deploy step still has its id**

```bash
cd /c/dev/XIVProjects/xivdyetools
python -c "
import yaml
d = yaml.safe_load(open('.github/workflows/deploy-web-app-beta.yml', encoding='utf-8'))
steps = d['jobs']['deploy']['steps']
print('steps:', len(steps))
for s in steps[-2:]:
    print(' -', s.get('name') or s.get('uses'), '| id=' + s['id'] if 'id' in s else '')
print()
print('smoke command:', steps[-1]['run'].strip())
"
```

Expected: 12 steps; the deploy step shows `id=deploy`; the smoke command prints as a single line containing `--expect-robots noindex`.

- [ ] **Step 3: Verify the exact command runs locally**

Run the command from Step 2's output verbatim, substituting a real alias for the Actions expression:

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec node scripts/smoke-test-pages.js \
  --deployment-url "https://ecc7fb76.xivdyetools-beta.pages.dev" \
  --domain https://beta.xivdyetools.app \
  --expect-robots noindex
```

Expected: exit 0 with the summary line. This confirms `pnpm --filter … exec node` resolves the script path relative to the web-app directory, the same way the existing `check-bundle-size.js` step does.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add .github/workflows/deploy-web-app-beta.yml
git commit -m "$(cat <<'EOF'
ci(web-app): use the shared smoke test on the beta workflow

Replaces the two curl steps with scripts/smoke-test-pages.js, which restores the
end-to-end noindex assertion c1af09c had to drop. It now runs on
beta.xivdyetools.app, the only host where the header is ours rather than
Cloudflare's, after proving the domain has converged on this deployment.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Verify in CI**

Push the branch. The `Deploy Beta Web App` run must go green, and the `Smoke test` step's log must show the `Smoke testing …` line followed by the summary naming `https://beta.xivdyetools.app/`. Do not proceed to Task 5 until this has passed at least once — Task 5 applies the inverted assertion to production, and a mistake there fails every production deploy.

---

### Task 5: Wire the production workflow

**Gated on Task 4 Step 5** — do not start until the beta workflow's smoke test has passed in CI at least once. Production carries the inverted assertion, so a mistake here fails every production deploy.

**Files:**
- Modify: `.github/workflows/deploy-web-app.yml:49-65`

**Interfaces:**
- Consumes: `scripts/smoke-test-pages.js` CLI from Task 3.
- Produces: nothing.

- [ ] **Step 1: Add `id: deploy` to the production deploy step**

In `.github/workflows/deploy-web-app.yml`, the deploy step at line 49 currently reads:

```yaml
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v4
```

Insert the id line between them:

```yaml
      - name: Deploy to Cloudflare Pages
        id: deploy
        uses: cloudflare/wrangler-action@v4
```

- [ ] **Step 2: Replace the smoke step**

Delete the `# ARCH-002: Verify deployed site responds after deployment` comment and the whole `Smoke test` step beneath it (lines 58–65). That step's `run:` block opens with a bare `sleep 5`; it goes with the step and must **not** be carried over — the script polls, so a fixed pre-wait only delays the first attempt. (The beta workflow's equivalent `sleep 5` was already removed in `c1af09c`.) Replace with:

```yaml
      # ARCH-002: Verify the deployment we just made is live on the public URL and
      # is NOT a beta build. `--expect-robots none` is the guard against a beta
      # build reaching production and deindexing the live site; nothing else in CI
      # catches that. See docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
      #
      # Note the deployment URL will be a *.xiv-colorexplorer.pages.dev host, not
      # xivdyetools.pages.dev: Cloudflare assigns a Pages project's subdomain at
      # creation and does not change it when the project is renamed. Reading it from
      # the action output avoids having to know that.
      - name: Smoke test
        run: >
          pnpm --filter xivdyetools-web-app exec node scripts/smoke-test-pages.js
          --deployment-url "${{ steps.deploy.outputs.deployment-url }}"
          --domain https://xivdyetools.app
          --expect-robots none
```

- [ ] **Step 3: Verify the YAML parses and both changes landed**

```bash
cd /c/dev/XIVProjects/xivdyetools
python -c "
import yaml
d = yaml.safe_load(open('.github/workflows/deploy-web-app.yml', encoding='utf-8'))
steps = d['jobs']['deploy']['steps']
ids = [s.get('id') for s in steps if 'id' in s]
print('steps:', len(steps), '| ids:', ids)
print('smoke command:', steps[-1]['run'].strip())
assert 'deploy' in ids, 'deploy step is missing id: deploy'
assert '--expect-robots none' in steps[-1]['run'], 'production must expect none'
print('OK')
"
```

Expected: prints `OK`, `ids: ['deploy']`, and a single-line command containing `--expect-robots none`.

- [ ] **Step 4: Verify the exact production command locally**

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm --filter xivdyetools-web-app exec node scripts/smoke-test-pages.js \
  --deployment-url "https://66496174.xiv-colorexplorer.pages.dev" \
  --domain https://xivdyetools.app \
  --expect-robots none
```

Expected: exit 0. If the live production deployment has moved on since this plan was written, get the current alias from the newest `deploy-web-app.yml` run log (`gh run list --workflow=deploy-web-app.yml --limit 1`, then `gh run view <id> --log | grep 'Deployment complete'`).

- [ ] **Step 5: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add .github/workflows/deploy-web-app.yml
git commit -m "$(cat <<'EOF'
ci(web-app): use the shared smoke test on the production workflow

Closes the drift that let production keep a weaker check than beta: it curled
xivdyetools.app with --retry 3 and no header assertion, so it verified that
something was up, never that this build went live.

Adds the inverse robots guard. `--expect-robots none` fails if production is ever
served with X-Robots-Tag: noindex, which is what a beta build reaching production
looks like -- it would deindex the live site, and nothing else in CI catches it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documentation

**Files:**
- Modify: `apps/web-app/scripts/README.md`
- Modify: `apps/web-app/CLAUDE.md:248`

**Interfaces:**
- Consumes: the finished script from Task 3.
- Produces: nothing.

- [ ] **Step 1: Document the script in `scripts/README.md`**

Insert before the `## License` section:

```markdown
---

## Pages Smoke Test

Verifies that the build a deploy just produced is live on the public URL with the
right robots policy. Run by both web-app deploy workflows after `pages deploy`:

```bash
node scripts/smoke-test-pages.js \
  --deployment-url https://<hash>.<project>.pages.dev \
  --domain https://beta.xivdyetools.app \
  --expect-robots noindex     # production uses: --expect-robots none
```

Three phases:

1. The deployment alias returns 2xx (~30 s budget). This is the build just
   uploaded, live the moment `wrangler pages deploy` returns.
2. The custom domain is polled until its `index.html` sha256 matches the alias's
   (~180 s budget). A Pages custom domain keeps serving the *previous* deployment
   until propagation finishes, so this is what makes phase 3 describe the right
   build.
3. `x-robots-tag` on that matched response must contain `noindex` for beta, and
   must not for production.

**Phase 3 only works on the custom domain.** Cloudflare injects
`x-robots-tag: noindex` onto every `*.pages.dev` hostname itself, so asserting it
on the deployment alias passes whether or not the build set it. See
`docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md`.

Unit tests: `scripts/smoke-test-pages.test.js` (`npm run test`).
```

- [ ] **Step 2: Update the beta bullet in `apps/web-app/CLAUDE.md`**

Line 248 ends with `See docs/operations/DEPLOY_ENVIRONMENTS.md.` Append to that bullet:

```markdown
 The end-to-end counterpart is `scripts/smoke-test-pages.js`, which asserts the header on `beta.xivdyetools.app` after deploy — **not** on the `*.pages.dev` deployment alias, because Cloudflare injects `x-robots-tag: noindex` onto those hostnames itself and an assertion there passes even when the plugin never ran.
```

- [ ] **Step 3: Verify the links and paths referenced actually exist**

```bash
cd /c/dev/XIVProjects/xivdyetools
ls docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md
ls apps/web-app/scripts/smoke-test-pages.js apps/web-app/scripts/smoke-test-pages.test.js
grep -c "smoke-test-pages" apps/web-app/scripts/README.md apps/web-app/CLAUDE.md
```

Expected: both files listed, and a non-zero count for each doc.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/XIVProjects/xivdyetools
git add apps/web-app/scripts/README.md apps/web-app/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(web-app): document the Pages smoke test and the pages.dev caveat

The caveat is the part worth writing down: Cloudflare injects
`x-robots-tag: noindex` onto every *.pages.dev hostname, so the obvious place to
assert it is the one place the assertion cannot fail.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Summary

After all six tasks:

```bash
cd /c/dev/XIVProjects/xivdyetools
pnpm install --frozen-lockfile
pnpm turbo run test type-check lint --filter=xivdyetools-web-app
pnpm --filter xivdyetools-web-app exec wrangler --version   # 4.120.x
python -c "
import yaml
for f in ['deploy-web-app.yml', 'deploy-web-app-beta.yml']:
    d = yaml.safe_load(open(f'.github/workflows/{f}', encoding='utf-8'))
    steps = d['jobs']['deploy']['steps']
    assert any(s.get('id') == 'deploy' for s in steps), f
    assert 'smoke-test-pages.js' in steps[-1]['run'], f
    print(f, 'OK')
"
git status --short   # clean
```

Then in CI: both deploy workflows green, and their deploy logs show no `📥 Installing Wrangler` group and no `uncommitted changes` warning.

## Out of Scope

Carried from the spec, not to be done here:

- The web-app JS payload at 91.3% of budget. Passing; separate concern.
- Smoke tests for the eight worker deploy workflows, which have none. Workers have no custom-domain-alias problem and need a different design.
- Tests for `check-bundle-size.js` / `check-beta-build.js`, though Task 2 Step 1 makes them possible.
