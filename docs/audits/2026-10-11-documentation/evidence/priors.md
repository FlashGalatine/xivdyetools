| cluster | prior | status | note |
|---|---|---|---|
| web-app-core | DOC-001 | STILL_PRESENT | 102 British spellings in 7 of 9 files (tools.md 40, components.md 19, accessibility.md 19, getting-started.md 12, favorites-collections.md 7, faq.md 3, overview.md 2) |
| web-app-core | DOC-012 | STILL_PRESENT | components.md:197 and overview.md:28 still say 1,152; en.json and all locales have 1,177 (i18n-parity.mjs) |
| web-app-core | DOC-013 | FIXED | components.md:46 order now matches TOOL_MENU in v4-app-header.ts:54-65 |
| web-app-core | DOC-014 | STILL_PRESENT | components.md:47 and tools.md:31 still quote 'Colour wheel'; en.json:176 is 'Color wheel' |
| web-app-core | DOC-015 | FIXED | en.json tools.presets.title is 'Community Presets' in en (and translated in the five others); docs and apps/web-app/CLAUDE.md:21 agree |
| web-app-tools | 2026-09-21-documentation/DOC-001 | STILL_PRESENT | 127 British spellings remain in 7 of 8 cluster files (palette-extractor 28, swatch-matcher 27, color-harmony 18); folded into cand-web-app-tools-07 |
| discord-worker | DOC-002 | STILL_PRESENT | 48 British spellings now in 8 docs (prior 44); commands.md 14, getting-started.md 11, command-reference.md 8 |
| discord-worker | DOC-010 | STILL_PRESENT | faq.md:37 still says 2 characters; index.ts:1270 uses query.length >= 1 |
| discord-worker | DOC-011 | STILL_PRESENT | commands.md:241 still says 20 Cosmic Exploration; quick-picks.ts has 16 plus 4 Cosmic Fortunes |
| api-worker | DOC-003 | STILL_PRESENT | endpoints.md 10, public-api.md 7 (5 prose + 2 code comments), overview.md 3 British spellings at HEAD |
| presets-moderation | DOC-017 | STILL_PRESENT | moderation-worker/overview.md:103-106 still omits types/modal.ts; file exists in apps/moderation-worker/src/types/ |
| oauth-og | DOC-016 | STILL_PRESENT | docs/projects/oauth/overview.md:200-204 (and quick start :22-24) still omit XIVAUTH_CLIENT_SECRET; wrangler.toml:86 and types.ts:393 confirm it exists as optional |
| packages | 2026-09-21-documentation/DOC-003 | STILL_PRESENT | algorithms.md still has 5 (172,190,196,197,340); this cluster has 24 across 7 docs; folded into cand-packages-10 |
| architecture | DOC-004 | STILL_PRESENT | Still British: overview.md 19 (was 16), api-contracts.md 3, dependency-graph.md 3, service-bindings.md 2, data-flow.md 1 = 28 confirmed; api-contracts.md:444 rejected as before |
| architecture | DOC-007 | STILL_PRESENT | api-contracts.md:555-660 still has no POST /auth/revoke (token.ts:101, index.ts:281); XIVAuth routes also absent |
| architecture | DOC-009 | STILL_PRESENT | @cloudflare/workers-types still under dependencies in moderation-worker, og-worker, image-worker package.json; dependency-graph.md:135,138,141 still omit it |
| devguides-maintainer | DOC-004 | STILL_PRESENT | contributing.md lines 39,48,100,145 still say behaviour; architecture docs outside this cluster |
| devguides-maintainer | DOC-005 | STILL_PRESENT | maintainer/adding-dyes.md still has 7 (24,31,38,40,272,281,385) |
| devguides-maintainer | DOC-008 | STILL_PRESENT | contributing.md:65 unchanged; lint:fix defined only in web-app and core |
| operations | DOC-018 | STILL_PRESENT | docs/operations/MODERATION.md:37,100 still say user:<discord_user> and nothing mentions XIVAuth-only authors; source still shows STRING + autocomplete (register-commands.ts:82-106) and ban.xivauthId label (preset.ts:505-518). Folded into cand-operations-04. |
| operations | DOC-019 | PARTLY | OPEN_ITEMS.md:145-150 was rewritten to credit the presets-api side, but still calls the moderation-worker side future ('follows in Sprint 4'); it shipped in moderation-worker 1.8.0 (CHANGELOG.md:103-107, ban-service.ts:487-503). Folded into cand-operations-05. |
| entry-reference | DOC-005 | PARTLY | Still British: 68 confirmed spellings (versions.md 50, index.md 10, glossary.md 5, terminology 2, reference/index.md 1); maintainer/adding-dyes etc. are other clusters. |
| entry-reference | DOC-020 | STILL_PRESENT | glossary.md:94-95 text unchanged; dye-vocabulary.ts:34-39 still has no crafting/dungeon/event acquisition. |
| entry-reference | DOC-022 | STILL_PRESENT | glossary.md:91 still '### Marketboard'; terminology.md:287 says Market Board. |
| specs-other | DOC-021 | STILL_PRESENT | multi-color-extraction.md:120,129-133,345 still show the old signatures; real ones are PaletteService.ts:416 and :554. |
| policy-en | 2026-09-21-documentation/DOC-006 | STILL_PRESENT | The two web-app policies are still British: 17 hits (PRIVACY.md 8, TOS 9), up from 14, including 'unauthorised' at TOS:87. Fix would be spelling-only with no date bump. |
