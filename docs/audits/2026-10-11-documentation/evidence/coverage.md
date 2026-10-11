| cluster | file | result | note |
|---|---|---|---|
| web-app-core | docs/projects/web-app/components.md | reviewed | read in full; identifiers, files, modal/service/config/bundle claims checked against src |
| web-app-core | docs/projects/web-app/overview.md | reviewed | read in full; tree, env vars, deploy section checked; v5.0 history bullets treated as history |
| web-app-core | docs/projects/web-app/theming.md | reviewed | read in full; ThemeService API, storage key, tokens, tailwind config checked |
| web-app-core | docs/projects/web-app/tools.md | reviewed | read in full; defaults, share params, routes, keys, Glamour Reader section checked |
| web-app-core | docs/user-guides/web-app/accessibility.md | reviewed | every quoted string matched to en.json accessibility.* |
| web-app-core | docs/user-guides/web-app/community-presets.md | reviewed | labels string-matched to en.json; numeric limits checked in web-app and presets-api; example-link site list not individually re-verified |
| web-app-core | docs/user-guides/web-app/faq.md | reviewed | privacy lines compared with PRIVACY.md |
| web-app-core | docs/user-guides/web-app/favorites-collections.md | reviewed | limits and Advanced Settings strings checked; Manage Collections path flagged |
| web-app-core | docs/user-guides/web-app/getting-started.md | reviewed | labels, shortcuts, drawer, welcome modal, settings checked |
| web-app-tools | docs/user-guides/web-app/budget-suggestions.md | reviewed | vs budget-tool.ts, en.json budget.*, core dye-vocabulary |
| web-app-tools | docs/user-guides/web-app/color-harmony.md | reviewed | vs harmony-tool, config-sidebar, en.json |
| web-app-tools | docs/user-guides/web-app/dye-comparison.md | reviewed | vs comparison-tool, core band-vocabulary, en.json |
| web-app-tools | docs/user-guides/web-app/dye-mixer.md | reviewed | vs mixer-tool, mixer-blending-engine, en.json |
| web-app-tools | docs/user-guides/web-app/glamour-reader.md | reviewed | vs glamour-* components, glamour-list-actions, core chara-twins, api-worker resolver |
| web-app-tools | docs/user-guides/web-app/gradient-builder.md | reviewed | vs gradient-tool, config-sidebar, en.json |
| web-app-tools | docs/user-guides/web-app/palette-extractor.md | reviewed | vs extractor-tool, share-service, constants |
| web-app-tools | docs/user-guides/web-app/swatch-matcher.md | reviewed | vs swatch-tool, chara-file-card, en.json |
| discord-worker | docs/projects/discord-worker/commands.md | reviewed | all 564 lines vs schemas.ts, worker-kit limits, quick-picks |
| discord-worker | docs/projects/discord-worker/interactions.md | reviewed | all lines; routes, caps, helpers, buttons |
| discord-worker | docs/projects/discord-worker/overview.md | reviewed | all lines; wrangler.toml, env, CI |
| discord-worker | docs/projects/discord-worker/rendering.md | reviewed | all lines; fonts.ts, renderer.ts, svg exports |
| discord-worker | docs/user-guides/discord-bot/command-reference.md | reviewed | all lines; /glamour rules vs core and en.json |
| discord-worker | docs/user-guides/discord-bot/faq.md | reviewed | all lines |
| discord-worker | docs/user-guides/discord-bot/favorites-collections.md | reviewed | all lines; defaults and caps verified |
| discord-worker | docs/user-guides/discord-bot/getting-started.md | reviewed | all lines |
| api-worker | docs/projects/api-worker/endpoints.md | reviewed | all 567 lines vs routes, lib, chara, telemetry, universalis, wrangler.toml |
| api-worker | docs/projects/api-worker/overview.md | reviewed | all 183 lines vs wrangler.toml, types.ts, rate-limit.ts, package.json scripts |
| api-worker | docs/projects/universalis-proxy/overview.md | reviewed | 6-line pointer stub; target path exists |
| api-worker | docs/user-guides/public-api.md | reviewed | all 412 lines; examples and anchors checked |
| presets-moderation | docs/projects/moderation-worker/overview.md | reviewed |  |
| presets-moderation | docs/projects/presets-api/database.md | reviewed |  |
| presets-moderation | docs/projects/presets-api/endpoints.md | reviewed |  |
| presets-moderation | docs/projects/presets-api/moderation.md | reviewed |  |
| presets-moderation | docs/projects/presets-api/overview.md | reviewed |  |
| presets-moderation | docs/projects/presets-api/rate-limiting.md | reviewed |  |
| oauth-og | docs/projects/oauth/overview.md | reviewed |  |
| oauth-og | docs/projects/oauth/endpoints.md | reviewed |  |
| oauth-og | docs/projects/oauth/jwt.md | reviewed | startLogin and verifyJWT consumer snippets are illustrative, not checked as importable code |
| oauth-og | docs/projects/oauth/pkce-flow.md | reviewed |  |
| oauth-og | docs/projects/og-worker/overview.md | reviewed |  |
| packages | docs/projects/core/algorithms.md | reviewed | all 499 lines; bands, wheels, matrices, buckets, K-means, LRU checked vs source |
| packages | docs/projects/core/overview.md | reviewed | all 343 lines; delta E 9.57 example output not executed (types dist unbuilt) |
| packages | docs/projects/core/publishing.md | reviewed | build order, scripts and source files verified; no defects |
| packages | docs/projects/core/services.md | reviewed | all 294 lines vs index.ts and service sources |
| packages | docs/projects/core/types.md | reviewed | ownership table matches both barrels; spelling only |
| packages | docs/projects/logger/overview.md | reviewed | factories, subpaths, config, redaction counts match; 2.3.0 content correct |
| packages | docs/projects/test-utils/overview.md | reviewed | 3.0.0 removals correctly documented; only the id helpers are missing |
| packages | docs/projects/types/overview.md | reviewed | shapes match; import style and omissions filed |
| packages | docs/projects/index.md | reviewed | counts, routes and link targets verified; spelling only |
| architecture | docs/architecture/api-contracts.md | reviewed | All sections checked against presets-api/oauth/discord-worker source; cand-02, 08, 11 and spelling |
| architecture | docs/architecture/data-flow.md | reviewed | All 7 flows; cand-04 and spelling; TTLs, vote batch, OAuth redirect steps verified |
| architecture | docs/architecture/dependency-graph.md | reviewed | Edges and matrices verified against all package.json; cand-05, 06, spelling |
| architecture | docs/architecture/index.md | reviewed | 17 projects = 8 packages + 9 apps, correct; no defects |
| architecture | docs/architecture/overview.md | reviewed | Diagram, tool list, 18-command roster, api-worker routes, binding map; cand-01, 07, 09, spelling |
| architecture | docs/architecture/security-trade-offs.md | reviewed | cand-03; JWT/timing/moderation sections match source; anchors resolve |
| architecture | docs/architecture/service-bindings.md | reviewed | Binding names, ids, limits and Env interfaces match wrangler.toml/types; cand-07, 09, spelling |
| devguides-maintainer | docs/developer-guides/contributing.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/deployment.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/environment-variables.md | reviewed | rate-limit ids, VITE_* keys, secrets verified; stoat and moderation lists spot-checked |
| devguides-maintainer | docs/developer-guides/index.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/local-setup.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/logging-standards.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/monorepo-setup.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/release-process.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/testing.md | reviewed |  |
| devguides-maintainer | docs/developer-guides/troubleshooting.md | reviewed |  |
| devguides-maintainer | docs/maintainer/adding-dyes.md | reviewed |  |
| devguides-maintainer | docs/maintainer/dye-maintainer-tool.md | reviewed |  |
| devguides-maintainer | docs/maintainer/index.md | reviewed | architecture rationale and known-issues prose not source-verifiable |
| operations | docs/operations/ANALYTICS_QUERIES.md | reviewed | Column layouts, events, outcome classes, DRAIN_DEADLINE_MS, both anchors and the origin.ts reference verified; only a spelling hit. |
| operations | docs/operations/DEPLOY_ENVIRONMENTS.md | reviewed | Checked against all seven wrangler.toml files, the beta/prod workflows and oauth allowlists; seed (2) mostly still accurate, defects are cand-06 and cand-07. |
| operations | docs/operations/DOMAIN_DEPRECATION.md | reviewed | All route removals and phase statuses match wrangler.toml; stale line refs only (cand-10). |
| operations | docs/operations/IMAGE_WORKER_SPLIT.md | reviewed | Design record with Status line; wire contract, config test and hostname guard match image-worker source. |
| operations | docs/operations/MODERATION.md | reviewed | Checked against moderation-worker source and presets-api ban-check; several stale claims (cand-01..04). |
| operations | docs/operations/OPEN_ITEMS.md | reviewed | Every row 1-7 checked with git log, gh api (secrets, branch protection) and source; seed (1) yields cand-05 and cand-11. |
| operations | docs/operations/SECRET_ROTATION.md | reviewed | Secret inventory matches env reads in all workers; stale header and nonexistent docs/incidents (cand-09). |
| operations | docs/operations/index.md | reviewed | Links, hazards and deploy convention statements accurate. |
| operations | docs/operations/security-remediation-2026-09-15.md | reviewed | Commands and counts valid (11 workflows, migration 0014 file and trigger exist); document is an executed procedure with no status marker (cand-08). |
| entry-reference | docs/CLAUDE.md | reviewed | commands, scripts, ports, counts, example import checked |
| entry-reference | docs/README.md | reviewed | folder map and tier rules; anchors resolve |
| entry-reference | docs/index.md | reviewed | diagram, counts, dye composition, recent updates (stale) |
| entry-reference | docs/versions.md | reviewed | current tables vs package.json and npm; header, compat matrix, update steps |
| entry-reference | docs/reference/ffxiv-terminology.md | reviewed | all locale tables script-compared to core locales; one JA cell wrong |
| entry-reference | docs/reference/glossary.md | reviewed | band cuts, blending modes, matching vocabulary, KV, prior DOC-020/022 |
| entry-reference | docs/reference/index.md | reviewed | two-row index; spelling only |
| entry-reference | docs/user-guides/index.md | reviewed | tool order and labels vs en.json and v4-app-header.ts |
| specs-presets | docs/specifications/community-presets.md | reviewed | all 1,375 lines read and checked against presets-api, discord-worker, moderation-worker, web-app |
| specs-presets | docs/specifications/index.md | reviewed | all 129 lines; budget facts spot-checked |
| specs-other | docs/specifications/budget-aware-suggestions.md | reviewed | Read in full; banner accurate; design-era body flagged in 06. |
| specs-other | docs/specifications/collections.md | reviewed | Read in full; limits, keys, kinds, tombstones verified; 05. |
| specs-other | docs/specifications/feature-roadmap.md | reviewed | Read in full; /budget details verified; 03, 04, 06. |
| specs-other | docs/specifications/multi-color-extraction.md | reviewed | Read in full; 01, 02. |
| specs-other | docs/specifications/preset-palettes.md | reviewed | Read in full; 15/3/4/8 banner verified; 07. |
| frozen-body | docs/superpowers/README.md | reviewed | 13 plan rows and 12 specs indexed; two glamour rows stale |
| frozen-body | docs/superpowers/specs/ (12 files) | reviewed | Status lines; acquisition spec stale, rest true |
| frozen-body | docs/superpowers/plans/2026-08-09-beta-web-app-deployment.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-08-09-image-worker-split.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-08-10-pages-smoke-test.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-08-10-preset-preview-images.md | reviewed | Status true; migration 0009 exists |
| frozen-body | docs/superpowers/plans/2026-08-11-preset-categories-and-image-editing.md | reviewed | Status true; migration 0010 exists |
| frozen-body | docs/superpowers/plans/2026-08-16-local-presets-5-1.md | reviewed | PARKED true; no LocalPresetService |
| frozen-body | docs/superpowers/plans/2026-08-29-bot-analytics-tier-a.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-08-29-web-analytics.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-09-01-dead-code-guardrails.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-09-04-harmony-color-wheels.md | reviewed | Status true |
| frozen-body | docs/superpowers/plans/2026-09-15-sprint-0-webhook-bytes.md | partial | merge true; 'acceptance pending' clause not verifiable from source |
| frozen-body | docs/superpowers/plans/2026-09-27-glamour-acquisition.md | reviewed | Status stale (cand 01) |
| frozen-body | docs/superpowers/plans/2026-09-27-glamour-reader.md | reviewed | Status true |
| frozen-body | docs/research/index.md | reviewed | all 15 dirs listed; cand 03, 04 |
| frozen-body | docs/research/ (15 directories) | historical context | READMEs' status/outcome vs index checked; 22 anchored links all resolve |
| manual | apps/discord-worker/src/handlers/commands/manual.ts | reviewed | Topic branches and TOPIC_KEYS match schema choices and MANUAL_TOPICS. /a11y omission is commented in the source. |
| manual | packages/bot-logic/src/i18n/locales/en.json | reviewed | manual.*, manual5.*, matchImageHelp.* checked against schemas and handlers. American English scan is clean. |
| manual | packages/bot-logic/src/i18n/locales/ja.json | reviewed | Same claims as en; status labels match card.glamourStatus*. Shares the cand-01 wording. |
| manual | packages/bot-logic/src/i18n/locales/de.json | reviewed | Same claims as en. Decimal separator inconsistent (cand-04). |
| manual | packages/bot-logic/src/i18n/locales/fr.json | reviewed | Same claims as en. Decimal separator inconsistent (cand-04). |
| manual | packages/bot-logic/src/i18n/locales/ko.json | reviewed | Same claims as en; ranges use ~, equivalent. |
| manual | packages/bot-logic/src/i18n/locales/zh.json | reviewed | Same claims as en. |
| policy-ja | apps/web-app/PRIVACY.ja.md | reviewed | All sections vs PRIVACY.md; quoted labels match ja.json; no meaning difference |
| policy-ja | apps/web-app/TERMS_OF_SERVICE.ja.md | reviewed | All sections; governing law, liability, licence read twice; wording nits only |
| policy-ja | apps/discord-worker/PRIVACY_POLICY.ja.md | reviewed | All 12 sections and 4 tables row by row; retention numbers match |
| policy-ja | apps/discord-worker/TERMS_OF_SERVICE.ja.md | reviewed | All 12 sections; equivalent |
| policy-de | apps/web-app/PRIVACY.de.md | reviewed | All sections vs PRIVACY.md; every quoted UI label checked against web-app de.json; retention numbers, dates, exceptions equal; notice present. |
| policy-de | apps/web-app/TERMS_OF_SERVICE.de.md | reviewed | All 13 sections vs English; governing-law, liability and licence clauses read twice; no divergence. |
| policy-de | apps/discord-worker/PRIVACY_POLICY.de.md | reviewed | All 12 sections incl. tables vs English; retention table 13 rows equal; cross-refs match German headings; one register slip at line 173. |
| policy-de | apps/discord-worker/TERMS_OF_SERVICE.de.md | reviewed | All 12 sections vs English; no divergence. |
| policy-fr | apps/web-app/PRIVACY.fr.md | reviewed | all sections vs PRIVACY.md; UI labels verified against web fr.json; one wording item |
| policy-fr | apps/web-app/TERMS_OF_SERVICE.fr.md | reviewed | all sections; governing law, liability, licence clauses read twice; heading register only |
| policy-fr | apps/discord-worker/PRIVACY_POLICY.fr.md | reviewed | sections 1-12 and all four tables row by row; retention numbers match |
| policy-fr | apps/discord-worker/TERMS_OF_SERVICE.fr.md | reviewed | sections 1-12; one untranslated trademark sentence |
| policy-ko | apps/web-app/PRIVACY.ko.md | reviewed | all 11 sections vs PRIVACY.md; UI labels checked against web-app ko.json; meaning equivalent |
| policy-ko | apps/web-app/TERMS_OF_SERVICE.ko.md | reviewed | all 15 sections vs TERMS_OF_SERVICE.md; governing law, liability, ending clauses read twice |
| policy-ko | apps/discord-worker/PRIVACY_POLICY.ko.md | reviewed | sections 1-12 and all four tables row by row; labels checked against bot-logic ko.json |
| policy-ko | apps/discord-worker/TERMS_OF_SERVICE.ko.md | reviewed | sections 1-12 and closing acknowledgement; equivalent |
| policy-zh | apps/web-app/PRIVACY.zh.md | reviewed | All 17 sections compared with PRIVACY.md; quoted UI labels verified against web zh.json; meaning equivalent |
| policy-zh | apps/web-app/TERMS_OF_SERVICE.zh.md | reviewed | All 16 sections compared; governing-law, liability, ending clauses read twice, correct |
| policy-zh | apps/discord-worker/PRIVACY_POLICY.zh.md | reviewed | Sections 1-12 compared incl. tables and retention cells; commands/labels verified against bot zh.json |
| policy-zh | apps/discord-worker/TERMS_OF_SERVICE.zh.md | reviewed | Sections 1-12 compared; no meaning differences; no findings |
| policy-en | apps/web-app/PRIVACY.md | reviewed | Claims checked against telemetry schema, retention constants, IndexedDB use, CSP, en.json labels; one expired invite, 8 spelling hits |
| policy-en | apps/web-app/TERMS_OF_SERVICE.md | reviewed | expired invite, 9 spelling hits incl. unauthorised |
| policy-en | apps/discord-worker/PRIVACY_POLICY.md | reviewed | KV TTLs, 180-day flag, retention, commands verified; clean American English; expired invite |
| policy-en | apps/discord-worker/TERMS_OF_SERVICE.md | reviewed | commands verified; clean; expired invite |
| policy-en | localized variant links | reviewed | 20 variants + 4 English: 106 relative links incl. anchors, 0 broken; all contain the same expired Discord invite; web ones link policyDocFile siblings that exist |
| by-time-frontend | 8f57c1e8 fix(api-worker,web-app): name a retired-only family | reviewed | cand-06 |
| by-time-frontend | f45b3f04 build(web-app): re-budget core runtime chunk | reviewed | cand-01 |
| by-time-frontend | 647d8f9c + 742a3061 Sprint 27 outage / core 5.9.0 | reviewed | cand-04, cand-05 |
| by-time-frontend | fcc0b76f, bf1611a0, 60e89446, 85a16dcf, 7763d4e1, 057cba2f, 9dc5f75d Sprint 23 removals | reviewed | cand-03; icons line already updated |
| by-time-frontend | 6818070b api-worker 0.17.0 | reviewed | accurate |
| by-time-frontend | 261f1a13 og-worker 2.12.0 | reviewed | accurate |
| by-time-frontend | b29b9562 and Glamour Reader 5.13.0 set | reviewed | accurate; anchor resolves |
| by-time-frontend | Sprint 1/4/5/22/29 web-app commits | reviewed | accurate |
| by-time-frontend | d1f9e5c5, 1eaefd63, 7c97fc1d | reviewed | accurate |
| by-time-frontend | core 5.6-5.10 / svg 4.4 / bot commits | reviewed | no stale living-doc claim found |
| by-time-frontend | policy copy commits (c85fd23a, e7ad0bc8, bf332ddd, 3f662657, 91de5f8d, 59cc1d6a, 3daa83fd, 915b9127, 1f752c80, 2c07739a) | unverified | policy documents belong to other reviewers |
| by-time-frontend | 31c8914f, c88d51c6 Sprint 6 translations | unverified | terminology is an i18n handoff |
| by-time-frontend | changelog/version-row and dependency-bump commits | reviewed | skipped by rule |
| by-time-backend | bfd393e7 /glamour feature (+70e2482b, fbdc8c60, 73480209, 8b2eaeeb) | reviewed | commands.md, command-reference, getting-started; ROW_CAP, rate tier, SERVICE_RATE_LIMITER 1300 match |
| by-time-backend | 641257c5 /manual names Brio | reviewed | matches |
| by-time-backend | f5e3aac2/dfa45fd0/ce296d09 glamour refusal relay | reviewed | not contradicted |
| by-time-backend | c1f60ec8/b43e757a Sprint 15 bot-logic/discord | partial | docs make no dye-input resolution claim; omission only |
| by-time-backend | 7562d177/2d353699/49e6f31a bot-logic readouts | reviewed | no doc claim touched |
| by-time-backend | 412e3884 resvg free (5.8.10) | reviewed | no living claim |
| by-time-backend | 00390333/fa56ae8a FONT-001 | reviewed | rendering.md:44 matches |
| by-time-backend | d1fdb89a discord 5.8.0 | reviewed | /stats subcommands match |
| by-time-backend | c7fd9eba/10a3b137/aaa4467b/3a69828c moderation 1.8.0 | reviewed | overview matches |
| by-time-backend | 667f3ef9/e92ea01f/20587699 moderation 1.8.1 + types grammar | reviewed | docs point to types |
| by-time-backend | f1b54a0f presets-api 2.4.0 | reviewed | api-contracts, retention cron 23 4 * * * match |
| by-time-backend | e34ea70a retention job | reviewed | matches |
| by-time-backend | 8c264798/f1174a47 presets-api 2.5.0 edited_from | reviewed | matches |
| by-time-backend | 12e7f887/6f2bb05c/b0f01e24/ee869d55 retired routes | reviewed | DOMAIN_DEPRECATION matches wrangler.toml |
| by-time-backend | 35f502db oauth 3.1.3 | reviewed | endpoints/api-contracts match |
| by-time-backend | d853a765 oauth 3.1.2 | reviewed | matches |
| by-time-backend | ed460f33 worker-kit 1.5.0 | reviewed | no living claim |
| by-time-backend | 8d2649d7 logger 2.3.0 | reviewed | overview updated |
| by-time-backend | c73b702f test-utils 3.0.0 | reviewed | overview matches exports map |
| by-time-backend | 26e43a64 CI 2.3.2 | reviewed | deployment/DEPLOY_ENVIRONMENTS/release-process match ci.yml |
| by-time-backend | 3a158847 Workers Logs gate | reviewed | gap filed as cand-02 |
| by-time-backend | 6e8c7d81/01465700/64e1f212 image/stoat | reviewed | no stale claims |
| by-time-backend | d9fdb57c CommandRegistryEntry.deprecated | reviewed | no doc hits |
| by-time-backend | Dependabot/chore/version-row-only commits | historical context | skipped, no behavior change |
| cross-doc-facts | web-app tool count / names / order | reviewed | 20 mentions; ROUTES order vs rail order differ by design, each doc matches the one it describes; no candidate |
| cross-doc-facts | og-worker tool-card count | reviewed | 1 candidate (cand-01) |
| cross-doc-facts | registered bot command count / names | reviewed | 18 registrations / 17 distinct; all docs agree |
| cross-doc-facts | dye 125 / Facewear 11 / consolidated IDs 52254-52256 | reviewed | all mentions agree with dyes.json and consolidated-ids.ts |
| cross-doc-facts | locale count 6 | reviewed | all agree |
| cross-doc-facts | package 8 / app 9 / 17 projects | reviewed | all agree; dependency-graph matrix matches package.json |
| cross-doc-facts | harmony types 10 / vision types 5 / themes 2 / matching methods 6 | reviewed | all agree |
| cross-doc-facts | toolchain versions (Node, pnpm, Turbo, TS, Vitest, ESLint, Prettier, knip, Hono) | reviewed | cand-04 and cand-05 (Hono/Vite) |
| cross-doc-facts | wrangler version | reviewed | no living doc states a version; local-setup.md:17 says devDependency only |
| cross-doc-facts | public hostnames | reviewed | 1 candidate (cand-03, also filed by specs-presets) |
| cross-doc-facts | service binding / D1 / KV / R2 binding names | reviewed | all match wrangler.toml; namespace_ids match env-vars table |
| cross-doc-facts | cron schedules | reviewed | single cron 23 4 * * * in presets-api; docs say once a day |
| cross-doc-facts | rate-limit numbers | reviewed | cand-06 (faq omits /glamour); all numbers otherwise match |
| cross-doc-facts | cache TTLs | reviewed | cand-11 (10-minute claim); cand-08 is a size not TTL fact |
| cross-doc-facts | JWT / state / nonce lifetimes | reviewed | all agree (3600 s, 600 s, exp+15 min, 120 s nonce, 60 s signature window, 180 days) |
| mech-commands-paths | all 93 docs in docs/audits/2026-10-11-documentation/evidence/living-files.txt | reviewed | Per-file rows, all tier living, are in review-mech-commands-paths.md. 337 commands, 1093 paths, 22 file:line refs and 49 anchors checked statically. Localized policy variants were not scanned. |
| mech-symbols-routes | docs/CLAUDE.md | reviewed | mechanical scope; cand-mech-01 |
| mech-symbols-routes | docs/README.md | reviewed | mechanical scope; no defect |
| mech-symbols-routes | docs/architecture/api-contracts.md | reviewed | 54 route units all match presets/oauth/discord-worker routers; no defect |
| mech-symbols-routes | docs/architecture/data-flow.md | reviewed | routes verified; no defect |
| mech-symbols-routes | docs/architecture/dependency-graph.md | reviewed | paths/names verified; no defect |
| mech-symbols-routes | docs/architecture/index.md | reviewed | no units |
| mech-symbols-routes | docs/architecture/overview.md | reviewed | api-worker route list matches; cand-mech-05 (nine tools) |
| mech-symbols-routes | docs/architecture/security-trade-offs.md | reviewed | constants verified; no defect |
| mech-symbols-routes | docs/architecture/service-bindings.md | reviewed | binding/service names match wrangler; cand-mech-09 |
| mech-symbols-routes | docs/developer-guides/contributing.md | reviewed | no defect (wrong-import example is deliberate) |
| mech-symbols-routes | docs/developer-guides/deployment.md | reviewed | no defect |
| mech-symbols-routes | docs/developer-guides/environment-variables.md | reviewed | every var/binding/limit verified against wrangler and Env types; no defect |
| mech-symbols-routes | docs/developer-guides/index.md | reviewed | pnpm scripts valid; no defect |
| mech-symbols-routes | docs/developer-guides/local-setup.md | reviewed | no defect |
| mech-symbols-routes | docs/developer-guides/logging-standards.md | reviewed | logger import resolves; no defect |
| mech-symbols-routes | docs/developer-guides/monorepo-setup.md | reviewed | no defect |
| mech-symbols-routes | docs/developer-guides/release-process.md | reviewed | NPM_TOKEN correctly described as absent; no defect |
| mech-symbols-routes | docs/developer-guides/testing.md | reviewed | no defect |
| mech-symbols-routes | docs/developer-guides/troubleshooting.md | reviewed | no defect |
| mech-symbols-routes | docs/index.md | reviewed | no defect |
| mech-symbols-routes | docs/maintainer/adding-dyes.md | reviewed | vocabulary constants verified; no defect |
| mech-symbols-routes | docs/maintainer/dye-maintainer-tool.md | reviewed | removal notice; no defect |
| mech-symbols-routes | docs/maintainer/index.md | reviewed | no units |
| mech-symbols-routes | docs/operations/ANALYTICS_QUERIES.md | reviewed | no defect |
| mech-symbols-routes | docs/operations/DEPLOY_ENVIRONMENTS.md | reviewed | cand-mech-05 (x9 routes) |
| mech-symbols-routes | docs/operations/DOMAIN_DEPRECATION.md | reviewed | no defect |
| mech-symbols-routes | docs/operations/IMAGE_WORKER_SPLIT.md | reviewed | design/history paths; cand-mech-12 (health) |
| mech-symbols-routes | docs/operations/MODERATION.md | reviewed | no defect |
| mech-symbols-routes | docs/operations/OPEN_ITEMS.md | reviewed | no defect |
| mech-symbols-routes | docs/operations/SECRET_ROTATION.md | reviewed | secret inventory vs Env types and workflows verified; cand-mech-10 |
| mech-symbols-routes | docs/operations/index.md | reviewed | no units |
| mech-symbols-routes | docs/operations/security-remediation-2026-09-15.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/api-worker/endpoints.md | reviewed | all routes, params, error codes verified; no defect |
| mech-symbols-routes | docs/projects/api-worker/overview.md | reviewed | cand-mech-04 |
| mech-symbols-routes | docs/projects/core/algorithms.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/core/overview.md | reviewed | cand-mech-01 |
| mech-symbols-routes | docs/projects/core/publishing.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/core/services.md | reviewed | ColorService/PresetService methods and signatures verified; no defect |
| mech-symbols-routes | docs/projects/core/types.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/discord-worker/commands.md | reviewed | rate-limit tiers verified; no defect |
| mech-symbols-routes | docs/projects/discord-worker/interactions.md | reviewed | routes verified; no defect |
| mech-symbols-routes | docs/projects/discord-worker/overview.md | reviewed | env/bindings verified; cand-mech-08 |
| mech-symbols-routes | docs/projects/discord-worker/rendering.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/index.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/logger/overview.md | reviewed | logger imports resolve; no defect |
| mech-symbols-routes | docs/projects/moderation-worker/overview.md | reviewed | cand-mech-12 (health) |
| mech-symbols-routes | docs/projects/oauth/endpoints.md | reviewed | cand-mech-03 |
| mech-symbols-routes | docs/projects/oauth/jwt.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/oauth/overview.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/oauth/pkce-flow.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/og-worker/overview.md | reviewed | cand-mech-05, cand-mech-12 |
| mech-symbols-routes | docs/projects/presets-api/database.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/presets-api/endpoints.md | reviewed | all routes match handlers; no defect |
| mech-symbols-routes | docs/projects/presets-api/moderation.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/presets-api/overview.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/presets-api/rate-limiting.md | reviewed | DAILY_* caps match code; no defect |
| mech-symbols-routes | docs/projects/test-utils/overview.md | reviewed | all subpath imports resolve; removed helpers marked removed; no defect |
| mech-symbols-routes | docs/projects/types/overview.md | reviewed | cand-mech-01 |
| mech-symbols-routes | docs/projects/universalis-proxy/overview.md | reviewed | no units flagged |
| mech-symbols-routes | docs/projects/web-app/components.md | reviewed | cand-mech-06 |
| mech-symbols-routes | docs/projects/web-app/overview.md | reviewed | no defect |
| mech-symbols-routes | docs/projects/web-app/theming.md | reviewed | ThemeService methods exist; no defect |
| mech-symbols-routes | docs/projects/web-app/tools.md | reviewed | no defect |
| mech-symbols-routes | docs/reference/ffxiv-terminology.md | reviewed | no defect |
| mech-symbols-routes | docs/reference/glossary.md | reviewed | no defect |
| mech-symbols-routes | docs/reference/index.md | reviewed | no units |
| mech-symbols-routes | docs/specifications/budget-aware-suggestions.md | reviewed | cand-mech-11 |
| mech-symbols-routes | docs/specifications/collections.md | reviewed | no defect |
| mech-symbols-routes | docs/specifications/community-presets.md | reviewed | cand-mech-02 |
| mech-symbols-routes | docs/specifications/feature-roadmap.md | reviewed | cand-mech-07 |
| mech-symbols-routes | docs/specifications/index.md | reviewed | no units |
| mech-symbols-routes | docs/specifications/multi-color-extraction.md | reviewed | no defect |
| mech-symbols-routes | docs/specifications/preset-palettes.md | reviewed | no defect |
| mech-symbols-routes | docs/user-guides/discord-bot/command-reference.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/discord-bot/faq.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/discord-bot/favorites-collections.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/discord-bot/getting-started.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/index.md | reviewed | no units |
| mech-symbols-routes | docs/user-guides/public-api.md | reviewed | all /v1 paths exist; no defect |
| mech-symbols-routes | docs/user-guides/web-app/accessibility.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/budget-suggestions.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/color-harmony.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/community-presets.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/dye-comparison.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/dye-mixer.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/faq.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/favorites-collections.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/getting-started.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/glamour-reader.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/gradient-builder.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/palette-extractor.md | reviewed | no units flagged |
| mech-symbols-routes | docs/user-guides/web-app/swatch-matcher.md | reviewed | no units flagged |
| mech-symbols-routes | docs/versions.md | reviewed | history rows only; named removed symbols are history; no defect |
