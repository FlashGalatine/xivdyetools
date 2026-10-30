# External consumers of the planned M removals — October 2026

**PREPARATION ONLY — production activation is on hold.** This document authorizes no merge, package publication, remote database access, hosted request, deployment, workflow dispatch, command registration or announcement.

Reference tree: branch `codex/release-cut-f-03-readiness-20261030` at `2ac97b6fb37c12640a70af0aebac42d4086912e0`, evidence gathered 2026-10-30; line citations are to that tree unless a row says otherwise. The reference tree already carries the conditional M source (core 6.0.0, bot-logic 5.0.0), so the line numbers of the *removed* names are cited on the pre-removal base branches `codex/release-cut-03-core-20261029` and `codex/release-cut-06-bot-logic-20261029` (read with `git show <branch>:<path>`). See the [October 2026 A/R/H release and adoption runbook](REMEDIATION_RELEASE_2026_10.md), the [M runbook](REMEDIATION_M_RELEASE_2026_10.md) and the [deprecation register](../../DEPRECATIONS.md).

This is a read-only record. No person or project was contacted; no issue, comment or post was made. Raw outputs were not retained; every query is listed in section 2 for re-running. The individual third-party repositories behind the aggregate counts are kept in private operator evidence (a private appendix to this document); they are deliberately not named here.

## 1. Removal list

Sources: `packages/core/CHANGELOG.md:14-28` (6.0.0), `:30-44` (5.16.0, Deprecated at `:37`); `packages/bot-logic/CHANGELOG.md:8-20` (5.0.0), `:61-65` (4.12.0 Deprecated); `DEPRECATIONS.md:392-456`. The code was confirmed with `git diff codex/release-cut-03-core-20261029 codex/release-cut-m-01-core-20261029` and `git diff codex/release-cut-06-bot-logic-20261029 codex/release-cut-m-03-bot-20261029`.

### Core 6.0.0 (branch m-01 versus 03)

| Removed name | Kind | Module (on 03) | Root export (on 03) | Deprecation guidance (JSDoc on 03) |
|---|---|---|---|---|
| `parseCharaFile(text)` | function | `packages/core/src/services/chara/chara-parser.ts:427` | `packages/core/src/index.ts:184` | Use `inspectCharaForTools` and `resolveCharaForTools` (or `resolveCharaWithProvider`) for bounded import; planned removal in core 6 (`chara-parser.ts:425`) |
| `resolveCharaColors(parsed, ...)` | async function | `chara-resolver.ts:256` (same directory) | `index.ts:202` | Same facade; planned removal in core 6 (`chara-resolver.ts:254`) |
| `OFF_GRID_DELTA_E2000` (= 6) | const | `chara-resolver.ts:50` | `index.ts:203` | Legacy resolver threshold; planned removal in core 6 (`chara-resolver.ts:48`) |
| `ParsedCharaFile` | interface | `chara-parser.ts:109` | `index.ts:188` (type) | Same facade; planned removal in core 6 (`chara-parser.ts:107`) |
| `CharaColorSlotRaw` | interface | `chara-parser.ts:78` | `index.ts:190` | Legacy parser output; planned removal in core 6 (`chara-parser.ts:76`) |
| `CharaGearDye` | interface | `chara-parser.ts:97` | `index.ts:192` | Same text (`chara-parser.ts:95`) |

Retained: `MAX_CHARA_FILE_BYTES`, `CharaSlotId`, `ResolvedCharaCharacter`, `ResolvedCharaSlot` and the other live chara types. The `@internal` tag removal on five utility helpers affects declaration emit only, not exports.

Subpaths: `packages/core/package.json` "exports" lists `.`, `./blending`, `./chara` and `./package.json` (`git show 2ac97b6f:packages/core/package.json`, lines 8-20 for the first three); the 03-to-m-01 diff of that file changes only `version` 5.16.0 to 6.0.0. No subpath is removed. `./chara` (`packages/core/src/chara.ts:16`) never exported the legacy parser or resolver; it exports `inspectCharaForTools` and `resolveCharaWithProvider`.

### Bot Logic 5.0.0 (branch m-03 versus 06)

