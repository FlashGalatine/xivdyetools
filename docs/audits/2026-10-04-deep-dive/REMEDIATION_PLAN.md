# Remediation Plan — 2026-10-04 (deep-dive + dead-code, merged)

**Sources:**
- [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md): 175 findings.
- [2026-10-04-dead-code/DEAD_CODE_REPORT.md](../2026-10-04-dead-code/DEAD_CODE_REPORT.md): 64 findings.
- **ID convention:** deep-dive IDs are bare; dead-code IDs are qualified as `dead-code/DEAD-NNN`. Both catalogs come from the same preview branch (`main` plus the 13 open PRs).

**This plan supersedes** the dead-code audit's `CLEANUP_PLAN.md`. Its sprints are folded in here, one unit at a time.

**Status basis:** 239 total.
- 1 fixed: dead-code/DEAD-001, in #225, not merged.
- 220 outstanding.
- 2 deep-dive candidates superseded by dead-code removals (listed below).
- 18 KEEP.
- 0 need rotation.

**Ordering:**
1. Sprint 0 holds the decisions due before tomorrow's batch merge. Nothing is pushed without your yes.
2. Correctness first: the HIGH, then the units carrying MEDIUM bugs, then LOW-only units.
3. One deploy unit per sprint, with two exceptions: the four terminal structural sprints, each a publish followed by its consumers' deploys.
   - Dead-code cleanups ride in their unit's sprint, after that unit's fixes.
4. Package publishes follow the dependency graph: logger, core, svg, bot-logic, then worker-kit.
   - `workspace:*` becomes an exact version at publish, so a dependent must publish after its dependencies.
   - Consumers redeploy through their path filters on merge.
5. Structural refactors last.

**Conflicts (merged mode):**
- Two deep-dive candidates sat in code a dead-code entry removes, so the removal wins (*Superseded* below).
- One set of fixes shares files with removals: the preset services in Sprint 2. There the fixes land first, then the removals.
- No other overlap.

## Sprint 0 — Before the batch merge (your decision)

