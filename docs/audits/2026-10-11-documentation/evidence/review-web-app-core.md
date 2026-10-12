# Review: web-app-core cluster (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for web-app (only root CHANGELOG-laymans.md differs). Source of truth: `apps/web-app` at HEAD, plus `packages/core`, `apps/api-worker`, `apps/presets-api` where a doc crosses into them. Line numbers below are per-file (not cumulative).

## Coverage

| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| docs/projects/web-app/components.md | living | web-app (+core blending) | all (shell, tool table, primitives, modals, service layer, ConfigController, code splitting, localization) | reviewed |
| docs/projects/web-app/overview.md | living | web-app | all; "New in vX" bullets treated as release history | reviewed |
| docs/projects/web-app/theming.md | living | web-app | all | reviewed |
| docs/projects/web-app/tools.md | living | web-app, core | all ten tool sections, share-param tables, route table, config defaults vs `DEFAULT_CONFIGS` | reviewed |
| docs/user-guides/web-app/accessibility.md | living | web-app | all; every quoted string matched against en.json `accessibility.*` | reviewed |
| docs/user-guides/web-app/community-presets.md | living | web-app, presets-api | all; labels via en.json string match, limits vs source (2-50 / 10-200 / 3-6 dyes / 200 saved / 10 per day) | reviewed |
| docs/user-guides/web-app/faq.md | living | web-app, PRIVACY.md | all; privacy lines compared with `apps/web-app/PRIVACY.md` | reviewed |
| docs/user-guides/web-app/favorites-collections.md | living | web-app | all | reviewed |
| docs/user-guides/web-app/getting-started.md | living | web-app | all | reviewed |

Method: read every file in full; script-checked every backticked filename (only intentional "removed" names missing) and every backticked identifier against `apps/web-app/src` + `packages/core/src` (misses listed in cand-04); string-matched every bold UI label and quoted italic string in the five user guides against `src/locales/en.json`; compared `DEFAULT_CONFIGS`, router `ROUTES`, `TOOL_MENU`, keyboard map, bundle script, vite chunks, theme service, deploy workflows.

## Priors

| id | status | evidence |
|---|---|---|
| DOC-001 | STILL_PRESENT | 102 British spellings in 7 of the 9 files (table below). |
| DOC-012 | STILL_PRESENT | components.md:197 still says 1,152 keys; `node apps/web-app/scripts/i18n-parity.mjs` -> "EN keys 1177", and a leaf count of all six locale files = 1,177. overview.md:28 repeats 1,152 (inside the "New in v5.0.0" bullet, so arguably a history figure). |
| DOC-013 | FIXED | components.md:46 now reads Harmony, Extractor, Vision, Compare, Gradient, Mixer, Presets, Budget, Swatch, Glamour; `v4-app-header.ts:54-65` `TOOL_MENU` is the same order. |
| DOC-014 | STILL_PRESENT | components.md:47 "Harmony **Colour wheel** select" and tools.md:31 "the control is a **Colour wheel** select"; `en.json:176` `"colorWheel": "Color wheel"`. |
| DOC-015 | FIXED | `en.json` `tools.presets.title` = "Community Presets" (ja/de/fr/ko/zh follow); router-service.ts:80 uses that key; community-presets.md:1, tools.md:222, overview.md:22 and `apps/web-app/CLAUDE.md:21` agree. No "Preset Palettes" left in the web-app docs. |

## Candidates

