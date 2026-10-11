# Review: discord-worker cluster (2026-10-11)

Baseline: HEAD 42c35e87 (served 16a6123f for all apps). Units: apps/discord-worker, packages/bot-logic, packages/svg.

## Coverage
| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| docs/projects/discord-worker/commands.md | living | discord-worker, bot-logic | all 564 lines; every option table vs src/commands/schemas.ts; rate limits vs worker-kit configs.ts + services/rate-limiter.ts | reviewed |
| docs/projects/discord-worker/interactions.md | living | discord-worker | all 102 lines; routes, limits, buttons, response helpers, timeouts | reviewed |
| docs/projects/discord-worker/overview.md | living | discord-worker | all 270 lines; structure, bindings, vars, secrets, deploy, rules | reviewed |
| docs/projects/discord-worker/rendering.md | living | discord-worker, svg | all 89 lines; fonts.ts, renderer.ts, generator table, bundle size | reviewed |
| docs/user-guides/discord-bot/command-reference.md | living | discord-worker, bot-logic | all 382 lines; /glamour twin rules vs core chara-twins.ts; en.json labels | reviewed |
| docs/user-guides/discord-bot/faq.md | living | discord-worker | all 204 lines | reviewed |
| docs/user-guides/discord-bot/favorites-collections.md | living | discord-worker | all 141 lines; defaults, caps, messages, autocomplete | reviewed |
| docs/user-guides/discord-bot/getting-started.md | living | discord-worker | all 276 lines | reviewed |

Anchors checked: commands.md#preset-submit, overview.md#deployment, favorites-collections.md#where-dye-favorites-live all resolve.
Recent drift: git log --since=2026-09-21 on the three units read; claims those commits touched (glamour 5.7.x-5.8.x, twin rules, rate limits, review custom_id, font load order, announcement memo) were checked.

## Priors
- DOC-002 STILL_PRESENT: 48 confirmed (prior 44). Table below.
- DOC-010 STILL_PRESENT: faq.md:37 still "at least 2 characters"; apps/discord-worker/src/index.ts:1270 `query.length >= 1 ? searchDyesByName(...) : dyeService.getAllDyes()`.
- DOC-011 STILL_PRESENT: commands.md:241 "plus the 20 Cosmic Exploration dyes"; quick-picks.ts comments :35/:99 (16 Cosmic Exploration) and :149 (4 Cosmic Fortunes).

## Candidates (full text is in the structured return)
1. 01 MEDIUM (DOC-010) faq.md:37.
2. 02 MEDIUM (DOC-011) commands.md:241. command-reference.md:246-251 lists the 22 names correctly (match quick-picks.ts ids).
3. 03 LOW spelling (DOC-002).
4. 04 MEDIUM share-link overclaim. Embeds for /extractor color (handlers/commands/extractor.ts:391-399), /extractor image (:608-619), /gradient (bot-logic gradient.ts:396), /mixer (mixer.ts:163), /comparison (comparison.ts:160), /contrast (contrast.ts:139), /accessibility (accessibility.ts:213-266) carry no URL. Only harmony.ts:335, dye-info.ts:177, swatch.ts:271, glamour.ts:185, budget.ts:388-399 do.
5. 05 LOW faq.md:126 omits /glamour (default tier 15, worker-kit configs.ts:102).
6. 06 MEDIUM stale code examples (overview.md:165-177; rendering.md:383-390).
7. 07 LOW rendering.md:434 bundle figure.
8. 08 LOW commands.md:489 clan "Default clan for /swatch".
9. 09 LOW overview.md:213 ENVIRONMENT "Only validateEnv reads it".
10. 10 LOW interactions.md:318 and :303.
11. 11 LOW missing items (GET /health, emoji system, generateGlamourCard row, Recent Features, check-bundle-size).
12. 12 LOW handoff-security first-run flag wording.

## Seed (1) /glamour verdict
commands.md:17,67,199-212, command-reference.md:20,117-150, getting-started.md:209,219,390, overview.md:72,117 are accurate (labels match bot-logic en.json:630-637; twin order matches core chara-twins.ts defaultCharaTwin; ROW_CAP 5 glamour.ts:127; 1 MiB chara-attachment.ts:17; SERVICE_RATE_LIMITER 1300 api-worker wrangler.toml:71). Gaps: faq.md:126 (cand 05), favorites-collections.md:122 not listing /glamour among link-bearing replies (folded into cand 04).

## Positive controls
- 18 registrations / 17 distinct (registry.ts); /glamour in schemas.ts with one required `file` attachment.
- Every option table in commands.md matches schemas.ts (types, required, min/max, choices); /manual topics, /preferences keys, filters, /swatch slots, /harmony wheels match.
- Rate-limit tiers match worker-kit configs.ts plus LOCAL_COMMAND_LIMITS (changelog 30) and extractor:image 5.
- wrangler.toml bindings, RL_5..RL_70, vars, [[rules]], env.production routes, deploy vs deploy:production scripts as documented.
- Web-app tool names in the equivalents tables match apps/web-app/src/locales/en.json:41-101; favorites cap 50, messages, daily limit 10, 180-day flag, 100 KB body (auth discord.ts:42), 10 KB / 1 MiB webhook caps, 90-day announce memo verified.
- Font load order (fonts.ts:107-126) and subset sources verified.

## Rejected
- Rendering fonts / CJK claims match fonts.ts header and subset script.
- favorites-collections.md matching "Read by" includes /budget find: budget.ts:280-284 reads prefs.matching. True.
- /about invite link: about.ts:40 includes inviteBot, user guides correct.
- "centre" in favorites-collections.md:85 is ordinary spelling (in the count), not the French-cell standing rejection.
- market / show_* preferences "not read by any card": could not establish cheaply, not filed.
- resvg-wasm "~2.4 MiB" (rendering.md:424): not measured, unverified.

## Spelling per document (48 confirmed)
| doc | count | notes |
|---|---|---|
| commands.md | 14 | sweep 11 (17,30,41,89,109,244,278,358,380,452,453); dictionary misses 59 and 374 canonicalises, 454 favourited |
| getting-started.md | 11 | sweep 10 (28,51,65,67,107,122,146,153,164,224); miss 8 favourited. Line 224 "Colour vision" labels a /manual topic whose shipped label is "Color Vision" (schemas.ts), so a defect |
| command-reference.md | 8 | 9,25,43,52,79,168,248,364 |
| overview.md | 6 | sweep 5 (116,136,146,189,197); miss 183 canonicalised |
| faq.md | 4 | 82,87,88,179 |
| interactions.md | 3 | sweep 2 (32,43); miss 88 memoised |
| rendering.md | 1 | 30 |
| favorites-collections.md | 1 | 85 centre ("data centre"; Data Center is the game term) |

Rejected from sweep: none. --all extras: 0. Total 42 sweep rows + 6 dictionary misses.
