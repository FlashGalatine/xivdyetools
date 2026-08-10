# Design — `beta.xivdyetools.app`: a second Pages project for the web app

**Date:** 2026-08-09
**Status:** approved; Cloudflare-side setup complete
**Deploy unit:** `web-app` (plus one-line changes to `oauth` and `presets-api`)

---

## Problem

`web-app` deploys only from `main`, to one Cloudflare Pages project (`xivdyetools`) on
`xivdyetools.app`. There is no way to put a branch build in front of testers. The 5.0 work lives
on `monorepo-2.0-prep`, unmerged and unreleased, so the only way to see it running is locally.

The Discord bot already solved this: `deploy-discord-worker-beta.yml` publishes any non-main
branch to a separate beta worker with its own Discord application. The web app should follow the
same shape.

## Goal

`https://beta.xivdyetools.app` serves the latest push to any non-main branch, is visibly
distinguishable from production, and cannot be mistaken for or promoted to production by
accident.

## Decisions taken

| Decision | Choice | Reasoning |
|---|---|---|
| Isolation mechanism | **Second Pages project** (`xivdyetools-beta`), not a preview branch of the existing one | A preview-branch setup separates beta from production by a CLI flag and a hand-edited CNAME target. This project already has a documented incident from exactly that shape (`DEPLOY_ENVIRONMENTS.md`: a bare `wrangler deploy` reaching production). A second project makes the mistake unavailable. It also avoids two real caveats of the branch-alias route: it requires a *proxied* Cloudflare DNS record, and Cloudflare Access over previews is documented as covering `*.pages.dev` URLs but **not** custom domains |
| Backend | **Production APIs** (`api.` / `auth.xivdyetools.app`) | Matches the beta bot, which already shares production D1. There is no isolated preset database anywhere today — even `xivdyetools-presets-api-dev` binds production D1 (`e17d68a1-…`), so "give beta its own" means a new database, a schema migration and a curated-preset seed. **Consequence accepted: presets submitted or voted from beta are real** |
| Reachability | **Public, `noindex`** | Beta hits the real API, so it inherits production's auth, rate limits and moderation — a visitor can do nothing there they could not already do on the live site. Access-gating would add a login wall in front of the OAuth flow we most want to test |
| Trigger | **Any non-main branch** | Mirrors `deploy-discord-worker-beta.yml` exactly, including its one-beta-wins compromise |
| Beta marker | **Document title + favicon** | Enough to tell two tabs apart and to stop bugs being filed against the wrong site. No new component, no locale keys, nothing to remove at release |

## Cloudflare-side prerequisites — **DONE 2026-08-09**

Completed by the maintainer before implementation started:

- Pages project created **with the production branch set at creation time**, which is the part
  that matters:

  ```
  wrangler pages project create xivdyetools-beta --production-branch=beta
  ```

  Confirmed created; the project is reachable at `https://xivdyetools-beta.pages.dev/` once a
  first deployment exists.
- `beta.xivdyetools.app` attached to it as a custom domain.

Because `beta` is the production branch, `wrangler pages deploy … --branch=beta` produces a
**production** deployment of the beta project, which is what the custom domain serves. Getting
this wrong would not have failed loudly — the deploy would have succeeded as a *preview* while
the custom domain kept serving the previous content, presenting as "my changes did not deploy".
Direct Upload projects cannot change the production branch from the dashboard afterwards; the
documented route is a PATCH to the Update Project API. Setting it at creation avoided that
entirely.

## Architecture

```
push to any non-main branch
        │
        ▼
deploy-web-app-beta.yml ── VITE_APP_ENV=beta ──► vite build
        │                                            │
        │                          vite-plugin-beta-branding
        │                          ├─ index.html <title> + icon hrefs → /assets/icons/beta/
        │                          ├─ dist/_headers += X-Robots-Tag: noindex, nofollow
        │                          └─ define __APP_ENV__ → APP_NAME = "[BETA] XIV Dye Tools"
        ▼
wrangler pages deploy dist --project-name=xivdyetools-beta --branch=beta
        │
        ▼
https://beta.xivdyetools.app ──► auth.xivdyetools.app  (production oauth)
                             └─► api.xivdyetools.app   (production presets-api)
```

