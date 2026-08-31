# Deployment

**How each project reaches production, and the traps to avoid on the way**

---

## The short version

**Deployment is CI-driven. Merging to `main` is the deploy.** Every worker and the web app has a
path-filtered GitHub Actions workflow that fires on push to `main` and can also be triggered
manually via `workflow_dispatch`. You should rarely need to deploy from your machine.

If you do deploy by hand, read [Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md) first.
A bare `wrangler deploy` does **not** mean the same thing on every worker.

---

## CI deployment

| Workflow | Deploys | Triggered by changes to |
|----------|---------|-------------------------|
| `deploy-web-app.yml` | Cloudflare Pages project `xivdyetools` | `apps/web-app/**`, `packages/{core,types,logger}/**` |
| `deploy-web-app-beta.yml` | The beta Pages project (`beta.xivdyetools.app`) | same paths as `deploy-web-app.yml` above, but push to **any non-main branch** (not just `main`) — this is the premise of 2026-08-29 FINDING-028, not a typo |
| `deploy-discord-worker.yml` | `xivdyetools-discord-worker` | `apps/discord-worker/**`, `packages/{core,types,logger,auth,bot-logic,svg,worker-kit}/**` |
| `deploy-discord-worker-beta.yml` | `xivdyetools-discord-worker-dev` (the beta bot) | same paths as `deploy-discord-worker.yml` above, but push to **any non-main branch** (not just `main`) |
| `deploy-image-worker.yml` | `xivdyetools-image-worker` | `apps/image-worker/**` |
| `deploy-moderation-worker.yml` | `xivdyetools-moderation-worker` | `apps/moderation-worker/**` + shared packages |
| `deploy-presets-api.yml` | `xivdyetools-presets-api` | `apps/presets-api/**` + shared packages |
| `deploy-oauth.yml` | `xivdyetools-oauth` | `apps/oauth/**` + shared packages |
| `deploy-api-worker.yml` | `xivdyetools-api-worker` | `apps/api-worker/**` + shared packages |
| `deploy-og-worker.yml` | `xivdyetools-og-worker` | `apps/og-worker/**` + shared packages |

Each workflow runs the same shape: `pnpm install --frozen-lockfile` → build the target's
dependency closure (`--filter=<target>...`) → type-check → test → deploy via
`cloudflare/wrangler-action@v4`.

### Path filters are load-bearing

A worker only redeploys when a path in **its own filter list** changes. If you add a dependency
on a shared package, **add that package to the workflow's `paths:` list** — otherwise the worker
keeps running the old bundled copy after the package changes, and nothing fails loudly. This has
bitten the repo repeatedly (see the `ARCH-001` and `MONO2` comments in the workflow files).

### Required secrets

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the production workflows in the table above
(each gated on `environment: production`). The three `*-beta.yml` workflows in that same table use
a separate `CLOUDFLARE_API_TOKEN_BETA` under `environment: beta` instead — added 2026-08-29
(FINDING-028) so an edited beta workflow can no longer read the production-capable token; see
[Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md). There is **no npm token** — publishing
uses OIDC trusted publishing (see [Release Process](release-process.md)).

---

## ⚠️ Manual deploys: `deploy` does not mean the same thing everywhere

This is the single most dangerous thing in the repo. Two different conventions coexist.

### Convention A — top level is a `-dev` worker (the safe one)

`discord-worker`, `moderation-worker`, `presets-api`, `api-worker`, `og-worker`, `image-worker`.