**Merging tomorrow is safe from both audits' point of view:**
- no finding in the batch is CRITICAL, HIGH or MEDIUM;
- the cross-PR test failure is already fixed in #224 (`10a1cb77`);
- the preview passes 62/62.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-063](findings/BUG-063.md) | deep-dive | LOW · PR-#224 | presets-api 2.4.0 changelog intro denies a migration that its Rollout section requires (0015) |
| [BUG-053](findings/BUG-053.md) | deep-dive | LOW · PR-#225 | bot-i18n.ts footerTextOnly advertises the removed `reject <id> <reason>` option; preset.test.ts:446 pins it |
| [dead-code/DEAD-001](../2026-10-04-dead-code/findings/DEAD-001.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | preset.moderation.{approved,approvedDesc,missingReason,rejected,rejectedDesc} in moderation-worker bot-i18n.ts are orphaned by PR #225 — 5 lines, 0 test lines |
| [dead-code/DEAD-002](../2026-10-04-dead-code/findings/DEAD-002.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | ModerationPresetInfo.author_discord_id in preset-notifications.ts is unread since #227: 2 lines; fixture must be reshaped, not deleted |

- **BUG-063 (#224) and BUG-053 (#225):** recommended text-only fixes, to make inside the PRs before merging if you agree. Otherwise, correct them in the presets-api and moderation-worker sprints.
- **dead-code/DEAD-001:** already applied in #225 (`ea264d49`).
- **dead-code/DEAD-002 (#227):** optional; if deferred, it joins the discord-worker sprint.

**Question:** are `proxy.`, `api.` and `moderation-bot.xivdyetools.projectgalatine.com` still attached in Cloudflare?
- **If so:** merging #229, #224 and #225 changes nothing.
- **If you removed them in the dashboard:** those merges re-attach them. Delete the route lines first, per `docs/operations/DOMAIN_DEPRECATION.md`.

## Sprint 1 — web-app: tool settings have one owner (the HIGH)

BUG-001 is the anchor. Each tool keeps local copies of its settings, and `ConfigController` broadcasts a full config over them, or never seeds them at mount. Fix it once:
- seed every tool from `getConfig()`;
- route rail and slot picks through the controller;
- align the default tables.

Then add the test BUG-011 asks for: mount against a non-default persisted config with a real controller.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-001](findings/BUG-001.md) | deep-dive | HIGH · MAIN | swatch-tool setConfig applies ConfigController's full swatch config (default hairColors/SeekerOfTheSun/Female) over tool-local eyeColors/Midlander/Male state |
| [BUG-019](findings/BUG-019.md) | deep-dive | MEDIUM · MAIN | gradient/swatch loadFromShareUrl applies share settings to tool-local state only; the next ConfigController notification reverts them |
| [BUG-022](findings/BUG-022.md) | deep-dive | MEDIUM · MAIN | Gradient, Swatch, Mixer and Budget never seed dyeFiltersConfig from the persisted config at mount, so saved dye filters are ignored until the sidebar is touched |
| [BUG-027](findings/BUG-027.md) | deep-dive | MEDIUM · MAIN | config-sidebar.ts connectedCallback: local copies of 9 config keys never refresh after an external ConfigController write |
| [BUG-012](findings/BUG-012.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts in-page match-line slider writes only local storage; next full budget-config broadcast resets it to ConfigController maxDeltaE |
| [BUG-023](findings/BUG-023.md) | deep-dive | MEDIUM · MAIN | swatch-tool setConfig needsReload branch nulls selectedColor but leaves matchedDyes, result cards, SEND TO ids and an enabled share button |
| [BUG-024](findings/BUG-024.md) | deep-dive | MEDIUM · MAIN | swatch-tool pickCharaSlot sets a slot selectionContext but keeps the earlier grid selectedColor/matchedDyes, so CLOSEST DYES, share and SEND TO describe the old cell |
| [BUG-011](findings/BUG-011.md) | deep-dive | MEDIUM (untested) · MAIN | No tool test mounts against a non-default persisted config or asserts that dye filters reach matching (the swatch case is not.toThrow only) |
| [BUG-078](findings/BUG-078.md) | deep-dive | LOW · MAIN | budget-tool.ts ignores persisted ConfigController displayOptions at mount; showHue/Stain/Spectrum always reset to true |
| [BUG-079](findings/BUG-079.md) | deep-dive | LOW · MAIN | budget-tool.ts onMount: forces and persists the global market.showPrices=true and never restores it |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 2 — web-app: presets and collections

**The anchor is BUG-029:** `reconcileTombstones` marks live saved presets "Removed by its author".

**Also here:**
- vote failures shown as "already voted";
- a stale response cache;
- a delete failure reported as success;
- collection manager refresh;
- and the preset-tool test gap (BUG-026).

**Dead code:** the preset-service removals from the dead-code catalog land here, after the fixes in the same files.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-029](findings/BUG-029.md) | deep-dive | MEDIUM · MAIN | preset-tool reconcileTombstones marks saved community presets "Removed by its author" in three live cases: a swallowed API failure, a saved local- palette, and a stale filtered response |
| [BUG-030](findings/BUG-030.md) | deep-dive | MEDIUM · MAIN | preset-tool.ts handleCardVote: every failed vote is shown as 'already voted'; a failed removeVote is silent |
| [BUG-031](findings/BUG-031.md) | deep-dive | MEDIUM · MAIN | community-preset-service response cache never invalidated after delete/edit/submit |
| [BUG-032](findings/BUG-032.md) | deep-dive | MEDIUM · MAIN | preset-submission-service.deletePreset failure reported as success by both callers |
| [BUG-026](findings/BUG-026.md) | deep-dive | MEDIUM (untested) · MAIN | preset-tool.test.ts: no coverage of reconcileTombstones, vote handling, tab pools/counts or savedFirst |
| [BUG-017](findings/BUG-017.md) | deep-dive | MEDIUM · MAIN | collection-manager-modal.ts: creating from the manager never refreshes the manager list, count or create-limit state |
| [BUG-016](findings/BUG-016.md) | deep-dive | MEDIUM · MAIN | chara-sheet.ts saveCharacterColors: a duplicate record name fails with a generic 'save failed' toast and has no suffix fallback |
| [BUG-101](findings/BUG-101.md) | deep-dive | LOW · MAIN | my-submissions-modal.ts: after a successful delete the modal keeps showing the deleted preset and stale stats |
| [BUG-108](findings/BUG-108.md) | deep-dive | LOW · MAIN | preset-detail.ts checkVoteStatus: a failed hasVoted check overwrites the vote count with 0 |
| [BUG-109](findings/BUG-109.md) | deep-dive | LOW · MAIN | preset-tool.ts categoryCount/renderTabs: counts ignore feedBlend, feedHideUnbuyable, keepDeleted and the saved search, and the Saved badge omits local palettes |
| [BUG-110](findings/BUG-110.md) | deep-dive | LOW · MAIN | preset-tool.ts handleVoteUpdate: votedIds is not synced from the detail view, so card and detail vote state diverge |
| [BUG-102](findings/BUG-102.md) | deep-dive | LOW · MAIN | preset-submission-form.ts: dismissTop() after awaited submit/upload can close the wrong modal; unguarded sessionStorage write inside the submit try |
| [BUG-082](findings/BUG-082.md) | deep-dive | LOW · MAIN | chara-sheet.ts saveCharacterColors: ?? lets an empty or whitespace Nickname beat the file-name/default fallback, so the save always fails |
| [BUG-084](findings/BUG-084.md) | deep-dive | LOW · MAIN | collection-manager-modal downloadSingleCollection filename strips all non-ASCII (CJK names become dashes) |
| [OPT-008](findings/OPT-008.md) | deep-dive | Opt LOW · MAIN | preset-tool.ts handleSearchInput/sort: refetches the API pool with a spinner on Saved/Mine tabs whose pools are local |
| [dead-code/DEAD-012](../2026-10-04-dead-code/findings/DEAD-012.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | HybridPresetService: 5 public methods with no caller and no test, about 49 lines including blanks |
| [dead-code/DEAD-013](../2026-10-04-dead-code/findings/DEAD-013.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getFeaturedPresets: HybridPresetService's has no caller and CommunityPresetService's is test-only — 33 source + 31 test lines |
| [dead-code/DEAD-014](../2026-10-04-dead-code/findings/DEAD-014.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getPresets 'community' guard in hybrid-preset-service.ts is unreachable — 19 lines |
| [dead-code/DEAD-015](../2026-10-04-dead-code/findings/DEAD-015.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getRemainingSubmissions in preset-submission-service.ts has no caller or test — 41 lines |
| [dead-code/DEAD-016](../2026-10-04-dead-code/findings/DEAD-016.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 3 — web-app: tool correctness

**Language switch:** the switch empties four tools (BUG-021), and no test fires it (BUG-076).

**Stale deep links:** a stale deep link overrides the user's choice (BUG-013, BUG-014).

**Matching and runs:**
- budget runs without a supersede guard;
- the comparison tier disagrees with its verdict;
- a gradient pinned step can repeat a dye;
- swatch filtering returns too few matches.

**Keyboard:** the palette drawer cannot be used from the keyboard.

**Boot:** OPT-001 removes a dev-only network probe from boot.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-021](findings/BUG-021.md) | deep-dive | MEDIUM · MAIN | A language switch empties or hides the results of the Harmony, Mixer, Comparison and Accessibility tools (update() rebuilds the panels without regenerating them) |
| [BUG-076](findings/BUG-076.md) | deep-dive | LOW (untested) · MAIN | No tool test invokes the LanguageService.subscribe callback, so the language-switch rebuild that empties four tools (see the MEDIUM finding) is untested |
| [BUG-013](findings/BUG-013.md) | deep-dive | MEDIUM · MAIN | A stale preserved ?dye= deep link overrides the user's later choice in Budget (Set as budget target) and Harmony (base-dye pick) |
| [BUG-014](findings/BUG-014.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts handleDeepLink: ?maxDelta= changes matchLine after the slider and label were rendered |
| [BUG-015](findings/BUG-015.md) | deep-dive | MEDIUM · MAIN | budget-tool.ts findAlternatives has no run guard; a superseded run overwrites this.rows after a newer run |
| [BUG-018](findings/BUG-018.md) | deep-dive | MEDIUM · MAIN | comparison-tool.ts buildSevenReadouts: the ΔE2000 tier skips tierFor's 0->1 bump, so it contradicts the verdict when matchThreshold < 5 |
| [BUG-020](findings/BUG-020.md) | deep-dive | MEDIUM · MAIN | gradient-tool calculateInterpolation seeds usedDyeIds with endpoints only, so a free step before a pinned step can match the pinned dye undeduplicated |
| [BUG-025](findings/BUG-025.md) | deep-dive | MEDIUM · MAIN | swatch-tool findMatchingDyes filters after a top-(maxResults*3) request, so strong dye filters return fewer than maxResults; closestDyeTo ignores filters |
| [BUG-028](findings/BUG-028.md) | deep-dive | MEDIUM · MAIN | dye-palette-drawer.ts renderSwatch: swatch is a click-only div, so keyboard users cannot pick a dye from the app-wide picker |
| [OPT-001](findings/OPT-001.md) | deep-dive | Opt MEDIUM · MAIN | main.ts:111 boot awaits getServicesStatus() network probe used only by a dev-only log, delaying the v4 shell |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 4 — presets-api: dye validation, null bodies, retention signal

**BUG-010:** repeated dye ids bypass the 3-dye floor and the duplicate signature.

**From #224, after the merge:**
- BUG-066: make a failed retention sweep visible;
- BUG-067: add a self-guard to the identity re-key.

**BUG-003, payload half:** this sprint also carries the presets-api half of BUG-003, which is scheduled with discord-worker.
- Add only an edit flag to the webhook payload; `previous_values` is already sent.
- The change is additive, so it ships here, before discord-worker reads it.

**Dead code:** the presets-api cleanups follow the fixes.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-010](findings/BUG-010.md) | deep-dive | MEDIUM · MAIN | validation-service validatePresetDyes accepts repeated dye ids, bypassing the 3-dye floor and dye_signature dedup |
| [BUG-064](findings/BUG-064.md) | deep-dive | LOW · MAIN | presets PATCH/POST and moderation status/revert: JSON body `null` -> TypeError -> opaque 500 instead of 400 |
| [BUG-065](findings/BUG-065.md) | deep-dive | LOW · MAIN | presets PATCH /:id re-moderates unchanged text; a failing/unscored verdict re-queues an approved (or resubmits a rejected) preset |
| [BUG-066](findings/BUG-066.md) | deep-dive | LOW · PR-#224 | retention-job.ts runRetentionJob: prunes swallow D1 errors, so a failed sweep reports success with no durable signal |
| [BUG-067](findings/BUG-067.md) | deep-dive | LOW (untested) · PR-#224 | identity-rekey-service rekeyIdentity(db,id,id) silently wipes the user's votes; no self-guard or test |
| [BUG-068](findings/BUG-068.md) | deep-dive | LOW · MAIN | validation-service name/description min-length counts whitespace; whitespace-only values pass |
| [BUG-069](findings/BUG-069.md) | deep-dive | LOW · MAIN | validation-service validateExampleLink rejects a leading-space link that normalizeExampleLink would accept |
| [dead-code/DEAD-033](../2026-10-04-dead-code/findings/DEAD-033.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | PresetCategory/AuthSource re-exports in presets-api types.ts are test-only: 6 src lines + 33 test lines |
| [dead-code/DEAD-034](../2026-10-04-dead-code/findings/DEAD-034.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Stale 'community' ternary in presets-api scripts/migrate-presets.ts is a never-taken branch: 1 line |
| [dead-code/DEAD-031](../2026-10-04-dead-code/findings/DEAD-031.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | successResponse + ApiSuccessResponse in presets-api api-response.ts are test-only: 31 src lines + 31 test lines |
| [dead-code/DEAD-032](../2026-10-04-dead-code/findings/DEAD-032.md) | dead-code | Conf HIGH / Blast NONE · REFACTOR FIRST | ErrorCode.BAD_REQUEST and ErrorCode.DATABASE_ERROR in presets-api api-response.ts are never read: 2 lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` → merge → `deploy-presets-api.yml` (no D1 migration)

## Sprint 5 — discord-worker: one moderation-notification path, KV failure handling

**BUG-004:** the bot and the presets-api webhook both post for bot submissions.
- Drop the bot-side posts.
- presets-api needs no change.
- Check it with the moderation channel on a flagged `/preset submit` and `/preset edit`.

**BUG-003:** the webhook renders every edit as new.
- Map the presets-api sprint's edit flag to `kind: 'edit'`, with the original taken from the `previous_values` already in the payload.
- That presets-api change must be deployed first.

**Also here:**
- a world validation awaited inside the 3-second ack;
- favourites and preferences writes that overwrite after a swallowed read failure;
- the dead registry field.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-004](findings/BUG-004.md) | deep-dive | MEDIUM · MAIN | A preset submitted or edited through the bot is posted twice: discord-worker's own moderation/submission-log post (legacy button ids) plus the presets-api webhook's revision-bound post |
| [BUG-003](findings/BUG-003.md) | deep-dive | MEDIUM · MAIN | discord-worker's preset webhook (index.ts:402-407) hard-codes kind 'new', so a flagged edit is posted as "New preset pending" with no diff and no Revert button |
| [BUG-002](findings/BUG-002.md) | deep-dive | MEDIUM · MAIN | budget.ts/preferences.ts: validateWorld cold-cache service calls are awaited inside the 3 s ack window |
| [BUG-005](findings/BUG-005.md) | deep-dive | MEDIUM · MAIN | command-trace isUserCondition counts the Universalis client's synthetic 408 timeout as an answered 'rejected' outcome |
| [BUG-006](findings/BUG-006.md) | deep-dive | MEDIUM · MAIN | preset-favorites getPresetFavoriteEntries returns [] on read failure and addPresetFavorite overwrites the user's list |
| [BUG-041](findings/BUG-041.md) | deep-dive | LOW · MAIN | preview-image.ts puts a raw <@id> mention in the embed footer and drops the preset ID |
| [BUG-042](findings/BUG-042.md) | deep-dive | LOW · MAIN | extractor.ts renderColorSheet: render/edit failure is never logged and is reported to the user as 'no match found' |
| [BUG-043](findings/BUG-043.md) | deep-dive | LOW · MAIN | gradient.ts processGradientCommand: Start/End lines print the English Dye.name while step rows are localized |
| [BUG-044](findings/BUG-044.md) | deep-dive | LOW · MAIN | harmony.ts and sibling handlers echo the raw colour/dye option into errors.invalidColor embed descriptions with no sanitizeEmbedText or length cap |
| [BUG-045](findings/BUG-045.md) | deep-dive | LOW · MAIN | stats.ts overview: Avg Cmds/User divides a lifetime total by today's users |
| [BUG-046](findings/BUG-046.md) | deep-dive | LOW (untested) · MAIN | Router autocomplete paths for subcommand-group walk (/preset favorite remove), favourites back-fill incl. earlier-audit BUG-028 fix, clan autocomplete and preferences world autocomplete have no index.test.ts coverage. |
| [BUG-047](findings/BUG-047.md) | deep-dive | LOW · MAIN | Favourites name back-fill converts any getPreset failure (5xx/timeout/429, swallowed by .catch(()=>null)) into the preset UUID as the persisted name, which is never retried; names also never refresh on rename and the whole-list write can lose a concurrent favorite add. |
| [BUG-048](findings/BUG-048.md) | deep-dive | LOW · MAIN | preferences getUserPreferences swallows read failure as {} and the set/reset writes then overwrite or delete the user's whole prefs blob |
| [BUG-049](findings/BUG-049.md) | deep-dive | LOW · MAIN | preferences.ts getAffectedCommands and the /preferences schema advertise consumers that never read the key (clan/gender, blending->/gradient, matching->/swatch, and /harmony is left out) |
| [REFACTOR-002](findings/REFACTOR-002.md) | deep-dive | Refactor LOW · MAIN | searchPresetsForAutocomplete is called without logger, so its catch returns [] silently while the user-presets path logs. |
| [OPT-003](findings/OPT-003.md) | deep-dive | Opt LOW · MAIN | preset.ts favorite list fans out one getPreset per favourite (up to 50) |
| [OPT-004](findings/OPT-004.md) | deep-dive | Opt LOW · MAIN | stats.ts summary pages all of today's user keys it never displays |
| [OPT-005](findings/OPT-005.md) | deep-dive | Opt LOW · MAIN | preferences legacy-key migration re-reads two dead KV keys on every call for users with no prefs blob |
| [dead-code/DEAD-024](../2026-10-04-dead-code/findings/DEAD-024.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | CommandRegistryEntry.deprecated in registry.ts is never set or read in production: 2 lines + 3-line test |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` → merge → `deploy-discord-worker.yml` (CI runs `register-commands`; no command shape changes)

## Sprint 6 — oauth: limiter keying, null bodies

BUG-007: decode the path before the `/auth/*` limiter keys it, then add the tests BUG-055 asks for. BUG-056 turns a null JSON body into a 400. BUG-057 filters null roster elements and empty names, falling back to the degraded login.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-007](findings/BUG-007.md) | deep-dive | MEDIUM · MAIN | apps/oauth/src/index.ts /auth/* limiter keys and tiers on the raw percent-encoded pathname, while Hono routes on the decoded path |
| [BUG-055](findings/BUG-055.md) | deep-dive | LOW (untested) · MAIN | oauth tests never send a percent-encoded /auth path through the app's limiter or a JSON `null` body to the POST callbacks |
| [BUG-056](findings/BUG-056.md) | deep-dive | LOW · MAIN | POST /auth/callback and /auth/xivauth/callback destructure a null JSON body outside the parse try, giving a 500 instead of a 400 |
| [BUG-057](findings/BUG-057.md) | deep-dive | LOW · MAIN | xivauth.ts roster guard (earlier-audit BUG-051) validates only that the roster is an array; a null element gives a 500, and an empty verified name gives an empty username |
| [dead-code/DEAD-037](../2026-10-04-dead-code/findings/DEAD-037.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | apps/oauth vitest.config.ts coverage.exclude names nonexistent rate-limit-do.ts / durable-objects: 3 config lines |
| [dead-code/DEAD-036](../2026-10-04-dead-code/findings/DEAD-036.md) | dead-code | Conf HIGH / Blast LOW · REMOVE WITH CAUTION | decodeJWT wrapper in apps/oauth jwt-service.ts is test-only: 8 src lines + 31-line describe block |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` → merge → `deploy-oauth.yml` (never a bare `wrangler deploy` by hand: it is production)

## Sprint 7 — og-worker: gradient card follows the requested algorithm

BUG-009 and BUG-008: the gradient card ranks by a hard-coded ΔE and ramps in the wrong space. Also here: crawler parameters, the extractor algorithm, legacy `?algo=` spellings, cache-key fragmentation and resvg frees.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-009](findings/BUG-009.md) | deep-dive | MEDIUM · MAIN | gradient.ts generateGradientOG ranks middle-band dyes by hardcoded 'ciede2000' while printing the delta and footer in the requested algo |
| [BUG-008](findings/BUG-008.md) | deep-dive | MEDIUM · MAIN | services/svg/gradient.ts interpolate(): the card ramps in a space derived from algo (Lab for the default ciede2000) and ignores the shared interpolation (page default hsv), so its middle dyes differ from the page |
| [BUG-058](findings/BUG-058.md) | deep-dive | LOW · MAIN | index.ts ogCacheKey keys algo and mode on every /og route although only 5 routes read algo and 2 read mode, contradicting its own docblock |
| [BUG-059](findings/BUG-059.md) | deep-dive | LOW · MAIN | og-data-generator.ts generateOGDataForTool: gradient/mixer/harmony crawler ignores hexStart/hexEnd/hexA/hexB/hex slots, so a custom-colour share unfurls the generic tool card |
| [BUG-060](findings/BUG-060.md) | deep-dive | LOW · MAIN | extractor.ts matches by hardcoded ciede2000 and the crawler forwards algo only onto og:url, so the unfurl can name different dyes than the page |
| [BUG-061](findings/BUG-061.md) | deep-dive | LOW (untested) · MAIN | gradient.test.ts has no algorithm case; harmony.test.ts:233 lists only the six 5.0 spellings and asserts only '<svg' |
| [BUG-062](findings/BUG-062.md) | deep-dive | LOW · MAIN | harmony.ts passes a raw legacy ?algo= (hyab/euclidean/oklch-weighted) to core generateHarmonySlots; getDistanceForMethod returns undefined and the card shows dyes in table order |
| [OPT-006](findings/OPT-006.md) | deep-dive | Opt LOW · MAIN | renderer.ts renderSvgToPng never .free()s Resvg or RenderedImage, leaving each render's wasm allocations to FinalizationRegistry timing |
| [dead-code/DEAD-039](../2026-10-04-dead-code/findings/DEAD-039.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | CrawlerInfo.userAgent in apps/og-worker/src/types.ts is written but never read since the crawler log was minimized: 4 src lines + 11 test lines |
| [dead-code/DEAD-040](../2026-10-04-dead-code/findings/DEAD-040.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Unused '@' path alias in apps/og-worker vitest.config.ts and tsconfig.json: 10 config lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml` (bumping `CARD_VERSION` re-renders cached cards once; a bare deploy is the live beta)

## Sprint 8 — @xivdyetools/logger: redaction gaps (publish)

BUG-140: context strings skip key=value redaction. BUG-141: `toJSON` objects log as `{}`. Plus a stale doc and a per-call Set rebuild.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-140](findings/BUG-140.md) | deep-dive | LOW · MAIN | logger context string values skip sanitizeErrorMessage key=value/JSON-key redaction |
| [BUG-141](findings/BUG-141.md) | deep-dive | LOW · MAIN | logger redactSensitiveFields spread-copies toJSON objects (Date/URL), logging them as {} |
| [OPT-010](findings/OPT-010.md) | deep-dive | Opt LOW · MAIN | logger redactSensitiveFields rebuilds the normalized redact Set per node per call |
| [REFACTOR-007](findings/REFACTOR-007.md) | deep-dive | Refactor LOW · MAIN | logger orphaned MAX_STRINGIFY_NODES JSDoc sits above AUTH_SCHEMES |

**Ends with:** bump `@xivdyetools/logger` (patch) → gate with `--filter=...@xivdyetools/logger` → merge → Actions publish

## Sprint 9 — @xivdyetools/core: blending, palette extraction, parser bounds (publish)

**MEDIUM fixes:**
- BUG-035: grey mixes get a hue neither input has.
- BUG-036: palette extraction returns duplicate 0-pixel clusters.

**Also here:** LOW parser and data fixes, plus two tests that cannot fail.

**`build-locales.ts`:** BUG-128 is the generator, so fix the generator, never the generated JSON.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-035](findings/BUG-035.md) | deep-dive | MEDIUM · MAIN | blending.ts blendHSL interpolates the hue of an achromatic input, which is meaningless (always 0), so grey/white/black mixes get a hue neither input has |
| [BUG-036](findings/BUG-036.md) | deep-dive | MEDIUM · MAIN | PaletteService kMeansClustering caps k at pixel count, so images with fewer distinct colours than colorCount return duplicate 0-pixel clusters that discord /extractor renders as rows |
| [BUG-128](findings/BUG-128.md) | deep-dive | LOW · MAIN | build-locales.ts writes locale JSONs before exiting 1 on missing cells, and never checks dyes.json ids against dyenames.csv rows |
| [BUG-129](findings/BUG-129.md) | deep-dive | LOW · MAIN | blendColors lets a NaN ratio through Math.max/Math.min and returns the invalid hex '#NaNNaNNaN' |
| [BUG-130](findings/BUG-130.md) | deep-dive | LOW · MAIN | dyes.json English name 'Opo-Opo Brown' disagrees with en.json/dyenames.csv 'Opo-opo Brown' (stainID 24, itemID 5752) |
| [BUG-131](findings/BUG-131.md) | deep-dive | LOW · MAIN | CharacterColorService.findClosestDyes earlier-audit BUG-056 guard misses NaN/non-number count -> TypeError on best[-1] |
| [BUG-132](findings/BUG-132.md) | deep-dive | LOW · MAIN | DyeService.searchByLocalizedName returns all 125 dyes for an empty or whitespace query when the locale is loaded |
| [BUG-133](findings/BUG-133.md) | deep-dive | LOW · MAIN | chara-parser parseFloatColor accepts empty segments as 0 (and Infinity), producing a silent wrong lip/colour |
| [BUG-134](findings/BUG-134.md) | deep-dive | LOW · MAIN | ColorAccessibility.isLightColor/getOptimalTextColor use a luminance threshold of 0.5, which picks the lower-contrast text for luminance between about 0.18 and 0.5 |
| [BUG-135](findings/BUG-135.md) | deep-dive | LOW · MAIN | ColorConverter.hsvToRgb caches under a key rounded to 2 dp but stores the result computed from the unrounded inputs, so the output depends on call order |
| [BUG-136](findings/BUG-136.md) | deep-dive | LOW · MAIN | DyeDatabase.initialize accepts an all-invalid payload as a loaded empty DB, and duplicate ids only log through the NoOp logger |
| [BUG-137](findings/BUG-137.md) | deep-dive | LOW · MAIN | HarmonySelector.generateHarmonySlots reserves a pinned dye only for later slots under preventDuplicates, so an earlier slot can choose the same dye |
| [BUG-138](findings/BUG-138.md) | deep-dive | LOW (untested) · MAIN | DyeSearch.test.ts findClosestDye/findDyesWithinDistance tests pass on null or empty results |
| [BUG-139](findings/BUG-139.md) | deep-dive | LOW (untested) · MAIN | HarmonySelector.test.ts pin test pins Jet Black, a dye no earlier slot picks, so it cannot detect the earlier-slot duplicate |

**Ends with:** bump `@xivdyetools/core` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` (all consumers) → merge (consumer deploy workflows fire on `packages/core/**`) → Actions publish

## Sprint 10 — @xivdyetools/svg: card text fidelity (publish)

Rounding in the contrast tier, ellipsised step ranges, a sub-floor label, and the frame-budget gate's missing cards.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-142](findings/BUG-142.md) | deep-dive | LOW · MAIN | contrast-card.ts tone/tier judged on the raw ratio while 13C·1 prints it rounded to 1 dp (2.96 shows '3.0' in failing red) |
| [BUG-143](findings/BUG-143.md) | deep-dive | LOW · MAIN | emitted-glyphs.ts scanner fails open on \u escapes in literals and on a keyword-preceded regex (return /'/) |
| [BUG-144](findings/BUG-144.md) | deep-dive | LOW (untested) · MAIN | frame-budget.test.ts type-floor/text-extent gate omits glamour, swatch, a11y, dye-info and budget-ledger cards |
| [BUG-145](findings/BUG-145.md) | deep-dive | LOW · MAIN | glamour-card.ts look label drawn at 10.5 px, below the documented 11 px type floor |
| [BUG-146](findings/BUG-146.md) | deep-dive | LOW · MAIN | gradient.ts ROW_WIDTHS.lead=28 ellipsises two-digit merged step ranges ('9–10' -> '9–…', '10–12' -> '10…') |

**Ends with:** bump `@xivdyetools/svg` (patch) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` → merge → Actions publish

## Sprint 11 — @xivdyetools/bot-logic: input resolution and filtered matching (publish)

**Fixes:**
- BUG-034: an all-digit hex without `#` is read as a dye id.
- BUG-033: filters applied after a capped search return "no match".

**Coverage:** BUG-127. Restore the 90 % branch threshold by covering glamour's branches, and decide whether CI runs `test:coverage`.

**Consumers:** discord-worker and stoat-worker pick the change up via `workspace:*`. The merge redeploys discord-worker through its path filter.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-034](findings/BUG-034.md) | deep-dive | MEDIUM · MAIN | input-resolution.ts resolveColorInput: all-digit 6-char hex without '#' (000000, 333333, 123456) is read as a dye id and returns null |
| [BUG-033](findings/BUG-033.md) | deep-dive | MEDIUM · MAIN | gradient.ts/mixer.ts apply dyeFilters after a capped nearest-N search, so steps report no match although allowed dyes exist |
| [BUG-124](findings/BUG-124.md) | deep-dive | LOW · MAIN | glamour.ts gposersList writes the 'Model <key>' placeholder as an item name and drops Facewear when glasses are unresolved |
| [BUG-125](findings/BUG-125.md) | deep-dive | LOW · MAIN | execute* final 'catch {}' blocks discard the exception and return GENERATION_FAILED; adapters log only the code |
| [BUG-126](findings/BUG-126.md) | deep-dive | LOW · MAIN | locale-resolution.ts resolveUserLocale never passes a logger to getLegacyLanguagePreference, so the 'louder' KV-failure log never fires |
| [BUG-127](findings/BUG-127.md) | deep-dive | LOW (untested) · MAIN | bot-logic branch coverage 88.38% (502/568) is below its own 90% vitest threshold; glamour.ts has 25 uncovered branches; CI never enforces it |

**Ends with:** bump `@xivdyetools/bot-logic` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` → merge (redeploys discord-worker) → Actions "Publish Packages to npm"

## Sprint 12 — @xivdyetools/worker-kit: body guard and limiter edges (publish)

**Fixes:**
- BUG-149: a case-sensitive Content-Type check lets JSON skip the depth guard.
- Rate-limit headers dropped on raw Responses.
- Single-page KV resets.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-149](findings/BUG-149.md) | deep-dive | LOW · MAIN | worker-kit jsonDepthLimit: case-sensitive Content-Type check lets oauth JSON bodies skip the depth/__proto__ guard |
| [BUG-150](findings/BUG-150.md) | deep-dive | LOW · MAIN | worker-kit rateLimitMiddleware deny paths drop Retry-After/X-RateLimit-* when formatError returns a raw Response |
| [BUG-151](findings/BUG-151.md) | deep-dive | LOW · MAIN | worker-kit KVRateLimiter.reset/resetAll read a single kv.list page (no cursor loop) |

**Ends with:** bump `@xivdyetools/worker-kit` (patch) → gate with `--filter=...@xivdyetools/worker-kit` → merge (oauth, presets-api, api-worker, image-worker and the bots redeploy) → Actions publish

## Sprint 13 — moderation-worker: review edge cases, then cleanup

**From #225, after the merge:**
- BUG-052: a losing concurrent click overwrites the winner's embed;
- BUG-054: a stale-deploy 404 strips live buttons.

**Dead code:** the moderation-worker cleanups follow, safest first.
- `dead-code/DEAD-029`, the legacy ban suffix, goes last.
- It needs the test-fixture rewrite the finding describes.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-050](findings/BUG-050.md) | deep-dive | LOW · MAIN | preset-moderation.ts processApproval / preset-rejection.ts processRejection: success embed spreads a prior 'Error' field |
| [BUG-051](findings/BUG-051.md) | deep-dive | LOW · MAIN | ban-reason.ts handleBanReasonModal: reason length check is untrimmed, so a whitespace-only reason is stored |
| [BUG-052](findings/BUG-052.md) | deep-dive | LOW · PR-#225 | review-message.ts refreshReview: a losing concurrent click's 409 refresh overwrites the winner's 'Approved by'/'Reason' embed |
| [BUG-054](findings/BUG-054.md) | deep-dive | LOW · PR-#225 | moderation-worker getModerationPreset treats a missing-route 404 as 'preset gone' and strips live review buttons |
| [dead-code/DEAD-027](../2026-10-04-dead-code/findings/DEAD-027.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Translator.t() fallbackData branch in moderation-worker bot-i18n.ts is a no-op (data === fallbackData === strings): about 8 lines; getLocale is NOT included and stays as an observation hook |
| [dead-code/DEAD-028](../2026-10-04-dead-code/findings/DEAD-028.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | Unused _maxRetries parameter of incrementRateLimit in rate-limit.ts; its @param falsely says it is passed to the shared package: 2 src lines + 4 call-site edits |
| [dead-code/DEAD-025](../2026-10-04-dead-code/findings/DEAD-025.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines |
| [dead-code/DEAD-026](../2026-10-04-dead-code/findings/DEAD-026.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | getPreset in moderation-worker services/preset-api.ts is test-only: 13 src lines + 34 test lines |
| [dead-code/DEAD-030](../2026-10-04-dead-code/findings/DEAD-030.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines |
| [dead-code/DEAD-029](../2026-10-04-dead-code/findings/DEAD-029.md) | dead-code | Conf MEDIUM / Blast LOW · REMOVE WITH CAUTION | Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` → merge → `deploy-moderation-worker.yml` (commands are registered by hand; shapes unchanged)

## Sprint 14 — api-worker: telemetry double charge, param parsing, limiter test

BUG-037: each telemetry beacon is charged twice. BUG-039 is from #229: pin the multiplier to the binding. OPT-002 moves the 3.4 MB acquisition tables off the cold start.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-037](findings/BUG-037.md) | deep-dive | LOW · MAIN | index.ts telemetry limiter registered twice; each beacon is charged 2x against the 240/60s fail-closed bucket |
| [BUG-038](findings/BUG-038.md) | deep-dive | LOW · MAIN | parseIntParam/parseFloatParam accept trailing garbage and exponent forms in query params |
| [BUG-039](findings/BUG-039.md) | deep-dive | LOW (untested) · PR-#229 | router.ts SERVICE_BINDING_BUDGET_MULTIPLIER can drift from the UNIVERSALIS_SERVICE_RATE_LIMITER binding with no failing test |
| [BUG-040](findings/BUG-040.md) | deep-dive | LOW · MAIN | XIVAPI_VERSION="latest" makes the chara row-cache namespace constant, so a patch never cold-starts the cache |
| [OPT-002](findings/OPT-002.md) | deep-dive | Opt LOW · MAIN | chara acquisition/ko/zh JSON tables (3.4 MB raw) are evaluated at isolate start for every route |
| [dead-code/DEAD-035](../2026-10-04-dead-code/findings/DEAD-035.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | createMockKV re-export in api-worker tests/test-utils.ts has no importer — 1 line |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` → merge → `deploy-api-worker.yml`

## Sprint 15 — test-utils: D1/KV mock fidelity, then cleanup

The mock fixes come first. Then the dead-code removals, ending with the self-referential integration suite (`dead-code/DEAD-041`).

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-147](findings/BUG-147.md) | deep-dive | LOW · MAIN | test-utils createMockD1Database first() returns undefined (real D1: null) when the mock fn returns undefined |
| [BUG-148](findings/BUG-148.md) | deep-dive | LOW · MAIN | test-utils KV/R2 mock list(): cursor resume never ends when the cursor's key was deleted; insertion order instead of lexicographic |
| [dead-code/DEAD-042](../2026-10-04-dead-code/findings/DEAD-042.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | createMockD1 in test-utils cloudflare/d1.ts is reached only by its own unit test: 22 src lines + 18 test lines |
| [dead-code/DEAD-043](../2026-10-04-dead-code/findings/DEAD-043.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | randomStainId in test-utils factories/dye.ts is test-only — 9 lines + 6-line test |
| [dead-code/DEAD-044](../2026-10-04-dead-code/findings/DEAD-044.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | test-utils './auth' exports-map subpath has zero importers — 4 config lines |
| [dead-code/DEAD-041](../2026-10-04-dead-code/findings/DEAD-041.md) | dead-code | Conf HIGH / Blast NONE · REMOVE WITH CAUTION | test-utils integration/ suite only tests local re-implementations of presets-api auth: setup.ts 214 lines + 581 test lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` (every consumer re-runs) → merge; private, so no publish and no deploy

## Sprint 16 — root (CI/scripts): workflow and gate fixes

**Fixes:**
- BUG-152: CI concurrency cancels main-branch and nightly runs.
- BUG-153: deploy path filters omit the lockfile.
- BUG-154: the publish loop keeps going after a failure.
- Two gate-script fixes.

**Then:** stale docs and two root config lines.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-152](findings/BUG-152.md) | deep-dive | LOW · MAIN | ci.yml workflow-level concurrency ci-${{ github.ref }} + cancel-in-progress: true cancels main-push and nightly-schedule runs against each other |
| [BUG-153](findings/BUG-153.md) | deep-dive | LOW · MAIN | Production deploy workflows' paths filters omit pnpm-lock.yaml / pnpm-workspace.yaml / turbo.json / tsconfig.base.json |
| [BUG-154](findings/BUG-154.md) | deep-dive | LOW · MAIN | publish-packages.yml Publish loop records FAILED+= and keeps publishing dependents of a failed package |
| [BUG-155](findings/BUG-155.md) | deep-dive | LOW · MAIN | check-dead-code.ts findOrphanModules / findTestOnlyMembers read EXCLUDED_REFERRERS raw instead of via referrerTexts |
| [BUG-156](findings/BUG-156.md) | deep-dive | LOW (untested) · MAIN | check-doc-versions.ts promises failure on a non-semver version claim but silently drops the row |
| [REFACTOR-008](findings/REFACTOR-008.md) | deep-dive | Refactor LOW · MAIN | Stale comments: ci.yml check-bundle-size scope, web-app vitest coverage-report baseline, orphaned docblock above asReferrers |
| [REFACTOR-009](findings/REFACTOR-009.md) | deep-dive | Refactor LOW · MAIN | OPEN_ITEMS Phase 0 entry and DOMAIN_DEPRECATION inventory line numbers are stale |
| [dead-code/DEAD-046](../2026-10-04-dead-code/findings/DEAD-046.md) | dead-code | Conf HIGH / Blast LOW · REMOVE | The turbo.json `deploy` task (lines 130-134) has no caller: 5 lines |
| [dead-code/DEAD-045](../2026-10-04-dead-code/findings/DEAD-045.md) | dead-code | Conf HIGH / Blast MEDIUM · REMOVE WITH CAUTION | The qs override in pnpm-workspace.yaml:11 names a package nothing installs: 1 line, plus the comment on line 7 and lockfile line 10 |

**Ends with:** `pnpm install --frozen-lockfile`, the whole-graph gate, `pnpm test:scripts`, `pnpm dead-code:check`, `pnpm docs:check-links` → merge (deploys nothing)

## Sprint 17 — image-worker: stale path alias

Config only; the bundle is unchanged.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [dead-code/DEAD-038](../2026-10-04-dead-code/findings/DEAD-038.md) | dead-code | Conf HIGH / Blast NONE · REMOVE | apps/image-worker '@' path alias (vitest resolve.alias + tsconfig paths) has no importer: 10 config lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` → merge → `deploy-image-worker.yml`

## Sprint 18 — web-app: remaining LOW fixes

Tool, shell, service and glamour LOWs. Most are one-line guards or listener teardown.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-074](findings/BUG-074.md) | deep-dive | LOW (untested) · MAIN | validate-i18n.js PATTERNS only see single-line literal LanguageService.t/tInterpolate calls, so wrapped calls and the local t() alias are never key-checked |
| [BUG-075](findings/BUG-075.md) | deep-dive | LOW (untested) · MAIN | budget-tool.test.ts Basic Rendering asserts non-null on test-created panels, so left-panel and drawer rendering is unverified |
| [BUG-077](findings/BUG-077.md) | deep-dive | LOW (untested) · MAIN | tool setConfig tests (mixer maxResults/displayOptions guard/market marker, harmony type regeneration, extractor multi-key) assert only not.toThrow |
| [BUG-080](findings/BUG-080.md) | deep-dive | LOW · MAIN | budget-tool.ts / mixer-tool.ts: theme-dependent inline colours are not refreshed on a theme change |
| [BUG-081](findings/BUG-081.md) | deep-dive | LOW · MAIN | budget-tool.ts saveSwapRecord breaks 216-gil ties by database order, not by ΔE |
| [BUG-083](findings/BUG-083.md) | deep-dive | LOW · MAIN | chara-sheet.ts slot-card click re-renders the whole sheet and drops keyboard focus; selected state has no aria-pressed |
| [BUG-085](findings/BUG-085.md) | deep-dive | LOW · MAIN | comparison-tool.ts ensureActivePair: the index-based pair survives a removal and swaps out the surviving member |
| [BUG-086](findings/BUG-086.md) | deep-dive | LOW · MAIN | comparison-tool.ts renders the market price row from its own showMarketPrices flag, while the service's showPrices (default off) blocks fetching |
| [BUG-087](findings/BUG-087.md) | deep-dive | LOW · MAIN | comparison/accessibility getShareParams: Share stays enabled for an all-custom-colour selection that yields dyes:[] |
| [BUG-088](findings/BUG-088.md) | deep-dive | LOW · MAIN | dye-selector.ts handleGlobalKeydown: activeElement guard is blind inside the shell's shadow root, so '/' is swallowed in tool inputs |
| [BUG-089](findings/BUG-089.md) | deep-dive | LOW · MAIN | dye-selector.ts updateFavoritesPanel hardcodes the 8-column grid and overrides compactMode's 3-column favourites layout at mount |
| [BUG-090](findings/BUG-090.md) | deep-dive | LOW · MAIN | extractor-tool.ts fetchPricesForRoll: the catch, parseMarketError and lastMarketError are unreachable because every layer below swallows fetch failures |
| [BUG-091](findings/BUG-091.md) | deep-dive | LOW · MAIN | glamour-twin-picker (role=dialog) and item-links-menu never register with ModalService, so global 1-9/Shift+T/L/S shortcuts fire while they hold focus |
| [BUG-092](findings/BUG-092.md) | deep-dive | LOW · MAIN | gradient-tool.ts loadSelectedDyes drops persisted custom-colour endpoints and moves the remaining dye into the Start slot |
| [BUG-093](findings/BUG-093.md) | deep-dive | LOW · MAIN | swatch/gradient renderLeftPanel rebuilds CollapsiblePanel/MarketBoard/DyeSelector on every update() into the element renderRightPanel clears, without destroying the previous instances |
| [BUG-094](findings/BUG-094.md) | deep-dive | LOW · MAIN | gradient-tool.ts result-card slot picker (Set as End/Start) has no same-dye guard, and endpoint rows render cards |
| [BUG-095](findings/BUG-095.md) | deep-dive | LOW · MAIN | harmony-tool.ts renderRightPanel: each render adds a new matchMedia listener; destroy removes only the last |
| [BUG-096](findings/BUG-096.md) | deep-dive | LOW · MAIN | image-zoom-controller.ts Ctrl-drag pan ignores the centring margin, so a fitted image jumps on the first pan move |
| [BUG-097](findings/BUG-097.md) | deep-dive | LOW · MAIN | image-zoom-controller.ts touch handlers: a second finger does not cancel the drag, so a two-finger gesture commits a colour sample on lift |
| [BUG-098](findings/BUG-098.md) | deep-dive | LOW · MAIN | mixer-tool.ts loadSelectedDyes: a legacy third slot is restored, giving an equal-weight 3-way blend |
| [BUG-099](findings/BUG-099.md) | deep-dive | LOW · MAIN | mixer-tool.ts renderMixingField: a cell with no eligible match prints ΔE 0.0 |
| [BUG-100](findings/BUG-100.md) | deep-dive | LOW · MAIN | modal-container.ts attachSheetDrag: ignores inner scrollers and touchcancel on mobile sheets |
| [BUG-103](findings/BUG-103.md) | deep-dive | LOW · MAIN | swatch-tool registers its window resize listener with this.on in onMount; BaseComponent.update() unbinds it on a language switch and never re-adds it |
| [BUG-104](findings/BUG-104.md) | deep-dive | LOW · MAIN | swatch-tool.ts updateHandoffRow: SEND TO does a full reload with window.location.assign, so the in-memory .chara session is dropped |
| [BUG-105](findings/BUG-105.md) | deep-dive | LOW · MAIN | toast-container.ts: full rebuild on each change replays animations and re-announces alerts; Escape closes toast and modal together |
| [BUG-106](findings/BUG-106.md) | deep-dive | LOW · MAIN | tutorial-spotlight.ts: window-only scroll listener and a fixed 100ms measurement leave the spotlight off-target after a container smooth-scroll |
| [BUG-107](findings/BUG-107.md) | deep-dive | LOW · MAIN | dye-palette-drawer.ts filterByType: Metallic chip matches English name (14) instead of the gloss set isMetallic (16) |
| [BUG-111](findings/BUG-111.md) | deep-dive | LOW · MAIN | result-card.ts handleMenuClick/handleSelectClick: stopPropagation keeps other cards' open menus from closing |
| [BUG-112](findings/BUG-112.md) | deep-dive | LOW · MAIN | v4-layout-shell.ts static styles have no @media print: browser print is one clipped page including chrome |
| [BUG-113](findings/BUG-113.md) | deep-dive | LOW · MAIN | v4-layout-shell.ts re-emits composed child events without stopPropagation, so v4-layout handlers run twice |
| [BUG-114](findings/BUG-114.md) | deep-dive | LOW · MAIN | main.ts:126 non-critical tutorial-spotlight import failure triggers renderFatalError over the already-rendered shell |
| [BUG-115](findings/BUG-115.md) | deep-dive | LOW · MAIN | auth-service performLogout awaits /auth/revoke with no timeout before clearing local session |
| [BUG-116](findings/BUG-116.md) | deep-dive | LOW · MAIN | chara-resolve-service resolveCharaEquipment sends unbounded model lanes/glasses id; one lane >0xffff 400s the whole resolve and the Reader reports an outage |
| [BUG-117](findings/BUG-117.md) | deep-dive | LOW · MAIN | CollectionService.initialize re-enters and overflows the stack when a migration save fails |
| [BUG-118](findings/BUG-118.md) | deep-dive | LOW · MAIN | collection-service importData: earlier-audit BUG-024 guard dereferences a null collections[] element outside the per-record try |
| [BUG-119](findings/BUG-119.md) | deep-dive | LOW · MAIN | indexeddb-service has no db.onversionchange handler, so an open tab blocks a future DB_VERSION upgrade and the other tab caches initialize()=false |
| [BUG-120](findings/BUG-120.md) | deep-dive | LOW · MAIN | keyboard-service digit tool shortcuts unreachable from the AZERTY number row |
| [BUG-121](findings/BUG-121.md) | deep-dive | LOW · MAIN | LanguageService.setLocale has no sequencing; overlapping calls desync core and web locales |
| [BUG-122](findings/BUG-122.md) | deep-dive | LOW · MAIN | LanguageService.tInterpolate expands $ patterns in user-supplied values |
| [BUG-123](findings/BUG-123.md) | deep-dive | LOW · MAIN | palette-export.ts:136 today() stamps exports with the UTC date, not the local date |
| [OPT-007](findings/OPT-007.md) | deep-dive | Opt LOW · MAIN | mixer-tool.ts field-cell click renders the field twice; harmony-tool.ts market change runs a superseded price pass |
| [OPT-009](findings/OPT-009.md) | deep-dive | Opt LOW · MAIN | IndexedDBCacheBackend.loadFromStorage hydrates the price cache with one serial readonly transaction per key |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Sprint 19 — web-app: dead-code cleanup

The rest of the dead-code catalog's web-app entries. Each cascade is the next commit after its trigger, because web-app's knip gate fails on the orphaned exports in between: dead-code/DEAD-009 and dead-code/DEAD-010 after dead-code/DEAD-008. dead-code/DEAD-003, the context-action vocabulary, goes last.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
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

## Sprint 20 — stoat-worker (parked)

P3. Fix only if Stoat is resumed; otherwise these go with the app if it is archived (see `docs/research/discord-alternatives/07-2026-10-refresh.md`).

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [BUG-070](findings/BUG-070.md) | deep-dive | LOW · MAIN | stoat about.ts Quick Start advertises unrouted !xd random and an unimplemented ❓-reaction help |
| [BUG-071](findings/BUG-071.md) | deep-dive | LOW (untested) · MAIN | stoat dye-resolver.test.ts multiple/disambiguation tests cannot fail (any-kind else / guarded if) |
| [BUG-072](findings/BUG-072.md) | deep-dive | LOW · MAIN | stoat dye-resolver.ts ignores locale and initializeLocale is never called, while help advertises localized names |
| [BUG-073](findings/BUG-073.md) | deep-dive | LOW · MAIN | stoat dye-resolver.ts resolveDyeInputMulti: step 1 resolveColorInput first-match makes multiple/disambiguation unreachable for name queries |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker` → merge (no deploy workflow)

## Sprint 21 — auth: doc comment

A comment-only fix. It rides with the next auth change; no publish is needed for it alone.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [REFACTOR-006](findings/REFACTOR-006.md) | deep-dive | Refactor LOW · MAIN | auth JWTPayload doc falsely claims a re-export from types and mislabels sub |

**Ends with:** gate with `--filter=...@xivdyetools/auth` → merge

## Sprint 22 — Structural: share the review custom_id grammar (terminal)

REFACTOR-001: one module for the grammar and status list, consumed by presets-api, moderation-worker and discord-worker, or a parity test across them. One publish, then one deploy per consumer.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [REFACTOR-001](findings/REFACTOR-001.md) | deep-dive | Refactor LOW · PR-#227 + PR-#225 + PR-#224 | Review custom_id grammar and status list duplicated across discord-worker, moderation-worker and presets-api with no parity check |

**Ends with:** publish the host package → presets-api, moderation-worker and discord-worker each in their own deploy, in the documented order (presets-api first)

## Sprint 23 — Structural: one dyeable-slot set (terminal)

REFACTOR-004: core exports the dyeable-slot set, and web-app imports it.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [REFACTOR-004](findings/REFACTOR-004.md) | deep-dive | Refactor LOW · MAIN | glamour-block DYEABLE_SLOTS duplicates core chara-gposers private DYEABLE with a 'change both' comment |

**Ends with:** core publish → web-app deploy

## Sprint 24 — Structural: svg ledger constants (terminal)

REFACTOR-003: svg exports the ledger geometry, and discord-worker's budget calculator imports it.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [REFACTOR-003](findings/REFACTOR-003.md) | deep-dive | Refactor LOW · MAIN | budget-calculator.ts mirrors the svg ledger geometry with literals (350-43-27, 24, 40, 32, 47) instead of the exported LEDGER_* constants |

**Ends with:** svg publish → discord-worker deploy

## Sprint 25 — Structural: split swatch-tool and gradient-tool (terminal, last)

REFACTOR-005: the two largest files in the repo duplicate their desktop and mobile selector code. This goes last, because every web-app sprint above touches them.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
|---|---|---|---|
| [REFACTOR-005](findings/REFACTOR-005.md) | deep-dive | Refactor LOW · MAIN | swatch-tool.ts (3146 lines) and gradient-tool.ts (2755 lines): duplicated desktop/mobile selector code already drifts (mobile steps skip pinnedSteps.clear), a dead left panel and drawer, and a mojibake literal at gradient-tool.ts:825 |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. Recount coverage after any removal; never lower web-app's ratchet. Merge → `deploy-web-app.yml`.

## Superseded findings

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` (swatch/gradient) | dead-code/DEAD-003 | the `copy-hex` action is never emitted; the removal deletes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | dead-code/DEAD-008 | a test-only preset; the removal deletes it |

## KEEP register

These are not scheduled; the reasons and revisit triggers are in each finding. The package-major backlog is in the dead-code audit's report.

| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |
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

## Standing guidance

- **Verify first:** check each finding's evidence against the code before fixing; findings are leads. Re-grep before any removal, and grep `apps/stoat-worker` by hand for package exports.
- **One PR per sprint**, as with the security sprints. Make one commit per task, or per sprint when it is tiny. Stage only your own paths with `git commit --only -- <paths>`.
- **Gate every sprint boundary** (`release-mechanics.md` → *Standing verification gate*). Before merging a batch, run the whole-graph gate on a trial merge; the 2026-10-04 preview showed why.
- **Changelogs and versions:** every touched unit gets a version bump and a `CHANGELOG.md` entry. Player-visible web-app or bot fixes also get a root `CHANGELOG-laymans.md` entry, committed on its own.
- **Tracking:** mark executed sprints in their heading **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror the status in each finding and in both reports' status tables.