| Removed name | Kind | Location (on 06) | Deprecation guidance |
|---|---|---|---|
| `SwatchResult.character` (required field on both `ok: true` returns of `executeSwatch`) | result field | `packages/bot-logic/src/commands/swatch.ts:115` (type), `:549` (return); the m-03 diff removes `character` from two `return { ok: true, svgString, embed, character }` statements | `@deprecated Since 4.12.0. Use svgString/embed for presentation. Planned removal in bot-logic 5.0.0 ...` (`swatch.ts:113`, `packages/bot-logic/CHANGELOG.md:63-65`) |
| `SwatchCharacter` (= `Omit<ResolvedCharaCharacter, 'nickname'>`) | exported type | `swatch.ts:104`; root export `packages/bot-logic/src/index.ts:130` | Same (`swatch.ts:102`) |
| internal back-mapping (`toSwatchCharacter` and helpers) | not exported | `swatch.ts:374` | Internal; listed for completeness |

Unchanged in 5.0.0 (`packages/bot-logic/CHANGELOG.md:15-16`): `fileText`/`fileBytes`, the error unions, `NO_INPUT` and `familySize`. `SwatchResult` and `SwatchSlotOption` stay exported. The m-03 diff of `packages/bot-logic/package.json` changes only `version` 4.12.0 to 5.0.0.

Gate text: `DEPRECATIONS.md:453` reads "Recheck external npm consumer usage; cancel removal if an active consumer still needs the field." It is unchecked at the reference tree.

State fact (section 2, query 1): the deprecation minors core 5.16.0 and bot-logic 4.12.0 are NOT on the npm registry yet (`latest` is core 5.15.0 and bot-logic 4.11.0, re-checked 2026-10-30 13:17Z). No external user has yet seen a `@deprecated` tag for these symbols.

## 2. Method and queries

All times are UTC on 2026-10-30. Queries 1-15 were first run 12:58-13:06; the items marked "re-run" were repeated 13:16-13:18.

