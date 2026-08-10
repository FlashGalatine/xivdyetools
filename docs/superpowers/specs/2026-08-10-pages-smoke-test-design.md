# Design — one Pages smoke test for both web-app workflows

**Date:** 2026-08-10
**Status:** approved
**Deploy unit:** `web-app` (both deploy workflows; no runtime code changes)

---

## Problem

Two problems, both surfaced by the beta project's first-ever deploy (run `31360179537`).

**1. The smoke tests assert against the wrong hostname.** Both `deploy-web-app.yml` and
`deploy-web-app-beta.yml` curl the public custom domain after deploying. That domain is a
*mutable alias*: Cloudflare Pages keeps serving the previous deployment there until propagation
finishes. So the check can pass while measuring the build before this one — it verifies
"something is up", never "my build went live". It also went red on a deploy that succeeded: on
the beta project's first deploy the custom domain had no origin yet (a Pages custom domain has
none until the project's first production deployment exists) and returned **522** for the whole
~36s retry budget.

Commit `c1af09c` moved the beta workflow's *reachability* assertion onto the immutable
`deployment-url`, which fixes the false red. It did not close the false green, and it removed the
robots assertion without replacing it, because:

**2. `X-Robots-Tag` cannot be asserted on a `*.pages.dev` URL.** Cloudflare injects
`x-robots-tag: noindex` onto those hostnames itself. Proof: `apps/web-app/public/_headers`
contains no `X-Robots-Tag` (only `vite-plugin-beta-branding.ts` appends one, for beta builds
only), yet the production deployment alias serves `x-robots-tag: noindex`. Observed:

| Hostname | `x-robots-tag` | Source |
|---|---|---|
| `xivdyetools.app` | *absent* | build |
| `66496174.xiv-colorexplorer.pages.dev` | `noindex` | **Cloudflare** |
| `beta.xivdyetools.app` | `noindex, nofollow` | build |
| `xivdyetools-beta.pages.dev` | `noindex, nofollow` | build |

So asserting `noindex` on the beta alias is a tautology — it passes even if the beta-branding
plugin never ran. And the inverse production assertion ("must NOT be noindex") is impossible
there, because Cloudflare's injection would fail it unconditionally.

Consequently the only hostname where the header carries information is the custom domain, which
returns us to problem 1: an assertion there is only meaningful once we know the domain is serving
*this* deployment.

**3. `wrangler` is not a declared dependency of `web-app`.** All 7 worker apps declare
`wrangler: ^4.120.0`; `web-app` does not, because it is a Vite/Pages app that never needed
wrangler locally. So `wrangler-action` installs it at deploy time (`pnpm add wrangler@4`), which
costs ~9s and mutates `package.json` + `pnpm-lock.yaml`. Wrangler then warns
`Your working directory ... has uncommitted changes` and **declines to attach commit metadata to
the deployment**. Every web-app deploy in this repo's history has therefore landed in the
Cloudflare dashboard with no commit attribution — `66496174` cannot be traced to a commit without
cross-referencing Actions logs by timestamp.

## Goal

