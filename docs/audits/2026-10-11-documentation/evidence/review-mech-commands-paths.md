# Review: mechanical sweep - commands and paths (key: mech-commands-paths)

Run 2026-10-11, HEAD 42c35e87 (== served 16a6123f for all app code). Static check only; nothing was run. Scope: 93 living docs in `living-files.txt` (the root `CLAUDE.md` and `README.md` are in that list).

Method: (A) 337 shell commands extracted from fences and inline code (pnpm / npx / npm / wrangler / node / gh / git); each `--filter` name compared to the 17 workspace `name` fields, each `pnpm ... run <script>` to that workspace's `scripts` (root `package.json` for bare commands), each `--env` value to the `[env.*]` blocks of the worker's `wrangler.toml`, each file argument to `git ls-files`. (B) 1,093 backticked or linked paths resolved from the repo root, the doc's directory, or (for `docs/projects/<unit>/`) the unit root with and without `src/`; 22 `file:line` references checked for range and content; 49 `#anchor` links checked against GitHub slugs (the gate does not do this); bare file names ending in .ts/.yml/.py etc. checked against `git ls-files` basenames; localhost ports compared to `[dev]` blocks.

Result: commands and paths are in very good shape. All `--filter` names (except valid turbo git-range syntax) and all `run <script>` pairs resolve; all `--env production` uses are on workers that have `[env.production]` (oauth correctly shown bare, `--env development` correct); 0 broken anchors; 8 candidates, one MEDIUM and seven LOW.

## Candidates

### cand-mech-commands-paths-01 (MEDIUM) - local-setup.md test example names a path that does not exist
- Doc: `docs/developer-guides/local-setup.md:73` `pnpm --filter @xivdyetools/core exec vitest run src/services/DyeService.test.ts`
- Truth: the file is `packages/core/src/services/__tests__/DyeService.test.ts`. vitest filters by substring, and `src/services/DyeService.test.ts` is not a substring of that path, so the command finds no test files and exits 1. (`maintainer/adding-dyes.md:341`, `src/config/__tests__/dye-vocabulary.test.ts`, is correct. The generic `src/path/to/file.test.ts` placeholders elsewhere are fine.)
- Evidence: `git ls-files packages/core | grep DyeService.test` returns only `packages/core/src/services/__tests__/DyeService.test.ts`.
- Fix: `pnpm --filter @xivdyetools/core exec vitest run src/services/__tests__/DyeService.test.ts` (add `--coverage.enabled=false` per the root CLAUDE.md note if desired).

### cand-mech-commands-paths-02 (LOW) - DOMAIN_DEPRECATION.md file:line references have drifted
- Docs: `docs/operations/DOMAIN_DEPRECATION.md:52` and `:197` (`apps/presets-api/wrangler.toml:64`), `:147` (`discord.ts:134`), `:175` (`apps/oauth/wrangler.toml:17, 50`), `:195` (`apps/oauth/src/constants/oauth.ts:17`).
- Truth: `ADDITIONAL_CORS_ORIGINS` is at `apps/presets-api/wrangler.toml:76` (production env only) and its value is `https://xiv-colorexplorer.pages.dev,https://beta.xivdyetools.app` - the projectgalatine entry is already gone, yet the Allowlists table row at :52 is not struck through and says "retire only the ... entry" (the header Status says it shipped in presets-api 2.4.0). `Invalid signature` is `packages/auth/src/discord.ts:152` (134 is `reader.releaseLock()`). `DISCORD_CLIENT_ID` in oauth is at `apps/oauth/wrangler.toml:19` and `:61`. `ALLOWED_REDIRECT_ORIGINS` starts at `oauth.ts:14`; line 17 is a comment about the beta app. `Missing signature headers` `discord.ts:95`, `_middleware.ts:17`, `product-links.ts:34`, `photon.ts:55` are correct.
- Evidence: `grep -n ADDITIONAL_CORS_ORIGINS apps/presets-api/wrangler.toml` -> 76 only; `grep -n "Invalid signature" packages/auth/src/discord.ts` -> 152; `grep -n DISCORD_CLIENT_ID apps/oauth/wrangler.toml` -> 19, 61.
- Fix: strike the :52 row like its siblings (done in 2.4.0) and update the other line numbers, or drop line numbers in favor of symbol names.

### cand-mech-commands-paths-03 (LOW) - deployment.md cites the wrong workflow lines
- Doc: `docs/developer-guides/deployment.md:116` "`deploy-discord-worker.yml:81-83`, `deploy-moderation-worker.yml:74-76`" for the "Register Discord commands" step.
- Truth: in `deploy-discord-worker.yml` the step is lines 90-92 (`name:` 90, `working-directory: apps/discord-worker` 91, `run: pnpm run register-commands` 92); in `deploy-moderation-worker.yml` it is 83-85. Lines 81-83 / 74-76 are the preceding Deploy step. The claim itself (both workflows register after deploy) is correct.
- Fix: `deploy-discord-worker.yml:90-92`, `deploy-moderation-worker.yml:83-85`.