The top-level `wrangler.toml` block declares a `…-dev` name and **no routes**. Production lives
in `[env.production]`.

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # → …-dev worker
pnpm --filter xivdyetools-discord-worker run deploy:production   # → production
```

### Convention B — top level *is* production

`oauth`. Its top-level block is named `xivdyetools-oauth` and holds the live routes;
`[env.development]` and `[env.preview]` are the non-production environments.

Consequently **`oauth`'s `deploy:production` script is literally `wrangler deploy`** — no
`--env` flag. That is correct for `oauth` and wrong for everything else. Do not copy it.

```bash
pnpm --filter xivdyetools-oauth-worker run deploy                # → PRODUCTION
```

### Why the naming looks inverted

`routes` and `workers_dev` are **inheritable** wrangler keys; `vars` are **not**. Because a named
environment inherits the top-level `routes` unless it overrides them, the fix under Convention A
required *moving* `routes` into `[env.production]` rather than copying it — which is why the
environment literally named `production` is the one that declares the routes, while the unnamed
default holds nothing. Both keys are now declared explicitly in both environments on the three
workers that were corrected on 2026-08-09.

The corollary for `vars`: because they are not inherited, `[env.production.vars]` must repeat
every variable the top level declares. A missing entry silently drops that variable from
production only.

---

## Post-deploy steps that are not automatic

### Slash-command registration

Adding, removing, or changing the *shape* of a Discord command (name, options, choices) requires
re-registering with Discord. Deploying the worker alone does not do this.

```bash
pnpm --filter xivdyetools-discord-worker run register-commands
pnpm --filter xivdyetools-moderation-worker run register-commands
```

The registration script asserts parity against `COMMAND_REGISTRY`
(`apps/discord-worker/src/commands/registry.ts`) before publishing, so a command missing from the
registry fails the run rather than silently shipping a mismatched roster.

### D1 migrations

`presets-api` and `oauth` persist to D1. Migrations are applied explicitly:

```bash
pnpm --filter xivdyetools-presets-api run db:migrate:local   # local dev DB
pnpm --filter xivdyetools-presets-api run db:migrate         # remote
```

Apply the migration **before** the code that depends on it reaches production.

---

## Web app deployment

The web app builds to static assets and deploys to the Cloudflare Pages project `xivdyetools`.
The workflow additionally enforces a bundle-size budget
(`apps/web-app/scripts/check-bundle-size.js`) and verifies after deploy that the live public URL
serves the build just made and is **not** a beta build (`--expect-robots none`).

A separate Pages project serves `beta.xivdyetools.app` via `deploy-web-app-beta.yml`. Two things
about the beta worth knowing:

- The `--branch=beta` argument is load-bearing and **fails silently** if omitted.
- The beta app writes to **production** preset data. It is not an isolated environment.

### Cache poisoning hazard on Pages

An SPA catch-all combined with `immutable` caching on `/assets/*` can cache an HTML fallback
under a `.js` URL for a year. The symptom looks exactly like a partial deploy. To tell them
apart, diff the custom domain against the `pages.dev` alias — if the alias is correct and the
custom domain is not, it is cache poisoning, not a bad build.

---

## Worker size limits

Cloudflare enforces a **3 MiB (3,072 KiB) gzipped** script limit. `discord-worker` runs close to
it — the `@cf-wasm/photon` dependency was split out into `image-worker` on 2026-08-09 specifically
to get back under it (3,209.3 → 2,589.70 KiB). See
[IMAGE_WORKER_SPLIT](../operations/IMAGE_WORKER_SPLIT.md).

Before adding a large dependency to `discord-worker`, check the headroom. Bundled CJK font
subsets and WASM modules are the usual offenders.

---

## Deployment checklist

- [ ] `pnpm turbo run lint type-check test build --filter=<target>...` passes locally
- [ ] If a new shared-package dependency was added, the deploy workflow's `paths:` filter includes it
- [ ] If slash-command shape changed, `register-commands` is scheduled to run
- [ ] If the D1 schema changed, the migration is applied first
- [ ] If deploying by hand, you have confirmed which convention this worker uses
- [ ] For `discord-worker`, the gzip bundle is comfortably under 3,072 KiB

---

## Related Documentation

- [Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md) — the full evidence and runbook
- [Domain Deprecation](../operations/DOMAIN_DEPRECATION.md) — the `xivdyetools.app` migration
- [Environment Variables](environment-variables.md) — every var and secret, per project
- [Release Process](release-process.md) — version bumping and npm publishing
- [Secret Rotation](../operations/SECRET_ROTATION.md)
