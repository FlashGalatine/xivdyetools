# Release Process

**Version bumping, npm publishing, and coordinated multi-project releases**

---

## Two kinds of release

| | Shared packages (`packages/*`) | Applications (`apps/*`) |
|---|---|---|
| Artifact | An npm tarball under `@xivdyetools` | A deployed Worker or Pages site |
| Triggered by | Manual `workflow_dispatch` | Merge to `main` (path-filtered) |
| Gate | Version differs from what's on npm | Path filter matched |
| Rollback | Publish a new patch (npm publishes are immutable) | Re-deploy the previous commit |

`@xivdyetools/test-utils` is workspace-private and never published.

---

## Publishing a shared package

### 1. Change, build, test

```bash
pnpm turbo run build test --filter=@xivdyetools/<name>
```

### 2. Bump the version and write the changelog

Edit `packages/<name>/package.json` and add an entry to `packages/<name>/CHANGELOG.md`.

The repo follows [Keep a Changelog](https://keepachangelog.com/) and semantic versioning.
Changelog entries are expected to say *what broke and why it mattered*, not just what changed —
look at recent entries in `packages/core/CHANGELOG.md` for the house style.

**A version bump is mandatory.** The publish workflow's `detect` job only publishes a package
whose local version differs from the published one. At version parity it does nothing and
reports success, which is easy to misread as a successful publish.

### 3. Merge to `main`

### 4. Run the publish workflow

**Actions → "Publish Packages to npm"** → choose the package, or `all-modified` to publish
everything whose local version differs from npm.

The workflow authenticates to npm via **trusted publishing (OIDC)**. There is no `NPM_TOKEN`
anywhere in CI — the `id-token: write` permission mints a short-lived credential from the
workflow's own GitHub identity, which also signs the provenance attestation.

### Ordering matters

Publish in dependency order, lowest level first. A consumer published against an unpublished
dependency version will fail to install for external users, even though it resolves fine inside
the monorepo via `workspace:*`:

```
types, logger, auth  →  core, worker-kit  →  svg  →  bot-logic
```

---

## Trusted publishing setup

Configured per package at npmjs.com → package → Settings:

| Field | Value |
|-------|-------|
| Publisher | GitHub Actions |
| Repository | `FlashGalatine/xivdyetools` |
| Workflow | `publish-packages.yml` |
| Permission | `npm publish` |

Two constraints follow from this:

- **A brand-new package cannot be published by CI.** OIDC cannot create a package that does not
  exist yet, so the *first* version must be published by a 2FA-authenticated human. Configure
  the trusted publisher afterwards.
- **Local publishing is deliberately not a normal path.** Every package is set to *"Require
  two-factor authentication and disallow tokens"*, so an unattended local publish is impossible
  by design. Break-glass only:

  ```bash
  pnpm --filter @xivdyetools/<name> publish --provenance --access public --no-git-checks --otp=<code>
  ```

pnpm 11 performs the OIDC exchange natively — the npm CLI is not involved. (Under pnpm 10 the
publish was delegated to npm, which needed ≥ 11.5.1 for OIDC support; that step was removed with
the pnpm 11 migration.)

---

## Releasing an application

Applications are versioned in `package.json` and released by merging to `main`, which fires the
path-filtered deploy workflow. See [Deployment](deployment.md).

Still do the version bump and changelog entry — they feed the web app's "What's New" modal,
the `/changelog` Discord command and the release announcement (three layman's files, below).

### Layman's changelogs

Three plain-language files are rendered to end users. Dependency bumps, lint passes, internal
refactors and security-only patches are deliberately folded out of all of them — only
user-visible changes belong there.

| File | Rendered by | Grammar |
|------|-------------|---------|
| `apps/web-app/CHANGELOG-laymans.md` | the web app's "What's New" modal (`vite-plugin-changelog-parser.ts`) | `## Web-App Version X.Y.Z — Date` + `###` sections |
| `apps/discord-worker/CHANGELOG-laymans.md` | the bot's `/changelog` — **bundled into the Worker at deploy time** (wrangler Text rule), so an edit is a deploy | `## [x.y.z] - YYYY-MM-DD` + `###` sections + `-` bullets (`changelog-parser.ts`) |
| `CHANGELOG-laymans.md` (repo root) | the release-announcement webhook (`/webhooks/github`, product-level: web app + bot + link previews) | same grammar as the bot file |

Each surface's in-product "what's new" reads **its own** file with **its own** version numbers —
the bot's `version:` option looks up bot releases, not web-app ones. The root file is the one
product-wide summary; when the announcement has to cut a long release it links to that file on
GitHub.

If a parser stops matching its file's format, the surface renders **empty** rather than
failing — the web app's modal shows nothing, and the bot's parse failures are silent by design.
`apps/discord-worker/src/services/changelog-parser.test.ts` guards the bot file (grammar,
newest-first, and the newest entry's version must equal `apps/discord-worker/package.json` —
so the bump and the notes travel together); verify the web modal after changing that format.

---

## Coordinated multi-project releases

When a change spans packages and apps — an audit remediation sweep, or a major like the 5.0 wave
— the order is:

1. Land every change on a working branch and get CI green.
2. Bump versions across all affected projects, with changelog entries.
3. Merge to `main`. Deploy workflows fire automatically for the affected apps.
4. Run the publish workflow for each package, in dependency order.
5. Run `register-commands` if any slash-command shape changed.
6. Apply D1 migrations if the schema changed.
7. Update [versions.md](../versions.md) — the current-version tables, the version-history
   sections, and the compatibility matrix.

The root `CHANGELOG.md` carries a monorepo-level rollup for sweeps that touch many projects at
once.

### Current state

The **5.0 wave** is complete on `monorepo-2.0-prep` but not yet merged or published. Several of
its packages have `package.json` versions ahead of their `CHANGELOG.md` — `core` 4.0.0 vs 3.0.0,
`types` 2.0.0 vs 1.15.0, `svg` 2.0.0 vs 1.2.1, `bot-logic` 2.0.0 vs 1.5.0, `web-app` 5.0.0 vs
4.12.0, `discord-worker` 5.0.0 vs 4.7.0. **Those changelog entries need writing before the
release**, since step 2 above is what makes the release legible afterwards.

---

## Version numbering

Standard semver. In practice:

- **Major** — a consumer must change code. Removing an export, changing a data file's schema in a
  way that reaches the public API, renaming a subpath export.
- **Minor** — new capability, backward compatible. New functions, new optional fields, absorbed
  subpath exports (`core/blending`, `auth/encoding`, `bot-logic/i18n` all landed as minors
  because the old package kept working until it was retired).
- **Patch** — fixes, dependency bumps, lint sweeps.

Note that schema v2 shipped as `core` **3.0.0 (major)** even though the runtime `Dye` object kept
its full 16-field shape — because the data file, the Facewear export, and the `isMetallic` /
`isCosmic` memberships all changed. The test is whether a consumer's *behaviour* changes, not
whether their types still compile.

---

## Related Documentation

- [Deployment](deployment.md) — how apps reach production
- [Version Matrix](../versions.md) — current versions and history
- [Core Publishing Guide](../projects/core/publishing.md) — core-specific notes
- [Contributing](contributing.md) — branch and commit conventions