### cand-web-app-core-01 (MEDIUM, inaccurate) "Manage Collections / Export All" path does not exist in the shipped shell
- Docs: faq.md:99-104 (the whole "Can I export my saved palettes?" answer); favorites-collections.md:86 ("those have their own export") and :87 (the Manage Collections / Export All / Import / per-palette download instruction); also corroborated outside the cluster by `apps/web-app/PRIVACY.md:60` ("Manage Collections -> Delete Collection").
- Claim: open a dye-picker tool, expand the Favorites panel, press **Manage Collections**, then **Export All** / **Import**.
- Truth: the only caller of `showCollectionManagerModal()` is the button inside `DyeSelector.createFavoritesPanel()`, and no tool leaves a DyeSelector in the DOM. Every tool renders its DyeSelector into `leftPanel`, then `renderRightPanel()` calls `clearContainer(right)`, and the v4 shell passes the same element for both (`leftPanel: mainPanel, rightPanel: mainPanel`). `CollectionService.exportAll/importData` have no other UI caller. The repo's own e2e header says so.
- Evidence: `apps/web-app/src/components/dye-selector.ts:553-566`; `src/components/v4-layout.ts:589-596` (same element for both panels); `src/components/accessibility-tool.ts:504-519` (selector built in left) vs `:743-745` (`clearContainer(right)`; same shape in harmony-tool.ts:942/1122-1124, mixer-tool.ts:1062/1483-1487, comparison-tool.ts:476/888-890); `e2e/ui-interactions.spec.ts:16-18` ("`#manage-collections-btn` lives in dye-selector.ts, which Q7 unmounted when the drawer replaced the persistent left column"); `grep -rn "exportAll\|importData" src` shows only collection-manager-modal.ts. `dye-palette-drawer.ts` contains no manage/export UI.
- Suggested fix: remove the instruction (or say plainly that device-local favorites and palettes have no export in this release; the Backup card exports settings only). Maintainer call whether the missing UI is a product bug. A verifier should confirm once in the running app (open Harmony, look for "Manage Collections").

### cand-web-app-core-02 (MEDIUM, inaccurate) Advanced Settings card is "Behavior" in the UI, docs say "Behaviour"
- Docs: components.md:49 (**Behaviour**), faq.md:158 (**Behaviour** in Advanced Settings), getting-started.md:144 (**Behaviour**).
- Truth: `en.json:1160` `"behaviorTitle": "Behavior"`, rendered from `advanced.behaviorTitle` (advanced-options-panel.ts, the third section card). A reader scanning the panel for "Behaviour" finds "Behavior".
- Fix: quote the label as "Behavior" in all three places. (Same class as DOC-014: a stale quotation, not only a spelling slip.)