| # | Query / URL | Time | Result |
|---|---|---|---|
| 1 | `npm view @xivdyetools/{types,logger,auth,worker-kit,core,svg,bot-logic} --json`; registry packuments `https://registry.npmjs.org/@xivdyetools%2F<pkg>` (re-run 13:17) | 12:58:57 | All 7 exist. `latest` (versions): types 3.3.0 (22), logger 2.3.0 (17), auth 2.0.2 (12), worker-kit 1.5.0 (7), core 5.15.0 (49), svg 4.4.0 (15), bot-logic 4.11.0 (17). Single maintainer account (the project owner). core last modified 2026-10-26T21:15Z, bot-logic 2026-10-26T21:13Z |
| 2 | `https://registry.npmjs.org/-/v1/search?text=scope:xivdyetools&size=100` | 12:59:25 | total 0 (scope qualifier unsupported) |
| 3 | `.../-/v1/search?text=xivdyetools&size=100` | 12:59:25 | total 8: the 7 packages plus `@xivdyetools/test-utils` 1.1.8 (last modified 2026-07-19; `packages/test-utils/package.json:4` says `"private": true`, yet 13 versions (1.0.0-1.1.8) are on the registry). No third-party package |
| 4 | npm search `xiv dye`, `ffxiv dye`, `xivdye`, `xivcharakit` | 12:59:25 | 247 / 123 / 0 / 1 hits. Only `@xivdyetools/*` plus unrelated packages. `xivcharakit` 0.1.0-beta.1 belongs to the maintainer; it is a dependency of core (core 5.15.0 depends on `xivcharakit` 0.1.0-beta.4), not a consumer |
| 5 | `https://api.npmjs.org/downloads/point/{last-month,last-week}/@xivdyetools/<pkg>` for 7 packages | 12:59:29 | Section 4 |
| 6 | `https://api.npmjs.org/versions/@xivdyetools%2F{core,bot-logic}/last-week` | 12:59:29 | Per-version counts, section 4 |
| 7 | `https://api.deps.dev/v3alpha/systems/npm/packages/%40xivdyetools%2F<pkg>/versions/<v>:dependents` for core 5.15.0, 5.12.0, 5.10.0, 5.8.0, 4.0.1, 2.0.0; bot-logic 4.11.0, 4.9.0; svg 4.4.0; types 3.3.0; logger 2.3.0; auth 2.0.2; worker-kit 1.5.0 | 12:59:41 | HTTP 200 on all 13; counts only, no names. core 5.15.0: 1; 5.12.0: 1; 5.10.0: 2; 5.8.0: 2; 4.0.1: 2 (re-run 13:16); 2.0.0: 2; bot-logic 4.11.0: 0; 4.9.0: 0; svg 4.4.0: 1; types 3.3.0: 3; logger 2.3.0: 4 (2 direct); auth 2.0.2: 0; worker-kit 1.5.0: 0 |
| 8 | Registry packuments for svg, bot-logic, worker-kit, test-utils, cross-checked against query 7 | 13:00 | The core dependents are explained by the maintainer's own packages: core 5.15.0 from bot-logic 4.11.0; 5.12.0 from bot-logic 4.9.0; 5.10.0 from svg 4.4.0 and bot-logic 4.8.3; 5.8.0 from svg 4.3.0 and bot-logic 4.5.0; 2.0.0 from svg 1.1.2 and bot-logic 1.1.2. For core 4.0.1, deps.dev says 2, which matches the two distinct packages whose versions pin it (svg 2.0.1 and 3.0.0; bot-logic 2.1.0 and 3.0.0; each pin confirmed in the registry at 13:16). deps.dev counts distinct dependent packages, not versions (https://docs.deps.dev/api/v3alpha/, retrieved 2026-10-30 13:16Z). No unexplained dependent |
| 9 | `gh search code <symbol> --limit 100` for `parseCharaFile`, `resolveCharaColors`, `OFF_GRID_DELTA_E2000`, `ParsedCharaFile`, `CharaColorSlotRaw`, `CharaGearDye`, `SwatchCharacter` | 13:00:25-13:01:12 | Totals 39 / 29 / 13 / 16 / 10 / 9 / 27; excluding the monorepo: 1 / 3 / 0 / 1 / 0 / 0 / 9 (section 3) |
| 10 | `gh search code '"@xivdyetools/core"'` (also with `--filename package.json`), and the same for bot-logic, svg, types, logger, auth, worker-kit | 13:01:39-13:02:41 | Non-monorepo hits only in the maintainer's docs repository (7 for core); the `package.json` filter gives 0 external hits for all seven |
| 11 | `gh search code` for `from "@xivdyetools/core"`, the single-quote form, bot-logic variants and `xivdyetools/core` (TypeScript) | 13:02:58-13:03:37 | Capped at 100 results and dominated by the monorepo; non-monorepo hits only in the maintainer's docs repository (8). The cap means this query alone cannot prove absence |
| 12 | GitHub REST `search/code` excluding `-repo:FlashGalatine/xivdyetools`: `"@xivdyetools/core"`, `bot-logic`, `svg`, `types`, `logger`, `auth`, `worker-kit`, `parseCharaFile`, and `xivdyetools filename:package.json -user:FlashGalatine` | 13:04:55-13:06:05; core pair re-run 13:16 | `incomplete_results=false` throughout. core: 59 excluding the monorepo (maintainer's docs repository plus XIVCharaKit); 3 when the docs repository is also excluded (all XIVCharaKit documents: `migration.md`, `docs/plans/2026-10-19-chara-library-mvp.md`, `docs/superpowers/plans/2026-10-22-xivdyetools-integration.md`). bot-logic 2 and svg 3 (docs repository); types 30 and logger 26 (docs repository); auth 8 (7 docs repository, 1 unrelated); worker-kit 0; `parseCharaFile` 1 (XIVCharaKit); `package.json` outside the owner 0 |
| 13 | `gh search repos` xivdyetools / xivdyetools-core / "xivdyetools bot-logic" / "xiv dye tools" | 13:03:44-13:03:59 | 19 / 2 / 0 / 6 repositories, all owned by the maintainer, none a fork (legacy split repositories last pushed February 2026, plus the monorepo) |
| 14 | `gh api repos/FlashGalatine/xivdyetools` and `.../forks` | 13:04 | `forks_count` 0, 1 star, public, pushed 2026-10-30T12:22Z |
| 15 | `git grep` in the reference tree for "external consumer", "known consumer" and "supported" over `docs/`, `apps/api-worker/docs`, package READMEs and CLAUDE files, `DEPRECATIONS.md` | 13:06 | Generic, hypothetical mentions only: `DEPRECATIONS.md:453` (the open recheck gate), `packages/core/README.md:471`, `docs/developer-guides/troubleshooting.md:72`, `docs/research/monorepo-consolidation/02-tool-selection.md:15`, `docs/architecture/security-trade-offs.md:160`, `docs/audits/2026-01-25/findings/FINDING-001-exposed-npm-token.md:36`. None names a consumer or promises support to one |
| 16 | `git grep '"@xivdyetools/core"\|"@xivdyetools/bot-logic"' -- apps/*/package.json packages/*/package.json` (re-run, new) | 13:17 | Every in-repo dependency on core or bot-logic is `workspace:*` (apps: api-worker, discord-worker, moderation-worker, og-worker, stoat-worker, web-app; packages: bot-logic, svg). No app is pinned to a published version |
| 17 | `gh search code` for the three legacy parser names with `user:<owner>` excluding the monorepo and XIVCharaKit (re-run, new) | 13:17 | 0 results across the maintainer's other repositories, including the legacy split repositories and the maintainer tooling repository |

## 3. Findings

| Consumer | How found | Versions / ranges | Removed API used? | Evidence |
|---|---|---|---|---|
| The monorepo itself (web-app, discord-worker, stoat-worker and the others) | origin | `workspace:*` (query 16) | In-repo only; out of scope | `apps/*/package.json` |
| `@xivdyetools/svg` and `@xivdyetools/bot-logic` (published) | deps.dev counts and registry dependencies (queries 7-8) | svg 1.1.2-4.4.0, bot-logic 1.1.2-4.11.0, each pinning one exact core version (bot-logic 4.11.0 to core 5.15.0) | Maintainer-owned. Versions before 4.11.0 used the legacy parser/resolver; 4.11.0 reads through core 5.15.0's `xivcharakit` facade (`packages/bot-logic/CHANGELOG.md:79`). Because each release pins an exact core, published pairs are unaffected | Registry packuments |
| Maintainer's XIVCharaKit repository (public, not a fork, pushed 2026-10-27) | code search (queries 9, 12) | Not a dependency: its `package.json` at commit `bf6009fb` has no `@xivdyetools` entry (re-checked 13:16); `migration.md:43` says "Do not create a dependency cycle through `@xivdyetools/core`" and XIVCharaKit is itself a dependency of core | NO import. Planning documents only name the symbols: `docs/superpowers/plans/2026-10-22-xivdyetools-integration.md` line 57 ("Preserve published `parseCharaFile`, `resolveCharaColors`, `ParsedCharaFile`, ... during this additive migration"; "removing or changing legacy APIs requires a separate semver decision") and line 253 (`SwatchResult` success carries `character: SwatchCharacter`) | https://github.com/FlashGalatine/XIVCharaKit/blob/bf6009fb1ff02eb64b40cdec9e6295ee11da805f/docs/superpowers/plans/2026-10-22-xivdyetools-integration.md#L57 and `#L253`; https://github.com/FlashGalatine/XIVCharaKit/blob/bf6009fb1ff02eb64b40cdec9e6295ee11da805f/migration.md |
| Maintainer's documentation repository (public) | code search (queries 10-12) | Documentation only; mentions package names | No code import | https://github.com/FlashGalatine/xivdyetools-docs |
| Maintainer's tooling repository (public, not a fork, last pushed 2026-02-23) | `gh api .../contents/package.json` | `"@xivdyetools/core": "file:../xivdyetools-core"` (`package.json:16`), a local path to the retired split repository, not the npm package | NO: query 17 finds no occurrence of the legacy parser names in it (index coverage caveat, section 5) | https://github.com/FlashGalatine/xivdyetools-maintainer |
| 8 unrelated public repositories by other owners (name collisions) | symbol search (query 9) and package-name search (query 12) | n/a | NO. Six match `SwatchCharacter` only as substrings of unrelated identifiers in PHP, Prisma, PowerShell, Dart, Java, C# and Markdown files (the code-search text fragments show identifiers such as `colourSwatchCharacter` and `WatchCharacter...`); one defines its own local method `_resolveCharaColors` in two JavaScript files (detail file lines 272, 416, 420 [comment] and 1170; editor file definition at line 790 with calls at 800, 951, 959, 1050); one is a library-survey dataset row listing `@xivdyetools/auth,2.0.2` as data, not an import (auth is not affected by M). None imports any `@xivdyetools` package | Per-repository URLs and commit SHAs are in the private operator appendix |
| Forks or mirrors of the monorepo | `repos/FlashGalatine/xivdyetools/forks` | 0 forks | None | Queries 13-14 |

Net: zero identified external code imports a removed symbol or reads `.character`. Every name-matching hit is a maintainer repository or an unrelated false positive.

## 4. Download-count context

npm point API, windows 2026-09-29 to 2026-10-28 (month) and 2026-10-22 to 2026-10-28 (week), retrieved 2026-10-30 12:59:29Z:

| Package | last-month | last-week |
|---|---|---|
| `@xivdyetools/core` | 1,176 | 329 |
| `@xivdyetools/bot-logic` | 716 | 248 |
| `@xivdyetools/types` | 393 | 47 |
| `@xivdyetools/logger` | 348 | 48 |
| `@xivdyetools/svg` | 311 | 29 |
| `@xivdyetools/worker-kit` | 269 | 29 |
| `@xivdyetools/auth` | 73 | 8 |

Per version, last week: core 5.15.0 178, 5.12.0 71, 5.8.0 26, 1.16.0 16, 5.10.0 13, 2.0.0 8, 4.0.1 8, 5.2.0 6, others 1-2 each. bot-logic 4.11.0 160, 4.9.0 38, older versions 1-5 each.

Interpretation (not provable from these data): the counts are download requests, not distinct users. They include CI installs of the monorepo and the maintainer's pipelines, registry mirrors, security scanners and bots. The single-digit tail on every old version (including bot-logic 1.1.0-4.5.0) is typical of mirror and scanner behavior, and the spikes on the newest versions (core 5.15.0, bot-logic 4.11.0, published 2026-10-26) coincide with the maintainer's own publishing and CI. Whether any download is a distinct real user is UNKNOWN. Downloads of any core version through 5.15.0 (all of which contain the removed symbols) cannot be attributed to symbol use.

## 5. Coverage limits

- Private repositories, private registries and internal mirrors are invisible to every query. A private bot or tool depending on `@xivdyetools/core` or `@xivdyetools/bot-logic` cannot be ruled out.
- GitHub code search indexes a subset of public code (default branch, size limits, no forks unless starred) and caps results at 100 per query. Queries 11-12 returned `incomplete_results=false`, but the index may lag recent commits or omit repositories. The code-search rate limit (about 10 per minute) was respected with pauses.
- Bundled or vendored copies (minified bundles, copied source, committed `node_modules`) would not match package-name searches. Renamed imports or re-exports through another package would not match symbol searches, and `file:`, git or tarball dependencies would not show the scoped name.
- deps.dev `:dependents` returns counts of distinct dependent packages with no names (https://docs.deps.dev/api/v3alpha/, retrieved 13:16Z); it sees only public npm packages it has indexed.
- npm search is keyword-based and the public registry offers no reverse-dependency API, so a package depending on `@xivdyetools/core` without mentioning "xivdyetools" in its own metadata would not be found.
- The legacy split repositories (last pushed 2026-02) predate the chara API, which core introduced in 4.0.0 on 2026-08-16 (`packages/core/CHANGELOG.md:1032-1074`); query 17 also finds no use of the legacy names there.
- Core 5.16.0 and bot-logic 4.12.0 are unpublished (query 1), so no consumer has seen the `@deprecated` guidance. The absence of objections is weaker evidence than it would be after a deprecation window.

### Items previously UNKNOWN that are now settled

- Whether the in-repo apps are pinned to published versions: no, all are `workspace:*` (query 16).
- Whether the maintainer's tooling repository and legacy split repositories use the legacy chara API: no code-search match (query 17), subject to the index caveats above.
- Whether the 9 `SwatchCharacter` hits outside the monorepo are real consumers: 1 is the maintainer's XIVCharaKit plan; the other 8 hits (in 6 repositories) are substring noise (section 3).

### Still UNKNOWN

- Private, bundled or vendored users (not observable with public data).
- Whether any download is a distinct real user (section 4).
- Whether any external project will adopt core 5.16.0 or bot-logic 4.12.0 and be affected after publication (the releases do not exist yet).

## 6. Recommendation

On the evidence retrieved, no removal needs to be revisited now. No public npm dependent, repository, fork or `package.json` outside the maintainer's own repositories imports `parseCharaFile`, `resolveCharaColors`, `OFF_GRID_DELTA_E2000`, `ParsedCharaFile`, `CharaColorSlotRaw`, `CharaGearDye` or `SwatchCharacter`, or reads `SwatchResult.character`. The only external-looking hits are the maintainer's own planning documents and unrelated name collisions, and `@xivdyetools/core/chara` plus the retained live types remain available.

The evidence is nevertheless too weak for a decisive "no consumer" claim: the deprecation releases are not yet published (nobody has been warned), downloads cannot be attributed to real users (core 1,176 and bot-logic 716 in the last month), and private or bundled users are unobservable. Keep the `DEPRECATIONS.md:453` gate unchecked until core 5.16.0 and bot-logic 4.12.0 are published and have been live for the agreed window, then repeat queries 5, 7 and 12 with a new retrieval time. If the removals proceed, the semver MAJOR bump and the migration text already written (`inspectCharaForTools` plus `resolveCharaForTools`, or `@xivdyetools/core/chara` plus `resolveCharaWithProvider`; use `svgString` and `embed` instead of `.character`) are the appropriate protection for unseen users.
