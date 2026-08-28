# Group 6 — Presets / Collections hardcoded-string scan (2026-08-20)

Scope: `apps/web-app` (branch `monorepo-2.0-prep`), 15 files, read in full. Read-only.
All paths relative to `c:\dev\XIVProjects\xivdyetools\apps\web-app\src\`.

Legend — Context: text / attr / toast / error / concat / plural / dye.name / date / dead.
"Reachable?" notes are folded into the String/Context columns where the visibility needed tracing.

| File:Line | String (verbatim, ≤80 chars) | Context | Priority | Existing key? | Suggested key |
|---|---|---|---|---|---|
| components/v4/preset-detail.ts:845 | `Loading preset...` | text (no-preset fallback render) | High | near: `preset.loading` = "Loading presets..." | `preset.loadingOne` (or reuse `preset.loading`) |
| components/v4/preset-detail.ts:934 | `` `${dye.cost.toLocaleString()}g` `` | currency suffix "g" next to number; also `toLocaleString()` w/o locale | High | `LanguageService.getCurrency('Gil')`; `preset.costNoteAll` already spells "gil" | `preset.gilAmount` = "{n} gil" via `getCurrency('Gil')` + `getCurrentLocale()` |
| components/v4/preset-detail.ts:1015 | `Login with Discord or XIVAuth to vote for this preset` | text (login CTA div) | High | **`preset.loginToVote` — identical value** | `preset.loginToVote` |
| components/v4/preset-detail.ts:885 | `` ★ ${this.currentVoteCount} ${t('preset.votesLabel')} `` | concat number + label; no plural; `votesLabel` is the SHOUT "VOTES" chip label, misused as a sentence word | Medium | `preset.votesLabel` (wrong register); `preset.mineSummary` has "{v} votes" | `preset.votesCount` = "{n} votes" (tInterpolate) |
| components/v4/preset-detail.ts:989–991 | `` ✓ ${t('preset.voted')} · ${count} `` / `` ${t('preset.vote')} · ${count} `` | concat of t() + separator + number (HC-002/003 follow-up) | Low | `preset.voted` / `preset.vote` | `preset.voteBtn` = "{label} · {n}" or leave (separator is a symbol) |
| components/v4/preset-detail.ts:806–807 | `names.join(' · ')` / `sources.join(', ')` inside `preset.costNotePartial` | concat — list separators are locale-specific (ja/zh use 、) | Low | — | `Intl.ListFormat(getCurrentLocale())` |
| components/v4/preset-detail.ts:796 | `gil.toLocaleString()` | date/number format without locale (browser locale ≠ app locale) | Low | — | `toLocaleString(LanguageService.getCurrentLocale())` |
| components/v4/preset-card.ts:412 | `` ${byline} · ${preset.dyes.length} · ${this.ageText(preset)} `` | concat; bare dye count with no unit word (reads "Ships with the app · 4 · built in") | Medium | `collections.dyeCount` = "{count} dyes" (different section) | `preset.dyeCountShort` = "{n} dyes" |
| components/v4/preset-card.ts:342–343 | `` `${t('preset.voted')} · ${preset.voteCount}` `` | concat t() + number (same shape as detail 989) | Low | `preset.voted` / `preset.vote` | same key as above |
| components/v4/preset-tool.ts:942 | `` ${pool.length} ${t('preset.resultsWord')} `` | concat number + noun; no plural ("1 presets") | Medium | `preset.resultsWord` = "presets" | `preset.resultsCount` = "{n} presets" (tInterpolate) |
| components/preset-edit-form.ts:119 | `title: 'Edit Preset'` | text (modal title) | High | near: `preset.edit` = "Edit", `preset.deleteTitle` = "Delete Preset" | `preset.editTitle` |
| components/preset-edit-form.ts:177 | `Preset Name` | text (label) | High | `preset.fieldName` = "Name" | `preset.fieldName` |
| components/preset-edit-form.ts:187 | `e.g., Dark Knight Abyssal` | attr (placeholder) | Medium | — | `preset.fieldNamePlaceholder` |
| components/preset-edit-form.ts:222 | `Description` | text (label) | High | **`preset.fieldDesc` — identical** | `preset.fieldDesc` |
| components/preset-edit-form.ts:231 | `Describe your color palette and when to use it...` | attr (placeholder) | Medium | — | `preset.fieldDescPlaceholder` |
| components/preset-edit-form.ts:239,243 | `` `${n}/${MAX} (min ${MIN})` `` | text counter — English abbreviation "min" | Low | — | `preset.counterWithMin` = "{n}/{max} (min {min})" |
| components/preset-edit-form.ts:269 | `Select Dyes` | text (label) | High | `preset.dyes` = "Dyes" (+ `preset.dyesReq`); `tutorial.*.title` "Select Dyes" (wrong section) | `preset.dyes` + `preset.dyesReq` (match submission form L350) |
| components/preset-edit-form.ts:275,309 | `` `${n}/${MAX_DYES} (min ${MIN_DYES})` `` | text counter ("min") | Low | — | `preset.counterWithMin` |
| components/preset-edit-form.ts:292 | `` <span>${dye.name}</span> `` | dye.name rendered (English only) in selected-dye chip | High | `LanguageService.getDyeName(dye.itemID)` | getter (as preset-detail.ts:783 does) |
| components/preset-edit-form.ts:327 | `Search dyes...` | attr (placeholder) | Medium | **`colorPalette.searchPlaceholder` — identical** | `colorPalette.searchPlaceholder` or new `preset.searchDyes` |
| components/preset-edit-form.ts:352 | `swatch.title = dye.name` | dye.name as tooltip | Medium | `getDyeName` | getter |
| components/preset-edit-form.ts:371 | `No dyes found` | text (empty grid) | High | **`colorPalette.noDyesFound` — identical** | `colorPalette.noDyesFound` |
| components/preset-edit-form.ts:371 | `All matching dyes selected` | text (empty grid) | High | — | `preset.allMatchingSelected` |
| components/preset-edit-form.ts:380 | `d.name.toLowerCase().includes(query) \|\| d.category...` | dye.name — search matches English names/categories only (a ja user typing 漆黒 finds nothing) | Low | `getDyeName` / `getCategory` | search localized name too |
| components/preset-edit-form.ts:457 | `Tags (optional)` | text (label) | High | `preset.fieldTags` = "Tags" + `common.optional` = "(optional)" / `preset.reqOptional` | `preset.fieldTags` (+ `reqOptional` chip like submit form) |
| components/preset-edit-form.ts:467 | `e.g., dark, edgy, tank (comma-separated)` | attr (placeholder) | Medium | — | `preset.fieldTagsPlaceholder` |
| components/preset-edit-form.ts:473 | `` `Max ${MAX_TAGS} tags, 30 chars each` `` | text (hint) | High | near: `preset.fieldTagsHint` | `preset.fieldTagsLimit` = "Max {max} tags, {chars} chars each" |
| components/preset-edit-form.ts:609 | `Cancel` | text (button) | High | **`common.cancel` — identical** | `common.cancel` |
| components/preset-edit-form.ts:628,763 | `Save Changes` | text (button, set twice) | High | near: `common.save` = "Save" | `preset.saveChanges` |
| components/preset-edit-form.ts:672 | `` `Name must be at least ${MIN_NAME_LENGTH} characters` `` | toast (validation) | High | — | `preset.validation.nameMin` = "Name must be at least {n} characters" |
| components/preset-edit-form.ts:675 | `` `Description must be at least ${MIN_DESC_LENGTH} characters` `` | toast | High | — | `preset.validation.descMin` |
| components/preset-edit-form.ts:678 | `` `Must include at least ${MIN_DYES} dyes` `` | toast | High | — | `preset.validation.dyesMin` |
| components/preset-edit-form.ts:681 | `` `Maximum ${MAX_DYES} dyes allowed` `` | toast | High | **`preset.maxDyesAllowed` = "Maximum {count} dyes allowed"** | `preset.maxDyesAllowed` |
| components/preset-edit-form.ts:685 | `errors.join('. ')` | concat — sentence-joining several messages with ". " | Low | — | one toast per error, or `Intl.ListFormat` |
| components/preset-edit-form.ts:701 | `Saving...` | text (button busy state) | High | near: `preset.deleting` = "Deleting preset..." | `preset.saving` |
| components/preset-edit-form.ts:711 | `another preset` | text — fallback `{name}` interpolated into `preset.duplicateFound` | Medium | — | `preset.anotherPreset` |
| components/preset-submission-form.ts:266 | `e.g., Dark Knight Abyssal` | attr (placeholder) | Medium | — | `preset.fieldNamePlaceholder` |
| components/preset-submission-form.ts:311 | `Describe your color palette and when to use it...` | attr (placeholder) | Medium | — | `preset.fieldDescPlaceholder` |
| components/preset-submission-form.ts:319,323,356,415 | `` `${n}/${MAX} (min ${MIN})` `` | text counter ("min") | Low | — | `preset.counterWithMin` |
| components/preset-submission-form.ts:350 | `` `${t('preset.dyes')} — ${t('preset.dyesReq')}` `` | concat of two t() fragments into one label | Low | `preset.dyes`, `preset.dyesReq` | `preset.dyesLabelFull` or a second chip (like `fieldLabelRow`) |
| components/preset-submission-form.ts:375 | `Click dyes below to add them...` | text (empty selected-dyes placeholder) | High | — | `preset.clickDyesToAdd` |
| components/preset-submission-form.ts:389 | `name.textContent = dye.name` | dye.name rendered in selected chip | High | `getDyeName` | getter |
| components/preset-submission-form.ts:405 | `chip.title = 'Click to remove'` | attr (title) | Medium | — | `preset.clickToRemove` |
| components/preset-submission-form.ts:432 | `Search dyes by name...` | attr (placeholder) | Medium | **`dyeSelector.searchPlaceholder` — identical** | `dyeSelector.searchPlaceholder` |
| components/preset-submission-form.ts:456 | `btn.title = dye.name` | dye.name as tooltip | Medium | `getDyeName` | getter |
| components/preset-submission-form.ts:485 | `d.name.toLowerCase().includes(query)` | dye.name — English-only search | Low | `getDyeName` | search localized name |
| components/preset-submission-form.ts:521 | `dark, gothic, elegant (comma-separated)` | attr (placeholder) | Medium | — | `preset.fieldTagsPlaceholder` |
| components/preset-submission-form.ts:674 | `errors.map((e) => e.message).join('. ')` | toast — renders the English `validateSubmission()` messages (see service rows) + ". " join | High | — | see `preset.validation.*` |
| components/preset-submission-form.ts:685 | `Submitting...` | text (button busy state) | High | — | `preset.submitting` |
| components/preset-submission-form.ts:692 | `existing preset` | text — fallback `{name}` in `duplicateFound`/`duplicateWithVote` | Medium | — | `preset.anotherPreset` |
| services/preset-submission-service.ts:93 | `Name must be at least 2 characters` | error → toast (submission-form:674, and via `submitPreset` error:216→form:737) | High | — | `preset.validation.nameMin` |
| services/preset-submission-service.ts:95 | `Name must be 50 characters or less` | error → toast | High | — | `preset.validation.nameMax` |
| services/preset-submission-service.ts:100 | `Description must be at least 10 characters` | error → toast | High | — | `preset.validation.descMin` |
| services/preset-submission-service.ts:102 | `Description must be 200 characters or less` | error → toast | High | — | `preset.validation.descMax` |
| services/preset-submission-service.ts:107 | `Please select a valid category` | error → toast | High | — | `preset.validation.category` |
| services/preset-submission-service.ts:112 | `Must include at least 3 dyes` | error → toast (reachable: form allows submit with <3) | High | — | `preset.validation.dyesMin` |
| services/preset-submission-service.ts:114 | `Maximum 6 dyes allowed` | error → toast | High | `preset.maxDyesAllowed` | `preset.maxDyesAllowed` |
| services/preset-submission-service.ts:118 | `Invalid dye selection` | error → toast | High | — | `preset.validation.dyesInvalid` |
| services/preset-submission-service.ts:124,127 | `Dye IDs must be stainIDs (1-254), not legacy item IDs` / `Dye IDs must be stainIDs (1-254)` | error → toast (dev-guard; practically unreachable from the form) | Low | — | `preset.validation.dyesRange` (or keep as dev error) |
| services/preset-submission-service.ts:132 | `Tags must be an array` | error → toast (unreachable from form) | Low | — | keep / dev |
| services/preset-submission-service.ts:134 | `Maximum 10 tags allowed` | error → toast (**reachable** — form has no tag-count check) | High | — | `preset.validation.tagsMax` |
| services/preset-submission-service.ts:136 | `Each tag must be 30 characters or less` | error → toast (reachable) | High | — | `preset.validation.tagLength` |
| services/preset-submission-service.ts:207 | `You must be logged in to submit presets` | error → toast (form:737) — form gates auth first, so edge | Medium | `preset.loginToSubmit` | `preset.loginToSubmit` |
| services/preset-submission-service.ts:216 | `validationErrors.map(...).join('. ')` | concat (". " join) | Low | — | see above |
| services/preset-submission-service.ts:252 | `result.message \|\| 'Submission failed'` | error → toast (form:737); `result.message` is the presets-api's English wire message (API-side, out of scope) | High | `errors.submitPresetFailed` | `errors.submitPresetFailed` (and map API error codes client-side) |
| services/preset-submission-service.ts:277 | `Request timed out. Please try again.` | error → toast (form:737) | High | — | `errors.requestTimeout` |
| services/preset-submission-service.ts:284 | `Failed to submit preset. Please try again.` | error → toast | High | **`errors.submitPresetFailed` — identical** | `errors.submitPresetFailed` |
| services/preset-submission-service.ts:339–365 | `Approved` / `Pending Review` / `Rejected` / `Flagged` / `Unknown` | dead — `getStatusInfo()` has **no callers** in src (my-submissions-modal uses `preset.status*` keys) | Low | `preset.statusLive/Review/Rejected` | delete the method (knip candidate) |
| services/preset-submission-service.ts:418,437,443 | `Not authenticated` / `` `Failed to delete (${status})` `` / `Network error - please try again` | error returned but **never displayed** — both callers (`preset-tool.ts:834`, `my-submissions-modal.ts:195`) ignore `deletePreset()`'s return and toast success regardless (functional bug, not i18n) | Low | `errors.deletePresetFailed` | surface `result.error` via key; `errors.networkError` |
| services/preset-submission-service.ts:457 | `You must be logged in to edit presets` | error → toast (edit-form:716) — gated, edge | Medium | `preset.loginToEdit` | `preset.loginToEdit` |
| services/preset-submission-service.ts:466–499 | `Name must be at least 2 characters` … `Invalid dye selection` (edit copies of the validation set) | error → toast (edit-form:716) — mostly pre-empted by the form's own checks; tag rules (L507,509) ARE reachable | High (tags) / Low (rest) | — | `preset.validation.*` (share one table with `validateSubmission`) |
| services/preset-submission-service.ts:559 | `` `This dye combination already exists as "${name}"` `` | error — not displayed (edit-form branches on `result.duplicate` → `preset.duplicateFound`) | Low | `preset.duplicateFound` | drop, or set from key |
| services/preset-submission-service.ts:567 | `result.message \|\| 'Edit failed'` | error → toast (edit-form:716) | High | `errors.saveChangesFailed` | `errors.saveChangesFailed` |
| services/preset-submission-service.ts:583 | `Request timed out. Please try again.` | error → toast | High | — | `errors.requestTimeout` |
| services/preset-submission-service.ts:590 | `Failed to edit preset. Please try again.` | error → toast | High | near: `errors.saveChangesFailed` = "Failed to save changes. Please try again." | `errors.saveChangesFailed` |
| services/community-preset-service.ts:363 | `You must be logged in to vote` | error → toast (preset-detail:759 `result.error \|\| …`) — detail gates auth at L724, edge | Medium | `preset.loginToVote` | `preset.loginToVote` |
| services/community-preset-service.ts:384 | `You have already voted for this preset` | error — not displayed (both callers branch to `preset.alreadyVoted`) | Low | `preset.alreadyVoted` | drop |
| services/community-preset-service.ts:392 | `message \|\| 'Failed to vote'` | error → toast (preset-detail:759) | High | **`errors.voteFailed` — identical** | `errors.voteFailed` |
| services/community-preset-service.ts:407,455 | `Network error - please try again` | error → toast (preset-detail:743,759) | High | — | `errors.networkError` |
| services/community-preset-service.ts:421 | `You must be logged in to remove your vote` | error → toast (preset-detail:743) — gated, edge | Medium | `preset.loginToVote` | `preset.loginToVote` |
| services/community-preset-service.ts:438 | `message \|\| 'Failed to remove vote'` | error → toast (preset-detail:743) | High | **`errors.removeVoteFailed` — identical** | `errors.removeVoteFailed` |
| services/collection-service.ts:933 | `Invalid file format: not an XIV Dye Tools collection` | error → toast (collection-manager-modal:553–557 shows `result.errors[0]`) | High | `collections.invalidFormat` = "Invalid file format" | `collections.invalidFormat` (+ `collections.invalidFormatNotCollection`) |
| services/collection-service.ts:938 | `Invalid file format: missing data` | error → toast | High | `collections.invalidFormat` | `collections.invalidFormat` |
| services/collection-service.ts:957 | `` `Skipped invalid collection: ${name \|\| 'unnamed'}` `` | error → toast (only if it is `errors[0]` and nothing imported) | Medium | — | `collections.importSkippedInvalid` = "Skipped invalid collection: {name}" + `collections.unnamed` |
| services/collection-service.ts:993 | `` `Failed to create collection: ${name}` `` | error → toast | Medium | — | `collections.importCreateFailed` |
| services/collection-service.ts:1003 | `Failed to parse JSON: invalid format` | error → toast | High | `collections.invalidFormat` / `collections.importFailed` | `collections.invalidFormat` |
| services/collection-service.ts:971 | `` `${collection.name}_imported_${suffix}` `` | text — generated, user-visible collection name suffix | Low | — | `collections.importedSuffix` = "{name} (imported {n})" |
| components/collection-manager-modal.ts:230 | `new Date(collection.updatedAt).toLocaleDateString()` | date — browser locale, not app locale | Medium | — | `toLocaleDateString(LanguageService.getCurrentLocale())` |
| components/add-to-collection-menu.ts:220 | `Full` | text (menu row badge when collection is at cap) | High | near: `collections.collectionFull` = "Collection is full ({max} dyes max)" | `collections.full` |
| components/my-submissions-modal.ts:139–141 | `` ${vote_count \| '—'} ${t('preset.votesLabel')} `` | concat number + SHOUT label; no plural | Medium | `preset.votesLabel` | `preset.votesCount` = "{n} votes" (shared with detail:885) |

## Summary

**88 findings** across the 15 files: **High 44 · Medium 25 · Low 19** (rows that bundle several adjacent strings are counted once). Per file: `preset-submission-service.ts` 24 (the two validation tables plus returned error strings — almost all of them ARE user-visible because `preset-submission-form.ts:674/737` and `preset-edit-form.ts:716` toast `result.error`/`e.message` verbatim), `preset-edit-form.ts` 24 (the worst component — its labels/buttons/placeholders/validation are still 4.x English while the sibling submission form was localized for 8S; "Cancel", "Description", "No dyes found", "Search dyes..." all have identical keys already shipping), `preset-submission-form.ts` 15 (placeholders, "Click dyes below…", "Submitting...", two `dye.name` renders, English-only dye search), `community-preset-service.ts` 8 (vote error strings surfaced by preset-detail; "Failed to vote"/"Failed to remove vote" duplicate existing `errors.*` keys exactly), `preset-detail.ts` 7 (incl. the hardcoded **`…g` gil suffix** at L934 and the **`Login with Discord or XIVAuth…` CTA at L1015 whose exact text already exists as `preset.loginToVote`**), `collection-service.ts` 6 (import errors toasted by the manager modal), `preset-card.ts` 2, `my-submissions-modal.ts` 1, `preset-tool.ts` 1 (number+noun "N presets" concat), `collection-manager-modal.ts` 1 (`toLocaleDateString()` without locale), `add-to-collection-menu.ts` 1 ("Full"). Recurring shapes: number+word concatenation with no plural (`{n} votes`, `{n} presets`, bare dye count on the card), `" (min N)"` counters, `". "`-joined error lists, `dye.name` in chips/tooltips instead of `getDyeName()`, and `toLocaleString`/`toLocaleDateString` on the browser locale. **HC-001…004 status (preset-detail.ts): all four FIXED** — HC-001 "Copy Link" → `t('preset.copyLink')` (L977); HC-002/003 "Voted (n)"/"Vote (n)" → `t('preset.voted')`/`t('preset.vote')` (L989–991; the `preset.voteCount`/`votesCount` keys the audit pointed at no longer exist in en.json, and the count is now appended with a `·` separator — residual Low concat, no plural issue since the word is separate); HC-004 raw category slug → `presetCategoryLabel()` (L866/871, via the new `shared/preset-i18n.ts`). Side observations (not i18n): `deletePreset()` failures are never surfaced — both callers ignore the returned `{success:false}` and toast success; `my-submissions-modal.ts:138` injects `preset.name`/`rejection_reason` into `innerHTML` unescaped. **Completely clean files (4):** `components/preset-category-selector.ts`, `services/hybrid-preset-service.ts`, `services/saved-presets-service.ts`, `shared/preset-i18n.ts`.