### cand-web-app-core-03 (MEDIUM, inaccurate) Harmony wheel control is quoted as "Colour wheel"; shipped label is "Color wheel" (supersedes 2026-09-21-documentation/DOC-014)
- Docs: components.md:47; tools.md:31 (the heading "Colour wheels." is ordinary spelling and belongs to the spelling count; the same paragraph's "**Colour wheel** select" is a quoted control name).
- Truth: `en.json:176` `"colorWheel": "Color wheel"`, used by config-sidebar.ts.
- Fix: quote as `Color wheel`.

### cand-web-app-core-04 (MEDIUM, inaccurate) components.md names symbols that no longer exist (plus one in tools.md)
- components.md:35 `SubscriptionManager.addAll` (removed in 057cba2f, Sprint 23 DEAD-019; the class has only `add` and `unsubscribeAll`, subscription-manager.ts:46,55). components.md:37 `BaseLitComponent.clearError()` (removed b3b7f252; only `setError` exists, base-lit-component.ts:93). components.md:136 `getMarketBoardService()` and `storage-service`'s `SecureStorage` (git grep: 0 hits in src; storage-service.ts exports `StorageService`, `NamespacedStorage`, `appStorage`). components.md:158 `consumeReturnTool` (0 hits; auth-service.ts only reads `OAUTH_RETURN_TOOL_KEY` at :566). components.md:160 `resolveCharaGear` (the export is `resolveCharaEquipment`, chara-resolve-service.ts:147). components.md:163 and tools.md:91 `MixerBlendingEngine` / `blendColors` (the module exports `blendTwoColors`, `calculateColorDistance`, `findMatchingDyes`, `getContrastColor`; no class, no `blendColors`; services/mixer-blending-engine.ts:69-168). components.md:164 and :185 `getCardDisplayOptions` (display-options-helper.ts exports only `applyDisplayOptions` + `DEFAULT_DISPLAY_OPTIONS`).
- Fix: `SubscriptionManager` -> `add`, `unsubscribeAll`; `BaseLitComponent` -> `setError()` only; drop `getMarketBoardService()` and `SecureStorage`; drop `consumeReturnTool`; `resolveCharaGear` -> `resolveCharaEquipment`; `MixerBlendingEngine` row -> "`blendTwoColors`, `findMatchingDyes` ... (functions, not a class)"; drop `getCardDisplayOptions`.

### cand-web-app-core-05 (LOW, inaccurate) Glamour Reader missing from the "no palette drawer" lists
- Docs: components.md:48 ("Hidden for `extractor` and `presets` (`TOOLS_WITHOUT_PALETTE`)"); getting-started.md:45 ("every tool that takes dyes (all but Palette Extractor and Community Presets)"); favorites-collections.md:34 ("Not available in Palette Extractor or Community Presets").
- Truth: `v4-layout-shell.ts:97` `TOOLS_WITHOUT_PALETTE = ['extractor', 'presets', 'glamour']`. tools.md:11 already says all three.
- Fix: add the Glamour Reader to each.

### cand-web-app-core-06 (LOW, inaccurate) Tool counts still stop at nine in components.md / overview.md
- Docs: components.md:23 ("abstract base for the eight imperative tools"); components.md:56-70 (the "One per `ToolId`" table lists nine rows, no `glamour` / `GlamourTool` / `components/glamour-tool.ts`); overview.md:136 ("the ninth tool, Lit" - Community Presets is the tenth tool; only the imperative count is nine).
- Truth: `GlamourTool extends BaseComponent` (glamour-tool.ts:29), mounted at v4-layout.ts:692-693; tools.md:9 correctly says nine imperative + the Lit one = ten; `ROUTES` has ten (router-service.ts:74-85).
- Fix: "nine imperative tools", add a `glamour` row, "the tenth tool". Also components.md:74 and overview.md:124 describe `glamour-block.ts` as the Swatch Matcher's view (it is the Glamour Reader's since 5.13.0; components.md:74 says so itself, overview.md:124 does not).

### cand-web-app-core-07 (LOW, inaccurate) Bundle payload budget is 2,250 KB, not 2,200 KB
- Doc: components.md:191 ("JS payload (one locale) against a 2,200 KB total").
- Truth: `scripts/check-bundle-size.js:200` `PAYLOAD_JS_LIMIT = 2250 * KB` (raised in 5.13.0; comment at :193-197); a separate all-locales artifact cap `TOTAL_JS_LIMIT = 2800 * KB` at :209. The 60 KB default (:176 region, `DEFAULT_CHUNK_LIMIT`) is right.
- Fix: 2,250 KB.

### cand-web-app-core-08 (LOW, inaccurate) theming.md names a `.glass-panel` rule that does not exist
- Doc: theming.md:83-85 ("consumed by the `.glass-panel` rule in `components/v4/base-lit-component.ts`'s shared `baseStyles`").
- Truth: `grep -rn glass-panel apps/web-app/src` finds nothing; `baseStyles` (base-lit-component.ts:34-50) only sets `:host`/box-sizing; each component reads `var(--v4-glass-bg|blur|border)` itself (config-sidebar.ts:341-344, dye-palette-drawer.ts:146-149, preset-detail.ts:186-189 ...). components.md:5 even lists `glass-panel` among names that no longer exist. `ThemeService.applyTheme()` does set `--v4-glass-bg` (theme-service.ts:277).
- Fix: "consumed directly by components (`var(--v4-glass-bg)`, `--v4-glass-blur`, `--v4-glass-border`)".

