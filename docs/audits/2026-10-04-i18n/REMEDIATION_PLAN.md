# Remediation Plan — 2026-10-04 (deep-dive + dead-code + i18n, merged)

**Sources:**
- [I18N_AUDIT_2026-10-04.md](I18N_AUDIT_2026-10-04.md): 45 findings.
- [2026-10-04-deep-dive/DEEP_DIVE_REPORT.md](../2026-10-04-deep-dive/DEEP_DIVE_REPORT.md): 175 findings.
- [2026-10-04-dead-code/DEAD_CODE_REPORT.md](../2026-10-04-dead-code/DEAD_CODE_REPORT.md): 64 findings.
- **ID convention:** i18n IDs are bare (`I18N-`, `TERM-`, `HC-`, `FONT-`). The others are qualified as `deep-dive/BUG-NNN` and `dead-code/DEAD-NNN`.
- All three catalogs come from the same preview branch: `main` plus the 13 open PRs.

**This plan supersedes** the deep-dive's `REMEDIATION_PLAN.md`, which had already absorbed the dead-code `CLEANUP_PLAN.md`.
- Its 25 sprints are kept, with their rows unchanged.
- The i18n sprints are inserted (2, 3, 6, 7 and the last).
- The i18n rows are added to the units they belong to (11, 13, 14).
- So every deep-dive sprint number from 2 on has moved.