### cand-mech-commands-paths-04 (LOW) - `pnpm --filter <app> deploy` runs pnpm's built-in, not the script
- Doc: `docs/operations/DEPLOY_ENVIRONMENTS.md:27` "Bare `pnpm --filter xivdyetools-og-worker deploy` therefore publishes to real, public hostnames".
- Truth: `deploy` is a pnpm built-in command (copies a package to a target dir) that shadows a package script of the same name; the script needs `pnpm ... run deploy`. `apps/og-worker/package.json` defines `"deploy"`, and every other doc writes `run deploy` (e.g. `DEPLOY_ENVIRONMENTS.md:132`, `:296`). As written the command errors rather than deploying; the sentence is explanatory, so the risk is copy-paste confusion only. (Line 171 `pnpm deploy` quotes the old wrong doc text and is fine.) Not run here; verifier should confirm built-in precedence on pnpm 11.
- Fix: `pnpm --filter xivdyetools-og-worker run deploy`.

### cand-mech-commands-paths-05 (LOW) - oauth overview deploys with `npm run deploy`
- Doc: `docs/projects/oauth/overview.md:32` `npm run deploy` (following a pnpm `--filter` dev command, no `cd`).
- Truth: every other doc uses `pnpm --filter xivdyetools-oauth-worker run deploy` (`developer-guides/deployment.md:91`); `developer-guides/index.md:40` and `monorepo-setup.md:72` tell readers never to run npm in the workspace. Run from the root, `npm run deploy` has no script to run; run in `apps/oauth` it is a production deploy (`apps/oauth/package.json:10-11`, both scripts are `wrangler deploy`, no `[env.production]`).
- Fix: `pnpm --filter xivdyetools-oauth-worker run deploy`.

### cand-mech-commands-paths-06 (LOW) - `run lint:fix` offered for any `<project>`
- Doc: `docs/developer-guides/contributing.md:65` `pnpm --filter <project> run lint:fix`.
- Truth: only `@xivdyetools/core` and `xivdyetools-web-app` define `lint:fix` (workspace `package.json` scripts; the other 15 workspaces do not), so for most `<project>` values pnpm reports a missing script.
- Fix: name the two workspaces that have it, or say "where the workspace defines `lint:fix`".

### cand-mech-commands-paths-07 (LOW) - runbook sends the reader to a directory that does not exist
- Doc: `docs/operations/SECRET_ROTATION.md:170` "Write the incident up in `docs/incidents/`".
- Truth: no tracked `docs/incidents/` (docs/ contains architecture, audits, developer-guides, historical, maintainer, operations, projects, reference, research, specifications, superpowers, user-guides). contributing.md's tier table does not list it either. review-operations.md may also file this; the coordinator should merge.
- Fix: point at an existing home (for example `docs/audits/` or `docs/operations/`) or create and document the folder.

### cand-mech-commands-paths-08 (LOW) - implemented specs list file paths that no longer exist, without the pre-monorepo caveat
- Docs: `docs/specifications/community-presets.md:1331-1356` and `:1296` (`xivdyetools-worker/`, `xivdyetools-discord-bot/`, `xivdyetools-web-app/`, `xivdyetools-core/` trees, `preset-api-service.ts`); `docs/specifications/multi-color-extraction.md:199-200,253,293-295` ("Create `src/renderers/palette-grid.ts`", `palette-extraction-service.ts`, `palette-results.ts`); `docs/specifications/preset-palettes.md:350-353,416` (`src/renderers/preset-swatch.ts`, `preset-browser.ts`, `preset-detail-modal.ts`, `app-layout.ts`); `docs/specifications/collections.md:274` (`dye-card.ts`).
- Truth: the renderers now live in `packages/svg/src/palette-grid.ts` and `packages/svg/src/preset-swatch.ts`; the standalone repos were folded into `apps/*`. `feature-roadmap.md:9-13` carries an explicit "paths are pre-monorepo" note; these four specs do not. They are Status "Implemented" implementation records in the living tier.
- Fix: add the same one-line caveat (or "paths as of the original implementation") to each spec header, or update the renderer paths to `packages/svg/src/`. Low value; the verifier may prefer to downgrade to a note.

