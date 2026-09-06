# Sweep F — docs tree structure, indexes, links

Scope: the skeleton of `docs/` — indexes, reachability, links, placement, duplication — plus the
root and per-workspace README / CLAUDE files. Baseline `1eb57cda`. 1,337 markdown files scanned,
2,134 relative links resolved by script.

## Broken relative links

207 genuine broken links (211 raw minus 4 regex-in-inline-code false positives). **Every one was in
the archived tier** (`docs/audits/**` 190, `docs/brainstorming/**` 16) plus one false positive in a
plan file. The living tier had zero. Dominant cause in the archive: source-code links written at the
wrong relative depth, and links to pre-monorepo paths (`xivdyetools-core/…`,
`packages/worker-middleware/`, `apps/universalis-proxy/`).

Disposition: the archive is left as it is (its links describe the tree as it was);
`docs/brainstorming/` was retired into `docs/historical/` (see below); one leaked absolute local
path in `docs/audits/2026-04-28/bugs/BUG-003.md` was replaced with a description; a link gate
(`scripts/check-doc-links.ts`) now guards the living tier.

## Index gaps and reachability

- 91 living-tier pages, 86 reachable from the five hub files; 5 orphans:
  `architecture/security-trade-offs.md`, `operations/ANALYTICS_QUERIES.md`,
  `operations/plans/2026-08-09-image-worker-split.md`, `maintainer/dye-maintainer-tool.md`,
  `projects/universalis-proxy/overview.md` — all now linked.
- `docs/projects/index.md` did not link `core/publishing.md`, `presets-api/rate-limiting.md`,
  `oauth/endpoints.md` — now linked; the two `deployment.md` pages were folded into their overviews.
- `docs/audits/` had no index; 13 of its 33 dated directories were referenced by nothing; an undated
  2026-01-22 core audit occupied the folder root and its `README.md` slot — moved to
  `docs/audits/2026-01-22-core/`; `docs/audits/index.md` created.
- `docs/research/` had no index and was reachable only through a bare directory link; 3 of its 10
  directories had no `README.md` — index created, READMEs added, `discord-alternatives/00-overview.md`
  renamed to `README.md`.
- `docs/superpowers/` (19 files) was linked from nothing; three spec `Status:` lines were wrong
  (two said "not implemented" for shipped features, one said "awaiting implementation plan" beside
  the plan) and no plan carried a status — `README.md` index created, every plan given a
  `**Status:**` line, the three specs corrected.
- `docs/architecture/`, `docs/operations/`, `docs/reference/` had no index — short ones added.
- `docs/historical/` had two competing indexes; `README.md`'s paths were wrong — deleted.
- `docs/brainstorming/README.md` indexed 7 of 18 files.

## Archival and relocation

| File / folder | Why | Destination |
|---|---|---|
| `docs/brainstorming/` (18 files) | Every file describes shipped or superseded work; 16 of the 17 non-archive broken links | `docs/historical/20260108-Brainstorm/`, `20260115-v4-DiscordBot/`, `20260218-AnalyticsExploration/` |
| `docs/operations/plans/2026-08-09-image-worker-split.md` | Only file in its folder; a shipped plan | `docs/superpowers/plans/` |
| `docs/operations/IMAGE_WORKER_SPLIT.md` header | Said "not yet implemented / blocking" for work shipped 2026-08-11 | Header corrected in place; kept as the design record |
| `docs/projects/{web-app,discord-worker}/deployment.md` | Unlinked, stale version banners, restated the shared deploy guides | Folded into the respective `overview.md` and deleted |
| `docs/projects/core/publishing.md` | Documented a local `npm whoami` / `npm publish` flow the repo forbids | Replaced with core-specific build notes + a pointer to the release process |
| `docs/operations/POST_MERGE_CHECKLIST.md` | 682-line one-off event doc with ~27 open items interleaved | Kept in place (the maintainer is still ticking it); the index wording now says what it is for |

## Duplicate-topic map

| Topic | Canonical | Others |
|---|---|---|
| Deployment | `developer-guides/deployment.md` (how a change reaches prod) + `operations/DEPLOY_ENVIRONMENTS.md` (which environment a bare command hits) | per-app `deployment.md` pages folded into overviews |
| Publishing / release | `developer-guides/release-process.md` | `projects/core/publishing.md` reduced to a pointer; CLAUDE.md blurbs link out |
| Environment variables | `developer-guides/environment-variables.md` | app CLAUDE.md files keep their local list |
| Top-level index | `docs/index.md` | `docs/README.md` reduced to a folder map |
| Historical index | `docs/historical/index.md` | `historical/README.md` deleted |
| Versions | `docs/versions.md` (+ root `README.md`, both CI-gated) | every other table removed |

## Version-table single source

Six hand-maintained surfaces (`versions.md`, `docs/index.md`, `docs/README.md`,
`projects/index.md`, `architecture/overview.md`, root `README.md`) disagreed with `package.json`
and with each other on every row, plus a seventh in `maintainer/index.md` and four per-page banners.
`contributing.md` codified the drift ("duplicated … by design … all of them drift together").
Resolution: two files own versions and a CI gate (`scripts/check-doc-versions.ts`) checks them;
everything else links.

## Conventions

- Naming splits cleanly by folder (`operations/` SCREAMING_CASE, everything else kebab); left alone.
  Index filenames: `index.md` in living folders, `README.md` inside dated snapshots — now ~95% true.
- Front matter: the `Status / Date / Author` template was adopted by ~8% of live pages and the
  project is single-authored. `docs/README.md`'s template now asks for Status and Date only.
- Stale "Last updated" dates: `specifications/feature-roadmap.md` and
  `budget-aware-suggestions.md` said December 2025 with content ~250 days older than their last
  real change — corrected during the sweep-D fixes.

## Not done (deliberately)

- Renaming dated audit / historical directories or `operations/` files.
- Splitting `POST_MERGE_CHECKLIST.md` into open / closed halves.
- A link gate over the archive tier.
