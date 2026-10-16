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
| `deploy-web-app.yml` | Cloudflare Pages project `xivdyetools` | `apps/web-app/**`, `packages/{core,types,logger,svg}/**` |
| `deploy-web-app-beta.yml` | The beta Pages project (`beta.xivdyetools.app`) | same paths as `deploy-web-app.yml` above, but push to **any non-main branch** (not just `main`) — this is the premise of 2026-08-29 FINDING-028, not a typo — and only when the branch's own changes touch them (see *Beta deploys follow the branch's own changes* below) |
| `deploy-discord-worker.yml` | `xivdyetools-discord-worker` | `apps/discord-worker/**`, `packages/{core,types,logger,auth,bot-logic,svg,worker-kit}/**` |
| `deploy-discord-worker-beta.yml` | `xivdyetools-discord-worker-dev` (the beta bot) | same paths as `deploy-discord-worker.yml` above, but push to **any non-main branch** (not just `main`), and only when the branch's own changes touch them |
| `deploy-og-worker-beta.yml` | `xivdyetools-og-worker-dev` (the routed beta worker: `beta.xivdyetools.app/*` + `og-beta.xivdyetools.app`) | same paths as `deploy-og-worker.yml` below, but push to **any non-main branch** (not just `main`), and only when the branch's own changes touch them |
| `deploy-image-worker.yml` | `xivdyetools-image-worker` | `apps/image-worker/**`, `packages/{logger,worker-kit}/**` |
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