A pass means: *the build this run produced is live at the public URL, with the robots policy that
environment requires.* One implementation, shared by both workflows, so they cannot drift apart
again — the drift being what let production keep a weaker check than beta.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Where reachability is asserted | `deployment-url` from wrangler-action | Immutable, unambiguously this build, live the instant the deploy returns. Also avoids hardcoding a hostname: production's Pages project is *named* `xivdyetools` but its pages.dev subdomain is `xiv-colorexplorer` (Cloudflare assigns it at creation and does not change it on rename), so `xivdyetools.pages.dev` does not even resolve |
| Where robots is asserted | the custom domain | The only hostname where the header is build-determined |
| Proving the domain is current | sha256 of `index.html` from the alias vs. the domain, polled to equality | Turns the domain check from "something is up" into "this build is up". Verified byte-identical across alias and domain on **both** projects, so no zone feature (Rocket Loader, Email Obfuscation) is rewriting HTML |
| Rejected: discriminate on `nofollow` | no | Cloudflare injects bare `noindex`, the build emits `noindex, nofollow`, so it *would* work today — but it couples CI to Cloudflare's exact injected value and header-merge behaviour, and breaks silently if either changes |
| Implementation home | `apps/web-app/scripts/smoke-test-pages.js` | Matches the precedent of `check-bundle-size.js` and `check-beta-build.js` — the repo's two existing CI gates, in that same directory. Unit-testable, runs on Windows, one implementation for both workflows |
| Rejected: composite action / inline shell | no | A composite action keeps the logic untestable outside CI; inline shell means ~20 duplicated lines differing by one inverted assertion, which is the drift shape being eliminated |
| `wrangler` version for web-app | `^4.120.0` | Verbatim match with all 7 workers. That range is already resolved in the lockfile, so the diff is one importer entry — no new download, so `minimumReleaseAge: 1440` does not apply and `--frozen-lockfile` keeps passing |

## Architecture

```
wrangler-action ──► outputs.deployment-url  (https://<hash>.<subdomain>.pages.dev)
                              │
                              ▼
      node scripts/smoke-test-pages.js --deployment-url … --domain … --expect-robots …
                              │
        ┌─────────────────────┼─────────────────────────────┐
        ▼                     ▼                             ▼
  1. reachable?         2. domain converged?          3. robots correct?
  GET alias, 2xx        poll domain until its         read x-robots-tag from
  ~30s budget           index.html sha256 ==          the matched domain response
                        the alias's, ~180s budget     (beta: has noindex,
                                                       prod: has none)
```

Phase 2 exists to make phase 3 trustworthy. Without it, phase 3 could assert the robots policy of
the *previous* deployment.

## Components

### 1. `apps/web-app/scripts/smoke-test-pages.js` (new)

ESM (the package is `"type": "module"`), following `check-beta-build.js`'s conventions: a
`failures[]` + `check()` accumulator, a bulleted `process.exit(1)`, one-line success summary, and
`::error::` annotations so failures surface on the run summary rather than only in the log.

```
node scripts/smoke-test-pages.js \
  --deployment-url <url> \
  --domain <url> \
  --expect-robots noindex|none
```

Behaviour:

1. **Guard the inputs.** An empty or missing `--deployment-url` is a hard failure, so a future
   `wrangler-action` output rename cannot silently reduce this gate to a no-op. `--expect-robots`
   accepts only `noindex` or `none`; anything else is a usage error.
2. **Phase 1 — reachable.** GET `<deployment-url>/`, retrying on non-2xx and transport errors,
   6 attempts × 5s. Retain the response body.
3. **Phase 2 — converged.** sha256 the phase-1 body. GET `<domain>/` and compare hashes, retrying
   until equal, 36 attempts × 5s (~180s). Retain the matching response's headers. Track the last
   observed domain status separately from the hash comparison: a domain that never returned 2xx is
   a *different* failure from one serving stale bytes, and the two must not share an error
   message (a 522 reported as "serves a different build" is the class of misdirection this design
   exists to remove).
4. **Phase 3 — robots.** From that response's `x-robots-tag`:
   `--expect-robots noindex` requires the value to contain `noindex`; `--expect-robots none`
   requires no such header, or a value without `noindex`.

Budgets are named constants with a comment, not flags — no caller needs to vary them.

The network call is a single injected function so tests can drive it without HTTP.

### 2. Workflow wiring

`deploy-web-app-beta.yml` — replaces both smoke steps (its deploy step already has `id: deploy`):

```yaml
      - name: Smoke test
        run: >
          pnpm --filter xivdyetools-web-app exec node scripts/smoke-test-pages.js
          --deployment-url "${{ steps.deploy.outputs.deployment-url }}"
          --domain https://beta.xivdyetools.app
          --expect-robots noindex
```

`deploy-web-app.yml` — same, plus `id: deploy` on its deploy step, and `--domain
https://xivdyetools.app --expect-robots none`. The redundant `sleep 5` goes from both; the script
polls.

