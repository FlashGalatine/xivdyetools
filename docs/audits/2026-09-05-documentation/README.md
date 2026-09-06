# Documentation audit — whole repository, 2026-09-05

**Baseline:** `1eb57cda` (= `origin/main` after PRs #167, #168 and #169 merged).
**Branch:** `worktree-docs-audit-2026-09-05`, recorded in the root `CHANGELOG.md` as 2.2.0.
**Scope:** every document in the repository — `docs/` (about 90 living pages plus the dated
archives), all 17 workspace `README.md` / `CLAUDE.md` / `CHANGELOG.md` sets, the three
`CHANGELOG-laymans.md` files, the root `README.md` / `CLAUDE.md` / `DEPRECATIONS.md` /
`SECURITY.md`, the Discord bot's privacy policy and terms, the web app's privacy page, and every
version number.

## Method

Six read-only sweeps ran in parallel, each fact-checking one slice of the documentation against
the code, config and git history and reporting only discrepancies it had verified with a
`path:line` citation. Five fix agents then applied the findings to disjoint file sets, re-checking
each citation before editing and reporting anything that did not hold. The dated archive tier
(`docs/audits/`, `docs/historical/`, `docs/research/`) was out of scope for fact-checking: it
records the tree as it was.

| Sweep | Slice | Findings | HIGH | Report |
|-------|-------|----------|------|--------|
| A | `docs/architecture`, `docs/operations`, `docs/developer-guides`, `docs/reference`, `SECURITY.md` | 98 | 18 | [sweep-A](findings/sweep-A-architecture-operations-guides.md) |
| B | the 8 packages' README / CLAUDE.md, `docs/projects/{core,types,logger,test-utils}`, `DEPRECATIONS.md` | 105 | 55 | [sweep-B](findings/sweep-B-packages.md) |
| C1 | discord-worker + web-app: README / CLAUDE.md / ToS, `docs/projects/{discord-worker,web-app}` | 98 | 32 | [sweep-C1](findings/sweep-C1-discord-worker-web-app.md) |
| C2 | presets-api, image-worker, api-worker, og-worker, oauth, moderation-worker, stoat-worker + their `docs/projects` pages | 166 | 41 | [sweep-C2](findings/sweep-C2-workers.md) |
| D | `docs/user-guides`, `docs/specifications`, `docs/maintainer`, brainstorming status | 67 | 28 | [sweep-D](findings/sweep-D-user-guides-specs-maintainer.md) |
| E | all 21 changelog files vs git history and the layman's rule | 3 coverage gaps, 7 hygiene items, 7 layman's gaps | — | [sweep-E](findings/sweep-E-changelogs.md) |
| F | tree structure, indexes, reachability, 2,134 links | 207 broken links (all archive), 5 orphans, 6 unindexed folders | — | [sweep-F](findings/sweep-F-structure.md) |

Severity: HIGH = a wrong instruction, route, option, binding, symbol or flow that would mislead
someone acting on it; MED = stale count / status / version; LOW = cosmetic.

## Headline findings

- **Versions.** Five hand-maintained version tables (`docs/versions.md`, `docs/index.md`,
  `docs/README.md`, `docs/projects/index.md`, `docs/architecture/overview.md`, root `README.md`)
  carried four different snapshots, every one behind `package.json` on every row, plus a seventh
  in `docs/maintainer/index.md` and fifteen per-page banners. `docs/versions.md` still said the
  5.0 wave was "not yet merged or published" a week after it merged and published.
- **APIs that never existed.** Four `docs/projects` pages (`core/services.md`, `core/types.md`,
  `logger/overview.md`, `test-utils/overview.md`) documented functions, types and subpaths that do
  not appear anywhere in the monorepo (`createLogger`, `/node`, `DyeMatch`, `HarmonyResult`,
  `WCAGResult`, `Result<T>`, `createMockD1({presets})`, a `/dom` subpath removed in August). The
  package READMEs and CLAUDE.md files beside the code were broadly accurate — the drift was
  almost entirely in `docs/projects/`.
- **Flows described wrong.** The OAuth callback (`?token=JWT` redirect; in fact `code`+`csrf`+
  `state` then a POST exchange the worker verifies itself), a vote API with up/down votes and
  `BEGIN TRANSACTION` (in fact a single toggle and `db.batch`), a KV cache layer and two KV
  namespaces on the Universalis proxy (Cache API only, one KV binding), a Durable Object rate
  limiter and a `USE_DO_RATE_LIMITING` var on oauth, a `/auth/xivauth/cb` route, preset moderation
  described as fail-open with clean submissions set to `pending` (fail-closed; clean ones are
  approved at once).
- **Things that no longer exist.** `color_space` / `vibrancy_boost` / `count` options on
  commands that do not register them, `/favorites` and `/collection` commands deleted in 5.0, a
  discord-worker D1 binding, `utils/verify.ts`, `scripts/cleanup-v4-kv.ts`, a service worker,
  Tailwind glassmorphism plugins, a "report" button on presets, an "Add to Discord" footer link,
  five Allied Society vendor acquisitions, `jobNames` / `grandCompanyNames` locale keys.
- **Instructions the maintainer cannot follow.** `--otp` and `--provenance` in a local publish
  break-glass (the 2FA is a security key and provenance only works in CI), `npm whoami` /
  `npm publish` as the normal publishing path, `pnpm --filter xivdyetools-oauth` (the workspace
  is `xivdyetools-oauth-worker`), `npm update xivdyetools-core` in consumers that use
  `workspace:*`.
- **Shipped work still marked pending.** Budget suggestions "Planned"; three superpowers specs
  "not implemented"; `IMAGE_WORKER_SPLIT.md` "blocking — nothing in discord-worker can deploy";
  a "Known issue (5.0.0)" about `/preset submit` resolved on 2026-08-29.
- **Structure.** Zero broken links in the living tier and 207 in the archive; 5 live orphans;
  `docs/audits/` (33 directories), `docs/research/` (10) and `docs/superpowers/` (19 files)
  reachable from no index; `docs/brainstorming/` entirely shipped-or-superseded and the home
  of 16 of the 17 non-archive broken links; two competing top-level indexes and two competing
  historical indexes.

## What changed

- 534 of the 534 sweep A–D findings were applied; six were corrected on the facts before
  application (see the remediation record). Sweeps E and F were applied by the orchestrator.
- **`docs/` reorganised** — `docs/brainstorming/` retired into three dated `docs/historical/`
  folders; the undated core audit moved to `docs/audits/2026-01-22-core/`;
  `docs/operations/plans/` folded into `docs/superpowers/plans/`; `docs/historical/README.md`
  deleted; `docs/README.md` reduced to a folder map; `docs/projects/{web-app,discord-worker}/deployment.md`
  folded into their overviews; `docs/projects/core/publishing.md` reduced to build notes plus a
  pointer; index pages added for `audits/`, `research/`, `superpowers/`, `architecture/`,
  `operations/`, `reference/`; READMEs added to two research directories; a `**Status:**` line on
  every plan.
- **Versions single-sourced** — only the root `README.md` and `docs/versions.md` carry version
  tables; `docs/versions.md` gained 75 missing history rows and a current compatibility matrix.
- **Two CI gates** — `scripts/check-doc-versions.ts` and `scripts/check-doc-links.ts`, each with
  a `node:test` suite in `pnpm test:scripts`, both wired into `ci.yml` after the dead-code gate.
- **Changelog hygiene** — compare-link footers to non-existent tags removed from four files, the
  og-worker "Planned" block removed, the root 2.0.0 entry re-dated to the merge, layman's gaps
  filled (see sweep E).

## Remediation record

The fix agents' reports — what was applied, what was skipped and why — are summarised in
[remediation.md](remediation.md).

## Lessons

- **A doc beside the code drifts less than a doc about the code.** Package READMEs and CLAUDE.md
  files were nearly right; `docs/projects/` mirrors of them were the worst pages in the repo.
  When a `docs/projects` page and a workspace's own CLAUDE.md disagree, the CLAUDE.md is the one
  to copy from.
- **Hand-copied numbers always drift; gate them or delete them.** Version tables, endpoint
  counts, test-file counts, key counts and rate-limit tiers were wrong wherever they were copied.
  The two gates cover versions and links; counts should be avoided in prose.
- **"Not yet" statements need an owner.** Every "pending / not yet merged / known issue" sentence
  found was stale. A status line on a spec or plan is cheap to update in the PR that ships it.
- **Frozen tiers must be named.** Archive links were never going to be maintained; the split
  between living and frozen folders is now written down in `docs/README.md`, `docs/CLAUDE.md`
  and the root `CLAUDE.md`, and the link gate follows it.