Every one of the 11 deploy workflows (the 8 production ones and the 3 beta ones) also lists four
**root inputs** that change a bundle without touching `apps/` or `packages/`: `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `turbo.json` and `tsconfig.base.json` (BUG-153). A lockfile or `overrides:`
bump of a bundled transitive dependency therefore ships. The cost is deliberate: a lockfile-only
bump, even a dev-only Dependabot one, redeploys every production worker with identical code
(idempotent, serialized per workflow), and **merging such a change to `main` starts all 8
production deploys, `oauth` included, whose bare deploy is production**. `scripts/check-workflows.test.ts`
(run by `pnpm test:scripts`) fails when any `deploy-*.yml` loses one of the four.

### Beta deploys follow the branch's own changes

A push filter compares only the pushed commits. So before 2026-10-13, merging `main` into a
branch started every beta deploy whose paths `main` had changed, even when the branch itself
changed nothing there, and the deploy took the shared beta bot, site or OG worker from whoever
was testing on it. A `CLAUDE.md` or `README.md` edit inside an app or package directory did the
same. Each of the three `*-beta.yml` workflows now starts with a `changes` job: it diffs the
pushed commit against its merge base with `main` over the workflow's deploy paths, minus
`CLAUDE.md` and `README.md`, and the deploy job runs only when that diff is non-empty. A manual
`workflow_dispatch` always deploys. The `push.paths` filters also leave out those two file
names, so a push that edits only them does not start a run at all. The exclusion is by name,
never `*.md`: discord-worker bundles `CHANGELOG-laymans.md` for `/changelog`.

Two `concurrency` groups decide who holds a shared beta. The shared group sits on the deploy job,
not the workflow, so a run whose guard skips the deploy never joins it and cannot cancel another
branch's deploy in progress. A per-ref group at workflow level (`deploy-<app>-beta-${{ github.ref }}`)
cancels a branch's older run, guard included, when the branch is pushed again, so two quick pushes
no longer race to deploy. `scripts/check-workflows.test.ts` checks that each guard's path list
matches its `push.paths`, that both exclusions are in place and come last in the filter, that the
guard script keeps its shape, and that both groups are set this way.

Two cases do not follow the rule exactly:

- A branch stacked on another branch inherits its base's app changes, because both are measured
  against `main`, so it still deploys.
- A push that fully reverts the branch's own app changes does not redeploy beta, because the branch
  then matches its merge base with `main` over the deploy paths. Run the workflow by hand to put the
  branch back, once its later pushes have finished: a newer push to the branch cancels the manual run.

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

The top-level `wrangler.toml` block declares a `…-dev` name and **no routes** (except `og-worker`,
below). Production lives in `[env.production]`.

**Caveat — `og-worker`:** its top-level `…-dev` block is the routed public beta (the
`beta.xivdyetools.app/<tool>/*` routes plus `og-beta.xivdyetools.app`), so a bare `deploy` there
is live. Production is still `--env production`. See
[Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md).

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # → …-dev worker
pnpm --filter xivdyetools-discord-worker run deploy:production   # → production
```

### Convention B — top level *is* production

`oauth`. Its top-level block is named `xivdyetools-oauth` and holds the live routes;
`[env.development]` is the **only** other environment — `[env.preview]` was deleted by
FINDING-029 (2026-08-21 security audit) and a tombstone comment records it.

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
re-registering with Discord. **Both production deploy workflows already do this** — a
"Register Discord commands" step runs `pnpm run register-commands` after every successful
deploy (in both `deploy-discord-worker.yml` and `deploy-moderation-worker.yml`).

Run it by hand only out of band: a guild-scoped registration against the beta application, or
after a deploy you performed locally rather than through the workflow.

```bash
pnpm --filter xivdyetools-discord-worker run register-commands
pnpm --filter xivdyetools-moderation-worker run register-commands
```

The registration script asserts parity against `COMMAND_REGISTRY`
(`apps/discord-worker/src/commands/registry.ts`) before publishing, so a command missing from the
registry fails the run rather than silently shipping a mismatched roster.

### Applying D1 migrations

`presets-api` and `oauth` persist to D1. Numbered files under each app's `migrations/` are
applied **by hand, one file at a time**, with `wrangler d1 execute`:

```bash
# presets-api (database xivdyetools-presets)
pnpm --filter xivdyetools-presets-api exec wrangler d1 execute xivdyetools-presets \
  --remote --env production --file=./migrations/NNNN_name.sql

# oauth (database xivdyetools-users) — no --env: oauth has no [env.production]
# and its top-level block is already production
pnpm --filter xivdyetools-oauth-worker exec wrangler d1 execute xivdyetools-users \
  --remote --file=./migrations/NNNN_name.sql
```

Never run `wrangler d1 migrations apply`: no `d1_migrations` table records these files, so it
would replay every one of them and fail on the first duplicate column.

`db:migrate` does **not** apply migrations. In `presets-api` it only re-runs `schema.sql`
(`CREATE … IF NOT EXISTS`, useful for a fresh database) and cannot alter a live schema;
`db:migrate:local` does the same against the local dev DB. `oauth` has no `db:migrate` script.

Some newer files state their order in the header: `presets-api`'s `0014` is applied before the
revision-aware deploy, while its `0015` and `oauth`'s `0001` are applied after the deploy they
depend on. Follow the header. When a header says nothing, apply the migration **before** the code
that depends on it reaches production. A merge to `main` is what deploys that code, so a
before-deploy migration is applied before the merge, not after it.

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
- [ ] If the D1 schema changed, the migration is applied by hand, before or after the deploy as its header says ([Applying D1 migrations](#applying-d1-migrations))
- [ ] If deploying by hand, you have confirmed which convention this worker uses
- [ ] For `discord-worker`, the gzip bundle is comfortably under 3,072 KiB

---

## Related Documentation

- [Deploy Environments](../operations/DEPLOY_ENVIRONMENTS.md) — the full evidence and runbook
- [Domain Deprecation](../operations/DOMAIN_DEPRECATION.md) — the `xivdyetools.app` migration
- [Environment Variables](environment-variables.md) — every var and secret, per project
- [Release Process](release-process.md) — version bumping and npm publishing
- [Secret Rotation](../operations/SECRET_ROTATION.md)