### 3. `apps/web-app/package.json`

Add `"wrangler": "^4.120.0"` to `devDependencies`. Regenerate `pnpm-lock.yaml`.

`web-app`'s `build` is `tsc --noEmit && vite build` and never runs `build:css`, so the committed
`assets/css/tailwind.css` is untouched and `dist/` is gitignored — the tree is genuinely clean
afterwards, which is what makes the commit metadata appear.

### 4. `apps/web-app/vitest.config.ts`

Widen `include` to `['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.js']`. This is also the
first step toward covering the two existing gate scripts, which have no tests today.

### 5. Documentation

- `apps/web-app/scripts/README.md` — document the new script alongside its siblings.
- `apps/web-app/CLAUDE.md` — the `VITE_APP_ENV=beta` bullet should note that the end-to-end robots
  assertion lives on the custom domain and why the alias cannot carry it.
- `2026-08-09-beta-web-app-deployment-design.md` — already corrected in `c1af09c`; its smoke-test
  section defers here.

## Error handling and failure modes

| Failure | Presentation |
|---|---|
| `--deployment-url` empty | Hard fail naming `wrangler-action`, so the cause is the action's output and not the site |
| Alias never returns 2xx | Fail naming the alias — the deployment itself is bad; the domain is irrelevant |
| Domain never returns 2xx | Fail stating the deployment is live at `<alias>` but `<domain>` never answered, with the last status seen. This is the original 522 shape — a working deployment behind an unreachable or unattached domain |
| Domain answers but never converges | Fail stating *"deployment is live at `<alias>` but `<domain>` still serves a different build after 180s"*. Deliberately worded so a production operator reads "the deploy worked, the alias is lagging", not "production is down" |
| Beta missing `noindex` | Fail, dumping the response headers. Distinct from `check-beta-build.js`, which asserts the *artifact*; this asserts Cloudflare actually served it |
| Production has `noindex` | Fail loudly — this is the high-value guard. A beta build reaching production would deindex the live site, and nothing else in CI catches it today |

A one-time cold custom domain (the original 522) now fails only after ~180s rather than ~36s, and
the message identifies it as a domain problem with a working deployment behind it.

## Testing

`apps/web-app/scripts/smoke-test-pages.test.js`, with an injected fetch:

- passes with `--expect-robots noindex` when the domain converges and carries `noindex`
- passes with `--expect-robots none` when the domain converges and carries no such header
- fails on empty / missing `--deployment-url`
- fails on an unrecognised `--expect-robots` value
- fails when the alias never returns 2xx
- fails when the domain converges but robots is wrong — both directions
- fails when the domain answers 2xx but never converges, naming both hostnames
- fails distinctly when the domain never answers 2xx at all, reporting the last status seen —
  asserted as a *different* message from the stale-bytes case
- succeeds when the domain converges on a later attempt, not the first (proves polling, not just
  the happy path)

Verification beyond unit tests: run the script locally against the current live deployments (both
projects), which is how the byte-equality and Cloudflare-injection findings were established.

## Rollout order

1. `wrangler` devDependency + lockfile. Independently useful; verify a deploy log shows no
   *"Installing Wrangler"* group and no `--commit-dirty` warning.
2. Script + tests + `vitest.config.ts`. Green locally before any workflow references it.
3. Wire the beta workflow. Push to `monorepo-2.0-prep` exercises it immediately.
4. Wire the production workflow once beta has passed at least once.
5. Docs.

Step 4 is deliberately last: production's assertion is the inverse, and a mistake there fails
every production deploy.

## Out of scope

- The web-app JS payload sitting at 91.3% of its budget. Passing; separate concern.
- Smoke tests for the eight worker deploy workflows, which have none at all. Workers have no
  custom-domain-alias problem, so they need a different design.
- Testing the existing `check-bundle-size.js` / `check-beta-build.js`, though item 4 above makes
  it possible.