### cand-web-app-core-09 (LOW, inaccurate) Production deploy path filter omits the four root inputs
- Doc: overview.md:228 ("under the `apps/web-app/**` + `packages/{core,types,logger,svg}/**` path filter"); the beta row (:229) names no filter, though it has the same one.
- Truth: `.github/workflows/deploy-web-app.yml:5-22` and `deploy-web-app-beta.yml` add `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` (BUG-153), so a lockfile-only bump redeploys the app.
- Fix: append "plus the four root inputs".

### cand-web-app-core-10 (MEDIUM, handoff-security) FAQ tells users to request data deletion in a public channel and under-lists stored identifiers
- Docs: faq.md:163 ("contact us via GitHub issues or Discord to request data deletion"); faq.md:155 ("Discord ID (if logged in)" as the account datum).
- Truth: the Privacy Guide says the opposite for GitHub: "Please don't ask in a public GitHub issue" and gives email (subject "XIV Dye Tools Privacy") or a Discord DM to the maintainer (`apps/web-app/PRIVACY.md:258-266`). It also records XIVAuth ID + verified character name, optionally a linked Discord ID (`PRIVACY.md:84-88`), and `en.json:1018` says the same at sign-in; the FAQ itself offers XIVAuth sign-in at :15.
- Owner: security-audit (policy claims). Fix: point at the Privacy Guide's "Deleting your data" routes and say "your Discord or XIVAuth ID and a display name".