`beta` is the beta project's **production branch**, so every deploy is a production deployment of
that project and is served on the custom domain. Set at creation with
`wrangler pages project create xivdyetools-beta --production-branch=beta`, because Direct Upload
projects cannot change the production branch from the dashboard — the documented alternative is a
PATCH to the API.

## Components

### 1. `apps/web-app/vite-plugin-beta-branding.ts` (new)

One plugin, one job: make this build a beta build. Inert unless `VITE_APP_ENV === 'beta'`, so a
production build's output is byte-identical to today's.

- `config()` — inject `__APP_ENV__`.
- `transformIndexHtml()` — prefix `<title>`; rewrite every `/assets/icons/<file>` in an
  `<link rel="icon">` or `<link rel="apple-touch-icon">` to `/assets/icons/beta/<file>`. There
  are **seven** such links: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`,
  `favicon-48x48.png`, `apple-touch-icon.png`, `icon-192x192.png`, `icon-512x512.png`.
  Rewriting by path prefix rather than by an enumerated list means adding an icon to
  `index.html` later does not silently skip beta.
- `writeBundle()` — append a new `/*` section to `dist/_headers` carrying `X-Robots-Tag`.

The `noindex` rule is applied at build time rather than in `functions/_middleware.ts` for three
reasons: it does not depend on Pages Functions being deployed, it is verifiable by reading
`dist/`, and it keeps every beta-specific behaviour in one file.

### 2. Title marker — `shared/constants.ts` + `router-service.ts`

`APP_NAME` already exists and is already the right constant; `RouterService` just never used it.
It hardcodes `` `${route.title} | XIV Dye Tools` `` at lines 190, 227 and 347, so an
`index.html`-only title change would be overwritten on the first navigation.

```ts
// shared/constants.ts
declare const __APP_ENV__: string;
export const APP_ENV = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : 'production';
export const APP_NAME = APP_ENV === 'beta' ? '[BETA] XIV Dye Tools' : 'XIV Dye Tools';
```

The three literals in `RouterService` become `APP_NAME`. This is a de-duplication the file wanted
anyway.

### 3. Beta icon set — `public/assets/icons/beta/`

Generated once from `bot-avatar-beta-1024.png` (the blue paint bucket; production's identity is
red, so the two are distinguishable at 16 px) using `sharp`, which is already a `web-app`
devDependency and already drives `scripts/generate-icons.mjs`. Committed, not generated in CI.

Seven files, matching the seven links exactly: `favicon-16x16.png`, `favicon-32x32.png`,
`favicon-48x48.png`, `apple-touch-icon.png` (180), `icon-192x192.png`, `icon-512x512.png`, and
`favicon.ico` — the last a copy of the 32 px PNG, the same approach `generate-icons.mjs` already
takes and documents.

> **Observation, deliberately not fixed here.** `src/index.html` links
> `/assets/icons/favicon-48x48.png`, which does **not** exist in `public/assets/icons/` — a live
> 404 on production today. Beta will have the file because we are generating a complete set, so
> beta ends up marginally more correct than production. Fixing production's missing icon is a
> one-file change but it is a production-behaviour change, so it belongs in its own commit rather
> than inside beta infrastructure.

**Known trade-off:** these ~80 KB ship in the production bundle too, unreferenced. Accepted
because the directory is self-describing and small; the alternative (plugin-time copy from a
non-`public/` source) reintroduces the out-of-`publicDir` pattern that Sprint 4 documented as a
trap.

### 4. `.github/workflows/deploy-web-app-beta.yml` (new)

Modelled on `deploy-discord-worker-beta.yml`:

- `on.push.branches-ignore: [main, master, 'dependabot/**']` + `workflow_dispatch`
- `concurrency: { group: deploy-web-app-beta, cancel-in-progress: true }` — one beta, newest push
  wins, made explicit
- Same steps as `deploy-web-app.yml`: install → build deps → type-check → test → build →
  `check-bundle-size`
- `env: VITE_APP_ENV: beta` on the build step
- `pages deploy dist --project-name=xivdyetools-beta --branch=beta`
- Smoke test, in two steps:
  1. `curl --fail` against the wrangler-action `deployment-url` output (the immutable
     `<hash>.xivdyetools-beta.pages.dev` alias) for a 2xx. This is the build just uploaded;
     `beta.xivdyetools.app` is a mutable alias still serving the *previous* deployment
     until propagation completes, so a reachability assertion there can pass against the
     old build.
  2. `curl --fail` against `https://beta.xivdyetools.app/` with a ~2min retry budget, as a
     separate check that the custom domain is attached and current.

  The first-ever run of this workflow failed here with **522**: a Pages custom domain has no
  origin until the project's first *production* deployment exists, and the original ~36s
  retry budget expired during that one-time cold activation.

  **No `X-Robots-Tag` assertion belongs on a `*.pages.dev` URL.** Cloudflare injects
  `x-robots-tag: noindex` onto those hostnames itself, so asserting it there passes whether
  or not `vite-plugin-beta-branding` ran. Proof: production's `public/_headers` contains no
  `X-Robots-Tag`, yet its deployment alias serves one. The header is only build-determined on
  the custom domain, and asserting it there first requires proving the domain has caught up to
  this deployment — see `2026-08-10-pages-smoke-test-design.md`, which supersedes this section.

### 5. Origin allowlists

| File | Change | Deploy needed |
|---|---|---|
| `apps/oauth/src/constants/oauth.ts` | add `https://beta.xivdyetools.app` to `ALLOWED_REDIRECT_ORIGINS` | yes — oauth |
| `apps/presets-api/wrangler.toml` | append the origin to `env.production.ADDITIONAL_CORS_ORIGINS` | yes — presets-api |
| `apps/web-app/public/_headers` | none — `connect-src` already allows `https://*.xivdyetools.app` | — |

### 6. Documentation

- `docs/operations/DEPLOY_ENVIRONMENTS.md` — a section for the beta web app alongside the beta bot.
- `apps/web-app/CLAUDE.md` — the beta deploy and the `VITE_APP_ENV` flag.

## Error handling and failure modes

| Failure | Behaviour | Mitigation |
|---|---|---|
| `VITE_APP_ENV` unset in the beta workflow | Beta serves a build indistinguishable from production, still on the beta domain | The build assertion in the test plan fails the job before deploy |
| oauth allowlist not yet deployed | Login on beta fails at the redirect-URI check with an opaque error | Rollout order below puts oauth first |
| Two branches pushed close together | The later deploy wins | `cancel-in-progress: true`, same as the beta bot |
| Beta indexed by search engines | Competes with production | `X-Robots-Tag` header, plus the existing canonical tag pointing at production |
| Beta build passes tests but breaks at runtime | Beta only | It is beta; production is a separate project and unaffected |

## Testing

- **Unit** — `APP_NAME` carries the marker under a beta `__APP_ENV__` and not otherwise.
- **Unit** — `RouterService` titles inherit the marker. The existing title tests assert with
  `toContain`, so they pass either way; add one explicit assertion so the coupling is recorded.
- **Build assertion** — a `VITE_APP_ENV=beta` build produces a `dist/index.html` whose icon links
  point at `icons/beta/` and a `dist/_headers` containing `X-Robots-Tag`. Runs in the beta
  workflow before deploy.
- **Regression** — a normal build's `dist/index.html` and `dist/_headers` are unchanged.
- **Manual, once** — log in on beta with Discord, load the preset browser, confirm the tab shows
  `[BETA]` and the blue icon.

## Rollout order

1. `workflow_dispatch` **deploy-oauth** from `monorepo-2.0-prep` (carries the allowlist entry).
2. `workflow_dispatch` **deploy-presets-api** from the same branch (carries the CORS origin).
3. Push the branch — `deploy-web-app-beta.yml` fires.
4. Smoke-test login and the preset browser on beta.

Steps 1–2 must precede 3, otherwise beta deploys successfully and then fails at login for a
reason nothing on screen explains. Both workflows already expose `workflow_dispatch`, and
`actions/checkout` takes the dispatched ref, so neither needs a merge to `main`.

## Out of scope

- The `robots.txt` / `manifest.json` / `service-worker.js` packaging gap (they sit at the package
  root, outside `publicDir`, and never reach `dist/`). Beta's `noindex` comes from a header, so
  this does not block the work, and fixing it would change **production** behaviour inside a
  beta-infrastructure change.
- The stale `xiv-colorexplorer` hostnames in `presets-api`'s `ADDITIONAL_CORS_ORIGINS` and
  `oauth`'s `[env.preview].FRONTEND_URL`. Left alone rather than guessed at; they may still serve
  something.
- Any isolated beta database. Revisit if beta traffic starts polluting real community presets.