> [!IMPORTANT]
> **Re-verified on 2026-10-05 against `main@50165ec6`** (after the batch merge, #239 and #240): [evidence/reverify-2026-10-05.md](evidence/reverify-2026-10-05.md).
> - It records what was fixed inside the PRs, the corrected anchors for findings whose files moved, and the fix steps that #239's dictionary table changes (TERM-003, TERM-004, TERM-021).
> - **Read it before starting any sprint.** The finding files keep their as-audited line numbers.
> - The whole-graph gate on that `main` is green (62/62).
> - The maintainer's answers to the open questions (Sprints 6, 7, 9, 15, 18, 24, 26, 30) are in its *Decisions* section. Sprint 24 is **not** skipped.

**Status basis:** 284 total (as of 2026-10-05).
- 8 fixed, all inside their PRs before the batch merge: dead-code/DEAD-001 and DEAD-002, deep-dive/BUG-053, I18N-004, I18N-005, I18N-006, TERM-014 and TERM-015.
- 258 outstanding. Four of them are partly fixed: deep-dive/BUG-063 (rest in Sprint 8), I18N-001 (optional rest in Sprint 7), TERM-001 (Sprint 7) and deep-dive/REFACTOR-009 (Sprint 20).
- 2 deep-dive candidates superseded by dead-code removals, and 1 i18n candidate that duplicates deep-dive/BUG-145 (listed below).
- 18 KEEP.
- 0 need rotation.
- Seven terminology questions need a dictionary row before anyone edits them (*Pin first*, below). They are not findings.

**Ordering:**
1. Sprint 0 holds the decisions due before tomorrow's batch merge. Nothing is pushed without your yes.
2. Correctness first:
   - the deep-dive HIGH (Sprint 1), then the two i18n P1s (Sprints 2–3), after #239 and #240 (the dictionary table and core's race and clan names);
   - then the units carrying MEDIUM / P2 findings;
   - then the LOW-only units.
3. One deploy unit per sprint, with three exceptions:
   - Sprints 2 and 3 are one PR, because bot-logic's text changes need discord-worker's fonts re-cut in the same merge (the 2026-09-19 i18n plan did the same);
   - Sprint 7 edits the policy documents of both apps and changes no code;
   - the four structural sprints are each a publish followed by their consumers' deploys.
   - Dead-code cleanups ride in their unit's sprint, after that unit's fixes.
4. Package publishes follow the dependency graph: logger, core, svg, bot-logic, then worker-kit.
   - `workspace:*` becomes an exact version at publish, so a dependent must publish after its dependencies.
   - bot-logic also publishes once early, in Sprint 2. It needs nothing from the core or svg sprints.
   - Consumers redeploy through their path filters on merge.
5. **Fonts:** a sprint that changes drawn text re-cuts the CJK subsets in its own PR; otherwise `font-coverage.test.ts` fails. The terminal fonts sprint is only the item-name decision (FONT-001).
6. Structural refactors last, then the fonts sprint.

**Conflicts (merged mode):**
- Two deep-dive candidates sat in code a dead-code entry removes, so the removal wins (*Superseded* below).
- One set of fixes shares files with removals: the preset services in Sprint 4. There the fixes land first, then the removals.
- Sprint 6 (i18n) and Sprint 22 (deep-dive LOWs) both touch `glamour-block.ts`; Sprint 6 lands first.
- No i18n finding sits in code a dead-code entry removes.

## Sprint 0 — Before the batch merge (your decision) — ✅ APPLIED 2026-10-05 (inside the PRs; batch merged 2026-10-05)

**Outcome** (re-verified; details in [evidence/reverify-2026-10-05.md](evidence/reverify-2026-10-05.md)):
- **Fixed inside their PRs:**
  - dead-code/DEAD-001 (`ea264d49`, #225) and dead-code/DEAD-002 (`d3bf312a`, #227);
  - deep-dive/BUG-053 (`6f2bb05c`, #225);
  - I18N-004 (`5805bf8a`, #227) and I18N-005 (`3f662657`, #230);
  - I18N-006 (`3f662657` and `5805bf8a`);
  - TERM-014 and TERM-015 (`91de5f8d`, #223).
- **Partly fixed:**
  - deep-dive/BUG-063 (`12e7f887`, #224): the intro names 0015 but not the new daily cron, which moves to Sprint 8.
  - I18N-001: the lighter fix, *Last updated* 2026-10-05 on all twelve variants. The optional fixed-date rewording moves to Sprint 7.
- **TERM-001's #223 line** is fixed (`91de5f8d`); the Terms documents remain, in Sprint 7.
- **The domain question is settled.** The three route lines were deleted inside #224, #225 and #229 (`12e7f887`, `6f2bb05c`, `d1f9e5c5`). The custom domains were removed in the dashboard on 2026-10-05.
- **Prerequisites done:** #239 and #240 are merged, and core 5.8.1 is on npm.

The text below is the plan as written before the merge.

**Merging tomorrow is safe from all three audits' point of view:**
- no finding in the batch is CRITICAL or HIGH;
- no deep-dive finding in the batch is MEDIUM;
- the i18n findings that come from the PRs are P2 or P3 policy text;
- the cross-PR test failure is already fixed in #224 (`10a1cb77`);
- the preview passes 62/62.

### From the deep-dive and dead-code audits

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-063](../2026-10-04-deep-dive/findings/BUG-063.md) | deep-dive | LOW · PR-#224 | presets-api 2.4.0 changelog intro denies a migration that its Rollout section requires (0015) |
| [deep-dive/BUG-053](../2026-10-04-deep-dive/findings/BUG-053.md) | deep-dive | LOW · PR-#225 | bot-i18n.ts footerTextOnly advertises the removed `reject <id> <reason>` option; preset.test.ts:446 pins it |
| [dead-code/DEAD-001](../2026-10-04-dead-code/findings/DEAD-001.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | preset.moderation.{approved,approvedDesc,missingReason,rejected,rejectedDesc} in moderation-worker bot-i18n.ts are orphaned by PR #225 — 5 lines, 0 test lines |
| [dead-code/DEAD-002](../2026-10-04-dead-code/findings/DEAD-002.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | ModerationPresetInfo.author_discord_id in preset-notifications.ts is unread since #227: 2 lines; fixture must be reshaped, not deleted |

- **deep-dive/BUG-063 (#224) and deep-dive/BUG-053 (#225):** recommended text-only fixes, to make inside the PRs before merging if you agree. Otherwise, correct them in the presets-api and moderation-worker sprints.
- **dead-code/DEAD-001:** already applied in #225 (`ea264d49`).
- **dead-code/DEAD-002 (#227):** optional; if deferred, it joins the discord-worker sprint.

**Question:** are `proxy.`, `api.` and `moderation-bot.xivdyetools.projectgalatine.com` still attached in Cloudflare?
- **If so:** merging #229, #224 and #225 changes nothing.
- **If you removed them in the dashboard:** those merges re-attach them. Delete the route lines first, per `docs/operations/DOMAIN_DEPRECATION.md`.

### From the i18n audit

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [I18N-001](findings/I18N-001.md) | i18n | P2 · PR#230 (web), PR#227 (bot) | Both English privacy documents anchor "posts no longer show your Discord user ID" to the moving *Last updated* date |
| [I18N-004](findings/I18N-004.md) | i18n | P3 · PR#227 | Bot privacy policy retention row reads as "kept until the preset is deleted" for a hide or restore, and the translations took that reading |
| [I18N-005](findings/I18N-005.md) | i18n | P3 · PR#230 | Web privacy guide gives two retention rules for a hide or restore log entry |
| [I18N-006](findings/I18N-006.md) | i18n | P3 · PR#230 (web), PR#227 (bot) | Korean privacy documents: "숨겨진 사용자의 프리셋 수" reads as "the hidden user's preset count" |
| [TERM-014](findings/TERM-014.md) | i18n | P3 · PR#223 | Korean privacy guide says 복장 for "outfit" in a line #223 added |
| [TERM-015](findings/TERM-015.md) | i18n | P3 · PR#223 | Chinese privacy guide calls the moderator 版主 in a line #223 added, and 审核员 everywhere else |

- **English edits (I18N-001, I18N-004, I18N-005):** each one needs its five translations in the same commit, or the fix itself creates a parity defect. That means a translator and a verifier per PR.
  - I18N-001 has a lighter option: set *Last updated* to the merge date on all twelve variants. That is a date edit, with no translation. The sentence then holds, because a later date bump only makes it less precise, never false. A fixed-date rewording is the full fix, and its date only exists at merge time.
  - If you would rather not fix them inside the PRs, all three land in Sprint 7.
- **Translation-only edits (I18N-006, TERM-014, TERM-015):** one Korean or Chinese phrase each, inside #223, #227 and #230. Otherwise, Sprint 7.
- **TERM-001:** #223's new line 13 can switch to 조정자 now, the word the rest of that file uses. The full fix is in Sprint 7.

**Answered 2026-10-05: the character-creation sheet names.**
- The client's own labels are now in the dictionary (#239, *Character-Creation Color Sheets*), read from the game data in all six languages.
- So TERM-003, TERM-004 and TERM-021 are unblocked and stay in Sprints 6, 2 and 13. Merge #239 before those sprints.

**Prerequisite before Sprint 2: core's race and clan names (#240).** The same research found three sets of names in core that aren't the clients':
- two Korean race names (Hyur, Hrothgar);
- 13 of 16 Korean clan names;
- 4 Chinese clan names.

HC-001 (Sprint 2) prints core's clan names on the bot cards, so you chose to fix core first.
- **What #240 contains:** core 5.8.1, plus the discord-worker 5.8.1 and og-worker 2.11.2 CJK font re-cut.
- **Merge order:** #240 is stacked on #239. Merge it after the batch and after #239, before Sprint 2.
- **No ID:** it came from the research, not from a catalog.

## Sprint 1 — web-app: tool settings have one owner (the HIGH) — PR #244 (open)

**Done in PR #244** (web-app 5.14.1, `f20683f8` + `68599b74`). It also fixed deep-dive/BUG-014 (Sprint 5) and the Mixer's mixing-field mode (unnumbered), and changed one `PRIVACY.md` clause in all six languages. Details are in the re-verification file's *Sprint 1* section.

deep-dive/BUG-001 is the anchor. Each tool keeps local copies of its settings, and `ConfigController` broadcasts a full config over them, or never seeds them at mount. Fix it once:
- seed every tool from `getConfig()`;
- route rail and slot picks through the controller;
- align the default tables.

Then add the test deep-dive/BUG-011 asks for: mount against a non-default persisted config with a real controller.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-001](../2026-10-04-deep-dive/findings/BUG-001.md) | deep-dive | HIGH · MAIN | swatch-tool setConfig applies ConfigController's full swatch config (default hairColors/SeekerOfTheSun/Female) over tool-local eyeColors/Midlander/Male state |
| [deep-dive/BUG-019](../2026-10-04-deep-dive/findings/BUG-019.md) | deep-dive | MEDIUM · MAIN | gradient/swatch loadFromShareUrl applies share settings to tool-local state only; the next ConfigController notification reverts them |
| [deep-dive/BUG-022](../2026-10-04-deep-dive/findings/BUG-022.md) | deep-dive | MEDIUM · MAIN | Gradient, Swatch, Mixer and Budget never seed dyeFiltersConfig from the persisted config at mount, so saved dye filters are ignored until the sidebar is touched |
| [deep-dive/BUG-027](../2026-10-04-deep-dive/findings/BUG-027.md) | deep-dive | MEDIUM · MAIN | config-sidebar.ts connectedCallback: local copies of 9 config keys never refresh after an external ConfigController write |
| [deep-dive/BUG-012](../2026-10-04-deep-dive/findings/BUG-012.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts in-page match-line slider writes only local storage; next full budget-config broadcast resets it to ConfigController maxDeltaE |
| [deep-dive/BUG-023](../2026-10-04-deep-dive/findings/BUG-023.md) | deep-dive | MEDIUM · MAIN | swatch-tool setConfig needsReload branch nulls selectedColor but leaves matchedDyes, result cards, SEND TO ids and an enabled share button |
| [deep-dive/BUG-024](../2026-10-04-deep-dive/findings/BUG-024.md) | deep-dive | MEDIUM · MAIN | swatch-tool pickCharaSlot sets a slot selectionContext but keeps the earlier grid selectedColor/matchedDyes, so CLOSEST DYES, share and SEND TO describe the old cell |
| [deep-dive/BUG-011](../2026-10-04-deep-dive/findings/BUG-011.md) | deep-dive | MEDIUM (untested) · MAIN | No tool test mounts against a non-default persisted config or asserts that dye filters reach matching (the swatch case is not.toThrow only) |
| [deep-dive/BUG-078](../2026-10-04-deep-dive/findings/BUG-078.md) | deep-dive | LOW · MAIN | budget-tool.ts ignores persisted ConfigController displayOptions at mount; showHue/Stain/Spectrum always reset to true |
| [deep-dive/BUG-079](../2026-10-04-deep-dive/findings/BUG-079.md) | deep-dive | LOW · MAIN | budget-tool.ts onMount: forces and persists the global market.showPrices=true and never restores it |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 2 — bot-logic: the bot speaks the user's language (i18n, publish) — PR #246 (open, with Sprint 3)

**Done in PR #246** (bot-logic 4.6.0 + discord-worker 5.8.2, stacked on #244). Details are in the re-verification file's *Sprints 2+3* section.

**The anchor is HC-001 (P1):** `/glamour` and `/swatch` cards print the clan in English in every locale. bot-logic needs a clan getter for the names core ships, and #240 (core 5.8.1) makes the Korean and Chinese ones the clients' own. Merge #240 before this sprint.

**Also here:** the dye-problem chip (TERM-012), a Chinese category name (TERM-013), card plurals and wording (I18N-016 to I18N-018), the manual topic `/glamour` points to (I18N-019) and a Korean option description (I18N-020).

**TERM-004:** the sheet names are pinned in the dictionary (#239, *Character-Creation Color Sheets*). Merge #239 first.

**Also here (no ID):** the Korean `/preferences set clan` tooltip still gives core's old clan names as examples (미드랜더, 렌). Use the clients' (중원 부족, 아우라 렌).

**Publishes bot-logic early.** It needs nothing from the core and svg sprints. bot-logic publishes again in Sprint 15.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [HC-001](findings/HC-001.md) | i18n | P1 · MAIN | `tribeDisplay()` prints the clan in English on every `/glamour` and `/swatch` card |
| [TERM-012](findings/TERM-012.md) | i18n | P2 · MAIN | The bot's dye-problem chip says "FARBEN" (colors) in German and "TEINTES" (shades) in French |
| [TERM-013](findings/TERM-013.md) | i18n | P2 · MAIN | Chinese `/manual` tip calls the Facewear dye category 面部装备 |
| [TERM-004](findings/TERM-004.md) | i18n | P2 · MAIN | The bot names character-creation sheets differently from its own card labels and from web-app |
| [I18N-016](findings/I18N-016.md) | i18n | P3 · MAIN | Bot `card.glamourLooks` goes through `t()`, not `tc()`: the card reads "+3 LOOK" / "+3 ASPECT" |
| [I18N-017](findings/I18N-017.md) | i18n | P3 · MAIN | Korean `card.glamourPieces` "염색 {n}개" counts dye jobs, not dyed pieces |
| [I18N-018](findings/I18N-018.md) | i18n | P3 · MAIN | German bot `card.glamourFixed*` hardcodes neuter "das" after an item name of any gender |
| [I18N-019](findings/I18N-019.md) | i18n | P3 · MAIN | `/glamour` sends users to the character-file manual topic, which only describes `/swatch` |
| [I18N-020](findings/I18N-020.md) | i18n | P3 · MAIN | Korean `/glamour` and `/swatch` file-option descriptions show literal backticks |

**Ends with:** **one PR with the next sprint.** Bump `@xivdyetools/bot-logic` (minor) and discord-worker; re-cut discord-worker's CJK subsets (`python scripts/subset-cjk-fonts.py` in `apps/discord-worker`; compare the subsets by cmap, never md5); `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` (that includes discord-worker's `font-coverage.test.ts`) → merge (`deploy-discord-worker.yml` runs `register-commands`) → Actions "Publish Packages to npm" for bot-logic

## Sprint 3 — discord-worker: localized file errors, and the font re-cut (same PR as Sprint 2) — PR #246 (open)

**HC-002 (P1):** every pre-check in `chara-attachment.ts` puts an English reason into the translated error. The new keys live in bot-logic's locales, so this ships in Sprint 2's PR.

**Fonts:** re-cut the CJK subsets here, for every drawn string Sprint 2 changes. A drawn-text change with no re-cut turns `font-coverage.test.ts` red.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [HC-002](findings/HC-002.md) | i18n | P1 · MAIN | The bot fills its translated file-error message with English reasons |

**Ends with:** the same PR and merge as Sprint 2 (`deploy-discord-worker.yml`, which runs `register-commands`)

## Sprint 4 — web-app: presets and collections — PR #245 (open)

**Done in PR #245** (web-app 5.14.2, stacked on #244). It also fixed the Glamour Reader's copies of BUG-016 and BUG-082, and tagged core's `PresetService.getCategoryMeta` `@public`. Details are in the re-verification file's *Sprint 4* section.

**The anchor is deep-dive/BUG-029:** `reconcileTombstones` marks live saved presets "Removed by its author".

**Also here:**
- vote failures shown as "already voted";
- a stale response cache;
- a delete failure reported as success;
- collection manager refresh;
- and the preset-tool test gap (deep-dive/BUG-026).

**Dead code:** the preset-service removals from the dead-code catalog land here, after the fixes in the same files.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-029](../2026-10-04-deep-dive/findings/BUG-029.md) | deep-dive | MEDIUM · MAIN | preset-tool reconcileTombstones marks saved community presets "Removed by its author" in three live cases: a swallowed API failure, a saved local- palette, and a stale filtered response |
| [deep-dive/BUG-030](../2026-10-04-deep-dive/findings/BUG-030.md) | deep-dive | MEDIUM · MAIN | preset-tool.ts handleCardVote: every failed vote is shown as 'already voted'; a failed removeVote is silent |
| [deep-dive/BUG-031](../2026-10-04-deep-dive/findings/BUG-031.md) | deep-dive | MEDIUM · MAIN | community-preset-service response cache never invalidated after delete/edit/submit |
| [deep-dive/BUG-032](../2026-10-04-deep-dive/findings/BUG-032.md) | deep-dive | MEDIUM · MAIN | preset-submission-service.deletePreset failure reported as success by both callers |
| [deep-dive/BUG-026](../2026-10-04-deep-dive/findings/BUG-026.md) | deep-dive | MEDIUM (untested) · MAIN | preset-tool.test.ts: no coverage of reconcileTombstones, vote handling, tab pools/counts or savedFirst |
| [deep-dive/BUG-017](../2026-10-04-deep-dive/findings/BUG-017.md) | deep-dive | MEDIUM · MAIN | collection-manager-modal.ts: creating from the manager never refreshes the manager list, count or create-limit state |
| [deep-dive/BUG-016](../2026-10-04-deep-dive/findings/BUG-016.md) | deep-dive | MEDIUM · MAIN | chara-sheet.ts saveCharacterColors: a duplicate record name fails with a generic 'save failed' toast and has no suffix fallback |
| [deep-dive/BUG-101](../2026-10-04-deep-dive/findings/BUG-101.md) | deep-dive | LOW · MAIN | my-submissions-modal.ts: after a successful delete the modal keeps showing the deleted preset and stale stats |
| [deep-dive/BUG-108](../2026-10-04-deep-dive/findings/BUG-108.md) | deep-dive | LOW · MAIN | preset-detail.ts checkVoteStatus: a failed hasVoted check overwrites the vote count with 0 |
| [deep-dive/BUG-109](../2026-10-04-deep-dive/findings/BUG-109.md) | deep-dive | LOW · MAIN | preset-tool.ts categoryCount/renderTabs: counts ignore feedBlend, feedHideUnbuyable, keepDeleted and the saved search, and the Saved badge omits local palettes |
| [deep-dive/BUG-110](../2026-10-04-deep-dive/findings/BUG-110.md) | deep-dive | LOW · MAIN | preset-tool.ts handleVoteUpdate: votedIds is not synced from the detail view, so card and detail vote state diverge |
| [deep-dive/BUG-102](../2026-10-04-deep-dive/findings/BUG-102.md) | deep-dive | LOW · MAIN | preset-submission-form.ts: dismissTop() after awaited submit/upload can close the wrong modal; unguarded sessionStorage write inside the submit try |
| [deep-dive/BUG-082](../2026-10-04-deep-dive/findings/BUG-082.md) | deep-dive | LOW · MAIN | chara-sheet.ts saveCharacterColors: ?? lets an empty or whitespace Nickname beat the file-name/default fallback, so the save always fails |
| [deep-dive/BUG-084](../2026-10-04-deep-dive/findings/BUG-084.md) | deep-dive | LOW · MAIN | collection-manager-modal downloadSingleCollection filename strips all non-ASCII (CJK names become dashes) |
| [deep-dive/OPT-008](../2026-10-04-deep-dive/findings/OPT-008.md) | deep-dive | Opt LOW · MAIN | preset-tool.ts handleSearchInput/sort: refetches the API pool with a spinner on Saved/Mine tabs whose pools are local |
| [dead-code/DEAD-012](../2026-10-04-dead-code/findings/DEAD-012.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | HybridPresetService: 5 public methods with no caller and no test, about 49 lines including blanks |
| [dead-code/DEAD-013](../2026-10-04-dead-code/findings/DEAD-013.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getFeaturedPresets: HybridPresetService's has no caller and CommunityPresetService's is test-only — 33 source + 31 test lines |
| [dead-code/DEAD-014](../2026-10-04-dead-code/findings/DEAD-014.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getPresets 'community' guard in hybrid-preset-service.ts is unreachable — 19 lines |
| [dead-code/DEAD-015](../2026-10-04-dead-code/findings/DEAD-015.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getRemainingSubmissions in preset-submission-service.ts has no caller or test — 41 lines |
| [dead-code/DEAD-016](../2026-10-04-dead-code/findings/DEAD-016.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 5 — web-app: tool correctness — PR #247 (open)

**Done in PR #247** (web-app 5.14.3, stacked on #245). It also removed dead-code/DEAD-004 (from Sprint 23) to keep the layout shell within budget. Details are in the re-verification file's *Sprint 5* section.

**Language switch:** the switch empties four tools (deep-dive/BUG-021), and no test fires it (deep-dive/BUG-076).

**Stale deep links:** a stale deep link overrides the user's choice (deep-dive/BUG-013, deep-dive/BUG-014).
- **deep-dive/BUG-014 is already fixed by Sprint 1 (PR #244);** skip it here. `?maxDelta=` now goes through `ConfigController`, and Budget's `setConfig` moves both thumbs and the label.

**Matching and runs:**
- budget runs without a supersede guard;
- the comparison tier disagrees with its verdict;
- a gradient pinned step can repeat a dye;
- swatch filtering returns too few matches.

**Keyboard:** the palette drawer cannot be used from the keyboard.

**Boot:** deep-dive/OPT-001 removes a dev-only network probe from boot.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-021](../2026-10-04-deep-dive/findings/BUG-021.md) | deep-dive | MEDIUM · MAIN | A language switch empties or hides the results of the Harmony, Mixer, Comparison and Accessibility tools (update() rebuilds the panels without regenerating them) |
| [deep-dive/BUG-076](../2026-10-04-deep-dive/findings/BUG-076.md) | deep-dive | LOW (untested) · MAIN | No tool test invokes the LanguageService.subscribe callback, so the language-switch rebuild that empties four tools (see the MEDIUM finding) is untested |
| [deep-dive/BUG-013](../2026-10-04-deep-dive/findings/BUG-013.md) | deep-dive | MEDIUM · MAIN | A stale preserved ?dye= deep link overrides the user's later choice in Budget (Set as budget target) and Harmony (base-dye pick) |
| [deep-dive/BUG-014](../2026-10-04-deep-dive/findings/BUG-014.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts handleDeepLink: ?maxDelta= changes matchLine after the slider and label were rendered |
| [deep-dive/BUG-015](../2026-10-04-deep-dive/findings/BUG-015.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts findAlternatives has no run guard; a superseded run overwrites this.rows after a newer run |
| [deep-dive/BUG-018](../2026-10-04-deep-dive/findings/BUG-018.md) | deep-dive | MEDIUM · MAIN | comparison-tool.ts buildSevenReadouts: the ΔE2000 tier skips tierFor's 0->1 bump, so it contradicts the verdict when matchThreshold < 5 |
| [deep-dive/BUG-020](../2026-10-04-deep-dive/findings/BUG-020.md) | deep-dive | MEDIUM · MAIN | gradient-tool calculateInterpolation seeds usedDyeIds with endpoints only, so a free step before a pinned step can match the pinned dye undeduplicated |
| [deep-dive/BUG-025](../2026-10-04-deep-dive/findings/BUG-025.md) | deep-dive | MEDIUM · MAIN | swatch-tool findMatchingDyes filters after a top-(maxResults*3) request, so strong dye filters return fewer than maxResults; closestDyeTo ignores filters |
| [deep-dive/BUG-028](../2026-10-04-deep-dive/findings/BUG-028.md) | deep-dive | MEDIUM · MAIN | dye-palette-drawer.ts renderSwatch: swatch is a click-only div, so keyboard users cannot pick a dye from the app-wide picker |
| [deep-dive/OPT-001](../2026-10-04-deep-dive/findings/OPT-001.md) | deep-dive | Opt MEDIUM · MAIN | main.ts:111 boot awaits getServicesStatus() network probe used only by a dev-only log, delaying the v4 shell |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 6 — web-app: translations and terminology (i18n) — PR #248 (open)

**Done in PR #248** (web-app 5.14.4 and core 5.8.2, stacked on #247). All 18 rows, the fur-pattern note, and the core Brass names the maintainer asked for. **Deploy needs:** after merge, publish core 5.8.2 through the "Publish Packages to npm" workflow. Details are in the re-verification file's *Sprint 6* section.

**Wrong English first:** the Glamour list privacy note claims a scope the code does not have (TERM-002), "tribe" names two things (TERM-009), and the list goes by two names (TERM-018).

**Then the translations:**
- two Korean typos (I18N-003);
- German words for dye, preset and facewear (TERM-005 to TERM-007);
- the Chinese Dated tag (TERM-008);
- singular forms (I18N-007);
- the smaller wording rows.

**TERM-003:** the sheet names are pinned in the dictionary (#239, *Character-Creation Color Sheets*).

**TERM-007, decided 2026-10-05:** a web-research agent first finds the client's own word for "facewear" in each language and records it in `docs/reference/ffxiv-terminology.md`. The fix and the facewear *Pin first* row then follow the dictionary.

**Also here (no ID):** `swatch.absentFurPattern` still calls Hrothgar 로스갈 in Korean (core says 로스가르 since #240). All five translations also name the fur pattern differently from the client (体毛柄 / Fellzeichnung / Motif du pelage / 털 무늬 / 毛纹).

**Before Sprint 22:** some rows touch `glamour-block.ts`, which several of Sprint 22's rows also touch, so this sprint lands first.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [TERM-002](findings/TERM-002.md) | i18n | P2 · MAIN | The Glamour list privacy note says edits are kept "for this outfit"; they are kept per piece of gear |
| [TERM-009](findings/TERM-009.md) | i18n | P2 · MAIN | English calls the clan "tribe" in Swatch Matcher, and calls the race lock "ANY TRIBE" in the Glamour Reader |
| [TERM-018](findings/TERM-018.md) | i18n | P3 · MAIN | English calls the Glamour list "Equipment list" in its toasts, and its download "Export .md" then "Save .md" |
| [I18N-003](findings/I18N-003.md) | i18n | P2 · MAIN | Korean ΔE explainer and budget note contain a non-word (낙은) and a broken verb form (뺌 값을) |
| [TERM-005](findings/TERM-005.md) | i18n | P2 · MAIN | German `glamour.fact.dye` "FARBE ×{n}" says color where it means dye |
| [TERM-006](findings/TERM-006.md) | i18n | P2 · MAIN | German web-app names a preset three ways: Voreinstellung, Preset and Vorlage |
| [TERM-007](findings/TERM-007.md) | i18n | P2 · MAIN | The facewear color tag says "glasses" in de, fr and zh, beside a slot that says facewear |
| [TERM-008](findings/TERM-008.md) | i18n | P2 · MAIN | Chinese `glamour.fact.dated` "旧版"; the Chinese client prefixes Dated items 过期 |
| [TERM-003](findings/TERM-003.md) | i18n | P2 · MAIN | web-app names character-creation sheets two ways within one file: highlights, tattoo, face paint, limbal ring |
| [TERM-016](findings/TERM-016.md) | i18n | P3 · MAIN | Japanese names the dye channel two ways: 染色枠 and チャンネル |
| [TERM-017](findings/TERM-017.md) | i18n | P3 · MAIN | Korean share errors say 염색약 (hair dye) where every other surface says 염료 |
| [I18N-007](findings/I18N-007.md) | i18n | P3 · MAIN | Glamour Reader counts have no singular form: "1 dyes", "Same look as 1 other items", "1 pieces" |
| [I18N-008](findings/I18N-008.md) | i18n | P3 · MAIN | German `glamour.row.fixed*` hardcodes neuter "das" after an item name of any gender |
| [I18N-009](findings/I18N-009.md) | i18n | P3 · MAIN | German `glamour.verdict.countCompany` "{n} BRAUCHT GESELLSCHAFT" reads as "needs company" |
| [I18N-010](findings/I18N-010.md) | i18n | P3 · MAIN | French `glamour.picker.foot` quotes the button as "Exporter .md"; the button says "Exporter en .md" |
| [I18N-011](findings/I18N-011.md) | i18n | P3 · MAIN | French lip and face-paint sheet labels put "(Foncé)" / "(Clair)" on feminine nouns |
| [I18N-012](findings/I18N-012.md) | i18n | P3 · MAIN | The character-file card joins two ja / zh sentences with an ASCII space after 。 |
| [HC-003](findings/HC-003.md) | i18n | P3 · MAIN | The Glamour Reader's facewear chip tooltip names the color in English |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`. The edited `en` values re-key the allow-lists: re-run `pnpm --filter xivdyetools-web-app exec vitest run scripts/i18n-parity-gate.test.js --coverage.enabled=false` and update a stale allow-list reason in the same commit.

## Sprint 7 — Policy documents, both apps (docs only) — PR #249 (open)

**Done in PR #249** (web-app 5.14.5 and discord-worker 5.8.3, stacked on #248; merge #246 first, since it is 5.8.2). All six rows, plus I18N-001's full fix. **Deploy needs:**
- If the PR merges after 2026-10-05, set *Last updated* to the merge date on all 24 variants.
- The bot policy's §11 Discord announcement is the maintainer's call.

Details are in the re-verification file's *Sprint 7* section.

**What lands here:** the Terms of Service variants missing the Glamour Reader (I18N-002), the "About → Privacy" path (I18N-013), the Korean moderator word (TERM-001), French "préréglage" (TERM-010), tool names in the policy prose (TERM-019) and Japanese 自社 (TERM-020).

**Sprint 0 fallback:** any Sprint 0 policy item not fixed inside its PR lands here too.
- **Carried from Sprint 0 (2026-10-05): I18N-001's full fix — decided: do it.** The lighter fix shipped. Replace "since the *Last updated* date" with the go-live date (2026-10-05) in all twelve variants; the anchors are in the re-verification file.
- **TERM-001 shrank to the two Korean Terms documents (five lines).** Both privacy documents now say 조정자.
- **Do I18N-002 and TERM-019 in one pass:** they rewrite the same tools sentence in each variant.

**How to edit:** one translator per language plus a verifier, as in the 2026-09-20 pass. Each document's six variants change in one commit, with `Last updated` on all six. The checklist is `.agents/skills/audit-shared/policy-documents.md`.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [I18N-002](findings/I18N-002.md) | i18n | P2 · MAIN | The five web Terms of Service translations say "ten tools" and list nine: the Glamour Reader is missing |
| [I18N-013](findings/I18N-013.md) | i18n | P3 · MAIN | The web privacy guide says it is reached from "About → Privacy"; the UI says "About XIV Dye Tools" and "POLICIES" |
| [TERM-001](findings/TERM-001.md) | i18n | P2 · PR#223 (`PRIVACY.ko.md:13`) + MAIN | Korean policy documents call the moderator two things: 운영자 and 조정자 |
| [TERM-010](findings/TERM-010.md) | i18n | P2 · MAIN (the PRs add more) | French policy documents call a preset "palette prédéfinie"; the UI says "préréglage" |
| [TERM-019](findings/TERM-019.md) | i18n | P3 · MAIN | Policy prose names four tools differently from their UI titles |
| [TERM-020](findings/TERM-020.md) | i18n | P3 · MAIN | Japanese privacy guide says the fonts are 自社ホスト ("hosted by our company") |

**Ends with:** `python .agents/skills/audit-shared/scripts/policy-locale-parity.py` and `pnpm docs:check-links` → merge. The documents are served from GitHub `main` (`about-modal.ts` `POLICY_DOCS_BASE`), so they are live at merge. The web-app and discord-worker deploy workflows fire through their path filters but ship no code change. A user-visible policy change also gets a root `CHANGELOG-laymans.md` line, committed on its own.

## Sprint 8 — presets-api: dye validation, null bodies, retention signal — PR #256 (open)

**Done in PR #256** (presets-api 2.5.0), the first PR of the discord-worker stack. It is based on the join branch; see the re-verification file's *Execution notes* for the merge order. All seven fixes and the BUG-003 payload half are in, plus DEAD-031 to DEAD-034 and the BUG-063 cron line.

**Deploy needs:**
- Deploy together with Sprint 9.
- Run two read-only D1 queries first: presets that repeat a dye, and existing `previous_values` snapshots.
- After deploy, check Cron Events for a failed sweep.

**deep-dive/BUG-010:** repeated dye ids bypass the 3-dye floor and the duplicate signature.

**From #224, after the merge:**
- deep-dive/BUG-066: make a failed retention sweep visible;
- deep-dive/BUG-067: add a self-guard to the identity re-key.

**deep-dive/BUG-003, payload half:** this sprint also carries the presets-api half of deep-dive/BUG-003, which is scheduled with discord-worker.
- Add only an edit flag to the webhook payload; `previous_values` is already sent.
- The change is additive, so it ships here, before discord-worker reads it.

**Dead code:** the presets-api cleanups follow the fixes.

**Carried from Sprint 0 (2026-10-05): deep-dive/BUG-063's remainder.** The 2.4.0 intro (`CHANGELOG.md:13-14`) should also name the new production-only daily Cron Trigger (`23 4 * * *`). Text only.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-010](../2026-10-04-deep-dive/findings/BUG-010.md) | deep-dive | MEDIUM · MAIN | validation-service validatePresetDyes accepts repeated dye ids, bypassing the 3-dye floor and dye_signature dedup |
| [deep-dive/BUG-064](../2026-10-04-deep-dive/findings/BUG-064.md) | deep-dive | LOW · MAIN | presets PATCH/POST and moderation status/revert: JSON body `null` -> TypeError -> opaque 500 instead of 400 |
| [deep-dive/BUG-065](../2026-10-04-deep-dive/findings/BUG-065.md) | deep-dive | LOW · MAIN | presets PATCH /:id re-moderates unchanged text; a failing/unscored verdict re-queues an approved (or resubmits a rejected) preset |
| [deep-dive/BUG-066](../2026-10-04-deep-dive/findings/BUG-066.md) | deep-dive | LOW · PR-#224 | retention-job.ts runRetentionJob: prunes swallow D1 errors, so a failed sweep reports success with no durable signal |
| [deep-dive/BUG-067](../2026-10-04-deep-dive/findings/BUG-067.md) | deep-dive | LOW (untested) · PR-#224 | identity-rekey-service rekeyIdentity(db,id,id) silently wipes the user's votes; no self-guard or test |
| [deep-dive/BUG-068](../2026-10-04-deep-dive/findings/BUG-068.md) | deep-dive | LOW · MAIN | validation-service name/description min-length counts whitespace; whitespace-only values pass |
| [deep-dive/BUG-069](../2026-10-04-deep-dive/findings/BUG-069.md) | deep-dive | LOW · MAIN | validation-service validateExampleLink rejects a leading-space link that normalizeExampleLink would accept |
| [dead-code/DEAD-033](../2026-10-04-dead-code/findings/DEAD-033.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | PresetCategory/AuthSource re-exports in presets-api types.ts are test-only: 6 src lines + 33 test lines |
| [dead-code/DEAD-034](../2026-10-04-dead-code/findings/DEAD-034.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Stale 'community' ternary in presets-api scripts/migrate-presets.ts is a never-taken branch: 1 line |
| [dead-code/DEAD-031](../2026-10-04-dead-code/findings/DEAD-031.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | successResponse + ApiSuccessResponse in presets-api api-response.ts are test-only: 31 src lines + 31 test lines |
| [dead-code/DEAD-032](../2026-10-04-dead-code/findings/DEAD-032.md) | dead-code | Conf HIGH / Blast NONE · REFACTOR FIRST | ErrorCode.BAD_REQUEST and ErrorCode.DATABASE_ERROR in presets-api api-response.ts are never read: 2 lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` → merge → `deploy-presets-api.yml` (no D1 migration)

## Sprint 9 — discord-worker: one moderation-notification path, KV failure handling — PR #257 (open)

**Done in PR #257** (discord-worker 5.8.4, bot-logic 4.7.0, presets-api 2.6.0), stacked on #256. Everything below is fixed except OPT-003, which needs a presets-api `?ids=` batch endpoint first, and OPT-005, which is per-isolate only.
- **presets-api grew one field.** The webhook only had `previous_values` to diff an edit against, and that is the Revert target, not the replaced text. 2.6.0 sends `edited_from`, the text the edit replaced; the bot diffs against it and labels Revert by what it restores.
- **Command shapes changed after all:** free-text options gain `max_length` (BUG-044's schema half) and the clan/gender descriptions are reworded ×6 (BUG-049). The deploy workflow re-registers them.
- **Also here:** the `/swatch slot:` refusal names the slot in the reader's language (from the Sprints 2+3 notes), and the moderation and submission-log embeds print the category's display name.
- **Recorded, not fixed:** `refusePrivately` sends nothing when the delete succeeds and the follow-up fails (logged only); a favourite marked `gone` is never looked up again; `/preferences set`'s Universalis-outage reply is not marked `upstream_universalis`; a v1 favourites blob that will not parse still throws; `edited_from` carries name, description, tags and dyes only.

**deep-dive/BUG-004:** the bot and the presets-api webhook both post for bot submissions.
- Drop the bot-side posts.
- presets-api needs no change.
- Check it with the moderation channel on a flagged `/preset submit` and `/preset edit`.

**deep-dive/BUG-003:** the webhook renders every edit as new.
- Map the presets-api sprint's edit flag to `kind: 'edit'`, with the original taken from the `previous_values` already in the payload.
- That presets-api change must be deployed first.

**Also here:**
- a world validation awaited inside the 3-second ack;
- favourites and preferences writes that overwrite after a swallowed read failure;
- the dead registry field.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-004](../2026-10-04-deep-dive/findings/BUG-004.md) | deep-dive | MEDIUM · MAIN | A preset submitted or edited through the bot is posted twice: discord-worker's own moderation/submission-log post (legacy button ids) plus the presets-api webhook's revision-bound post |
| [deep-dive/BUG-003](../2026-10-04-deep-dive/findings/BUG-003.md) | deep-dive | MEDIUM · MAIN | discord-worker's preset webhook (index.ts:402-407) hard-codes kind 'new', so a flagged edit is posted as "New preset pending" with no diff and no Revert button |
| [deep-dive/BUG-002](../2026-10-04-deep-dive/findings/BUG-002.md) | deep-dive | MEDIUM · MAIN | budget.ts/preferences.ts: validateWorld cold-cache service calls are awaited inside the 3 s ack window |
| [deep-dive/BUG-005](../2026-10-04-deep-dive/findings/BUG-005.md) | deep-dive | MEDIUM · MAIN | command-trace isUserCondition counts the Universalis client's synthetic 408 timeout as an answered 'rejected' outcome |
| [deep-dive/BUG-006](../2026-10-04-deep-dive/findings/BUG-006.md) | deep-dive | MEDIUM · MAIN | preset-favorites getPresetFavoriteEntries returns [] on read failure and addPresetFavorite overwrites the user's list |
| [deep-dive/BUG-041](../2026-10-04-deep-dive/findings/BUG-041.md) | deep-dive | LOW · MAIN | preview-image.ts puts a raw <@id> mention in the embed footer and drops the preset ID |
| [deep-dive/BUG-042](../2026-10-04-deep-dive/findings/BUG-042.md) | deep-dive | LOW · MAIN | extractor.ts renderColorSheet: render/edit failure is never logged and is reported to the user as 'no match found' |
| [deep-dive/BUG-043](../2026-10-04-deep-dive/findings/BUG-043.md) | deep-dive | LOW · MAIN | gradient.ts processGradientCommand: Start/End lines print the English Dye.name while step rows are localized |
| [deep-dive/BUG-044](../2026-10-04-deep-dive/findings/BUG-044.md) | deep-dive | LOW · MAIN | harmony.ts and sibling handlers echo the raw colour/dye option into errors.invalidColor embed descriptions with no sanitizeEmbedText or length cap |
| [deep-dive/BUG-045](../2026-10-04-deep-dive/findings/BUG-045.md) | deep-dive | LOW · MAIN | stats.ts overview: Avg Cmds/User divides a lifetime total by today's users |
| [deep-dive/BUG-046](../2026-10-04-deep-dive/findings/BUG-046.md) | deep-dive | LOW (untested) · MAIN | Router autocomplete paths for subcommand-group walk (/preset favorite remove), favourites back-fill incl. earlier-audit BUG-028 fix, clan autocomplete and preferences world autocomplete have no index.test.ts coverage. |
| [deep-dive/BUG-047](../2026-10-04-deep-dive/findings/BUG-047.md) | deep-dive | LOW · MAIN | Favourites name back-fill converts any getPreset failure (5xx/timeout/429, swallowed by .catch(()=>null)) into the preset UUID as the persisted name, which is never retried; names also never refresh on rename and the whole-list write can lose a concurrent favorite add. |
| [deep-dive/BUG-048](../2026-10-04-deep-dive/findings/BUG-048.md) | deep-dive | LOW · MAIN | preferences getUserPreferences swallows read failure as {} and the set/reset writes then overwrite or delete the user's whole prefs blob |
| [deep-dive/BUG-049](../2026-10-04-deep-dive/findings/BUG-049.md) | deep-dive | LOW · MAIN | preferences.ts getAffectedCommands and the /preferences schema advertise consumers that never read the key (clan/gender, blending->/gradient, matching->/swatch, and /harmony is left out) |
| [deep-dive/REFACTOR-002](../2026-10-04-deep-dive/findings/REFACTOR-002.md) | deep-dive | Refactor LOW · MAIN | searchPresetsForAutocomplete is called without logger, so its catch returns [] silently while the user-presets path logs. |
| [deep-dive/OPT-003](../2026-10-04-deep-dive/findings/OPT-003.md) | deep-dive | Opt LOW · MAIN | preset.ts favorite list fans out one getPreset per favourite (up to 50) |
| [deep-dive/OPT-004](../2026-10-04-deep-dive/findings/OPT-004.md) | deep-dive | Opt LOW · MAIN | stats.ts summary pages all of today's user keys it never displays |
| [deep-dive/OPT-005](../2026-10-04-deep-dive/findings/OPT-005.md) | deep-dive | Opt LOW · MAIN | preferences legacy-key migration re-reads two dead KV keys on every call for users with no prefs blob |
| [dead-code/DEAD-024](../2026-10-04-dead-code/findings/DEAD-024.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | CommandRegistryEntry.deprecated in registry.ts is never set or read in production: 2 lines + 3-line test |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic --filter=...xivdyetools-presets-api` → merge → `deploy-discord-worker.yml` (CI runs `register-commands`; this sprint changes command shapes: `max_length` and the clan/gender descriptions) and `deploy-presets-api.yml` (presets-api 2.6.0)

## Sprint 10 — oauth: limiter keying, null bodies

deep-dive/BUG-007: decode the path before the `/auth/*` limiter keys it, then add the tests deep-dive/BUG-055 asks for. deep-dive/BUG-056 turns a null JSON body into a 400. deep-dive/BUG-057 filters null roster elements and empty names, falling back to the degraded login.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-007](../2026-10-04-deep-dive/findings/BUG-007.md) | deep-dive | MEDIUM · MAIN | apps/oauth/src/index.ts /auth/* limiter keys and tiers on the raw percent-encoded pathname, while Hono routes on the decoded path |
| [deep-dive/BUG-055](../2026-10-04-deep-dive/findings/BUG-055.md) | deep-dive | LOW (untested) · MAIN | oauth tests never send a percent-encoded /auth path through the app's limiter or a JSON `null` body to the POST callbacks |
| [deep-dive/BUG-056](../2026-10-04-deep-dive/findings/BUG-056.md) | deep-dive | LOW · MAIN | POST /auth/callback and /auth/xivauth/callback destructure a null JSON body outside the parse try, giving a 500 instead of a 400 |
| [deep-dive/BUG-057](../2026-10-04-deep-dive/findings/BUG-057.md) | deep-dive | LOW · MAIN | xivauth.ts roster guard (earlier-audit BUG-051) validates only that the roster is an array; a null element gives a 500, and an empty verified name gives an empty username |
| [dead-code/DEAD-037](../2026-10-04-dead-code/findings/DEAD-037.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | apps/oauth vitest.config.ts coverage.exclude names nonexistent rate-limit-do.ts / durable-objects: 3 config lines |
| [dead-code/DEAD-036](../2026-10-04-dead-code/findings/DEAD-036.md) | dead-code | Conf HIGH / Blast LOW · REMOVE WITH CAUTION | decodeJWT wrapper in apps/oauth jwt-service.ts is test-only: 8 src lines + 31-line describe block |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` → merge → `deploy-oauth.yml` (never a bare `wrangler deploy` by hand: it is production)

## Sprint 11 — og-worker: gradient card follows the requested algorithm

deep-dive/BUG-009 and deep-dive/BUG-008: the gradient card ranks by a hard-coded ΔE and ramps in the wrong space. Also here: crawler parameters, the extractor algorithm, legacy `?algo=` spellings, cache-key fragmentation and resvg frees.

**i18n:** the French deck name for Community Presets (TERM-011) and a German crawler sentence (I18N-014).

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-009](../2026-10-04-deep-dive/findings/BUG-009.md) | deep-dive | MEDIUM · MAIN | gradient.ts generateGradientOG ranks middle-band dyes by hardcoded 'ciede2000' while printing the delta and footer in the requested algo |
| [deep-dive/BUG-008](../2026-10-04-deep-dive/findings/BUG-008.md) | deep-dive | MEDIUM · MAIN | services/svg/gradient.ts interpolate(): the card ramps in a space derived from algo (Lab for the default ciede2000) and ignores the shared interpolation (page default hsv), so its middle dyes differ from the page |
| [deep-dive/BUG-058](../2026-10-04-deep-dive/findings/BUG-058.md) | deep-dive | LOW · MAIN | index.ts ogCacheKey keys algo and mode on every /og route although only 5 routes read algo and 2 read mode, contradicting its own docblock |
| [deep-dive/BUG-059](../2026-10-04-deep-dive/findings/BUG-059.md) | deep-dive | LOW · MAIN | og-data-generator.ts generateOGDataForTool: gradient/mixer/harmony crawler ignores hexStart/hexEnd/hexA/hexB/hex slots, so a custom-colour share unfurls the generic tool card |
| [deep-dive/BUG-060](../2026-10-04-deep-dive/findings/BUG-060.md) | deep-dive | LOW · MAIN | extractor.ts matches by hardcoded ciede2000 and the crawler forwards algo only onto og:url, so the unfurl can name different dyes than the page |
| [deep-dive/BUG-061](../2026-10-04-deep-dive/findings/BUG-061.md) | deep-dive | LOW (untested) · MAIN | gradient.test.ts has no algorithm case; harmony.test.ts:233 lists only the six 5.0 spellings and asserts only '<svg' |
| [deep-dive/BUG-062](../2026-10-04-deep-dive/findings/BUG-062.md) | deep-dive | LOW · MAIN | harmony.ts passes a raw legacy ?algo= (hyab/euclidean/oklch-weighted) to core generateHarmonySlots; getDistanceForMethod returns undefined and the card shows dyes in table order |
| [deep-dive/OPT-006](../2026-10-04-deep-dive/findings/OPT-006.md) | deep-dive | Opt LOW · MAIN | renderer.ts renderSvgToPng never .free()s Resvg or RenderedImage, leaving each render's wasm allocations to FinalizationRegistry timing |
| [dead-code/DEAD-039](../2026-10-04-dead-code/findings/DEAD-039.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | CrawlerInfo.userAgent in apps/og-worker/src/types.ts is written but never read since the crawler log was minimized: 4 src lines + 11 test lines |
| [dead-code/DEAD-040](../2026-10-04-dead-code/findings/DEAD-040.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Unused '@' path alias in apps/og-worker vitest.config.ts and tsconfig.json: 10 config lines |
| [TERM-011](findings/TERM-011.md) | i18n | P2 · MAIN | og-worker's French deck still calls Community Presets "Palettes Communautaires" |
| [I18N-014](findings/I18N-014.md) | i18n | P3 · MAIN | German Glamour Reader crawler description is ungrammatical: an ob-clause under "mit" |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml` (bumping `CARD_VERSION` re-renders cached cards once; a bare deploy is the live beta). TERM-011 changes `og-strings.ts`: re-run og-worker's `scripts/subset-cjk-fonts.py` and compare by cmap (Latin-only, so expect no change).

## Sprint 12 — @xivdyetools/logger: redaction gaps (publish)

deep-dive/BUG-140: context strings skip key=value redaction. deep-dive/BUG-141: `toJSON` objects log as `{}`. Plus a stale doc and a per-call Set rebuild.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-140](../2026-10-04-deep-dive/findings/BUG-140.md) | deep-dive | LOW · MAIN | logger context string values skip sanitizeErrorMessage key=value/JSON-key redaction |
| [deep-dive/BUG-141](../2026-10-04-deep-dive/findings/BUG-141.md) | deep-dive | LOW · MAIN | logger redactSensitiveFields spread-copies toJSON objects (Date/URL), logging them as {} |
| [deep-dive/OPT-010](../2026-10-04-deep-dive/findings/OPT-010.md) | deep-dive | Opt LOW · MAIN | logger redactSensitiveFields rebuilds the normalized redact Set per node per call |
| [deep-dive/REFACTOR-007](../2026-10-04-deep-dive/findings/REFACTOR-007.md) | deep-dive | Refactor LOW · MAIN | logger orphaned MAX_STRINGIFY_NODES JSDoc sits above AUTH_SCHEMES |

**Ends with:** bump `@xivdyetools/logger` (patch) → gate with `--filter=...@xivdyetools/logger` → merge → Actions publish

## Sprint 13 — @xivdyetools/core: blending, palette extraction, parser bounds (publish) — PR #260 (open)

**Done in PR #260** (core 5.10.0, bot-logic 4.8.2, web-app 5.14.10, og-worker 2.11.3, discord-worker 5.8.7), stacked on #259. All fourteen and TERM-021 are fixed; both workers' CJK subsets were re-cut and compared by cmap.
- **BUG-035 grew:** the same grey-hue defect sat on the DEFAULT path of `/gradient` and the web Gradient Builder (hsv, oklch, lch); fixed there too. Exact greys only, as CSS Color 4 has it — near-greys keep their hue.
- **og-worker:** its de/fr swatch descriptions reworded so no gendered word precedes the new sheet names; its version moves to retire cached HSL mixer cards.
- **docs/versions.md** gets the history rows Sprints 9, 15 and 14+28 left out.
- **Recorded, not fixed:** the web app's private text-colour helpers keep a 0.45/0.5 luminance threshold (BUG-134's class, in budget-tool, gradient-tool, mixer-tool, preset-edit-form, v4-color-wheel, mixer-blending-engine); three Infinity policies across blendColors (clamp), findClosestDyes (no cap) and PaletteService (default); og-worker's English swatch description says "this {sheet}" with plural sheet names; the web app's English tattoo label and core's en `Tattoo/Limbal` keep the unspaced slash.

**MEDIUM fixes:**
- deep-dive/BUG-035: grey mixes get a hue neither input has.
- deep-dive/BUG-036: palette extraction returns duplicate 0-pixel clusters.

**Also here:** LOW parser and data fixes, plus two tests that cannot fail.

**`build-locales.ts`:** deep-dive/BUG-128 is the generator, so fix the generator, never the generated JSON. The sheet names (TERM-021) are in the same file and follow the dictionary table (#239). The race and clan names there were corrected earlier, in #240 (core 5.8.1), so this sprint's bump is the next minor.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-035](../2026-10-04-deep-dive/findings/BUG-035.md) | deep-dive | MEDIUM · MAIN | blending.ts blendHSL interpolates the hue of an achromatic input, which is meaningless (always 0), so grey/white/black mixes get a hue neither input has |
| [deep-dive/BUG-036](../2026-10-04-deep-dive/findings/BUG-036.md) | deep-dive | MEDIUM · MAIN | PaletteService kMeansClustering caps k at pixel count, so images with fewer distinct colours than colorCount return duplicate 0-pixel clusters that discord /extractor renders as rows |
| [deep-dive/BUG-128](../2026-10-04-deep-dive/findings/BUG-128.md) | deep-dive | LOW · MAIN | build-locales.ts writes locale JSONs before exiting 1 on missing cells, and never checks dyes.json ids against dyenames.csv rows |
| [deep-dive/BUG-129](../2026-10-04-deep-dive/findings/BUG-129.md) | deep-dive | LOW · MAIN | blendColors lets a NaN ratio through Math.max/Math.min and returns the invalid hex '#NaNNaNNaN' |
| [deep-dive/BUG-130](../2026-10-04-deep-dive/findings/BUG-130.md) | deep-dive | LOW · MAIN | dyes.json English name 'Opo-Opo Brown' disagrees with en.json/dyenames.csv 'Opo-opo Brown' (stainID 24, itemID 5752) |
| [deep-dive/BUG-131](../2026-10-04-deep-dive/findings/BUG-131.md) | deep-dive | LOW · MAIN | CharacterColorService.findClosestDyes earlier-audit BUG-056 guard misses NaN/non-number count -> TypeError on best[-1] |
| [deep-dive/BUG-132](../2026-10-04-deep-dive/findings/BUG-132.md) | deep-dive | LOW · MAIN | DyeService.searchByLocalizedName returns all 125 dyes for an empty or whitespace query when the locale is loaded |
| [deep-dive/BUG-133](../2026-10-04-deep-dive/findings/BUG-133.md) | deep-dive | LOW · MAIN | chara-parser parseFloatColor accepts empty segments as 0 (and Infinity), producing a silent wrong lip/colour |
| [deep-dive/BUG-134](../2026-10-04-deep-dive/findings/BUG-134.md) | deep-dive | LOW · MAIN | ColorAccessibility.isLightColor/getOptimalTextColor use a luminance threshold of 0.5, which picks the lower-contrast text for luminance between about 0.18 and 0.5 |
| [deep-dive/BUG-135](../2026-10-04-deep-dive/findings/BUG-135.md) | deep-dive | LOW · MAIN | ColorConverter.hsvToRgb caches under a key rounded to 2 dp but stores the result computed from the unrounded inputs, so the output depends on call order |
| [deep-dive/BUG-136](../2026-10-04-deep-dive/findings/BUG-136.md) | deep-dive | LOW · MAIN | DyeDatabase.initialize accepts an all-invalid payload as a loaded empty DB, and duplicate ids only log through the NoOp logger |
| [deep-dive/BUG-137](../2026-10-04-deep-dive/findings/BUG-137.md) | deep-dive | LOW · MAIN | HarmonySelector.generateHarmonySlots reserves a pinned dye only for later slots under preventDuplicates, so an earlier slot can choose the same dye |
| [deep-dive/BUG-138](../2026-10-04-deep-dive/findings/BUG-138.md) | deep-dive | LOW (untested) · MAIN | DyeSearch.test.ts findClosestDye/findDyesWithinDistance tests pass on null or empty results |
| [deep-dive/BUG-139](../2026-10-04-deep-dive/findings/BUG-139.md) | deep-dive | LOW (untested) · MAIN | HarmonySelector.test.ts pin test pins Jet Black, a dye no earlier slot picks, so it cannot detect the earlier-slot duplicate |
| [TERM-021](findings/TERM-021.md) | i18n | P3 · MAIN | Core's character-creation sheet names are typed by hand, and its limbal is "cornea" / "iris" in ja, ko and zh |

**Ends with:** bump `@xivdyetools/core` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` (all consumers) → merge (consumer deploy workflows fire on `packages/core/**`) → Actions publish. If TERM-021 lands, its CJK sheet names reach both workers' font gates, which read core's locales. Re-cut the discord-worker and og-worker subsets in the same PR (compare by cmap).

## Sprint 14 — @xivdyetools/svg: card text fidelity (publish) — PR #259 (open, with Sprint 28)

**Done in PR #259** together with Sprint 28 (svg 4.4.0, one publish; bot-logic 4.8.1, discord-worker 5.8.6), stacked on #258. All six are fixed.
- **BUG-142 grew:** the /contrast embed and the /compare RATIO readout printed the same ratio rounded, so svg now exports `formatContrastRatio` and all three printers use it (bot-logic 4.8.1). Publish svg before bot-logic.
- **The /compare readouts are localized** (de/fr decimal comma), as its ΔE headline already was.
- **Also here:** the `+2 LOOKS` doc comment (Sprints 2+3 note); the discord-worker integration suite's stale `validateWorld` expectations (BUG-031).
- **Recorded, not fixed:** the /compare embed still prints ΔE with `toFixed` (de reads 27,2 on the card, 27.2 in the embed); the web app has three ratio printers on other rules (comparison-tool, accessibility-tool pairValue, metric-help); og-worker's font gate still uses a hand-kept glyph list instead of `scanEmittedGlyphs`; the scanner's two documented limits.

Rounding in the contrast tier, ellipsised step ranges, a sub-floor label, and the frame-budget gate's missing cards. The glamour card footer's line breaks (I18N-015) ride with them.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-142](../2026-10-04-deep-dive/findings/BUG-142.md) | deep-dive | LOW · MAIN | contrast-card.ts tone/tier judged on the raw ratio while 13C·1 prints it rounded to 1 dp (2.96 shows '3.0' in failing red) |
| [deep-dive/BUG-143](../2026-10-04-deep-dive/findings/BUG-143.md) | deep-dive | LOW · MAIN | emitted-glyphs.ts scanner fails open on \u escapes in literals and on a keyword-preceded regex (return /'/) |
| [deep-dive/BUG-144](../2026-10-04-deep-dive/findings/BUG-144.md) | deep-dive | LOW (untested) · MAIN | frame-budget.test.ts type-floor/text-extent gate omits glamour, swatch, a11y, dye-info and budget-ledger cards |
| [deep-dive/BUG-145](../2026-10-04-deep-dive/findings/BUG-145.md) | deep-dive | LOW · MAIN | glamour-card.ts look label drawn at 10.5 px, below the documented 11 px type floor |
| [deep-dive/BUG-146](../2026-10-04-deep-dive/findings/BUG-146.md) | deep-dive | LOW · MAIN | gradient.ts ROW_WIDTHS.lead=28 ellipsises two-digit merged step ranges ('9–10' -> '9–…', '10–12' -> '10…') |
| [I18N-015](findings/I18N-015.md) | i18n | P3 · MAIN | Glamour card footer wraps at any space: counts split from their nouns, and long German is cut off |

**Ends with:** bump `@xivdyetools/svg` (patch) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` → merge → Actions publish

## Sprint 15 — @xivdyetools/bot-logic: input resolution and filtered matching (publish) — PR #258 (open)

**Done in PR #258** (bot-logic 4.8.0, discord-worker 5.8.5), stacked on #257. All six are fixed; BUG-126 waits only on moderation-worker's caller (Sprint 17).
- **Coverage is enforced:** `coverage.enabled` in bot-logic's `vitest.config.ts`, as discord-worker, oauth and web-app do, so the gate and CI fail below 90%. Branches are at 96.0%.
- **One log format:** every caught failure logs `[cmd] generation failed: <class[ code]>` through an internal `failureKind`; never the message, which can quote the user's hex or the file.
- **Published API (minor):** `NOT_ENOUGH_DYES` joins the comparison, contrast and accessibility result unions; the resolvers trim and read six bare digits as a colour; `resolveUserLocale` takes an optional logger. 4.7.0 (Sprint 9) may be skipped on npm.
- **Recorded, not fixed:** six handlers call `getUserPreferences` without the logger they hold (accessibility, contrast, extractor, glamour, gradient, swatch), so a KV failure there is still silent; harmony's unknown-wheel warning echoes the caller's value; stoat-worker's `info.ts` has no logger to pass.

**Fixes:**
- deep-dive/BUG-034: an all-digit hex without `#` is read as a dye id.
- deep-dive/BUG-033: filters applied after a capped search return "no match".

**Coverage:** deep-dive/BUG-127. Restore the 90 % branch threshold by covering glamour's branches, and decide whether CI runs `test:coverage`.

**Consumers:** discord-worker and stoat-worker pick the change up via `workspace:*`. The merge redeploys discord-worker through its path filter. This is bot-logic's second publish; the first was Sprint 2.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-034](../2026-10-04-deep-dive/findings/BUG-034.md) | deep-dive | MEDIUM · MAIN | input-resolution.ts resolveColorInput: all-digit 6-char hex without '#' (000000, 333333, 123456) is read as a dye id and returns null |
| [deep-dive/BUG-033](../2026-10-04-deep-dive/findings/BUG-033.md) | deep-dive | MEDIUM · MAIN | gradient.ts/mixer.ts apply dyeFilters after a capped nearest-N search, so steps report no match although allowed dyes exist |
| [deep-dive/BUG-124](../2026-10-04-deep-dive/findings/BUG-124.md) | deep-dive | LOW · MAIN | glamour.ts gposersList writes the 'Model <key>' placeholder as an item name and drops Facewear when glasses are unresolved |
| [deep-dive/BUG-125](../2026-10-04-deep-dive/findings/BUG-125.md) | deep-dive | LOW · MAIN | execute* final 'catch {}' blocks discard the exception and return GENERATION_FAILED; adapters log only the code |
| [deep-dive/BUG-126](../2026-10-04-deep-dive/findings/BUG-126.md) | deep-dive | LOW · MAIN | locale-resolution.ts resolveUserLocale never passes a logger to getLegacyLanguagePreference, so the 'louder' KV-failure log never fires |
| [deep-dive/BUG-127](../2026-10-04-deep-dive/findings/BUG-127.md) | deep-dive | LOW (untested) · MAIN | bot-logic branch coverage 88.38% (502/568) is below its own 90% vitest threshold; glamour.ts has 25 uncovered branches; CI never enforces it |

**Ends with:** bump `@xivdyetools/bot-logic` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` → merge (redeploys discord-worker) → Actions "Publish Packages to npm"

## Sprint 16 — @xivdyetools/worker-kit: body guard and limiter edges (publish)

**Fixes:**
- deep-dive/BUG-149: a case-sensitive Content-Type check lets JSON skip the depth guard.
- Rate-limit headers dropped on raw Responses.
- Single-page KV resets.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-149](../2026-10-04-deep-dive/findings/BUG-149.md) | deep-dive | LOW · MAIN | worker-kit jsonDepthLimit: case-sensitive Content-Type check lets oauth JSON bodies skip the depth/__proto__ guard |
| [deep-dive/BUG-150](../2026-10-04-deep-dive/findings/BUG-150.md) | deep-dive | LOW · MAIN | worker-kit rateLimitMiddleware deny paths drop Retry-After/X-RateLimit-* when formatError returns a raw Response |
| [deep-dive/BUG-151](../2026-10-04-deep-dive/findings/BUG-151.md) | deep-dive | LOW · MAIN | worker-kit KVRateLimiter.reset/resetAll read a single kv.list page (no cursor loop) |

**Ends with:** bump `@xivdyetools/worker-kit` (patch) → gate with `--filter=...@xivdyetools/worker-kit` → merge (oauth, presets-api, api-worker, image-worker and the bots redeploy) → Actions publish

## Sprint 17 — moderation-worker: review edge cases, then cleanup — PR #261 (open)

**Done in PR #261** (moderation-worker 1.8.1), stacked on #260. All ten are fixed, with BUG-126's last call site and the Sprint 9 refresh-Revert note.
- **Refresh Revert (maintainer's decision, 2026-10-06):** keep offering Revert when a snapshot exists, trusting presets-api 2.5.0's approved-only snapshots; the refreshed embed says "restores the saved version" (it cannot verify approval). **Hand-run step:** after presets-api 2.5.0 deploys and before this worker does, review the rows the read-only query in `apps/presets-api/CLAUDE.md` lists and clear any unapproved snapshot through `wrangler d1 execute --file`.
- **BUG-052:** a channel post keeps the winner's embed and states the status in its message content; a private confirmation is rebuilt.
- **Contract:** presets-api's own tests pin both 404 bodies moderation-worker tells apart, since a presets-api-only PR never runs moderation-worker's tests.
- **Recorded, not fixed:** a narrow race where a loser's non-conflict failure (5xx) can still write an Error over a winner's embed.

**From #225, after the merge:**
- deep-dive/BUG-052: a losing concurrent click overwrites the winner's embed;
- deep-dive/BUG-054: a stale-deploy 404 strips live buttons.

**Dead code:** the moderation-worker cleanups follow, safest first.
- `dead-code/DEAD-029`, the legacy ban suffix, goes last.
- It needs the test-fixture rewrite the finding describes.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-050](../2026-10-04-deep-dive/findings/BUG-050.md) | deep-dive | LOW · MAIN | preset-moderation.ts processApproval / preset-rejection.ts processRejection: success embed spreads a prior 'Error' field |
| [deep-dive/BUG-051](../2026-10-04-deep-dive/findings/BUG-051.md) | deep-dive | LOW · MAIN | ban-reason.ts handleBanReasonModal: reason length check is untrimmed, so a whitespace-only reason is stored |
| [deep-dive/BUG-052](../2026-10-04-deep-dive/findings/BUG-052.md) | deep-dive | LOW · PR-#225 | review-message.ts refreshReview: a losing concurrent click's 409 refresh overwrites the winner's 'Approved by'/'Reason' embed |
| [deep-dive/BUG-054](../2026-10-04-deep-dive/findings/BUG-054.md) | deep-dive | LOW · PR-#225 | moderation-worker getModerationPreset treats a missing-route 404 as 'preset gone' and strips live review buttons |
| [dead-code/DEAD-027](../2026-10-04-dead-code/findings/DEAD-027.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Translator.t() fallbackData branch in moderation-worker bot-i18n.ts is a no-op (data === fallbackData === strings): about 8 lines; getLocale is NOT included and stays as an observation hook |
| [dead-code/DEAD-028](../2026-10-04-dead-code/findings/DEAD-028.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Unused _maxRetries parameter of incrementRateLimit in rate-limit.ts; its @param falsely says it is passed to the shared package: 2 src lines + 4 call-site edits |
| [dead-code/DEAD-025](../2026-10-04-dead-code/findings/DEAD-025.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines |
| [dead-code/DEAD-026](../2026-10-04-dead-code/findings/DEAD-026.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getPreset in moderation-worker services/preset-api.ts is test-only: 13 src lines + 34 test lines |
| [dead-code/DEAD-030](../2026-10-04-dead-code/findings/DEAD-030.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines |
| [dead-code/DEAD-029](../2026-10-04-dead-code/findings/DEAD-029.md) | dead-code | Conf MEDIUM / Blast LOW · REMOVE WITH CAUTION | Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite |

**From Sprint 15 (PR #258):** pass the request logger to `resolveUserLocale` in `src/services/bot-i18n.ts` (BUG-126's last call site).

**From Sprint 9 (PR #257): the refresh Revert.** `review-message.ts` `actionsFor` still offers Revert on any pending preset with a snapshot. Apply the three-part rule (`is_edit`, a well-formed `previous_values`, `edited_from_status === 'approved'`). A refresh cannot show the edit's diff: `edited_from` travels only on the webhook and is never stored, and `GET /moderation/:id` has no edit marker either. So either refresh without a diff and without Revert unless the rule can be checked, or grow presets-api to persist the edit base first; decide before scheduling.

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` → merge → `deploy-moderation-worker.yml` (commands are registered by hand; shapes unchanged)

## Sprint 18 — api-worker: telemetry double charge, param parsing, limiter test

deep-dive/BUG-037: each telemetry beacon is charged twice. deep-dive/BUG-039 is from #229: pin the multiplier to the binding. deep-dive/OPT-002 moves the 3.4 MB acquisition tables off the cold start.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-037](../2026-10-04-deep-dive/findings/BUG-037.md) | deep-dive | LOW · MAIN | index.ts telemetry limiter registered twice; each beacon is charged 2x against the 240/60s fail-closed bucket |
| [deep-dive/BUG-038](../2026-10-04-deep-dive/findings/BUG-038.md) | deep-dive | LOW · MAIN | parseIntParam/parseFloatParam accept trailing garbage and exponent forms in query params |
| [deep-dive/BUG-039](../2026-10-04-deep-dive/findings/BUG-039.md) | deep-dive | LOW (untested) · PR-#229 | router.ts SERVICE_BINDING_BUDGET_MULTIPLIER can drift from the UNIVERSALIS_SERVICE_RATE_LIMITER binding with no failing test |
| [deep-dive/BUG-040](../2026-10-04-deep-dive/findings/BUG-040.md) | deep-dive | LOW · MAIN | XIVAPI_VERSION="latest" makes the chara row-cache namespace constant, so a patch never cold-starts the cache |
| [deep-dive/OPT-002](../2026-10-04-deep-dive/findings/OPT-002.md) | deep-dive | Opt LOW · MAIN | chara acquisition/ko/zh JSON tables (3.4 MB raw) are evaluated at isolate start for every route |
| [dead-code/DEAD-035](../2026-10-04-dead-code/findings/DEAD-035.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | createMockKV re-export in api-worker tests/test-utils.ts has no importer — 1 line |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` → merge → `deploy-api-worker.yml`

## Sprint 19 — test-utils: D1/KV mock fidelity, then cleanup

The mock fixes come first. Then the dead-code removals, ending with the self-referential integration suite (`dead-code/DEAD-041`).

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-147](../2026-10-04-deep-dive/findings/BUG-147.md) | deep-dive | LOW · MAIN | test-utils createMockD1Database first() returns undefined (real D1: null) when the mock fn returns undefined |
| [deep-dive/BUG-148](../2026-10-04-deep-dive/findings/BUG-148.md) | deep-dive | LOW · MAIN | test-utils KV/R2 mock list(): cursor resume never ends when the cursor's key was deleted; insertion order instead of lexicographic |
| [dead-code/DEAD-042](../2026-10-04-dead-code/findings/DEAD-042.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | createMockD1 in test-utils cloudflare/d1.ts is reached only by its own unit test: 22 src lines + 18 test lines |
| [dead-code/DEAD-043](../2026-10-04-dead-code/findings/DEAD-043.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | randomStainId in test-utils factories/dye.ts is test-only — 9 lines + 6-line test |
| [dead-code/DEAD-044](../2026-10-04-dead-code/findings/DEAD-044.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | test-utils './auth' exports-map subpath has zero importers — 4 config lines |
| [dead-code/DEAD-041](../2026-10-04-dead-code/findings/DEAD-041.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | test-utils integration/ suite only tests local re-implementations of presets-api auth: setup.ts 214 lines + 581 test lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` (every consumer re-runs) → merge; private, so no publish and no deploy

## Sprint 20 — root (CI/scripts): workflow and gate fixes

**Fixes:**
- deep-dive/BUG-152: CI concurrency cancels main-branch and nightly runs.
- deep-dive/BUG-153: deploy path filters omit the lockfile.
- deep-dive/BUG-154: the publish loop keeps going after a failure.
- Two gate-script fixes.

**Then:** stale docs and two root config lines.

**Since 2026-10-05:**
- **deep-dive/REFACTOR-009 is half done.** `223b839f` (#228) fixed its OPEN_ITEMS entry. The DOMAIN_DEPRECATION inventory still cites route lines that were deleted, so strike them through; refreshing them is no longer possible.
- **deep-dive/BUG-152 was seen live:** 11 of the batch's CI runs on `main` were cancelled.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-152](../2026-10-04-deep-dive/findings/BUG-152.md) | deep-dive | LOW · MAIN | ci.yml workflow-level concurrency ci-${{ github.ref }} + cancel-in-progress: true cancels main-push and nightly-schedule runs against each other |
| [deep-dive/BUG-153](../2026-10-04-deep-dive/findings/BUG-153.md) | deep-dive | LOW · MAIN | Production deploy workflows' paths filters omit pnpm-lock.yaml / pnpm-workspace.yaml / turbo.json / tsconfig.base.json |
| [deep-dive/BUG-154](../2026-10-04-deep-dive/findings/BUG-154.md) | deep-dive | LOW · MAIN | publish-packages.yml Publish loop records FAILED+= and keeps publishing dependents of a failed package |
| [deep-dive/BUG-155](../2026-10-04-deep-dive/findings/BUG-155.md) | deep-dive | LOW · MAIN | check-dead-code.ts findOrphanModules / findTestOnlyMembers read EXCLUDED_REFERRERS raw instead of via referrerTexts |
| [deep-dive/BUG-156](../2026-10-04-deep-dive/findings/BUG-156.md) | deep-dive | LOW (untested) · MAIN | check-doc-versions.ts promises failure on a non-semver version claim but silently drops the row |
| [deep-dive/REFACTOR-008](../2026-10-04-deep-dive/findings/REFACTOR-008.md) | deep-dive | Refactor LOW · MAIN | Stale comments: ci.yml check-bundle-size scope, web-app vitest coverage-report baseline, orphaned docblock above asReferrers |
| [deep-dive/REFACTOR-009](../2026-10-04-deep-dive/findings/REFACTOR-009.md) | deep-dive | Refactor LOW · MAIN | OPEN_ITEMS Phase 0 entry and DOMAIN_DEPRECATION inventory line numbers are stale |
| [dead-code/DEAD-046](../2026-10-04-dead-code/findings/DEAD-046.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | The turbo.json `deploy` task (lines 130-134) has no caller: 5 lines |
| [dead-code/DEAD-045](../2026-10-04-dead-code/findings/DEAD-045.md) | dead-code | Conf HIGH / Blast MEDIUM · REMOVE WITH CAUTION | The qs override in pnpm-workspace.yaml:11 names a package nothing installs: 1 line, plus the comment on line 7 and lockfile line 10 |

**Ends with:** `pnpm install --frozen-lockfile`, the whole-graph gate, `pnpm test:scripts`, `pnpm dead-code:check`, `pnpm docs:check-links` → merge (deploys nothing)

## Sprint 21 — image-worker: stale path alias

Config only; the bundle is unchanged.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [dead-code/DEAD-038](../2026-10-04-dead-code/findings/DEAD-038.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | apps/image-worker '@' path alias (vitest resolve.alias + tsconfig paths) has no importer: 10 config lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` → merge → `deploy-image-worker.yml`

## Sprint 22 — web-app: remaining LOW fixes — PR #252 (open)

**Done in PR #252** (web-app 5.14.6, stacked on #249): 41 of 42 rows. BUG-086 covers the four sibling tools it names. **deep-dive/BUG-090 stays open:** it needs core to surface a batch failure, so it moves to Sprint 27. The layout shell is at 215.75 of 218 KB; Sprint 23 should trim it. Details are in the re-verification file's *Sprint 22* section.

Tool, shell, service and glamour LOWs. Most are one-line guards or listener teardown.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-074](../2026-10-04-deep-dive/findings/BUG-074.md) | deep-dive | LOW (untested) · MAIN | validate-i18n.js PATTERNS only see single-line literal LanguageService.t/tInterpolate calls, so wrapped calls and the local t() alias are never key-checked |
| [deep-dive/BUG-075](../2026-10-04-deep-dive/findings/BUG-075.md) | deep-dive | LOW (untested) · MAIN | budget-tool.test.ts Basic Rendering asserts non-null on test-created panels, so left-panel and drawer rendering is unverified |
| [deep-dive/BUG-077](../2026-10-04-deep-dive/findings/BUG-077.md) | deep-dive | LOW (untested) · MAIN | tool setConfig tests (mixer maxResults/displayOptions guard/market marker, harmony type regeneration, extractor multi-key) assert only not.toThrow |
| [deep-dive/BUG-080](../2026-10-04-deep-dive/findings/BUG-080.md) | deep-dive | LOW · MAIN | budget-tool.ts / mixer-tool.ts: theme-dependent inline colours are not refreshed on a theme change |
| [deep-dive/BUG-081](../2026-10-04-deep-dive/findings/BUG-081.md) | deep-dive | LOW · MAIN | budget-tool.ts saveSwapRecord breaks 216-gil ties by database order, not by ΔE |
| [deep-dive/BUG-083](../2026-10-04-deep-dive/findings/BUG-083.md) | deep-dive | LOW · MAIN | chara-sheet.ts slot-card click re-renders the whole sheet and drops keyboard focus; selected state has no aria-pressed |
| [deep-dive/BUG-085](../2026-10-04-deep-dive/findings/BUG-085.md) | deep-dive | LOW · MAIN | comparison-tool.ts ensureActivePair: the index-based pair survives a removal and swaps out the surviving member |
| [deep-dive/BUG-086](../2026-10-04-deep-dive/findings/BUG-086.md) | deep-dive | LOW · MAIN | comparison-tool.ts renders the market price row from its own showMarketPrices flag, while the service's showPrices (default off) blocks fetching |
| [deep-dive/BUG-087](../2026-10-04-deep-dive/findings/BUG-087.md) | deep-dive | LOW · MAIN | comparison/accessibility getShareParams: Share stays enabled for an all-custom-colour selection that yields dyes:[] |
| [deep-dive/BUG-088](../2026-10-04-deep-dive/findings/BUG-088.md) | deep-dive | LOW · MAIN | dye-selector.ts handleGlobalKeydown: activeElement guard is blind inside the shell's shadow root, so '/' is swallowed in tool inputs |
| [deep-dive/BUG-089](../2026-10-04-deep-dive/findings/BUG-089.md) | deep-dive | LOW · MAIN | dye-selector.ts updateFavoritesPanel hardcodes the 8-column grid and overrides compactMode's 3-column favourites layout at mount |
| [deep-dive/BUG-090](../2026-10-04-deep-dive/findings/BUG-090.md) | deep-dive | LOW · MAIN | extractor-tool.ts fetchPricesForRoll: the catch, parseMarketError and lastMarketError are unreachable because every layer below swallows fetch failures |
| [deep-dive/BUG-091](../2026-10-04-deep-dive/findings/BUG-091.md) | deep-dive | LOW · MAIN | glamour-twin-picker (role=dialog) and item-links-menu never register with ModalService, so global 1-9/Shift+T/L/S shortcuts fire while they hold focus |
| [deep-dive/BUG-092](../2026-10-04-deep-dive/findings/BUG-092.md) | deep-dive | LOW · MAIN | gradient-tool.ts loadSelectedDyes drops persisted custom-colour endpoints and moves the remaining dye into the Start slot |
| [deep-dive/BUG-093](../2026-10-04-deep-dive/findings/BUG-093.md) | deep-dive | LOW · MAIN | swatch/gradient renderLeftPanel rebuilds CollapsiblePanel/MarketBoard/DyeSelector on every update() into the element renderRightPanel clears, without destroying the previous instances |
| [deep-dive/BUG-094](../2026-10-04-deep-dive/findings/BUG-094.md) | deep-dive | LOW · MAIN | gradient-tool.ts result-card slot picker (Set as End/Start) has no same-dye guard, and endpoint rows render cards |
| [deep-dive/BUG-095](../2026-10-04-deep-dive/findings/BUG-095.md) | deep-dive | LOW · MAIN | harmony-tool.ts renderRightPanel: each render adds a new matchMedia listener; destroy removes only the last |
| [deep-dive/BUG-096](../2026-10-04-deep-dive/findings/BUG-096.md) | deep-dive | LOW · MAIN | image-zoom-controller.ts Ctrl-drag pan ignores the centring margin, so a fitted image jumps on the first pan move |
| [deep-dive/BUG-097](../2026-10-04-deep-dive/findings/BUG-097.md) | deep-dive | LOW · MAIN | image-zoom-controller.ts touch handlers: a second finger does not cancel the drag, so a two-finger gesture commits a colour sample on lift |
| [deep-dive/BUG-098](../2026-10-04-deep-dive/findings/BUG-098.md) | deep-dive | LOW · MAIN | mixer-tool.ts loadSelectedDyes: a legacy third slot is restored, giving an equal-weight 3-way blend |
| [deep-dive/BUG-099](../2026-10-04-deep-dive/findings/BUG-099.md) | deep-dive | LOW · MAIN | mixer-tool.ts renderMixingField: a cell with no eligible match prints ΔE 0.0 |
| [deep-dive/BUG-100](../2026-10-04-deep-dive/findings/BUG-100.md) | deep-dive | LOW · MAIN | modal-container.ts attachSheetDrag: ignores inner scrollers and touchcancel on mobile sheets |
| [deep-dive/BUG-103](../2026-10-04-deep-dive/findings/BUG-103.md) | deep-dive | LOW · MAIN | swatch-tool registers its window resize listener with this.on in onMount; BaseComponent.update() unbinds it on a language switch and never re-adds it |
| [deep-dive/BUG-104](../2026-10-04-deep-dive/findings/BUG-104.md) | deep-dive | LOW · MAIN | swatch-tool.ts updateHandoffRow: SEND TO does a full reload with window.location.assign, so the in-memory .chara session is dropped |
| [deep-dive/BUG-105](../2026-10-04-deep-dive/findings/BUG-105.md) | deep-dive | LOW · MAIN | toast-container.ts: full rebuild on each change replays animations and re-announces alerts; Escape closes toast and modal together |
| [deep-dive/BUG-106](../2026-10-04-deep-dive/findings/BUG-106.md) | deep-dive | LOW · MAIN | tutorial-spotlight.ts: window-only scroll listener and a fixed 100ms measurement leave the spotlight off-target after a container smooth-scroll |
| [deep-dive/BUG-107](../2026-10-04-deep-dive/findings/BUG-107.md) | deep-dive | LOW · MAIN | dye-palette-drawer.ts filterByType: Metallic chip matches English name (14) instead of the gloss set isMetallic (16) |
| [deep-dive/BUG-111](../2026-10-04-deep-dive/findings/BUG-111.md) | deep-dive | LOW · MAIN | result-card.ts handleMenuClick/handleSelectClick: stopPropagation keeps other cards' open menus from closing |
| [deep-dive/BUG-112](../2026-10-04-deep-dive/findings/BUG-112.md) | deep-dive | LOW · MAIN | v4-layout-shell.ts static styles have no @media print: browser print is one clipped page including chrome |
| [deep-dive/BUG-113](../2026-10-04-deep-dive/findings/BUG-113.md) | deep-dive | LOW · MAIN | v4-layout-shell.ts re-emits composed child events without stopPropagation, so v4-layout handlers run twice |
| [deep-dive/BUG-114](../2026-10-04-deep-dive/findings/BUG-114.md) | deep-dive | LOW · MAIN | main.ts:126 non-critical tutorial-spotlight import failure triggers renderFatalError over the already-rendered shell |
| [deep-dive/BUG-115](../2026-10-04-deep-dive/findings/BUG-115.md) | deep-dive | LOW · MAIN | auth-service performLogout awaits /auth/revoke with no timeout before clearing local session |
| [deep-dive/BUG-116](../2026-10-04-deep-dive/findings/BUG-116.md) | deep-dive | LOW · MAIN | chara-resolve-service resolveCharaEquipment sends unbounded model lanes/glasses id; one lane >0xffff 400s the whole resolve and the Reader reports an outage |
| [deep-dive/BUG-117](../2026-10-04-deep-dive/findings/BUG-117.md) | deep-dive | LOW · MAIN | CollectionService.initialize re-enters and overflows the stack when a migration save fails |
| [deep-dive/BUG-118](../2026-10-04-deep-dive/findings/BUG-118.md) | deep-dive | LOW · MAIN | collection-service importData: earlier-audit BUG-024 guard dereferences a null collections[] element outside the per-record try |
| [deep-dive/BUG-119](../2026-10-04-deep-dive/findings/BUG-119.md) | deep-dive | LOW · MAIN | indexeddb-service has no db.onversionchange handler, so an open tab blocks a future DB_VERSION upgrade and the other tab caches initialize()=false |
| [deep-dive/BUG-120](../2026-10-04-deep-dive/findings/BUG-120.md) | deep-dive | LOW · MAIN | keyboard-service digit tool shortcuts unreachable from the AZERTY number row |
| [deep-dive/BUG-121](../2026-10-04-deep-dive/findings/BUG-121.md) | deep-dive | LOW · MAIN | LanguageService.setLocale has no sequencing; overlapping calls desync core and web locales |
| [deep-dive/BUG-122](../2026-10-04-deep-dive/findings/BUG-122.md) | deep-dive | LOW · MAIN | LanguageService.tInterpolate expands $ patterns in user-supplied values |
| [deep-dive/BUG-123](../2026-10-04-deep-dive/findings/BUG-123.md) | deep-dive | LOW · MAIN | palette-export.ts:136 today() stamps exports with the UTC date, not the local date |
| [deep-dive/OPT-007](../2026-10-04-deep-dive/findings/OPT-007.md) | deep-dive | Opt LOW · MAIN | mixer-tool.ts field-cell click renders the field twice; harmony-tool.ts market change runs a superseded price pass |
| [deep-dive/OPT-009](../2026-10-04-deep-dive/findings/OPT-009.md) | deep-dive | Opt LOW · MAIN | IndexedDBCacheBackend.loadFromStorage hydrates the price cache with one serial readonly transaction per key |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 23 — web-app: dead-code cleanup — PR #253 (open)

**Done in PR #253** (web-app 5.14.7, stacked on #252): all fifteen rows, plus the code Sprint 22 made dead. The layout shell is at 215.02 KB. Details are in the re-verification file's *Sprint 23* section.

**dead-code/DEAD-004 is already removed** by Sprint 5 (PR #247); skip it here.

**From Sprint 22 (PR #252):**
- The layout shell is at 215.75 of 218 KB. Trim it here; do not raise the budget.
- Sprint 22 made more code dead. Its re-verification section lists it; confirm each item by hand, because the gate cannot see some of it.

The rest of the dead-code catalog's web-app entries. Each cascade is the next commit after its trigger, because web-app's knip gate fails on the orphaned exports in between: dead-code/DEAD-009 and dead-code/DEAD-010 after dead-code/DEAD-008. dead-code/DEAD-003, the context-action vocabulary, goes last.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [dead-code/DEAD-004](../2026-10-04-dead-code/findings/DEAD-004.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | v4-layout-shell.ts static styles: pre-5.0 Accessibility CSS block is unreachable (337 lines) |
| [dead-code/DEAD-005](../2026-10-04-dead-code/findings/DEAD-005.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | BaseLitComponent.baseStyles utility classes and two preset-detail selectors have no markup (~31 lines) |
| [dead-code/DEAD-006](../2026-10-04-dead-code/findings/DEAD-006.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | themes.css dead Tailwind-override selectors (lines 153-224) — 23 lines |
| [dead-code/DEAD-011](../2026-10-04-dead-code/findings/DEAD-011.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | BaseLitComponent hasError/errorMessage @state is write-only (10 lines) |
| [dead-code/DEAD-007](../2026-10-04-dead-code/findings/DEAD-007.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | 5 orphan accessibility.* locale keys x 6 locales hidden by the analyzer's dynamic-prefix rule (30 lines) |
| [dead-code/DEAD-017](../2026-10-04-dead-code/findings/DEAD-017.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | WorldService: 6 test-only lookup methods + orphaned worldByName map — 57 src lines + ~100 test lines |
| [dead-code/DEAD-018](../2026-10-04-dead-code/findings/DEAD-018.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | IndexedDBService.getAll/count/deleteDatabase are test-only — 100 src lines + ~200 test lines |
| [dead-code/DEAD-019](../2026-10-04-dead-code/findings/DEAD-019.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | SubscriptionManager.addAll and getters count/hasSubscriptions have no caller or test — 21 lines |
| [dead-code/DEAD-020](../2026-10-04-dead-code/findings/DEAD-020.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | APIService static formatPrice/getPriceData/isInitialized are test-only — 25 src lines + 72 test lines |
| [dead-code/DEAD-023](../2026-10-04-dead-code/findings/DEAD-023.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | web-app LanguageService.getLabel and preloadLocales are test-only — 17 source + 43 test lines |
| [dead-code/DEAD-008](../2026-10-04-dead-code/findings/DEAD-008.md) | dead-code | Conf HIGH / Blast LOW · REMOVE WITH CAUTION | empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 54 source + 53 test lines |
| [dead-code/DEAD-009](../2026-10-04-dead-code/findings/DEAD-009.md) | dead-code | Conf HIGH / Blast LOW · REMOVE WITH CAUTION | 4 state icons in state-icons.ts are reachable only from the 6 test-only EMPTY_STATE_PRESETS: 33 lines + 4 import lines |
| [dead-code/DEAD-010](../2026-10-04-dead-code/findings/DEAD-010.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | 14 web-app locale keys x 6 locales are read only by the test-only empty-state presets: 24 lines per locale, 144 total |
| [dead-code/DEAD-021](../2026-10-04-dead-code/findings/DEAD-021.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | color-service.test.ts tests @xivdyetools/core ColorService, not web-app code — 280 test lines |
| [dead-code/DEAD-022](../2026-10-04-dead-code/findings/DEAD-022.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | shared/__tests__/types.test.ts tests @xivdyetools/types, not web-app — 361 test lines |
| [dead-code/DEAD-003](../2026-10-04-dead-code/findings/DEAD-003.md) | dead-code | Conf HIGH / Blast LOW · REMOVE WITH CAUTION | 6 legacy ContextAction members in result-card.ts and their handler cases in 5 tools are never emitted (~102 src lines + 126-line guard test) |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 24 — stoat-worker (parked)

P3. Fix only if Stoat is resumed; otherwise these go with the app if it is archived (see `docs/research/discord-alternatives/07-2026-10-refresh.md`).

**Decided 2026-10-05: not skipped.** Stoat may be unparked within 30 days, so this sprint runs in order.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/BUG-070](../2026-10-04-deep-dive/findings/BUG-070.md) | deep-dive | LOW · MAIN | stoat about.ts Quick Start advertises unrouted !xd random and an unimplemented ❓-reaction help |
| [deep-dive/BUG-071](../2026-10-04-deep-dive/findings/BUG-071.md) | deep-dive | LOW (untested) · MAIN | stoat dye-resolver.test.ts multiple/disambiguation tests cannot fail (any-kind else / guarded if) |
| [deep-dive/BUG-072](../2026-10-04-deep-dive/findings/BUG-072.md) | deep-dive | LOW · MAIN | stoat dye-resolver.ts ignores locale and initializeLocale is never called, while help advertises localized names |
| [deep-dive/BUG-073](../2026-10-04-deep-dive/findings/BUG-073.md) | deep-dive | LOW · MAIN | stoat dye-resolver.ts resolveDyeInputMulti: step 1 resolveColorInput first-match makes multiple/disambiguation unreachable for name queries |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker` → merge (no deploy workflow)

## Sprint 25 — auth: doc comment

A comment-only fix. It rides with the next auth change; no publish is needed for it alone.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/REFACTOR-006](../2026-10-04-deep-dive/findings/REFACTOR-006.md) | deep-dive | Refactor LOW · MAIN | auth JWTPayload doc falsely claims a re-export from types and mislabels sub |

**Ends with:** gate with `--filter=...@xivdyetools/auth` → merge

## Sprint 26 — Structural: share the review custom_id grammar (terminal) — PR #262 (open)

**Done in PR #262** (types 3.3.0; moderation-worker 1.8.2, discord-worker 5.8.8, presets-api 2.6.1), stacked on #261. The host is `@xivdyetools/types` — the one package all three apps already depend on (presets-api does not depend on bot-logic). The wire format is byte-identical, fuzzed in both directions.
- **Deploy order:** none is required — each app bundles types through `workspace:*` and the bytes do not change. Merging does redeploy every app whose workflow filters on `packages/types/**` (10 workflows, oauth's production deploy included), with no code change for most.
- **Also here:** `AuthSource` tagged `@public` (its last in-repo re-export went in Sprint 8); a moderation-worker test pins its routing prefixes to the shared grammar.

deep-dive/REFACTOR-001: one module for the grammar and status list, consumed by presets-api, moderation-worker and discord-worker, or a parity test across them. One publish, then one deploy per consumer.

**Decided 2026-10-05: the shared module**, in a published package.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/REFACTOR-001](../2026-10-04-deep-dive/findings/REFACTOR-001.md) | deep-dive | Refactor LOW · PR-#227 + PR-#225 + PR-#224 | Review custom_id grammar and status list duplicated across discord-worker, moderation-worker and presets-api with no parity check |

**Ends with:** publish the host package → presets-api, moderation-worker and discord-worker each in their own deploy, in the documented order (presets-api first)

## Sprint 27 — Structural: one dyeable-slot set (terminal) — PR #254 (open)

**Done in PR #254** (core 5.9.0 and web-app 5.14.8, stacked on #253): REFACTOR-004 and BUG-090. The review also found that Chinese and Korean data centers sanitised to an empty path, which is fixed in the same core release. **Deploy needs:** publish core 5.9.0. It carries Sprint 6's unpublished 5.8.2 as well. Details are in the re-verification file's *Sprint 27* section.

deep-dive/REFACTOR-004: core exports the dyeable-slot set, and web-app imports it.

**Moved here from Sprint 22: deep-dive/BUG-090**, so core is released once, not twice.
- **What core does:** it surfaces a failed batch price fetch as an addition (a new method, or an outcome beside the result). It must not change `getPricesForDataCenter`'s `Map` return, which is published API. A failed chunk of a partial batch counts as a failure, and the result has to survive the in-flight coalescing.
- **What web-app does:** `MarketBoardService` maps that outcome to `lastFetchOutcome = 'error'`. Then the Extractor's error badge and Harmony's market-failure strip can appear.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/REFACTOR-004](../2026-10-04-deep-dive/findings/REFACTOR-004.md) | deep-dive | Refactor LOW · MAIN | glamour-block DYEABLE_SLOTS duplicates core chara-gposers private DYEABLE with a 'change both' comment |

**Ends with:** core publish → web-app deploy

## Sprint 28 — Structural: svg ledger constants (terminal) — PR #259 (open, with Sprint 14)

**Done in PR #259**, with Sprint 14 (one svg publish). The footer height also has one source now: the handler builds the key lines once and passes their count to the calculator.

deep-dive/REFACTOR-003: svg exports the ledger geometry, and discord-worker's budget calculator imports it.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/REFACTOR-003](../2026-10-04-deep-dive/findings/REFACTOR-003.md) | deep-dive | Refactor LOW · MAIN | budget-calculator.ts mirrors the svg ledger geometry with literals (350-43-27, 24, 40, 32, 47) instead of the exported LEDGER_* constants |

**Ends with:** svg publish → discord-worker deploy

## Sprint 29 — Structural: split swatch-tool and gradient-tool (terminal) — PR #255 (open)

**Done in PR #255** (web-app 5.14.9, stacked on #254). It is the last web-app sprint. Both tools keep one workspace; the v4-dead left panel and drawer are gone, and the duplication with them. Details are in the re-verification file's *Sprint 29* section.

deep-dive/REFACTOR-005: the two largest files in the repo duplicate their desktop and mobile selector code. This goes after every other web-app sprint, because they all touch these files.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [deep-dive/REFACTOR-005](../2026-10-04-deep-dive/findings/REFACTOR-005.md) | deep-dive | Refactor LOW · MAIN | swatch-tool.ts (3146 lines) and gradient-tool.ts (2755 lines): duplicated desktop/mobile selector code already drifts (mobile steps skip pinnedSteps.clear), a dead left panel and drawer, and a mojibake literal at gradient-tool.ts:825 |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 30 — Fonts: item names on the /glamour card (terminal, last of all)

**FONT-001 is a decision first:**
- **Option A:** widen discord-worker's CJK subsets with item names (about +363 Hangul and +1,171 hanzi).
- **Option B:** record the English-name card as accepted, with the measured rates.
- **Decided 2026-10-05: Option A**, widen the subsets.

**Why it is last:** any text change before it would invalidate the subsets again.

**Every other font re-cut** happens in the sprint whose drawn text changed (Sprints 2–3, 11).

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [FONT-001](findings/FONT-001.md) | i18n | P2 · MAIN | `/glamour` cards draw English item names for 62.5 % of items in Korean and 97.3 % in Chinese: the CJK subsets hold no item names |

**Ends with:** if widened: add the item-name tables to `apps/discord-worker/scripts/subset-cjk-fonts.py`'s inputs, measure `wrangler deploy --dry-run` gzip against the 3,072 KiB limit, run both `font-coverage` tests → merge → `deploy-discord-worker.yml`. If accepted: record it in `apps/discord-worker/CLAUDE.md` and close the finding.

## Superseded findings

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` (swatch/gradient) | dead-code/DEAD-003 | the `copy-hex` action is never emitted; the removal deletes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | dead-code/DEAD-008 | a test-only preset; the removal deletes it |
| glamour card look-count line drawn at 10.5 px (i18n candidate) | deep-dive/BUG-145 | same lines, same fix |

## KEEP register

These are not scheduled; the reasons and revisit triggers are in each finding. The package-major backlog is in the dead-code audit's report.

| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [dead-code/DEAD-047](../2026-10-04-dead-code/findings/DEAD-047.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | HarmonyGenerator find*Dyes family + 8 DyeService delegates + DyeDatabase hue-bucket index are test-only: ~660 src lines + ~1080 test lines |
| [dead-code/DEAD-048](../2026-10-04-dead-code/findings/DEAD-048.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | ColorManipulator (whole class) + 6 ColorService delegates + 3 ColorAccessibility methods/delegates are test-only: ~170 src lines + ~600 test lines |
| [dead-code/DEAD-049](../2026-10-04-dead-code/findings/DEAD-049.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core's tests — about 257 source + 100 test lines |
| [dead-code/DEAD-050](../2026-10-04-dead-code/findings/DEAD-050.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | types: ToolKey and LocaleData.tools outlive core's getToolName — 13 source lines, for the types major after DEAD-049 |
| [dead-code/DEAD-051](../2026-10-04-dead-code/findings/DEAD-051.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines |
| [dead-code/DEAD-052](../2026-10-04-dead-code/findings/DEAD-052.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | PresetService.getPresetWithDyes in core is test-only published API — 34 lines + 145-line test |
| [dead-code/DEAD-053](../2026-10-04-dead-code/findings/DEAD-053.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | HarmonyInput.harmonyOptions in bot-logic harmony.ts is ignored legacy published API — 2 lines + 11-line stale test |
| [dead-code/DEAD-054](../2026-10-04-dead-code/findings/DEAD-054.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | UpstashRateLimiter in worker-kit has no in-repo constructor (only its own test) but is @public published API: ~206 src lines + 344-line test |
| [dead-code/DEAD-055](../2026-10-04-dead-code/findings/DEAD-055.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | getClientIp trustXForwardedFor opt-in path is test-only in-repo — 26 src lines + 60 test lines; stale comments |
| [dead-code/DEAD-056](../2026-10-04-dead-code/findings/DEAD-056.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | logger BaseLogger.child() and the DelegatingLogger class have no non-test caller anywhere: 79 src lines + ~128 test lines |
| [dead-code/DEAD-057](../2026-10-04-dead-code/findings/DEAD-057.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | logger createBrowserLogger's errorTracker branch never runs in-repo (published extension point): ~90 src lines + 207 test lines |
| [dead-code/DEAD-058](../2026-10-04-dead-code/findings/DEAD-058.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | types createDyeId/createHue/createSaturation are untagged published exports reached only by tests: 68 src lines + ~200 test lines |
| [dead-code/DEAD-059](../2026-10-04-dead-code/findings/DEAD-059.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | auth verifier tuning options never passed by any app — ~27 src lines + 74 test lines (bot-signature knobs untested) |
| [dead-code/DEAD-060](../2026-10-04-dead-code/findings/DEAD-060.md) | dead-code | Conf HIGH / Blast HIGH · KEEP | auth barrel re-export of hmacSignHex is test-only in-repo and lacks @public — 1 line |
| [dead-code/DEAD-061](../2026-10-04-dead-code/findings/DEAD-061.md) | dead-code | Conf HIGH / Blast NONE · KEEP | registryCommandNames in registry.ts is test-only: 10 lines (62-71), 3 test lines to rewrite |
| [dead-code/DEAD-062](../2026-10-04-dead-code/findings/DEAD-062.md) | dead-code | Conf MEDIUM / Blast MEDIUM · KEEP | handleModal and the unsupportedComponent fallback in index.ts are unreachable defensive router branches: 24 lines + 12 locale lines + 59 test lines |
| [dead-code/DEAD-063](../2026-10-04-dead-code/findings/DEAD-063.md) | dead-code | Conf MEDIUM / Blast HIGH · KEEP | presets-api GET /presets/featured and /presets/rate-limit have no in-repo client once the dead web-app methods go; documented public API, so KEEP (~35 route lines) |
| [dead-code/DEAD-064](../2026-10-04-dead-code/findings/DEAD-064.md) | dead-code | Conf HIGH / Blast LOW · KEEP | stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines |

## Pin first (terminology without a source)

**Not findings, and not scheduled.** Each is real, but choosing the word needs a cited publisher source, not fluency. Add a row to `docs/reference/ffxiv-terminology.md` (or the glossary for app nouns), then file and fix.

| Concept | What the apps say today | Needs |
|---|---|---|
| Clan, as a noun | de Volksgruppe / Stamm (+ bot "Charakter-Stamm"); fr ethnie / tribu / Clan | the client's word in de and fr |
| Gender | fr sexe (`glamour.verdict.explain`) vs genre (Swatch Matcher, bot) | the fr client's word |
| "Same look" twins | en twin / same look / swap; fr "+N ASPECT" vs "même apparence"; ko 동형 / 유일 vs 같은 외형 | an app glossary row |
| A color slot | zh 栏位 (web) vs 部位 (bot) | an app glossary row |
| Moderator, in the UI | zh `fieldPreviewImageHint` 版主 vs the policies' 审核员; ko UI 모더레이터 | a glossary row; TERM-001 settles the ko policies |
| Dye channel (ja) | 染色枠 vs チャンネル (filed as TERM-016 for the split; the word is unpinned) | the client's dye UI text — **pinned 2026-10-05** (dictionary *Dye channels*: 染色1 / 染色2, counted with ヵ所); fixed in PR #248 |
| Facewear color tag (ja, ko) | ja フェイスウェアカラー, ko 페이스웨어 색상 transliterate "facewear" | follows TERM-007's choice — **pinned 2026-10-05** (dictionary, Addon 16050 + 16054); fixed in PR #248 |

## Standing guidance

- **Verify first:** check each finding's evidence against the code before fixing; findings are leads. Re-grep before any removal, and grep `apps/stoat-worker` by hand for package exports.
- **One PR per sprint**, as with the security sprints. Sprints 2 and 3 are the exception: one PR. Make one commit per task, or per sprint when it is tiny. Stage only your own paths with `git commit --only -- <paths>`.
- **Gate every sprint boundary** (`release-mechanics.md` → *Standing verification gate*). Before merging a batch, run the whole-graph gate on a trial merge; the 2026-10-04 preview showed why.
- **Translations:**
  - add or change a key in all six files at once;
  - the web-app order is checked by `node scripts/reorder-locales.mjs --check`;
  - list every new or changed translation in the commit message (no silent auto-translation);
  - a changed `en` value can turn an allow-list entry stale, so re-run the set's gates.
- **Policy documents:** all six variants of a document in one commit, with `Last updated` on all six (`policy-documents.md`).
- **Changelogs and versions:** every touched unit gets a version bump and a `CHANGELOG.md` entry. Player-visible web-app or bot fixes also get a root `CHANGELOG-laymans.md` entry, committed on its own.
- **Tracking:** mark executed sprints in their heading **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror the status in each finding and in the three reports' status tables.