## Positive controls
- `docs:check-links` covers file targets; this sweep adds 49 `#anchor` links across the living tier, all resolving.
- Every `pnpm --filter <name>` in the 93 docs names a real workspace; `oauth` is consistently `xivdyetools-oauth-worker` with the directory-name caveat (`local-setup.md:97`).
- presets-api scripts the docs cite (`db:migrate`, `db:migrate:local`, `db:migrate:indexes`, `db:seed`) exist; `db:migrate:indexes` -> `migrations/002_add_composite_indexes.sql` (`apps/presets-api/package.json:14`); `db:seed` really only prints SQL (`scripts/migrate-presets.ts` usage header), as `database.md:226` says. `migrations/0014_add_content_revision.sql` exists (security-remediation-2026-09-15.md:19, resolved against the package dir because `exec` runs there).
- `--env production` appears only for discord/moderation/presets-api/api-worker/og-worker/image-worker (all have `[env.production]`); oauth is shown bare and `--env development` -> `xivdyetools-oauth-dev` (`apps/oauth/wrangler.toml:59-60`). `--binding KV` exists in discord-worker (`wrangler.toml:22`, `:150`); presets-api D1 binding `DB` and database `xivdyetools-presets` match `wrangler.toml:23-24`.
- Dev ports 8787 / 8788 / 8790 / 5173 match `[dev]` blocks and `vite.config.ts:54`. `register-commands` runs with `working-directory` in both workflows (`deploy-discord-worker.yml:91`, `deploy-moderation-worker.yml:84`).
- Retired-app mentions (`apps/maintainer`, `apps/universalis-proxy`, `apps/api-docs`, `apps/web-app/netlify.toml`, `docs/brainstorming/`, `docs/operations/plans/`, `scripts/migrate-dyes-to-stainids.ts`, `services/user-storage.ts`) are all worded as removed.

## Rejected suspicions
- `monorepo-setup.md:124` `--filter='...[HEAD^]'`: valid turbo git-range filter, not a workspace name.
- `DEPLOY_ENVIRONMENTS.md:171` `pnpm deploy` and `IMAGE_WORKER_SPLIT.md:161` `pnpm deploy:production`: the first quotes the old incorrect doc text; the second is a one-time step in a design record whose Status is "implemented"; colon-named scripts are not pnpm built-ins.
- `environment-variables.md:284` `pnpm build:docs`: in the api-worker section where the cwd is the app; `projects/api-worker/overview.md:33` gives the `--filter` form. Ambiguous, not wrong.
- `IMAGE_WORKER_SPLIT.md:71-87` photon.ts / services/image/ and `:80` `extractor.ts:464`: describe the pre-split tree in a doc whose Status calls it the design record.
- `feature-roadmap.md` `xivdyetools-*` paths: the doc says up front they are pre-monorepo (lines 9-13).
- `versions.md` missing paths (`glamour/default.png`, `integration/setup.ts`, `auth/signature.ts`, `scripts/test-font-rendering.ts`, `e2e/...`): past-release history rows, allowed.
- `web-app/components.md:74`, `tools.md:27,52`, `overview.md:33,175`, `architecture/overview.md:174,205`, `index.md:211,279`, `adding-dyes.md:247` file names (`color-picker-display.ts`, `auth-button.ts`, `service-worker.js`, `colors_xiv.json`, `spectral.js`): each is worded as removed, renamed or never shipped.
- `contributing.md:166-168` `docs/brainstorming/`, `docs/operations/plans/`: stated as no longer existing.
- `DOMAIN_DEPRECATION.md:41-45,51` struck-through wrangler/oauth line refs: deliberately struck through.
- `docs/projects/discord-worker/overview.md:95` `utils/verify.ts`: stated as absent (moderation-worker has its own).
- Path-resolution false positives: `application/json`, `apps/web-app/src/...` ellipsis placeholders, `docs/.vitepress/dist` (build output), `scripts/.font-sources/` (git-ignored by `apps/discord-worker/.gitignore:1` and og-worker).
- Standing rejections not re-filed: Grey/Analogue/centre de donnees rows, api-contracts.md DB-seed "colours", tools.md "Colour wheels" heading.

## Spelling (this lens)
Spelling is owned by the american-spelling.mjs pipeline (438 candidates, 56 files). In the lines I read for path checking I confirmed 6 British spellings in prose; I did not do a full spelling pass.

| document | confirmed in this lens | words |
|---|---|---|
| docs/projects/discord-worker/commands.md | 1 | favourites (:380) |
| docs/projects/web-app/tools.md | 4 | colours, labelled x2, colour (:52) |
| docs/operations/IMAGE_WORKER_SPLIT.md | 1 | behaviour (:5) |

## Coverage

| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| docs/CLAUDE.md | living | root | 24 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/README.md | living | root | 2 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/api-contracts.md | living | architecture | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/data-flow.md | living | architecture | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/dependency-graph.md | living | architecture | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/index.md | living | architecture | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/overview.md | living | architecture | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/security-trade-offs.md | living | architecture | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/architecture/service-bindings.md | living | architecture | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/contributing.md | living | developer-guides | 11 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - lint:fix scope (cand-06) |
| docs/developer-guides/deployment.md | living | developer-guides | 13 cmds, 2 file:line refs, all backticked/linked paths + anchors | reviewed - stale workflow line refs (cand-03) |
| docs/developer-guides/environment-variables.md | living | developer-guides | 21 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/index.md | living | developer-guides | 26 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/local-setup.md | living | developer-guides | 24 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - wrong test path (cand-01) |
| docs/developer-guides/logging-standards.md | living | developer-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/monorepo-setup.md | living | developer-guides | 10 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/release-process.md | living | developer-guides | 10 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/testing.md | living | developer-guides | 10 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/developer-guides/troubleshooting.md | living | developer-guides | 5 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/index.md | living | root | 2 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/maintainer/adding-dyes.md | living | maintainer | 12 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/maintainer/dye-maintainer-tool.md | living | maintainer | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/maintainer/index.md | living | maintainer | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/ANALYTICS_QUERIES.md | living | operations | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/DEPLOY_ENVIRONMENTS.md | living | operations | 16 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - pnpm deploy builtin collision (cand-04) |
| docs/operations/DOMAIN_DEPRECATION.md | living | operations | 5 cmds, 17 file:line refs, all backticked/linked paths + anchors | reviewed - stale line refs (cand-02) |
| docs/operations/IMAGE_WORKER_SPLIT.md | living | operations | 6 cmds, 3 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/MODERATION.md | living | operations | 3 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/OPEN_ITEMS.md | living | operations | 20 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/SECRET_ROTATION.md | living | operations | 17 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - docs/incidents/ missing (cand-07) |
| docs/operations/index.md | living | operations | 5 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/operations/security-remediation-2026-09-15.md | living | operations | 4 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/api-worker/endpoints.md | living | api-worker | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/api-worker/overview.md | living | api-worker | 9 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/core/algorithms.md | living | core | 2 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/core/overview.md | living | core | 2 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/core/publishing.md | living | core | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/core/services.md | living | core | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/core/types.md | living | core | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/discord-worker/commands.md | living | discord-worker | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/discord-worker/interactions.md | living | discord-worker | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/discord-worker/overview.md | living | discord-worker | 6 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/discord-worker/rendering.md | living | discord-worker | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/index.md | living | index.md | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/logger/overview.md | living | logger | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/moderation-worker/overview.md | living | moderation-worker | 9 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/oauth/endpoints.md | living | oauth | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/oauth/jwt.md | living | oauth | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/oauth/overview.md | living | oauth | 7 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - npm run deploy (cand-05) |
| docs/projects/oauth/pkce-flow.md | living | oauth | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/og-worker/overview.md | living | og-worker | 5 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/presets-api/database.md | living | presets-api | 6 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/presets-api/endpoints.md | living | presets-api | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/presets-api/moderation.md | living | presets-api | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/presets-api/overview.md | living | presets-api | 14 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/presets-api/rate-limiting.md | living | presets-api | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/test-utils/overview.md | living | test-utils | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/types/overview.md | living | types | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/universalis-proxy/overview.md | living | universalis-proxy | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/web-app/components.md | living | web-app | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/web-app/overview.md | living | web-app | 10 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/web-app/theming.md | living | web-app | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/projects/web-app/tools.md | living | web-app | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/reference/ffxiv-terminology.md | living | reference | 1 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/reference/glossary.md | living | reference | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/reference/index.md | living | reference | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/specifications/budget-aware-suggestions.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/specifications/collections.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/specifications/community-presets.md | living | specifications | 4 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - pre-monorepo paths (cand-08) |
| docs/specifications/feature-roadmap.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - pre-monorepo paths, flagged by doc itself (rejected) |
| docs/specifications/index.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/specifications/multi-color-extraction.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - obsolete src/renderers path (cand-08) |
| docs/specifications/preset-palettes.md | living | specifications | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed - obsolete src/renderers path (cand-08) |
| docs/user-guides/discord-bot/command-reference.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/discord-bot/faq.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/discord-bot/favorites-collections.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/discord-bot/getting-started.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/index.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/public-api.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/accessibility.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/budget-suggestions.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/color-harmony.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/community-presets.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/dye-comparison.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/dye-mixer.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/faq.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/favorites-collections.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/getting-started.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/glamour-reader.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/gradient-builder.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/palette-extractor.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/user-guides/web-app/swatch-matcher.md | living | user-guides | 0 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
| docs/versions.md | living | root | 7 cmds, 0 file:line refs, all backticked/linked paths + anchors | reviewed |
