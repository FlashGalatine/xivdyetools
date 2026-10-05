# Review: svg-bot-logic-stoat (packages/svg, packages/bot-logic, apps/stoat-worker)

Branch preview/integration-2026-10-04. Read-only audit; no builds run. Tracked files only (`git grep`, docs/audits excluded).

## Module map
- svg: base.ts (primitives), frame.ts (5.0 frame system), 13 card generators (one file each) + preset-swatch.ts, icons/tool-icons.ts (glyph geometry; web-app/og-worker/api-worker VitePress consume), emitted-glyphs.ts (@public; discord-worker font-coverage.test.ts consumer). Single export path ".".
- bot-logic: src/index.ts barrel + subpath `./i18n` (src/i18n/index.ts). commands/*.ts = execute* + types; input-resolution, localization, css-colors, moderators, discord-markdown.
- stoat-worker: Node process; index.ts -> message-handler.ts -> parser.ts -> router.ts COMMAND_ROUTES (ping, help, about, dye.info). Only `info` uses bot-logic (executeDyeInfo, resolveColorInput, resolveDyeInput, sanitizeEmbedText).

## Commands run (all from the worktree root; results abridged)
1. `Grep ^export ...` over packages/svg/src, packages/bot-logic/src, apps/stoat-worker/src -> full export lists (svg ~120, bot-logic ~95, stoat ~40).
2. Read packages/svg/src/index.ts, packages/bot-logic/src/index.ts, src/i18n/index.ts -> every barrel specifier and its `@public` tag.
3. `git grep -n -w -E "LEDGER_ROW_H|bandSlices|GLYPH_SETS|pillInkOnDye|placeGlyph|formatMeasure|BandInk|CATEGORY_DISPLAY|scanEmittedGlyphs|contrastRatio"` -> LEDGER_ROW_H/LEDGER_GROUP_H only in budget-ledger.ts (exported, used in-file); bandSlices exported, used in-file + palette-grid.test.ts; placeGlyph/formatMeasure/pillInkOnDye used in-file or by sibling cards; CATEGORY_DISPLAY used by discord-worker preset.ts; scanEmittedGlyphs used by discord-worker font-coverage.test.ts; contrastRatio used by bot-logic contrast.ts/comparison.ts.
4. /tmp/sr.sh (git-grep re-implementation of symrefs.sh; the packaged symrefs.sh timed out at 120s on this Windows checkout) over 20+ svg symbols and 40 bot-logic symbols -> see Rejected. Findings: HARMONY_ROW_CAP, LEDGER_FOOTER_H, LEDGER_FOOTER_2LINE_H, ACCENT have prod/other=0 outside barrel and all carry @public.
5. `git grep -w -E "parseDyeIdInput|resolveDyeInput|isValidDiscordSnowflake|LocaleInfo|LocalePreferenceStore" -- apps` -> parseDyeIdInput: discord-worker/src/index.ts:140 is a COMMENT only; resolveDyeInput: stoat dye-resolver.ts:11,60 is a real import and call (live); isValidDiscordSnowflake: moderation-worker/src/services/preset-api.ts:263 is a private local copy, NOT an import.
6. members.py on Translator, MessageContextStore, CommandThrottle -> Translator t/tc/getLocale live (`t.tc(` in discord-worker dye.ts:139, preset.ts:1010, rate-limiter.ts:314; `t.getLocale()` in ~10 handlers). CommandThrottle.tryAcquire live (message-handler.ts:81). MessageContextStore: see C1.
7. `Grep ^\s*(export )?class` over the three units -> only those 3 classes; no other class members to survey.
8. `git grep -w -E "messageContextStore|contexts|.size"` in stoat src -> `.set(` only at info.ts:124; no `.get(`/`.delete(`/`.size` caller outside the class and tests.
9. `git grep -w -E "isAuthorized|authorizedUsers|STATS_AUTHORIZED_USERS"` in stoat -> isAuthorized only config.ts:57 (def) + config.test.ts:84-104; authorizedUsers only logged as a count at index.ts:60.
10. `git show 01465700 -- apps/stoat-worker/src/services/response-formatter.ts` (PR #234) -> adds REVOLT_ROLE_MENTION, INVISIBLE_CHARS, STOAT_MASS_MENTION inside sanitizeEcho; deletes nothing but the old one-line body; every added constant is referenced at response-formatter.ts:113-116. Callers: router.ts:88, response-formatter.ts:132,153. No helper orphaned.
11. `git show d1fdb89a -- packages/bot-logic/src/i18n/locales/en.json` + `git grep subcommands.preferences|adoption rates` -> the 3 removed lines are stats.preferences description; zero residual references in apps/packages (clean).
12. `git grep -n -E "@deprecated|TODO|FIXME|LEGACY|OBSOLETE|HACK|for compat|backward"` over the unit -> harmony.ts:78 @deprecated harmonyOptions (C4); locale-resolution.ts LEGACY_KEY_PREFIX (live: getLegacyLanguagePreference consumed by moderation-worker i18n.ts:32 and resolveUserLocale); stoat info.ts:38 TODO (feature, not dead).
13. `git grep -n -E "\b(it|test|describe)\.(skip|todo|only)\b|xit|xdescribe"` over the unit -> 0 hits. Snapshot files in unit: 0.
14. Dependency check (package.json vs `git grep -h -o "from '...'"` in non-test src): svg core/types imported; test-utils devDep used by dye-info-card.test.ts, preset-swatch.test.ts, svg-pipeline.integration.test.ts. bot-logic core, core/blending, svg, types imported; @types/node devDep covers node:fs in locale-orphans.test.ts. stoat: bot-logic, logger, types, revolt.js imported; tsup/tsx/@vitest/coverage-v8 are script/config use. No unused dependency.
15. `grep svg|stoat|bot-logic DEPRECATIONS.md` + `git grep -w generateHarmonyWheel|generateContrastMatrix|generateRandomDyes|...` -> every symbol DEPRECATIONS.md lists as removed from svg is absent from packages/apps. bot-i18n and color-blending flips complete (no stale imports).
16. Error-code unions: `git grep "error: 'NO_MATCHES'|NO_DYES|NO_LIVE_SLOTS|SLOT_MISSING"` -> every union member is produced (harmony.ts:244, mixer.ts:121, dye-info.ts:234, swatch.ts:243/263); glamour.ts:353-488 produces all five glamour codes; discord-worker glamour.ts:161-165 handles them.
17. `git grep -w -E "sanitizeEmbedText|escapeDiscordMarkdown|ALLOWED_MENTIONS_NONE"` in apps -> sanitizeEmbedText: 6+ discord-worker files, moderation-worker, stoat response-formatter.ts:11; ALLOWED_MENTIONS_NONE: discord-worker utils/discord-api.ts:9, moderation-worker utils/discord-api.ts:8; escapeDiscordMarkdown: no app consumer (used by sanitizeEmbedText in-file).
18. Fixtures/mocks: DUSKWIGHT_HETEROCHROMIA and HROTHGAR_HELIONS used by swatch.test.ts; createMockChannel/Message/Client each used by stoat tests (index.test.ts:13,44,76 etc.). No unused helper.

## Candidates (summary; full list in the structured return)
- C1 stoat MessageContextStore: write-only (set at info.ts:124, get/delete/size/TTL never read in prod). DEAD-019-adjacent (reaction listener not shipped; info.ts:105-109 says so).
- C2 stoat isAuthorized + BotConfig.authorizedUsers: no admin command exists; test-only.
- C3 stoat BotConfig.upstashRedisUrl/Token: read from env (config.ts:49-50) and never consumed; rate limiting is in-memory CommandThrottle (command-throttle.ts:7).
- C4 bot-logic HarmonyInput.harmonyOptions (@deprecated, ignored): no prod reader; kept alive by harmony.test.ts:383 whose assertion (`ok === true`) cannot detect the field being read; test name is misleading ("preserves caller-supplied deltaE formula").
- C5 stoat HELP_TOPICS export: only help.test.ts:138 consumes it (parity fixture).
- C6 bot-logic index.ts:150-151 stale @public tags on sanitizeEmbedText and ALLOWED_MENTIONS_NONE (both have real in-repo consumers); the tag now masks any future orphaning. Related: moderators.ts isValidDiscordSnowflake is @public yet only used inside moderators.ts; moderation-worker preset-api.ts:263 carries its own duplicate (consolidation, not dead).
- C7 export-keyword-only symbols (knip hides them via ignoreExportsUsedInFile): svg budget-ledger.ts LEDGER_ROW_H/LEDGER_GROUP_H, palette-grid.ts bandSlices (test-imported), frame.ts placeGlyph, mixer.ts MixerSweepStop, input-resolution.ts parseDyeIdInput, localization.ts getLocalizedColorWheelName/getLocalizedRace.
- C8 stoat StoatMessage.interactions / .attachments (response-formatter.ts:27,34): fields never set by any prod caller (part of DEAD-019 reactions scaffolding).

## Positive controls
- #234 sanitizeEcho: all three new regex constants referenced; callers at router.ts:88 and two formatters; echo-sanitisation.test.ts covers them. Nothing orphaned.
- Locale removal (#227 d1fdb89a) removed key in all six locales with no residue.
- 0 skipped/todo/only tests in the three units; 0 snapshots.
- svg and bot-logic: no orphaned source files (every non-test file imported, barrelled, or a test fixture with importers).
- Every svg generator is consumed (bot-logic or discord-worker); web-app/og-worker/api-worker consume the glyph set (chromeGlyph/panelGlyph/toolGlyph).
- Result-error unions have no never-produced members.

## Rejected (checked live)
See the structured return; notable: resolveDyeInput (stoat dye-resolver.ts:60), searchDyesByName/findDyeByName (discord-worker dye.ts), getLegacyLanguagePreference (moderation-worker i18n.ts:32), getLocalizedAcquisition/HarmonyType/VisionType (discord-worker budget.ts, localize.ts), GLYPH_SETS (@testonly; reason still true: derives from Object.keys of the real glyph maps, parity test tool-icons.test.ts), pillInkOnDye/formatMeasure (sibling cards), scanEmittedGlyphs (discord-worker font-coverage.test.ts), CATEGORY_DISPLAY (discord-worker preset.ts), InterpolationMode (discord-worker gradient.ts).

## Prior-KEEP trigger status
- DEAD-018 (core APIs): none of its symbols are in this unit; N/A. Next core major not in this batch.
- DEAD-019 (parked Stoat scaffolding: parseMultiDyeArgs parser.ts:148 + 10 test refs, withLoadingIndicator loading-indicator.ts:25, DYE_INFO_REACTIONS response-formatter.ts:43): trigger NOT met. Stoat is still parked (#234 CHANGELOG/commit: "The bot is parked"), not retired, not resumed. C1/C8 are filed as adjacent extensions only so the verifier can decide whether they belong under the same KEEP.
- DEAD-020 (native-binding fallbacks): not in this unit.
- DEAD-021: not in this unit.

## Files covered
svg: 19 src + 6 doc/config; bot-logic: 22 src + 6 locale JSON + tests; stoat: 17 src + tests. 148 tracked files in the unit (git ls-files count); delta files from both evidence lists inspected (glamour.ts, chara-identity.ts, swatch.ts, localization.ts, input-resolution.ts, translator.ts, glamour-card.ts, swatch-card.ts, tool-icons.ts, response-formatter.ts, ping.ts, info.ts, revolt-mocks.ts).
