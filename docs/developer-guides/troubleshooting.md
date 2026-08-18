# Troubleshooting

**Failures this repo has actually produced, and what caused them**

Every entry below is a real failure mode with a documented root cause. Most share a shape: the
thing **appears to succeed** and the damage shows up somewhere else.

---

## Build and type-check

### `'Foo' is a type and must be imported using a type-only import`

The base tsconfig enables `verbatimModuleSyntax`. A plain `import { Foo }` for something used
only as a type is a compile error.

```typescript
import type { Dye } from '@xivdyetools/types';   // ✅
```

### A package builds locally but its consumer sees stale types

Internal dependencies resolve via `workspace:*`, but consumers import from the package's **built
output**. Build the dependency closure, not just the target:

```bash
pnpm turbo run build --filter=xivdyetools-web-app...    # note the trailing ...
```

### Hand-edits to `packages/core/src/data/locales/*.json` keep vanishing

Those files are generated. `@xivdyetools/core`'s `build` runs `build:locales` → `tsc` →
`copy:locales`, and `build:locales` regenerates from `dyenames.csv` / `localize.yaml`.
Fold corrections into the **source** files.

(`build:locales` is idempotent since core v2.8.0 — rebuilding from unchanged sources no longer
re-stamps `meta.generated`, so a full build no longer produces six spurious modifications.)

---

## Tests

### CI test job dies with exit 1 and no assertion failure

A change touching every package (a docs sweep, a formatting pass) makes the affected-filter
select all ~34 test tasks. At turbo's default concurrency of 10, that many vitest processes —
each with its own worker pool — get silently OOM-killed on a 2-core runner. The failure looks
like a broken test but has no failing assertion.

CI pins `--concurrency=3` for this reason. If you change that, expect wide sweeps to flake.

### Playwright `mobile-chrome` project is red

Pre-existing, not caused by your change. The Chromium project is the one that gates.

---

## Publishing

### The publish workflow ran, reported success, and published nothing

The `detect` job only publishes a package whose local version differs from the version on npm.
**At version parity it does nothing and exits green.** Bump the version in
`packages/<name>/package.json` first.

### A newly created package cannot be published by CI

OIDC trusted publishing cannot create a package that does not exist on npm yet. The *first*
version must be published by a 2FA-authenticated human; configure the trusted publisher
afterwards. See [Release Process](release-process.md).

### An external consumer can't install a package that works fine in the monorepo

Published in the wrong order. `workspace:*` resolves internally regardless, so the monorepo hides
the problem. Publish lowest-level first: `types, logger, auth` → `core, worker-kit` → `svg` →
`bot-logic`.

---

## Deployment

### 🔴 A bare `wrangler deploy` went to production

On `discord-worker`, `moderation-worker`, and `presets-api` this was true until 2026-08-09 —
the top-level block held the live routes and `[env.production]` set `name` to the same value,
collapsing both onto one script. All three now default to `-dev` workers.

**`oauth` is still Convention B**: its top level *is* production, and its `deploy:production`
script is literally `wrangler deploy` with no `--env` flag. Check the `wrangler.toml` before
deploying anything by hand. See [Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md).

### A `-dev` worker claimed a production route

`routes` and `workers_dev` are **inheritable** wrangler keys — a named environment takes the
top-level value unless it overrides it. Copying `routes` into `[env.production]` while leaving it
at the top level means the dev worker also claims the production hostname. It has to *move*.

### A variable is present in dev and missing in production

`vars` are **not** inheritable. `[env.production.vars]` must repeat every variable the top-level
block declares. A missing entry silently drops that variable from production only.

### A worker keeps running old code after a shared package changed

Deploy workflows are **path-filtered**. If the package isn't in that workflow's `paths:` list,
the worker never redeploys — and nothing fails. Add the path when you add the dependency.

### `discord-worker` deploy fails on script size

Cloudflare's limit is 3 MiB (3,072 KiB) gzipped. `discord-worker` runs near it. The
`@cf-wasm/photon` dependency was split into `image-worker` to get back under
(3,209.3 → 2,589.70 KiB). Bundled CJK font subsets and WASM modules are the usual causes of a
regression here — see [IMAGE_WORKER_SPLIT](../operations/IMAGE_WORKER_SPLIT.md).

### `IMAGE_WORKER` service binding fails to resolve

`xivdyetools-image-worker` must already exist in the Cloudflare account. The discord-worker and
image-worker deploy workflows run in parallel with no `needs:` between them — harmless after the
first image-worker deploy, load-bearing before it.

---

## Web app

### A `.js` URL returns HTML — looks like a partial deploy

Cloudflare Pages cache poisoning, not a bad build. An SPA catch-all plus `immutable` caching on
`/assets/*` can cache the HTML fallback under a `.js` URL for a year.

**To tell them apart**: diff the custom domain against the `pages.dev` alias. If the alias serves
the correct asset and the custom domain doesn't, it's cache poisoning.

### The beta deploy went to the wrong place

The `--branch=beta` argument is load-bearing and **fails silently** when omitted. Also note the
beta app writes to **production** preset data — it is not an isolated environment.

### The "What's New" popup is empty

`vite-plugin-changelog-parser.ts` expects `CHANGELOG-laymans.md` in a specific shape:
`## Web-App Version X.Y.Z — Date` headers with `###` sections. When the format drifts the regex
matches nothing, `virtual:changelog` is empty, and the modal falls back to `changelog.noChanges`
— **it does not error**. Verify the modal after touching that file's format.

### Market board or community presets are broken on beta

Historically this was an **undeployed worker**, not an app bug — `api-worker`'s `/universalis`
returning 404 and `presets-api`'s CORS allowlist missing the beta origin. Check that the backing
workers are deployed and their allowlists include the beta origin before debugging the client.

---

## Discord bot

### A new or changed slash command doesn't appear

Deploying the worker does not register commands with Discord. Run:

```bash
pnpm --filter xivdyetools-discord-worker run register-commands
```

Required whenever a command's *shape* changes — name, options, or choices. Adding a harmony type
or a filter option counts.

### `register-commands` fails a parity assertion

The script checks the registration schema against `COMMAND_REGISTRY`
(`apps/discord-worker/src/commands/registry.ts`). This is working as designed: the registry is
the roster of record precisely so a command cannot exist in the dispatch switch, the schema, and
`/about` in three different states. Fix the registry, don't bypass the check.

### Moderation approve/reject buttons do nothing

Discord routes component clicks to the application that **owns the message**. Embeds posted with
the main bot's token can never reach moderation-worker's handlers. The `MODERATION_BOT_TOKEN`
secret must be set; when it isn't, the buttons are deliberately omitted in favour of a
`/preset moderate` hint rather than shipping dead UI.

### CJK text renders as tofu boxes in generated images

The bundled resvg fonts have no emoji glyphs, and font subsets only cover the strings they were
generated from. `subset-cjk-fonts.py` reads both `packages/core` locales and the worker's own
card strings — if you add card strings elsewhere, they will be covered by luck alone.

---

## Still stuck?

- [Environment Variables](environment-variables.md) — the full var/secret inventory per project
- [Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md) — the deploy-target evidence table
- [Logging Standards](logging-standards.md) — how to get useful structured logs out of a worker
- `docs/audits/` — dated audit archives; many failure modes here were first documented there