### cand-web-app-core-11 (LOW, inaccurate) "Color Harmony" used as a tool name; the tool is "Harmony Explorer"
- Docs: faq.md:101; getting-started.md:113; favorites-collections.md:87 (inside cand-01's text).
- Truth: `en.json` `tools.harmony.title` = "Harmony Explorer", shortName "Harmony"; the rail and menu never say "Color Harmony" (the string is not a UI label). The guide's file name `color-harmony.md` is fine as a link target.
- Fix: "Harmony Explorer".

### cand-web-app-core-12 (LOW, inaccurate) Locale key count 1,152 -> 1,177 (supersedes 2026-09-21-documentation/DOC-012)
- Docs: components.md:197 (present tense: "1,152 keys per language"); overview.md:28 (inside "New in v5.0.0": "grew to 1,152 keys x 6", a release-history figure the verifier may leave).
- Truth: 1,177 in each of en/ja/de/fr/ko/zh (`node scripts/i18n-parity.mjs` prints "EN keys 1177" with missing=0 extra=0 for every locale).
- Fix: drop the number (it goes stale each key change) or write 1,177.

### cand-web-app-core-13 (LOW, spelling) 102 British spellings in 7 documents (supersedes 2026-09-21-documentation/DOC-001)
- Top documents: docs/projects/web-app/tools.md (40), docs/projects/web-app/components.md (19), docs/user-guides/web-app/accessibility.md (19). Full table below. No `--all` extras (0). Overlaps with cand-02/03: components.md:47,49, tools.md:31, faq.md:158, getting-started.md:144 are counted here as spellings and also carry the label findings.
- Fix: `node .agents/skills/audit-shared/scripts/american-spelling.mjs . <files> --fix`, then re-read the quoted labels (they must follow en.json, which is already American).

## Spelling per-document table

| document | confirmed |
|---|---|
| docs/projects/web-app/tools.md | 40 |
| docs/projects/web-app/components.md | 19 |
| docs/user-guides/web-app/accessibility.md | 19 |
| docs/user-guides/web-app/getting-started.md | 12 |
| docs/user-guides/web-app/favorites-collections.md | 7 |
| docs/user-guides/web-app/faq.md | 3 |
| docs/projects/web-app/overview.md | 2 |
| docs/projects/web-app/theming.md | 0 |
| docs/user-guides/web-app/community-presets.md | 0 |
| **total** | **102** |

Triage: all 102 default-sweep rows are prose-zone ordinary spelling. The one `glossary?` row (tools.md:205 "grey when the pick is a free choice") is a chip colour, not a game term or Facewear/dye name, so it is confirmed. tools.md:31 "Colour wheels" heading is ordinary spelling (standing rule) and is counted. `--all` extras: none. A manual grep for -ise/-our/-re/-ll- and other British forms found nothing the dictionary missed (data "centre(s)" at components.md:149 and getting-started.md:167 are already in the 102).

## Rejected suspicions

- Seed 1 (DOC-015): confirmed fixed, not a defect (see priors).
- Seed 2 (overview.md:121 "nine of the ten tools"): the listed files are harmony, extractor, accessibility, comparison, gradient, mixer, budget, swatch, glamour = nine imperative tools, and the tenth (Presets) is in the `v4/` lines. Correct. (The sibling "the ninth tool" at :136 is wrong - cand-06.)
- welcome-modal.ts lists four leads + five in the mono row (nine of ten tools; the Glamour Reader is absent). getting-started.md:119 and components.md:115 describe that accurately ("lists the other five"); the omission is app behaviour, not a doc error. Mentioned only for the maintainer.
- Telemetry/privacy statements in components.md:159 (default off, `globalPrivacyControl`) match `advanced.analyticsEnabled: false` and telemetry-service.ts; no differing policy claim there.
- faq.md:66 "Log in with Discord": incomplete (XIVAuth also works) but not wrong; not filed.
- overview.md:64 "10 Tools Total - Up from 7" sits in the "New in v4.0.0" history with its own 5.13.0 parenthesis; allowed past-release row.
- theming.md:57-58 fallback wording: after migration only an empty/absent value reaches `standard-dark`; the sentence is loosely phrased but not contradicted by theme-service.ts:155-173.
- tools.md:31 heading "Colour wheels" as a separate label finding: standing rejection, counted only in spelling.

## Positive controls (claims that checked out)

- Tool rail order, 38 px chips, 54 px bar, 769-919 px wordmark yield, `aria-current` (v4-app-header.ts:12-19,54-65,457; themes.css:59-64).
- `ROUTES`/keyboard map: 1-9 first nine in ROUTES order, 0 = glamour (router-service.ts:74-85, keyboard-service.ts:27-42); tools.md route table and getting-started.md shortcut table agree.
- `DEFAULT_CONFIGS` (tool-config-types.ts:406-500) matches every default in tools.md (harmony, extractor 4, gradient 8/hsv, mixer 4/ryb, comparison 5, budget 8, swatch eye/Midlander/Male/3, presets feed*/saved*).
- Share grammar: stainID 1-254, legacy >= 5729 rejected, `lang=` for non-English, `v=1` (share-service.ts:52-53,241-246,362); harmony `wheel` always written (harmony-tool.ts:1895-1906).
- IndexedDB v3 stores and `image_cache` deletion (indexeddb-service.ts:16-24,131-132); `ConfigController` key prefix and method names; `ModalService` API and `MAX_MODALS = 3`; advanced panel 392 px variant `panel`.
- Theme API and legacy migration (`cotton-candy`, `parchment-light`), default `standard-dark`, storage key `xivdyetools_theme`, `--v4-*` tokens, Tailwind config with no `darkMode`/plugins.
- Env vars, api-worker origin fallback (`localhost:8790` dev / `data.xivdyetools.app` prod), `/v1/telemetry`, `/v1/chara/resolve`, beta deploy mechanics (`--branch=beta`, smoke test, bundle and beta checks in both workflows).
- Accessibility guide: every quoted string and prevalence figure matches `en.json` `accessibility.*`; WCAG 1.4.11 link label; default share lens `protanopia`.
- Community Presets guide: tabs, categories, feed settings, 15 official palettes (events 8 / seasons 4 / grand-companies 3), name 2-50, description 10-200, 3-6 dyes, 200 saved, 10 submissions/day (rate-limit-service.ts:23), allowed `/preset` subcommands, no delete in the bot.
- Favorites limits 40 / 50 collections / 20 dyes / name 50 (collection-service.ts:142-145); Advanced Settings Data buttons and strings.
- All 60-odd backticked file names resolve or are deliberately listed as removed; every other backticked identifier exists (apart from cand-04).
