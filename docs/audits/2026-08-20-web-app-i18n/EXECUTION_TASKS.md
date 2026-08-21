# Execution tasks — web-app i18n remediation (2026-08-20)

Task-structured rendering of [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) (the sprint plan) for subagent-driven execution. Each task = one commit on branch `i18n-remediation-2026-08-20` (worktree `C:\dev\XIVProjects\.worktrees\xivdyetools-i18n`). Finding IDs refer to [HARDCODED_STRINGS.md](HARDCODED_STRINGS.md), [TERMINOLOGY_VIOLATIONS.md](TERMINOLOGY_VIOLATIONS.md), [FONT_SUBSET_AUDIT.md](FONT_SUBSET_AUDIT.md), [I18N_AUDIT_2026-08-20.md](I18N_AUDIT_2026-08-20.md); line-level detail is in `evidence/hardcoded-scan-group1..7.md`.

## Global Constraints (bind every task)

- **Work dir:** `C:\dev\XIVProjects\.worktrees\xivdyetools-i18n\apps\web-app`. Only files under `apps/web-app/` (plus `docs/audits/2026-08-20-web-app-i18n/` and `docs/reference/ffxiv-terminology.md` where a task says so) may change. Never touch `packages/*` — core locale JSON is **generated** (from `dyenames.csv`/`localize.yaml`); nothing in this plan edits core.
- **Locale files:** `src/locales/{en,de,fr,ja,ko,zh}.json`. Every key added/removed/renamed lands in **all six files in the same commit**, inserted at the **same position** (same parent object, same neighbour) in each file; 2-space indent, no trailing commas, UTF-8, keep the file ending with a single newline.
- **Orphan gate:** `npm run i18n:unused` (and `src/__tests__/i18n-orphans.test.ts`) fails on any key that no source file references. Every key you add must be referenced by source in the same commit; every key whose last reference you remove must be deleted from all six files in the same commit. `npm run validate:i18n` must also pass (every referenced key exists ×6).
- **Dynamic key references:** `scripts/analyze-unused-keys.js` resolves template references such as `` t(`swatch.slotError.${code}`) `` only when the prefix is literal — read the script's prefix-handling before relying on a dynamic key; if in doubt, reference each key literally (e.g. a `Record<code, key>` map).
- **Translation authoring:** write real de/fr/ja/ko/zh (not English). Match the register of neighbouring keys in the same namespace. Game nouns from `docs/reference/ffxiv-terminology.md` / core runtime values: dye = カララント / Farbstoff / teinture / 염료 / 染剂; Gil = ギル / Gil / gil / 길 / 金币; Market Board = マーケットボード / Marktbrett / tableau des ventes / 시장 게시판 / 市场板. Preserve `{placeholders}` verbatim. ja/zh use fullwidth punctuation (。、：（）), fr uses ` :` / ` ;` with a space, de capitalises nouns. Brand names (XIV Dye Tools, Universalis, Discord, XIVAuth, FFXIV) stay as-is.
- **API surface:** `LanguageService.t(key)`, `LanguageService.tInterpolate(key, {param})` (`{param}` braces), `LanguageService.getCurrentLocale()`, `getDyeName(itemID)`, `getCategory(cat)`, `getAcquisition(acq)`, `getCurrency(cur)`, `getHarmonyType(key)`, `getVisionType(key)`, `getRace(key)`, `getClan(key)`, `LanguageService.subscribe(listener) → unsubscribe`. `t()` returns the key itself when missing (never empty) — `t(...) || 'fallback'` is dead code. `ToastService.success/error/warning/info(message, details?)`.
- **Lit components** re-render on locale change only if they subscribe: pattern in `src/components/v4/v4-app-header.ts:77-90` (`connectedCallback` → `this.languageUnsubscribe = LanguageService.subscribe(() => this.requestUpdate())`; `disconnectedCallback` → unsubscribe). BaseComponent tools use `this.subscriptions.add(LanguageService.subscribe(() => this.update()))` (see `budget-tool.ts:260`).
- **Plurals:** house pattern is a `…One` / `…Many` key pair chosen in code (`chara-import.ts:1345`: `n === 1 ? t('swatch.footEmptyOne') : tInterpolate('swatch.footEmptyMany', {n})`). Do not invent ICU syntax.
- **Tests:** vitest 4 + jsdom, `src/**/__tests__/*.test.ts`. Add or extend a test for behaviour you change when the task says so; existing tests that assert the old English literal must be updated, not deleted. Run focused tests while iterating; run the full gate once before committing.
- **Gate before every commit (all must pass):** `npm run lint && npm run type-check && npm run validate:i18n && npm run i18n:unused && npm run test -- --run` (from `apps/web-app`). `npm run lint` includes knip; if knip reports a newly-unused export you created, fix it (don't add ignores).
- **Commit:** one commit per task, conventional style `type(web-app): summary` (e.g. `i18n(web-app): …`, `fix(web-app): …`, `refactor(web-app): …`, `chore(web-app): …`); body lists the finding IDs closed; end with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Stage only the files you changed (`git add <paths>`), never `git add -A`. Do not push.
- **Do not** rename existing keys, re-order existing keys, or reformat locale files beyond your edits. Do not change `packages/`. Do not widen scope: if you see an adjacent defect, note it in your report.

---

## Task 1: Sprint 0a — delete dead components and dead helpers (HC-SYS-012)

Delete, with their imports/fields/tests:
- `src/components/harmony-result-panel.ts` and `src/components/color-wheel-display.ts` — both imported by `src/components/harmony-tool.ts` (lines ~19-20) for *types only* and declared as fields; neither is ever constructed (results render via `<v4-result-card>`, the wheel via `<v4-color-wheel>`). Remove the imports and the unused fields/any dead code paths that only served them.
- `src/components/recent-colors-panel.ts` — imported by `src/components/extractor-tool.ts:18`, never instantiated. Remove the import and any field/dead branch.
- `src/components/dye-card-renderer.ts` and `src/components/__tests__/dye-card-renderer.test.ts` — no importer except its own test.
- `src/services/announcer-service.ts` lines ~185-270: the convenience helpers (`announceResults`/`announceSelection`/… — the English-template methods with zero callers). Keep `announce()` and whatever the rest of `src/` calls. Grep callers before deleting each.
- `src/services/preset-submission-service.ts` `getStatusInfo()` (~339-365) — no callers.

Also delete tests that exist only for the removed files (check `src/components/__tests__/` and `src/services/__tests__/` for `harmony-result-panel`, `color-wheel-display`, `recent-colors-panel`, `announcer-service` tests that cover the deleted helpers — trim those tests, keep the rest).

Locale keys: if deleting code removes the last reference to any key, `npm run i18n:unused` will list it — delete those keys from all six locale files in this commit. Expected candidates: none known, but verify.

Verify: `npx knip --production` from `apps/web-app` shows no new unused files/exports; full gate; commit `chore(web-app): delete four never-constructed components and dead announcer/status helpers (HC-SYS-012)`.

## Task 2: Sprint 0b — shared helpers: custom dye, number/gil formatting, localized dye name

Create three small modules with unit tests (`src/shared/__tests__/`):

1. `src/shared/custom-dye.ts`
   - `export const CUSTOM_DYE_SENTINEL = '__custom__' as const;`
   - `export function makeCustomDye(hex: string): Dye` — returns the same shape the seven tools build today (look at `gradient-tool.ts` ~2755-2770 `createCustomDye` for the field list: negative/synthetic ids, `rgb`/`hsv`/`lab` derived via the same core helpers they use, `isCustom`-style flags if present) but with `name = LanguageService.tInterpolate('common.customColorName', { hex: hex.toUpperCase() })`, `category = CUSTOM_DYE_SENTINEL`, `acquisition = CUSTOM_DYE_SENTINEL`. Cast as the existing code does.
   - `export function isCustomDye(dye: Pick<Dye,'category'>): boolean`
   - `export function customDyeLabel(): string` → `LanguageService.t('common.custom')` — the label render sites will use for category/acquisition of a custom dye.
   - Do **not** wire the tools yet (Task 8 does); this task only provides the module + tests (name uses the key, sentinel set, isCustomDye true/false).
2. `src/shared/format.ts`
   - `formatNumber(n: number, locale = LanguageService.getCurrentLocale()): string` → `n.toLocaleString(locale)`
   - `formatDate(d: Date | string | number, locale = LanguageService.getCurrentLocale()): string` → `new Date(d).toLocaleDateString(locale)`
   - `formatGil(n: number): string` → `LanguageService.tInterpolate('common.gilAmount', { n: formatNumber(n), unit: LanguageService.getCurrency('Gil') })`
   - Tests: de → `1.234`, en → `1,234`; formatGil uses the key (mock LanguageService the way `src/components/__tests__/image-zoom-controller.test.ts` does).
3. `src/shared/dye-name.ts`
   - `localizedDyeName(dye: Pick<Dye,'itemID'|'name'>): string` → `LanguageService.getDyeName(dye.itemID) ?? dye.name` (use `||` only if `getDyeName` can return `''` — check its signature: it returns `string | null`).
   - `compareDyeNames(a, b): number` → `localizedDyeName(a).localeCompare(localizedDyeName(b), LanguageService.getCurrentLocale())`
   - `dyeNameMatches(dye, query: string): boolean` → case-insensitive `includes` against BOTH the localized name and `dye.name`.

Locale keys (add to `common` in all six, after `"spectrum"` or wherever `common` ends — same position in each file):
- `common.custom` = "Custom" (de "Benutzerdefiniert", fr "Personnalisé", ja "カスタム", ko "사용자 지정", zh "自定义")
- `common.customColorName` = "Custom ({hex})" (de "Benutzerdefiniert ({hex})", fr "Personnalisé ({hex})", ja "カスタム（{hex}）", ko "사용자 지정 ({hex})", zh "自定义（{hex}）")
- `common.gilAmount` = "{n} {unit}" for en/de/fr/ko/zh; ja "{n}{unit}" (no space before ギル). All six carry both placeholders.

All three keys are referenced by the new modules, so the orphan gate stays green. Full gate; commit `feat(web-app): shared custom-dye, format, and dye-name helpers for i18n remediation`.

## Task 3: Sprint 0c — locale one-liners L-1…L-7 + terminology doc drift

Edit values only (no key changes):
- `src/locales/fr.json`: `config.mixingOklab` → `Perceptuel moderne`, `config.mixingRyb` → `Peinture`, `config.mixingHsl` → `Basé sur la teinte` (strip the leading space).
- `src/locales/ko.json`: `swatch.absentFurPattern` → replace `로스가르` with `로스갈`.
- `preset.gateBrowseNote`: ja → `アカウント不要、レート制限なし。`; ko → `계정 불필요, 속도 제한 없음.`; zh → `无需账号，无速率限制。`
- `docs/reference/ffxiv-terminology.md` (monorepo `docs/`, NOT web-app): § Color Harmony Types — ja Shades cell `明度配色` → `シェード` (runtime core value); add a row for `Inverted Tetradic` with core's runtime values (read them from `packages/core/src/data/locales/{ja,de,fr,ko,zh}.json` `harmonyTypes.invertedTetradic`; en = "Inverted Tetradic").

Verify `validate:i18n` + `i18n:unused` + `npm run test -- --run` (language-service tests); commit `fix(web-app): locale one-liners — fr leading spaces, ko Hrothgar, gateBrowseNote clause; sync terminology doc (L-1..L-7, TERM-001)`.

## Task 4: Sprint 1a — palette drawer category headings (HC-SYS-001 / TERM-002)

`src/components/v4/dye-palette-drawer.ts`:
- Delete `DYE_CATEGORY_ORDER` (lines ~33-45) and `CATEGORY_TRANSLATION_KEYS` (~50-61).
- `groupByCategory()` (~826-841): group by runtime `dye.category` in a fixed order taken from core — use the order core exposes if there is an exported category list (grep `@xivdyetools/core` for a `DYE_CATEGORIES`/`CATEGORY_ORDER` export); otherwise define `const CATEGORY_ORDER = ['Neutral','Reds','Browns','Yellows','Greens','Blues','Purples','Special'] as const` locally (the real runtime values — `Facewear` is already filtered out at ~759) and append any unknown category at the end as today.
- Heading render (~1327): `${LanguageService.getCategory(category)}`.
- Delete keys `colorPalette.whites, grays, blacks, browns, reds, oranges, yellows, greens, blues, purples, pinks` from all six locale files (they become orphans).
- Update/extend `src/components/v4/__tests__/dye-palette-drawer.test.ts` (or create it if absent): a test that renders a drawer with dyes in `Reds`/`Blues` and asserts the heading text equals `LanguageService.getCategory('Reds')` (mock it to return a marker like `赤系`) and that no `Translation not found` warning is logged.

Full gate; commit `fix(web-app): palette drawer category headings use core getCategory — map never matched runtime categories (HC-SYS-001, TERM-002)`.

## Task 5: Sprint 1b — localize preset-edit-form.ts and preset-submission-form.ts (HC-PRE-001, HC-PRE-002)

Use `src/components/preset-submission-form.ts` as the template for what is already keyed; bring `src/components/preset-edit-form.ts` to parity and close the submission form's own gaps.

`preset-edit-form.ts` — replace every literal (see `evidence/hardcoded-scan-group6.md` rows for lines): title `Edit Preset` → new `preset.editTitle`; `Preset Name` → `preset.fieldName`; `Description` → `preset.fieldDesc`; `Select Dyes` → `preset.dyes` (+ `preset.dyesReq` chip the way the submission form does at ~350); `Tags (optional)` → `preset.fieldTags` + `preset.reqOptional`/`common.optional` as the submission form does; `Search dyes...` → `colorPalette.searchPlaceholder`; `No dyes found` → `colorPalette.noDyesFound`; `All matching dyes selected` → new `preset.allMatchingSelected`; `Cancel` → `common.cancel`; `Save Changes` (×2) → new `preset.saveChanges`; `Saving...` → new `preset.saving`; `Max N tags, 30 chars each` → new `preset.fieldTagsLimit` "Max {max} tags, {chars} chars each"; placeholders → new `preset.fieldNamePlaceholder` ("e.g., Dark Knight Abyssal"), `preset.fieldDescPlaceholder` ("Describe your color palette and when to use it..."), `preset.fieldTagsPlaceholder` ("e.g., dark, edgy, tank (comma-separated)"); the `(min N)` counters → new `preset.counterWithMin` "{n}/{max} (min {min})"; the four validation toasts → new `preset.validation.nameMin` "Name must be at least {n} characters", `preset.validation.descMin` "Description must be at least {n} characters", `preset.validation.dyesMin` "Must include at least {n} dyes", and existing `preset.maxDyesAllowed`; `another preset` fallback → new `preset.anotherPreset`; dye chip text + swatch title → `localizedDyeName(dye)` from `@shared/dye-name`; search filter (~380) → `dyeNameMatches(d, query) || category match as today`. Show one toast per validation error instead of `errors.join('. ')`.

`preset-submission-form.ts` — placeholders → the same three `preset.field*Placeholder` keys (so share them); `Click dyes below to add them...` → new `preset.clickDyesToAdd`; `chip.title = 'Click to remove'` → new `preset.clickToRemove`; `Search dyes by name...` → `dyeSelector.searchPlaceholder`; `Submitting...` → new `preset.submitting`; `existing preset` → `preset.anotherPreset`; chip name/tooltip → `localizedDyeName`; search (~485) → `dyeNameMatches`; counters → `preset.counterWithMin`; `${t('preset.dyes')} — ${t('preset.dyesReq')}` (~350) may stay (two chips) — leave as-is.

Do **not** touch `preset-submission-service.ts` (Task 6 does). Add the new keys ×6 inside the `preset` object (group the `validation` sub-object at the end of `preset`). Update existing tests for both forms that assert the old literals (`src/components/__tests__/preset-edit-form.test.ts`, `preset-submission-form.test.ts` if present). Full gate; commit `i18n(web-app): localize preset edit/submission forms (HC-PRE-001, HC-PRE-002)`.

## Task 6: Sprint 1c — preset/vote/collection services return codes; callers map to keys (HC-SYS-011)

`src/services/preset-submission-service.ts`:
- `validateSubmission()` / the edit-side validation (~93-136, ~466-509): return `{ field, code }` where `code` ∈ `nameMin | nameMax | descMin | descMax | category | dyesMin | dyesMax | dyesInvalid | dyesRange | tagsArray | tagsMax | tagLength` (keep the existing `message` field too if other callers/tests read it, but callers below stop displaying it).
- Transport/auth returns (`'You must be logged in to submit presets'` ~207, `'Submission failed'` ~252, `'Request timed out. Please try again.'` ~277/583, `'Failed to submit preset. Please try again.'` ~284, `'You must be logged in to edit presets'` ~457, `'Edit failed'` ~567, `'Failed to edit preset. Please try again.'` ~590, `'This dye combination already exists as "…"'` ~559): return an `errorCode` alongside/instead of `error` — `notLoggedInSubmit | notLoggedInEdit | submitFailed | editFailed | timeout | network | duplicate`. Keep the presets-api wire `result.message` available as `details` for the toast if present.
- Callers: `preset-submission-form.ts:~674/737` and `preset-edit-form.ts:~716` map code → key: validation codes → `preset.validation.<code>` (add `nameMax` "Name must be {n} characters or less", `descMax` "Description must be {n} characters or less", `category` "Please select a valid category", `dyesInvalid` "Invalid dye selection", `tagsMax` "Maximum {n} tags allowed", `tagLength` "Each tag must be {n} characters or less"; reuse `preset.maxDyesAllowed` for `dyesMax`; `dyesRange`/`tagsArray` are dev-guards — map to `errors.unexpectedError`); transport codes → `preset.loginToSubmit` / `preset.loginToEdit` / `errors.submitPresetFailed` / `errors.saveChangesFailed` / new `errors.requestTimeout` "Request timed out. Please try again." / new `errors.networkError` "Network error — please try again." / `preset.duplicateFound` (already used for the duplicate branch — keep). One toast per validation error.
`src/services/community-preset-service.ts` (~363-455): vote/unvote results return `errorCode` ∈ `notLoggedIn | alreadyVoted | voteFailed | removeVoteFailed | network`; `src/components/v4/preset-detail.ts:~743/759` map to `preset.loginToVote` / `preset.alreadyVoted` / `errors.voteFailed` / `errors.removeVoteFailed` / `errors.networkError`.
`src/services/collection-service.ts` import path (~933-1003): `errors[]` become codes `invalidFormat | missingData | skippedInvalid(name) | createFailed(name) | parseFailed`; `src/components/collection-manager-modal.ts:~553-557` maps to `collections.invalidFormat` (for invalidFormat/missingData/parseFailed), new `collections.importSkippedInvalid` "Skipped invalid collection: {name}", new `collections.importCreateFailed` "Failed to create collection: {name}"; the generated `${name}_imported_${suffix}` (~971) → new `collections.importedSuffix` "{name} (imported {n})".
Keep the services' existing unit tests green by updating assertions to codes (`src/services/__tests__/preset-submission-service.test.ts`, `community-preset-service.test.ts`, `collection-service.test.ts` if present). Add the new keys ×6 (`errors.requestTimeout`, `errors.networkError`, the `preset.validation.*` additions, `collections.*`). Full gate; commit `refactor(web-app): preset/vote/collection services return error codes; UI maps them to locale keys (HC-SYS-011)`.

## Task 7: Sprint 1d — remaining preset-surface Highs (HC-PRE-003, HC-PRE-004, HC-PRE-005, vote/result counts)

- `src/components/v4/preset-detail.ts`: `:845` `Loading preset...` → new `preset.loadingOne`; `:1015` `Login with Discord or XIVAuth to vote for this preset` → `preset.loginToVote` (identical value exists); `:934` `` `${dye.cost.toLocaleString()}g` `` → `formatGil(dye.cost)` from `@shared/format`; `:885` `★ ${count} ${t('preset.votesLabel')}` → `tInterpolate('preset.votesCount', {n})` (new key "{n} votes" with a `preset.votesCountOne` "{n} vote" sibling chosen when n === 1); `:796` `gil.toLocaleString()` → `formatNumber`.
- `src/components/my-submissions-modal.ts:~139-141` → the same `preset.votesCount`/`votesCountOne`.
- `src/components/v4/preset-card.ts:412` bare dye count → new `preset.dyeCountShort` "{n} dyes" (+ `preset.dyeCountShortOne` "{n} dye").
- `src/components/v4/preset-tool.ts:942` `${n} ${t('preset.resultsWord')}` → new `preset.resultsCount` "{n} presets" (+ `preset.resultsCountOne` "{n} preset"); if `preset.resultsWord` loses its last reference, delete it ×6.
- `src/components/add-to-collection-menu.ts:220` `Full` → new `collections.full` "Full".
Update affected tests. Full gate; commit `i18n(web-app): preset detail/card/tool and collection menu — loading, login CTA, gil, counts (HC-PRE-003..005)`.

## Task 8: Sprint 2a — one custom-dye factory for seven tools (HC-SYS-002)

Replace the ad-hoc `Custom (#HEX)` dye construction with `makeCustomDye(hex)` from `@shared/custom-dye` in: `gradient-tool.ts` (~2760 `createCustomDye`), `comparison-tool.ts` (~2410 `selectCustomColor`), `harmony-tool.ts` (~2044), `mixer-tool.ts` (~853), `accessibility-tool.ts` (~418), `budget-tool.ts` (~1877), `swatch-tool.ts` (~637 `reverseDyeName` — here only the *name* is built; use `tInterpolate('common.customColorName', {hex})` or `makeCustomDye(hex).name`). Keep each tool's synthetic id scheme.
Render sites that print category/acquisition must map the sentinel: `src/components/v4/result-card.ts` acquisition line (~1609 `getAcquisition(...)`) and category label(s); `comparison-tool.ts` SOURCE row (~1761); `budget-tool.ts` verdict/target card; any `getCategory(dye.category)` / `getAcquisition(dye.acquisition)` call that can receive a custom dye → `isCustomDye(dye) ? customDyeLabel() : LanguageService.getAcquisition(...)`. Grep `getAcquisition(` and `getCategory(` across `src/components` and guard each site that can see a custom dye.
Add a test in `src/components/v4/__tests__/result-card.test.ts` (or the nearest existing) asserting a custom dye renders `common.custom` for acquisition and the interpolated name. Full gate; commit `refactor(web-app): single makeCustomDye() factory; custom dye name/category/acquisition localized in all tools (HC-SYS-002)`.

## Task 9: Sprint 2b — gil/currency, route titles, tool-load strings (HC-SYS-003, HC-SYS-006, HC-V4-005, HC-V4-006)

- `formatGil()` at `budget-tool.ts:~781, 1516, 1518 (range: formatNumber(min) – formatGil(max)), 1526, 1539`, `mixer-tool.ts:~2205`, `comparison-tool.ts:~1636` (the `{saving}` passed into `comparison.costDiff`), `v4/result-card.ts:~1013` (`${price} G` → `formatGil(price)`). `budget-tool.ts:~1523` `${price} ${tierMeta.currency}` → `${formatNumber(price)} ${LanguageService.getCurrency(tierMeta.currency)}`. `budget-tool.ts:~1529` `${t('budget.boardWord')} ${price}` → new `budget.boardPrice` "board {price}"; `~1540` `${t('budget.orWord')} ${cost}` → new `budget.orLocalCost` "or {cost}"; delete `budget.boardWord`/`budget.orWord` ×6 if they lose their last reference.
- `src/services/router-service.ts`: `ROUTES[].title` → `titleKey: 'tools.<id>.title'` (keys exist for all nine ids — verify each in en.json; `presets` may be `tools.presets.title`, `swatch` may be `tools.swatch.title` or `tools.character.title` — check and use what exists); the four `document.title = …` sites use `LanguageService.t(route.titleKey)`; export a `RouterService.refreshDocumentTitle()` and call it from the locale subscriber in `src/components/v4-layout.ts` so the tab title follows a language switch. Update `router-service.test.ts` expectations.
- `src/components/v4-layout.ts:~485` `Loading ${toolId}...` → new `common.loadingTool` "Loading {tool}…" with `{tool} = t(route.titleKey)`; `~635-636` → new `errors.toolLoadFailed` "Failed to load tool", `errors.tryAgainOrRefresh` "Please try again or refresh the page".
Full gate; commit `i18n(web-app): gil/currency via formatGil+getCurrency; localized route titles and tool-load messages (HC-SYS-003, HC-SYS-006, HC-V4-005/006)`.

## Task 10: Sprint 2c — components that go stale after a language switch + result-card labels (HC-SYS-007, HC-V4-002)

- Subscribe (pattern from `v4-app-header.ts:77-90`) in `src/components/v4/result-card.ts`, `v4/v4-layout-shell.ts`, `v4/display-options-v4.ts`, `v4/dye-filters-v4.ts`, `v4/share-button.ts`; in `result-card.ts` turn the field initialiser `primaryActionLabel = LanguageService.t('common.selectDye')` (~210) into a getter/derivation at render time (respect the `primary-action-label` attribute override).
- `result-card.ts:~1535` `STAIN` → new `resultCard.stainShort` "STAIN" (ja/ko/zh: keep "STAIN"? No — translate: ja "ステイン", ko "스테인", zh "染色ID", de/fr "STAIN"); `~1698-1707` `${t('common.replace')} ${t('common.slot')} 1/2` → new `resultCard.replaceSlotN` "Replace Slot {n}".
- Add a vitest (`src/components/v4/__tests__/locale-switch.test.ts`): mount `<v4-result-card>` and `<display-options-v4>`, flip `LanguageService` locale (or fire the subscribed listeners), assert `requestUpdate`/rendered text changed. Keep it small.
Full gate; commit `fix(web-app): result-card, layout-shell, display-options, dye-filters, share-button re-render on locale change; STAIN/Replace Slot keyed (HC-SYS-007, HC-V4-002)`.

## Task 11: Sprint 2d — swatch / chara-import / extractor Highs (HC-SWA-001..003, HC-CHA-001/002, HC-EXT-001/002)

- `swatch-tool.ts:~1395` `Closest Swatches` → new `swatch.closestSwatchesHead`; `~894` `Row ${r}, Column ${c}` → new `swatch.rowColumn` "Row {row}, Column {col}"; `~2331` `'Explore Dye'` → new `swatch.exploreDye`.
- `chara-import.ts:~606-613` raw `resolved.tribe` → `LanguageService.getClan(SUBRACE_TO_CLAN_KEY[tribe])` — move `SUBRACE_TO_CLAN_KEY` from `swatch-tool.ts:~1065` to `src/shared/subrace-clan.ts` and import in both; `~218` `ToastService.error(error.message)` → new `swatch.parseFailed` "Couldn't read this character file: {reason}" (reason = the core message for now; clear the `TODO(i18n)`); `~429/801` per-slot `slot.error.message` → a `Record<string,string>` map from core's slot-error codes to new `swatch.slotError.<code>` keys — read the core error type (`ChараImport`/`.chara` parser in `@xivdyetools/core`, grep `slot.error` / `error.code` in `chara-import.ts` to find the code set) and key each; unknown code → `swatch.slotError.unknown` "Could not read this slot".
- `extractor-tool.ts:~1840` `Sampled Color` → new `matcher.sampledColor`; `~1906` `Copy Color Info` → new `matcher.copyColorInfo`; `~310` → `errors.imageLoadFailed`; `~1938` → `success.copiedToClipboard`.
Update tests (`swatch-tool`, `chara-import`, `extractor-tool` tests asserting literals). Full gate; commit `i18n(web-app): swatch/chara-import/extractor visible strings keyed; clan via getClan; core errors mapped (HC-SWA-001..003, HC-CHA-001/002, HC-EXT-001/002)`.

## Task 12: Sprint 2e — comparison / gradient / mixer / accessibility / shell Highs (HC-HAR-001..003, HC-ACC-001, HC-SHL-001/005/006, share toasts)

- `comparison-tool.ts:~1933` `addRow('RATIO', …)` → new `comparison.mRatioShort` "RATIO".
- `gradient-tool.ts:~1351` export header → new `gradient.exportMeta` "Interpolation: {space} · {n} steps".
- `mixer-tool.ts:~1920` → new `mixer.exportMeta` "Blend: {model} @ {pct}%" with `{model}` = the existing `mixer.model*`/`config.mixing*` label for `this.mixingMode` (grep how the mixer labels models in its UI and reuse that mapping).
- `accessibility-tool.ts:~115-139` `VISION_TYPES[].prevalence` → keys `accessibility.prevalenceNormal` "~92%", `prevalenceDeuteranopia` "~6% males", `prevalenceProtanopia` "~2% males", `prevalenceTritanopia` "~0.01%", `prevalenceAchromatopsia` "~0.003%" (store the key on the constant, resolve at render; delete the unused `description` field if nothing reads it).
- `tutorial-spotlight.ts:~341` → new `tutorial.stepOf` "Step {i} of {n}"; if `tutorial.step`/`tutorial.of` lose their last reference delete them ×6.
- `advanced-options-panel.ts:~242/346` `DEVICE`/`SAVED` → new `advanced.dataBadge` / `advanced.behaviorBadge` (create an `advanced` object if absent).
- `about-modal.ts:~349/351` → new `about.dataApiLabel` "Data API", `about.apiDocsLabel` "API Worker docs".
- `share-service.ts:~469/486` → new `share.linkCopied` "Link copied to clipboard!"; `~488` → `errors.copyLinkFailed` + new `share.copyManually` "Please copy the URL manually"; `~546` → new `share.generateFailed` "Failed to generate share link".
Update tests. Full gate; commit `i18n(web-app): comparison/gradient/mixer/accessibility/tutorial/advanced/about/share visible strings keyed (HC-HAR-001..003, HC-ACC-001, HC-SHL-001/005/006)`.

## Task 13: Sprint 3 — core owns harmony/vision vocabulary (TERM-003, TERM-004, TERM-005, HC-V4-008 decision)

- `src/components/v4/config-sidebar.ts:~944-957` harmony `<option>` labels → `LanguageService.getHarmonyType(<camelCase value>)` (values are `complementary|analogous|triadic|splitComplementary|tetradic|square|monochromatic|compound|shades` — check the option `value`s and core's key names; `harmony-generator.ts:93-99` shows the camel-case mapping). Delete `config.{complementary,analogous,triadic,splitComplementary,tetradic,square,monochromatic,compound,shades}` ×6 once unreferenced (grep first — `config.harmonyType` stays).
- TERM-004 (locale-edit route, no core change): in `src/locales/{ja,ko,zh}.json` align `config.deuteranopia/protanopia/tritanopia/achromatopsia` head nouns to core's runtime values minus the parenthetical: ja `2型色覚` / `1型色覚` / `3型色覚` / `全色盲`; ko `제2색맹` / `제1색맹` / `제3색맹` / `전색맹`; zh `绿色盲` / `红色盲` / `蓝色盲` / `全色盲` (zh already matches — verify and leave).
- TERM-005: adopt the official nouns — de `filters.excludeCoffers` → `Schatzkisten-Farbstoffe ausschließen`, `preset.cfgHideUnbuyableDesc` → `Blendet Handwerks- und Schatzkisten-Farbstoffe aus`; fr `filters.excludeCoffers` → `Exclure les teintures de trouvaille`, `preset.cfgHideUnbuyableDesc` → `Écarte les palettes exigeant des teintures artisanales ou de trouvaille`, `budget.offText` replace `coffre de mission` with `trouvaille de servant`; ko `preset.cfgHideUnbuyableDesc` → `제작·보물상자 한정 염료가 필요한 팔레트 제외`.
- HC-V4-008 / swatch `METHOD_TAGS` `RGB DIST` / `DISTINGUISH %`: **ruling — keep as identifiers** (consistent with the ΔE tags per the design record); add a one-line comment at `config-sidebar.ts:~1467` and `swatch-tool.ts:~209` stating they are identifiers by decision (2026-08-20 i18n audit). No key.
Update tests. Full gate; commit `i18n(web-app): harmony/vision/category labels come from core vocabulary; official Venture Coffer nouns (TERM-003..005)`.

## Task 14: Sprint 4a — localized dye names in search, sort, aria, export (HC-SYS-004, HC-SYS-005, HC-V4-003)

- `dyeNameMatches` / `compareDyeNames` / `localizedDyeName` from `@shared/dye-name` at: `dye-selector.ts:~394` (search), `~405/425/428` (alphabetical sort), `v4/dye-palette-drawer.ts:~797` (search) and `~904` (random-dye toast name), `dye-grid.ts:~117` (aria-label), `v4/v4-color-wheel.ts:~478` (tooltip), `shared/palette-export.ts:~98` (exported header comment — give the exporter a `nameOf` resolver param or have callers pass localized names; keep the JSON `name` field English/canonical at `~211`).
- `v4/result-card.ts:~1484` `aria-label="Dye result: ${name}"` → new `resultCard.dyeResultAria` "Dye result: {name}".
Tests: `dye-selector` search finds a dye by its ja name when `getDyeName` is mocked; sort uses localized names. Full gate; commit `i18n(web-app): dye search/sort/aria/export use localized names (HC-SYS-004/005, HC-V4-003)`.

## Task 15: Sprint 4b — locale-aware number/date formatting and Medium attr/toast rows (HC-SYS-008, HC-EXT-003..005, HC-CHA-003, HC-SHL-002..004, HC-SHL-012)

- Replace bare `.toLocaleString()` with `formatNumber()` at every remaining site in `budget-tool.ts` (~16), `v4/result-card.ts` (~1022), `v4/preset-detail.ts`, `mixer-tool.ts`; `collection-manager-modal.ts:~230` `toLocaleDateString()` → `formatDate()`; `v4/config-sidebar.ts:~69` `toLocaleUpperCase()` → `toLocaleUpperCase(LanguageService.getCurrentLocale())`.
- `extractor-tool.ts:~2257/2776` `'Market'` → `common.market`; `image-zoom-controller.ts:~189/200/219` → new `matcher.zoomOut` "Zoom Out", `matcher.zoomLevel` "Current Zoom", `matcher.zoomIn` "Zoom In"; `camera-service.ts:~97` + `camera-preview-modal.ts:~54` `Camera ${n}` → new `camera.deviceFallback` "Camera {n}" (and fix the stale-array count at camera-service 97: number from the index of the new array).
- `chara-import.ts:~1166` → new `swatch.sameModelList` "Same model: {list}" with `new Intl.ListFormat(LanguageService.getCurrentLocale(), {style:'short', type:'unit'}).format(names)`; if `swatch.sameModel` loses its last reference delete it ×6.
- `tutorial-spotlight.ts:~89` aria → new `tutorial.dialogLabel` "Tutorial"; `modal-container.ts:~384` → new `common.closeModal` "Close modal", `~420` → `common.cancel`, `~429` → new `common.confirm` "Confirm", `~465` → new `a11y.modalDialogs` "Modal dialogs" (create `a11y` object if absent — check whether an `aria` namespace already exists and use that instead); `toast-container.ts:~151` → `common.dismiss`, `~182` → new `a11y.notifications` "Notifications".
- `shared/palette-export.ts:~120` → new `export.generatedLine` "Generated {date} · {n} entries" + `export.generatedLineOne` "… · {n} entry"; `~241-242` `Source`/`Dyes` → new `export.hexSourceHeader` "Source", `export.hexDyesHeader` "Dyes" (create `export` object if absent).
Update tests. Full gate; commit `i18n(web-app): app-locale number/date formatting; zoom/camera/modal/toast/export strings keyed (HC-SYS-008, HC-EXT-003..005, HC-CHA-003, HC-SHL-002..004, HC-SHL-012)`.

## Task 16: Sprint 5a — concatenations into interpolated keys; English plurals (HC-SYS-009, HC-SYS-010)

Fold each into one key with placeholders (delete source keys that lose their last reference, ×6):
- `gradient-tool.ts` ~1503 → `gradient.stepN` "STEP {n}"; ~1377/1538 → `gradient.pinnedCount` "{n} · Pinned steps" (fr/de/ja order per language); ~1514 → `gradient.avgDriftValue` "avg ΔE {v}"; ~1527 → `gradient.maxDriftValue` "max ΔE {v}".
- `harmony-tool.ts:~1470`, `v4-color-wheel.ts:~447/477` → `harmony.harmonyN` "Harmony {n}"; `v4-color-wheel.ts:~466` → `harmony.baseColorTitle` "Base Color: {hex}".
- `result-card.ts:~1276`, `dye-action-dropdown.ts:~452` → `common.slotN` "Slot {n}"; `result-card.ts:~1385`, `dye-action-dropdown.ts:~550` `t('resultCard.addingDye') + ':'` / `t('harmony.addingDye') + ':'` → fold the colon into new `resultCard.addingDyeLabel` / `harmony.addingDyeLabel` (ja/zh `：`, fr ` :`); `dye-action-dropdown.ts:~320/331` → `harmony.copiedHexValue` "Copied {hex}".
- `dye-selector.ts:~500/627`, `dye-palette-drawer.ts:~1271` → `collections.favoritesCount` "{label} ({count})" → simpler: `collections.favoritesWithCount` "Favorites ({count})" and `colorPalette.favoritesWithCount`.
- `swatch-tool.ts:~1325/1855/1866` → `swatch.gridTitle` "{name} ({count})"; `~1995` → `swatch.cellTag` "{palette} #{index}"; `~2037-2050` pass `{palette}` and `{addr}` separately into `swatch.selSentence*` (add the second placeholder to those keys ×6).
- `preset-submission-form.ts:~350` leave (two chips). `config-sidebar.ts:~1579` → `preset.cfgStoredLocallyHint` "{a} — {b}"? No — merge into one sentence key `preset.cfgStoredLocallyHint`; `~1103` leave. `shortcuts-panel.ts:~126` → `shortcuts.platformHintFull` one sentence. `image-upload-display.ts:~167` → fold the colon into `matcher.privacyTitle` values (`：`/` :`). `dye-palette-drawer.ts:~1238` → `aria.removeFromFavoritesNamed` / `aria.addToFavoritesNamed` "{action}: {name}" → simply "Remove {name} from favorites" / "Add {name} to favorites". `chara-import.ts:~1285` `ID ${stainId}` — **keep** (identifier ruling). List joins `preset-detail.ts:~806-807` → `Intl.ListFormat`.
- Plurals: `collections.collectionsCount` / `collections.dyeCount` → `…One`/`…Many` pairs selected in `collection-manager-modal.ts` (find the call sites); `matcher.paletteExtracted` → `…One` sibling for count 1; `preset.mineSummary` → split into `preset.mineSummaryPresets` ("{n} presets"/One) and votes reuse `preset.votesCount`/One from Task 7; `comparison.allPairs` / `preset.maxDyesAllowed` — n is always ≥2, leave.
Update tests. Full gate; commit `i18n(web-app): concatenated fragments become interpolated keys; One/Many plurals (HC-SYS-009, HC-SYS-010)`.

## Task 17: Sprint 5b — Low fallbacks, regions, exonyms, identifier rulings (HC-V4-004/007/009/010/011/012, HC-HAR-004, HC-ACC-002, HC-SHL-007/008/009/011, HC-SWA-004, HC-BUD-010/011)

- `result-card.ts:~1298`, `dye-action-dropdown.ts:~474` `Unknown` → new `common.unknown`; `result-card.ts:~1468` `No data` → new `resultCard.noData`; `v4-layout.ts:~651-652` → new `common.comingSoonTool` "{tool} Tool" / `common.comingSoon` "Coming soon"; `config-sidebar.ts:~1613` `'User'` → new `config.userFallback`; drop dead `|| '…'` fallbacks at `share-button.ts:~323/328`, `dye-grid.ts:~83/279`.
- `config-sidebar.ts:~1947`, `market-board.ts:~250` `(${dc.region})` → new `market.region.<slug>` keys for the region values present in `public/json/data-centers.json` (slugify: `europe`, `japan`, `northAmerica`, `oceania`, `china`, `korea` — read the file for the exact set); fall back to the raw string for unknown regions.
- `v4/language-modal.ts:~158` exonyms → new `languages.<code>` keys (`en`,`ja`,`de`,`fr`,`ko`,`zh`) per locale (e.g. de: Englisch, Japanisch, Deutsch, Französisch, Koreanisch, Chinesisch).
- `mixer-tool.ts:~1198` `MODEL_SHORT.spectral = 'Spectral'` → `t('mixer.modelSpectral')`; `accessibility-tool.ts:~1547-1580` `NRM/DEU/PRO/TRI/ACH` → new `accessibility.visionShort.{normal,deuteranopia,protanopia,tritanopia,achromatopsia}`.
- `about-modal.ts:~255/268-281` credit: put a `{link}` placeholder into `footer.universalisCredit` / `about.spectralCredit` values and render the anchor into it (keep the existing anchor element; if the keys are used elsewhere without a link, add `…WithLink` variants instead).
- `main.ts:~110-119` fatal overlay: add a tiny inline `FATAL_STRINGS` table keyed by `navigator.language.slice(0,2)` for the six locales (title/body/button) — this path runs before LanguageService, so no locale keys; `constants.ts` `ERROR_MESSAGES` stays (only reachable here).
- `base-component.ts:~364` → show `t('errors.unexpectedError')` and log the raw message; `metric-help.ts:~281/350` → use the same per-locale learn-link mechanism the ratio link uses (`getLearnLink(locale)` or equivalent) for the CIEDE2000 Wikipedia URL (ja/de/fr/ko/zh article URLs for "Color difference"; fall back to en).
- **Rulings (no code change, add a comment):** `R{row}·C{col}` and `ID {n}` (HC-SWA-004) and `STANDARD/WIDE #1/WIDE #2/COFFER` tier tags (HC-BUD-010) stay identifiers. `budget-tool.ts:~870` `split(' ')[0]` → render the full `localizedDyeName` and rely on CSS `text-overflow: ellipsis` (HC-BUD-011).
Update tests. Full gate; commit `i18n(web-app): low-priority fallbacks, DC regions, language exonyms, vision short codes, fatal-overlay strings (HC-V4-004..012, HC-SHL-007..011)`.

## Task 18: Sprint 5c — guardrails: key order, parity script, lint rule, locale-switch test

- `scripts/reorder-locales.mjs`: rewrite de/fr/ja/ko/zh so key order matches `en.json` recursively (values untouched); run it once and commit the reordered files. Then extend `scripts/validate-i18n.js` to (a) fail when any target file's key order differs from `en.json`, (b) fail when a target value has leading/trailing whitespace that the `en` value does not.
- `scripts/i18n-parity.mjs` (port of `docs/audits/2026-08-20-web-app-i18n/evidence/locale-parity.txt`'s logic in JS): duplicate keys (parse with a duplicate-detecting reviver), missing/extra, interpolation-placeholder mismatch, identical-to-EN report with an allow-list file `scripts/i18n-identical-allowlist.json` seeded with the current 87 legitimate values; wire into `npm run validate:i18n` (non-zero exit on dup/missing/extra/placeholder; identical-to-EN outside the allow-list is a warning).
- ESLint rule in `eslint-rules/` (see existing rules there for the plugin shape and how `eslint.config.js` loads them): `no-hardcoded-ui-strings` — report string literals / template-literal quasis containing ≥2 consecutive `[A-Za-z]{2,}` words when they appear (1) as `textContent`/`innerText`/`title`/`placeholder`/`aria-label`/`alt` assignment RHS or JSX-like attribute in `html\`` templates, (2) as the first argument of `ToastService.*()` / `AnnouncerService.announce()`, (3) as text between tags inside `html\`` templates; skip `logger.*`, `console.*`, test files, strings passed to `LanguageService.t*`, and strings that are all-caps identifiers ≤ 2 words. Severity `warn` for now; add to `eslint.config.js`. Add a unit test under `eslint-rules/__tests__/` with the existing rule-tester pattern.
- `src/components/v4/__tests__/locale-switch.test.ts` from Task 10 — extend to iterate every `customElements` class exported from `src/components/v4/*.ts` that extends `LitElement`, mount it, flip the locale, and assert `requestUpdate` was called (spy) — mark components with a static `localeAware = false` opt-out only if a component truly renders no strings (document each).
Full gate; commit `chore(web-app): i18n guardrails — locale key order + parity gates, no-hardcoded-ui-strings lint, locale-switch test`.

## Task 19: Sprint 6 — fonts (FONT-WEB-001, FONT-WEB-002)

- `src/styles/globals.css`: after the `--font-cjk` declaration add `:root:lang(zh) { --font-cjk: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans JP', 'Noto Sans KR'; }` and `:root:lang(ko) { --font-cjk: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans JP', 'Noto Sans SC'; }` (keep the explanatory comment style of the file; ja keeps the default order). Note: `globals.css` is page-level — confirm the shell's shadow root inherits the custom property (custom properties inherit through shadow boundaries; they do).
- `src/components/my-submissions-modal.ts:~139` inline `font-family: 'Fragment Mono', monospace` → `font-family: var(--font-mono)`.
- Update the font-contract test if one exists (`src/__tests__/` grep `font-face`/`--font-cjk`).
Full gate; commit `style(web-app): per-locale CJK font order for zh/ko; my-submissions row uses the font contract (FONT-WEB-001/002)`.

## Task 20: Close-out — changelog, plan status, audit cross-refs

- `apps/web-app/CHANGELOG.md`: add an `## [Unreleased]` section (or extend it if present) with a `### Fixed` / `### Changed` entry summarising the remediation (palette-drawer category bug, presets surface localization, custom dye, gil, route titles, stale-after-switch components, core-owned vocabulary, guardrails). Also add a layman's line to `CHANGELOG-laymans.md` following its existing style.
- `docs/audits/2026-08-20-web-app-i18n/REMEDIATION_PLAN.md`: annotate each sprint heading with `✅ COMPLETED 2026-08-20` and the commit range; `README.md` in that folder: change "No source or locale file was modified by this audit." to a line pointing at the remediation branch/commits.
- Re-run `docs/audits/2026-08-20-web-app-i18n/evidence` scripts' equivalents (`npm run validate:i18n`, `npm run i18n:unused`, `node scripts/i18n-parity.mjs`) and paste the post-remediation output into `evidence/post-remediation-gates.txt`.
Commit `docs(web-app): changelog + audit plan status for the i18n remediation`.
