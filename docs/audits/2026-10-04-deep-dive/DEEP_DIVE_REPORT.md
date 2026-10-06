# Deep-dive analysis — whole monorepo, as it will be after the 2026-10-04 batch merge (2026-10-04)

- **Branch/commit:** `preview/integration-2026-10-04@80262a2f`. This is a local branch that was never pushed. It is `main@8ecb878f` with the 13 open PRs (#223–#235) merged in, plus the two Sprint 0 fixes from the dead-code audit. Details: [evidence/baseline.md](evidence/baseline.md).
- **Scope:** all 17 workspaces, plus root scripts and CI. **No source file was modified by the audit.**
- **Method:**
  1. Uncached gates and coverage, plus lead lists: 531 source files, 1,257 pattern hits, and the 192 source files changed in 345 commits since the 2026-09-16 deep dive.
  2. 27 slice reviewers read every non-test file of their slice, including each app's `wrangler.toml` and `package.json`.
  3. Four cross-PR contract reviewers traced: revision binding (#224/#225/#227), the retention cron and migration 0015 (#224), the Universalis limiter (#229), and the retired OAuth origin (#228).
  4. A verifier checked every candidate at `file:line` and tagged its origin, either already on `main` or introduced by an open PR. It checked the dead-code catalog for superseded code and the 2026-09-16 rejections for repeats.
  5. An independent skeptic re-derived every bug graded MEDIUM or above. It refuted none, kept 1 HIGH and 47 MEDIUM, and moved 22 MEDIUM to LOW.
  6. A completeness critic found 8 gaps; a gap sweep closed them.
  7. 266 verdicts: 201 confirmed, 63 rejected, 2 superseded. Duplicates found from several slices were merged into one finding each.
- **Totals: 175 findings.**
  - **156 BUG:** 1 HIGH, 35 MEDIUM, 120 LOW. Of these, 17 are untested behaviour.
  - **9 REFACTOR** and **10 OPT.**
  - **8 introduced by open PRs,** all LOW or refactor; the rest are already on `main`. None is CRITICAL.

## Decide before tomorrow's merge

**No finding from this audit blocks the batch merge:**
- every HIGH and MEDIUM finding is already on `main`;
- the eight PR-origin findings are LOW or refactor.

**Two cheap text fixes are worth making inside their PRs before you merge them.** They are only recommended; nothing has been pushed.
- **BUG-063 (#224):** the presets-api 2.4.0 changelog intro says "No schema change and no migration". Its own Rollout section marks hand-running migration 0015 as **Required**. Whoever deploys from the intro would skip the migration.
- **BUG-053 (#225):** the moderation bot's footer still reads `reject <id> <reason>`. `reject` is still valid, but #225 removed its `<reason>` argument (the reason is now typed in a modal). A test pins the old footer.

**The other six PR-origin items can wait for their unit's sprint:**
- BUG-039 (#229): an untested multiplier;
- BUG-052, BUG-054 (#225): a concurrent-click refresh race, and a stale-deploy 404. The 404 case is covered by the documented deploy order;
- BUG-066, BUG-067 (#224): retention-job errors are logged but report success, and an identity re-key has no self-guard;
- REFACTOR-001: the review custom_id grammar is copied into three units.

**A question only you can answer.** Three workers in this batch still route a retired `xivdyetools.projectgalatine.com` hostname. Those route lines are already on `main`; merging these PRs only triggers the production deploys that re-apply them.

| Worker | Hostname | Route | Merged in |
|---|---|---|---|
| api-worker | `proxy.` | `wrangler.toml:110` | #229 |
| presets-api | `api.` | `:72` | #224 |
| moderation-worker | `moderation-bot.` | `:72` | #225 |

- **What the runbook says:** `docs/operations/DOMAIN_DEPRECATION.md` records `auth.`, `bot.` and the apex as removed. It says `api.` and `moderation-bot.` remain (2026-10-04), and records no step on `proxy.`.
- **The open question:** whether anything, `proxy.` especially, was removed in the Cloudflare dashboard after that note.
- **If one was,** a merge re-attaches it, because `wrangler deploy` attaches every custom domain its config lists. It might instead fail if the zone is gone; the repo cannot tell which.
- **If none was,** merging changes nothing.
- Details: [evidence/review-contract-oauth-origin.md](evidence/review-contract-oauth-origin.md).

| ID | PR | Sev/Pri | Finding |
|---|---|---|---|
| [BUG-039](findings/BUG-039.md) | #229 | LOW | router.ts SERVICE_BINDING_BUDGET_MULTIPLIER can drift from the UNIVERSALIS_SERVICE_RATE_LIMITER binding with no failing test |
| [BUG-052](findings/BUG-052.md) | #225 | LOW | review-message.ts refreshReview: a losing concurrent click's 409 refresh overwrites the winner's 'Approved by'/'Reason' embed |
| [BUG-053](findings/BUG-053.md) | #225 | LOW | bot-i18n.ts footerTextOnly advertises the removed `reject <id> <reason>` option; preset.test.ts:446 pins it |
| [BUG-054](findings/BUG-054.md) | #225 | LOW | moderation-worker getModerationPreset treats a missing-route 404 as 'preset gone' and strips live review buttons |
| [BUG-063](findings/BUG-063.md) | #224 | LOW | presets-api 2.4.0 changelog intro denies a migration that its Rollout section requires (0015) |
| [BUG-066](findings/BUG-066.md) | #224 | LOW | retention-job.ts runRetentionJob: prunes swallow D1 errors, so a failed sweep reports success with no durable signal |
| [BUG-067](findings/BUG-067.md) | #224 | LOW | identity-rekey-service rekeyIdentity(db,id,id) silently wipes the user's votes; no self-guard or test |
| [REFACTOR-001](findings/REFACTOR-001.md) | #227 + #225 + #224 | LOW | Review custom_id grammar and status list duplicated across discord-worker, moderation-worker and presets-api with no parity check |

## Catalog

### BUG

| ID | Title | Sev | Type | Deploy unit | Tested? | Origin |
|---|---|---|---|---|---|---|
| [BUG-001](findings/BUG-001.md) | swatch-tool setConfig applies ConfigController's full swatch config (default hairColors/SeekerOfTheSun/Female) over tool-local eyeColors/Midlander/Male state | HIGH | State | apps/web-app | no | MAIN |
| [BUG-002](findings/BUG-002.md) | budget.ts/preferences.ts: validateWorld cold-cache service calls are awaited inside the 3 s ack window | MEDIUM | Resource | apps/discord-worker | no | MAIN |
| [BUG-003](findings/BUG-003.md) | discord-worker's preset webhook (index.ts:402-407) hard-codes kind 'new', so a flagged edit is posted as "New preset pending" with no diff and no Revert button | MEDIUM | Logic | apps/discord-worker | no | MAIN |
| [BUG-004](findings/BUG-004.md) | A preset submitted or edited through the bot is posted twice: discord-worker's own moderation/submission-log post (legacy button ids) plus the presets-api webhook's revision-bound post | MEDIUM | Logic | apps/discord-worker | no | MAIN |
| [BUG-005](findings/BUG-005.md) | command-trace isUserCondition counts the Universalis client's synthetic 408 timeout as an answered 'rejected' outcome | MEDIUM | Logic | apps/discord-worker | no | MAIN |
| [BUG-006](findings/BUG-006.md) | preset-favorites getPresetFavoriteEntries returns [] on read failure and addPresetFavorite overwrites the user's list | MEDIUM | Error handling | apps/discord-worker | no | MAIN |
| [BUG-007](findings/BUG-007.md) | apps/oauth/src/index.ts /auth/* limiter keys and tiers on the raw percent-encoded pathname, while Hono routes on the decoded path | MEDIUM | Logic | apps/oauth | no | MAIN |
| [BUG-008](findings/BUG-008.md) | services/svg/gradient.ts interpolate(): the card ramps in a space derived from algo (Lab for the default ciede2000) and ignores the shared interpolation (page default hsv), so its middle dyes differ from the page | MEDIUM | Logic | apps/og-worker | no | MAIN |
| [BUG-009](findings/BUG-009.md) | gradient.ts generateGradientOG ranks middle-band dyes by hardcoded 'ciede2000' while printing the delta and footer in the requested algo | MEDIUM | Logic | apps/og-worker | no | MAIN |
| [BUG-010](findings/BUG-010.md) | validation-service validatePresetDyes accepts repeated dye ids, bypassing the 3-dye floor and dye_signature dedup | MEDIUM | Edge case | apps/presets-api | no | MAIN |
| [BUG-011](findings/BUG-011.md) | No tool test mounts against a non-default persisted config or asserts that dye filters reach matching (the swatch case is not.toThrow only) | MEDIUM | Untested behavior | apps/web-app | no | MAIN |
| [BUG-012](findings/BUG-012.md) | budget-tool.ts in-page match-line slider writes only local storage; next full budget-config broadcast resets it to ConfigController maxDeltaE | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-013](findings/BUG-013.md) | A stale preserved ?dye= deep link overrides the user's later choice in Budget (Set as budget target) and Harmony (base-dye pick) | MEDIUM | Logic | apps/web-app | no | MAIN |
| [BUG-014](findings/BUG-014.md) | budget-tool.ts handleDeepLink: ?maxDelta= changes matchLine after the slider and label were rendered | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-015](findings/BUG-015.md) | budget-tool.ts findAlternatives has no run guard; a superseded run overwrites this.rows after a newer run | MEDIUM | Race | apps/web-app | no | MAIN |
| [BUG-016](findings/BUG-016.md) | chara-sheet.ts saveCharacterColors: a duplicate record name fails with a generic 'save failed' toast and has no suffix fallback | MEDIUM | Edge case | apps/web-app | no | MAIN |
| [BUG-017](findings/BUG-017.md) | collection-manager-modal.ts: creating from the manager never refreshes the manager list, count or create-limit state | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-018](findings/BUG-018.md) | comparison-tool.ts buildSevenReadouts: the ΔE2000 tier skips tierFor's 0->1 bump, so it contradicts the verdict when matchThreshold < 5 | MEDIUM | Logic | apps/web-app | no | MAIN |
| [BUG-019](findings/BUG-019.md) | gradient/swatch loadFromShareUrl applies share settings to tool-local state only; the next ConfigController notification reverts them | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-020](findings/BUG-020.md) | gradient-tool calculateInterpolation seeds usedDyeIds with endpoints only, so a free step before a pinned step can match the pinned dye undeduplicated | MEDIUM | Logic | apps/web-app | no | MAIN |
| [BUG-021](findings/BUG-021.md) | A language switch empties or hides the results of the Harmony, Mixer, Comparison and Accessibility tools (update() rebuilds the panels without regenerating them) | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-022](findings/BUG-022.md) | Gradient, Swatch, Mixer and Budget never seed dyeFiltersConfig from the persisted config at mount, so saved dye filters are ignored until the sidebar is touched | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-023](findings/BUG-023.md) | swatch-tool setConfig needsReload branch nulls selectedColor but leaves matchedDyes, result cards, SEND TO ids and an enabled share button | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-024](findings/BUG-024.md) | swatch-tool pickCharaSlot sets a slot selectionContext but keeps the earlier grid selectedColor/matchedDyes, so CLOSEST DYES, share and SEND TO describe the old cell | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-025](findings/BUG-025.md) | swatch-tool findMatchingDyes filters after a top-(maxResults*3) request, so strong dye filters return fewer than maxResults; closestDyeTo ignores filters | MEDIUM | Logic | apps/web-app | no | MAIN |
| [BUG-026](findings/BUG-026.md) | preset-tool.test.ts: no coverage of reconcileTombstones, vote handling, tab pools/counts or savedFirst | MEDIUM | Untested behavior | apps/web-app | no | MAIN |
| [BUG-027](findings/BUG-027.md) | config-sidebar.ts connectedCallback: local copies of 9 config keys never refresh after an external ConfigController write | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-028](findings/BUG-028.md) | dye-palette-drawer.ts renderSwatch: swatch is a click-only div, so keyboard users cannot pick a dye from the app-wide picker | MEDIUM | Logic | apps/web-app | no | MAIN |
| [BUG-029](findings/BUG-029.md) | preset-tool reconcileTombstones marks saved community presets "Removed by its author" in three live cases: a swallowed API failure, a saved local- palette, and a stale filtered response | MEDIUM | Race | apps/web-app | no | MAIN |
| [BUG-030](findings/BUG-030.md) | preset-tool.ts handleCardVote: every failed vote is shown as 'already voted'; a failed removeVote is silent | MEDIUM | Error handling | apps/web-app | no | MAIN |
| [BUG-031](findings/BUG-031.md) | community-preset-service response cache never invalidated after delete/edit/submit | MEDIUM | State | apps/web-app | no | MAIN |
| [BUG-032](findings/BUG-032.md) | preset-submission-service.deletePreset failure reported as success by both callers | MEDIUM | Error handling | apps/web-app | no | MAIN |
| [BUG-033](findings/BUG-033.md) | gradient.ts/mixer.ts apply dyeFilters after a capped nearest-N search, so steps report no match although allowed dyes exist | MEDIUM | Logic | packages/bot-logic | no | MAIN |
| [BUG-034](findings/BUG-034.md) | input-resolution.ts resolveColorInput: all-digit 6-char hex without '#' (000000, 333333, 123456) is read as a dye id and returns null | MEDIUM | Edge case | packages/bot-logic | no | MAIN |
| [BUG-035](findings/BUG-035.md) | blending.ts blendHSL interpolates the hue of an achromatic input, which is meaningless (always 0), so grey/white/black mixes get a hue neither input has | MEDIUM | Logic | packages/core | no | MAIN |
| [BUG-036](findings/BUG-036.md) | PaletteService kMeansClustering caps k at pixel count, so images with fewer distinct colours than colorCount return duplicate 0-pixel clusters that discord /extractor renders as rows | MEDIUM | Edge case | packages/core | no | MAIN |
| [BUG-037](findings/BUG-037.md) | index.ts telemetry limiter registered twice; each beacon is charged 2x against the 240/60s fail-closed bucket | LOW | Logic | apps/api-worker | no | MAIN |
| [BUG-038](findings/BUG-038.md) | parseIntParam/parseFloatParam accept trailing garbage and exponent forms in query params | LOW | Edge case | apps/api-worker | no | MAIN |
| [BUG-039](findings/BUG-039.md) | router.ts SERVICE_BINDING_BUDGET_MULTIPLIER can drift from the UNIVERSALIS_SERVICE_RATE_LIMITER binding with no failing test | LOW | Untested behavior | apps/api-worker | no | PR-#229 |
| [BUG-040](findings/BUG-040.md) | XIVAPI_VERSION="latest" makes the chara row-cache namespace constant, so a patch never cold-starts the cache | LOW | State | apps/api-worker | no | MAIN |
| [BUG-041](findings/BUG-041.md) | preview-image.ts puts a raw <@id> mention in the embed footer and drops the preset ID | LOW | Logic | apps/discord-worker | no | MAIN |
| [BUG-042](findings/BUG-042.md) | extractor.ts renderColorSheet: render/edit failure is never logged and is reported to the user as 'no match found' | LOW | Error handling | apps/discord-worker | no | MAIN |
| [BUG-043](findings/BUG-043.md) | gradient.ts processGradientCommand: Start/End lines print the English Dye.name while step rows are localized | LOW | Logic | apps/discord-worker | no | MAIN |
| [BUG-044](findings/BUG-044.md) | harmony.ts and sibling handlers echo the raw colour/dye option into errors.invalidColor embed descriptions with no sanitizeEmbedText or length cap | LOW | Edge case | apps/discord-worker | no | MAIN |
| [BUG-045](findings/BUG-045.md) | stats.ts overview: Avg Cmds/User divides a lifetime total by today's users | LOW | Logic | apps/discord-worker | no | MAIN |
| [BUG-046](findings/BUG-046.md) | Router autocomplete paths for subcommand-group walk (/preset favorite remove), favourites back-fill incl. earlier-audit BUG-028 fix, clan autocomplete and preferences world autocomplete have no index.test.ts coverage. | LOW | Untested behavior | apps/discord-worker | no | MAIN |
| [BUG-047](findings/BUG-047.md) | Favourites name back-fill converts any getPreset failure (5xx/timeout/429, swallowed by .catch(()=>null)) into the preset UUID as the persisted name, which is never retried; names also never refresh on rename and the whole-list write can lose a concurrent favorite add. | LOW | Error handling | apps/discord-worker | no | MAIN |
| [BUG-048](findings/BUG-048.md) | preferences getUserPreferences swallows read failure as {} and the set/reset writes then overwrite or delete the user's whole prefs blob | LOW | Error handling | apps/discord-worker | no | MAIN |
| [BUG-049](findings/BUG-049.md) | preferences.ts getAffectedCommands and the /preferences schema advertise consumers that never read the key (clan/gender, blending->/gradient, matching->/swatch, and /harmony is left out) | LOW | Logic | apps/discord-worker | no | MAIN |
| [BUG-050](findings/BUG-050.md) | preset-moderation.ts processApproval / preset-rejection.ts processRejection: success embed spreads a prior 'Error' field | LOW | State | apps/moderation-worker | no | MAIN |
| [BUG-051](findings/BUG-051.md) | ban-reason.ts handleBanReasonModal: reason length check is untrimmed, so a whitespace-only reason is stored | LOW | Edge case | apps/moderation-worker | no | MAIN |
| [BUG-052](findings/BUG-052.md) | review-message.ts refreshReview: a losing concurrent click's 409 refresh overwrites the winner's 'Approved by'/'Reason' embed | LOW | Race | apps/moderation-worker | partly | PR-#225 |
| [BUG-053](findings/BUG-053.md) | bot-i18n.ts footerTextOnly advertises the removed `reject <id> <reason>` option; preset.test.ts:446 pins it | LOW | Logic | apps/moderation-worker | yes | PR-#225 |
| [BUG-054](findings/BUG-054.md) | moderation-worker getModerationPreset treats a missing-route 404 as 'preset gone' and strips live review buttons | LOW | Error handling | apps/moderation-worker | no | PR-#225 |
| [BUG-055](findings/BUG-055.md) | oauth tests never send a percent-encoded /auth path through the app's limiter or a JSON `null` body to the POST callbacks | LOW | Untested behavior | apps/oauth | no | MAIN |
| [BUG-056](findings/BUG-056.md) | POST /auth/callback and /auth/xivauth/callback destructure a null JSON body outside the parse try, giving a 500 instead of a 400 | LOW | Error handling | apps/oauth | no | MAIN |
| [BUG-057](findings/BUG-057.md) | xivauth.ts roster guard (earlier-audit BUG-051) validates only that the roster is an array; a null element gives a 500, and an empty verified name gives an empty username | LOW | Edge case | apps/oauth | partly | MAIN |
| [BUG-058](findings/BUG-058.md) | index.ts ogCacheKey keys algo and mode on every /og route although only 5 routes read algo and 2 read mode, contradicting its own docblock | LOW | Edge case | apps/og-worker | no | MAIN |
| [BUG-059](findings/BUG-059.md) | og-data-generator.ts generateOGDataForTool: gradient/mixer/harmony crawler ignores hexStart/hexEnd/hexA/hexB/hex slots, so a custom-colour share unfurls the generic tool card | LOW | Edge case | apps/og-worker | no | MAIN |
| [BUG-060](findings/BUG-060.md) | extractor.ts matches by hardcoded ciede2000 and the crawler forwards algo only onto og:url, so the unfurl can name different dyes than the page | LOW | Logic | apps/og-worker | no | MAIN |
| [BUG-061](findings/BUG-061.md) | gradient.test.ts has no algorithm case; harmony.test.ts:233 lists only the six 5.0 spellings and asserts only '<svg' | LOW | Untested behavior | apps/og-worker | no | MAIN |
| [BUG-062](findings/BUG-062.md) | harmony.ts passes a raw legacy ?algo= (hyab/euclidean/oklch-weighted) to core generateHarmonySlots; getDistanceForMethod returns undefined and the card shows dyes in table order | LOW | Edge case | apps/og-worker | no | MAIN |
| [BUG-063](findings/BUG-063.md) | presets-api 2.4.0 changelog intro denies a migration that its Rollout section requires (0015) | LOW | Logic | apps/presets-api | no | PR-#224 |
| [BUG-064](findings/BUG-064.md) | presets PATCH/POST and moderation status/revert: JSON body `null` -> TypeError -> opaque 500 instead of 400 | LOW | Error handling | apps/presets-api | no | MAIN |
| [BUG-065](findings/BUG-065.md) | presets PATCH /:id re-moderates unchanged text; a failing/unscored verdict re-queues an approved (or resubmits a rejected) preset | LOW | Logic | apps/presets-api | partly | MAIN |
| [BUG-066](findings/BUG-066.md) | retention-job.ts runRetentionJob: prunes swallow D1 errors, so a failed sweep reports success with no durable signal | LOW | Error handling | apps/presets-api | partly | PR-#224 |
| [BUG-067](findings/BUG-067.md) | identity-rekey-service rekeyIdentity(db,id,id) silently wipes the user's votes; no self-guard or test | LOW | Untested behavior | apps/presets-api | no | PR-#224 |
| [BUG-068](findings/BUG-068.md) | validation-service name/description min-length counts whitespace; whitespace-only values pass | LOW | Edge case | apps/presets-api | no | MAIN |
| [BUG-069](findings/BUG-069.md) | validation-service validateExampleLink rejects a leading-space link that normalizeExampleLink would accept | LOW | Edge case | apps/presets-api | no | MAIN |
| [BUG-070](findings/BUG-070.md) | stoat about.ts Quick Start advertises unrouted !xd random and an unimplemented ❓-reaction help | LOW | Logic | apps/stoat-worker | no | MAIN |
| [BUG-071](findings/BUG-071.md) | stoat dye-resolver.test.ts multiple/disambiguation tests cannot fail (any-kind else / guarded if) | LOW | Untested behavior | apps/stoat-worker | yes | MAIN |
| [BUG-072](findings/BUG-072.md) | stoat dye-resolver.ts ignores locale and initializeLocale is never called, while help advertises localized names | LOW | Logic | apps/stoat-worker | no | MAIN |
| [BUG-073](findings/BUG-073.md) | stoat dye-resolver.ts resolveDyeInputMulti: step 1 resolveColorInput first-match makes multiple/disambiguation unreachable for name queries | LOW | Logic | apps/stoat-worker | no | MAIN |
| [BUG-074](findings/BUG-074.md) | validate-i18n.js PATTERNS only see single-line literal LanguageService.t/tInterpolate calls, so wrapped calls and the local t() alias are never key-checked | LOW | Untested behavior | apps/web-app | partly | MAIN |
| [BUG-075](findings/BUG-075.md) | budget-tool.test.ts Basic Rendering asserts non-null on test-created panels, so left-panel and drawer rendering is unverified | LOW | Untested behavior | apps/web-app | no | MAIN |
| [BUG-076](findings/BUG-076.md) | No tool test invokes the LanguageService.subscribe callback, so the language-switch rebuild that empties four tools (see the MEDIUM finding) is untested | LOW | Untested behavior | apps/web-app | no | MAIN |
| [BUG-077](findings/BUG-077.md) | tool setConfig tests (mixer maxResults/displayOptions guard/market marker, harmony type regeneration, extractor multi-key) assert only not.toThrow | LOW | Untested behavior | apps/web-app | partly | MAIN |
| [BUG-078](findings/BUG-078.md) | budget-tool.ts ignores persisted ConfigController displayOptions at mount; showHue/Stain/Spectrum always reset to true | LOW | State | apps/web-app | no | MAIN |
| [BUG-079](findings/BUG-079.md) | budget-tool.ts onMount: forces and persists the global market.showPrices=true and never restores it | LOW | State | apps/web-app | no | MAIN |
| [BUG-080](findings/BUG-080.md) | budget-tool.ts / mixer-tool.ts: theme-dependent inline colours are not refreshed on a theme change | LOW | State | apps/web-app | no | MAIN |
| [BUG-081](findings/BUG-081.md) | budget-tool.ts saveSwapRecord breaks 216-gil ties by database order, not by ΔE | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-082](findings/BUG-082.md) | chara-sheet.ts saveCharacterColors: ?? lets an empty or whitespace Nickname beat the file-name/default fallback, so the save always fails | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-083](findings/BUG-083.md) | chara-sheet.ts slot-card click re-renders the whole sheet and drops keyboard focus; selected state has no aria-pressed | LOW | State | apps/web-app | no | MAIN |
| [BUG-084](findings/BUG-084.md) | collection-manager-modal downloadSingleCollection filename strips all non-ASCII (CJK names become dashes) | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-085](findings/BUG-085.md) | comparison-tool.ts ensureActivePair: the index-based pair survives a removal and swaps out the surviving member | LOW | State | apps/web-app | no | MAIN |
| [BUG-086](findings/BUG-086.md) | comparison-tool.ts renders the market price row from its own showMarketPrices flag, while the service's showPrices (default off) blocks fetching | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-087](findings/BUG-087.md) | comparison/accessibility getShareParams: Share stays enabled for an all-custom-colour selection that yields dyes:[] | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-088](findings/BUG-088.md) | dye-selector.ts handleGlobalKeydown: activeElement guard is blind inside the shell's shadow root, so '/' is swallowed in tool inputs | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-089](findings/BUG-089.md) | dye-selector.ts updateFavoritesPanel hardcodes the 8-column grid and overrides compactMode's 3-column favourites layout at mount | LOW | State | apps/web-app | no | MAIN |
| [BUG-090](findings/BUG-090.md) | extractor-tool.ts fetchPricesForRoll: the catch, parseMarketError and lastMarketError are unreachable because every layer below swallows fetch failures | LOW | Error handling | apps/web-app | partly | MAIN |
| [BUG-091](findings/BUG-091.md) | glamour-twin-picker (role=dialog) and item-links-menu never register with ModalService, so global 1-9/Shift+T/L/S shortcuts fire while they hold focus | LOW | State | apps/web-app | no | MAIN |
| [BUG-092](findings/BUG-092.md) | gradient-tool.ts loadSelectedDyes drops persisted custom-colour endpoints and moves the remaining dye into the Start slot | LOW | State | apps/web-app | no | MAIN |
| [BUG-093](findings/BUG-093.md) | swatch/gradient renderLeftPanel rebuilds CollapsiblePanel/MarketBoard/DyeSelector on every update() into the element renderRightPanel clears, without destroying the previous instances | LOW | Resource | apps/web-app | no | MAIN |
| [BUG-094](findings/BUG-094.md) | gradient-tool.ts result-card slot picker (Set as End/Start) has no same-dye guard, and endpoint rows render cards | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-095](findings/BUG-095.md) | harmony-tool.ts renderRightPanel: each render adds a new matchMedia listener; destroy removes only the last | LOW | Resource | apps/web-app | no | MAIN |
| [BUG-096](findings/BUG-096.md) | image-zoom-controller.ts Ctrl-drag pan ignores the centring margin, so a fitted image jumps on the first pan move | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-097](findings/BUG-097.md) | image-zoom-controller.ts touch handlers: a second finger does not cancel the drag, so a two-finger gesture commits a colour sample on lift | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-098](findings/BUG-098.md) | mixer-tool.ts loadSelectedDyes: a legacy third slot is restored, giving an equal-weight 3-way blend | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-099](findings/BUG-099.md) | mixer-tool.ts renderMixingField: a cell with no eligible match prints ΔE 0.0 | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-100](findings/BUG-100.md) | modal-container.ts attachSheetDrag: ignores inner scrollers and touchcancel on mobile sheets | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-101](findings/BUG-101.md) | my-submissions-modal.ts: after a successful delete the modal keeps showing the deleted preset and stale stats | LOW | State | apps/web-app | no | MAIN |
| [BUG-102](findings/BUG-102.md) | preset-submission-form.ts: dismissTop() after awaited submit/upload can close the wrong modal; unguarded sessionStorage write inside the submit try | LOW | Race | apps/web-app | no | MAIN |
| [BUG-103](findings/BUG-103.md) | swatch-tool registers its window resize listener with this.on in onMount; BaseComponent.update() unbinds it on a language switch and never re-adds it | LOW | State | apps/web-app | no | MAIN |
| [BUG-104](findings/BUG-104.md) | swatch-tool.ts updateHandoffRow: SEND TO does a full reload with window.location.assign, so the in-memory .chara session is dropped | LOW | State | apps/web-app | no | MAIN |
| [BUG-105](findings/BUG-105.md) | toast-container.ts: full rebuild on each change replays animations and re-announces alerts; Escape closes toast and modal together | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-106](findings/BUG-106.md) | tutorial-spotlight.ts: window-only scroll listener and a fixed 100ms measurement leave the spotlight off-target after a container smooth-scroll | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-107](findings/BUG-107.md) | dye-palette-drawer.ts filterByType: Metallic chip matches English name (14) instead of the gloss set isMetallic (16) | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-108](findings/BUG-108.md) | preset-detail.ts checkVoteStatus: a failed hasVoted check overwrites the vote count with 0 | LOW | Error handling | apps/web-app | partly | MAIN |
| [BUG-109](findings/BUG-109.md) | preset-tool.ts categoryCount/renderTabs: counts ignore feedBlend, feedHideUnbuyable, keepDeleted and the saved search, and the Saved badge omits local palettes | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-110](findings/BUG-110.md) | preset-tool.ts handleVoteUpdate: votedIds is not synced from the detail view, so card and detail vote state diverge | LOW | State | apps/web-app | no | MAIN |
| [BUG-111](findings/BUG-111.md) | result-card.ts handleMenuClick/handleSelectClick: stopPropagation keeps other cards' open menus from closing | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-112](findings/BUG-112.md) | v4-layout-shell.ts static styles have no @media print: browser print is one clipped page including chrome | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-113](findings/BUG-113.md) | v4-layout-shell.ts re-emits composed child events without stopPropagation, so v4-layout handlers run twice | LOW | Logic | apps/web-app | no | MAIN |
| [BUG-114](findings/BUG-114.md) | main.ts:126 non-critical tutorial-spotlight import failure triggers renderFatalError over the already-rendered shell | LOW | Error handling | apps/web-app | no | MAIN |
| [BUG-115](findings/BUG-115.md) | auth-service performLogout awaits /auth/revoke with no timeout before clearing local session | LOW | Error handling | apps/web-app | no | MAIN |
| [BUG-116](findings/BUG-116.md) | chara-resolve-service resolveCharaEquipment sends unbounded model lanes/glasses id; one lane >0xffff 400s the whole resolve and the Reader reports an outage | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-117](findings/BUG-117.md) | CollectionService.initialize re-enters and overflows the stack when a migration save fails | LOW | State | apps/web-app | no | MAIN |
| [BUG-118](findings/BUG-118.md) | collection-service importData: earlier-audit BUG-024 guard dereferences a null collections[] element outside the per-record try | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-119](findings/BUG-119.md) | indexeddb-service has no db.onversionchange handler, so an open tab blocks a future DB_VERSION upgrade and the other tab caches initialize()=false | LOW | State | apps/web-app | no | MAIN |
| [BUG-120](findings/BUG-120.md) | keyboard-service digit tool shortcuts unreachable from the AZERTY number row | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-121](findings/BUG-121.md) | LanguageService.setLocale has no sequencing; overlapping calls desync core and web locales | LOW | Race | apps/web-app | no | MAIN |
| [BUG-122](findings/BUG-122.md) | LanguageService.tInterpolate expands $ patterns in user-supplied values | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-123](findings/BUG-123.md) | palette-export.ts:136 today() stamps exports with the UTC date, not the local date | LOW | Edge case | apps/web-app | no | MAIN |
| [BUG-124](findings/BUG-124.md) | glamour.ts gposersList writes the 'Model <key>' placeholder as an item name and drops Facewear when glasses are unresolved | LOW | Logic | packages/bot-logic | no | MAIN |
| [BUG-125](findings/BUG-125.md) | execute* final 'catch {}' blocks discard the exception and return GENERATION_FAILED; adapters log only the code | LOW | Error handling | packages/bot-logic | partly | MAIN |
| [BUG-126](findings/BUG-126.md) | locale-resolution.ts resolveUserLocale never passes a logger to getLegacyLanguagePreference, so the 'louder' KV-failure log never fires | LOW | Error handling | packages/bot-logic | partly | MAIN |
| [BUG-127](findings/BUG-127.md) | bot-logic branch coverage 88.38% (502/568) is below its own 90% vitest threshold; glamour.ts has 25 uncovered branches; CI never enforces it | LOW | Untested behavior | packages/bot-logic | no | MAIN |
| [BUG-128](findings/BUG-128.md) | build-locales.ts writes locale JSONs before exiting 1 on missing cells, and never checks dyes.json ids against dyenames.csv rows | LOW | Error handling | packages/core | no | MAIN |
| [BUG-129](findings/BUG-129.md) | blendColors lets a NaN ratio through Math.max/Math.min and returns the invalid hex '#NaNNaNNaN' | LOW | Edge case | packages/core | no | MAIN |
| [BUG-130](findings/BUG-130.md) | dyes.json English name 'Opo-Opo Brown' disagrees with en.json/dyenames.csv 'Opo-opo Brown' (stainID 24, itemID 5752) | LOW | Logic | packages/core | no | MAIN |
| [BUG-131](findings/BUG-131.md) | CharacterColorService.findClosestDyes earlier-audit BUG-056 guard misses NaN/non-number count -> TypeError on best[-1] | LOW | Edge case | packages/core | no | MAIN |
| [BUG-132](findings/BUG-132.md) | DyeService.searchByLocalizedName returns all 125 dyes for an empty or whitespace query when the locale is loaded | LOW | Edge case | packages/core | no | MAIN |
| [BUG-133](findings/BUG-133.md) | chara-parser parseFloatColor accepts empty segments as 0 (and Infinity), producing a silent wrong lip/colour | LOW | Edge case | packages/core | no | MAIN |
| [BUG-134](findings/BUG-134.md) | ColorAccessibility.isLightColor/getOptimalTextColor use a luminance threshold of 0.5, which picks the lower-contrast text for luminance between about 0.18 and 0.5 | LOW | Logic | packages/core | partly | MAIN |
| [BUG-135](findings/BUG-135.md) | ColorConverter.hsvToRgb caches under a key rounded to 2 dp but stores the result computed from the unrounded inputs, so the output depends on call order | LOW | State | packages/core | no | MAIN |
| [BUG-136](findings/BUG-136.md) | DyeDatabase.initialize accepts an all-invalid payload as a loaded empty DB, and duplicate ids only log through the NoOp logger | LOW | Error handling | packages/core | no | MAIN |
| [BUG-137](findings/BUG-137.md) | HarmonySelector.generateHarmonySlots reserves a pinned dye only for later slots under preventDuplicates, so an earlier slot can choose the same dye | LOW | State | packages/core | no | MAIN |
| [BUG-138](findings/BUG-138.md) | DyeSearch.test.ts findClosestDye/findDyesWithinDistance tests pass on null or empty results | LOW | Untested behavior | packages/core | partly | MAIN |
| [BUG-139](findings/BUG-139.md) | HarmonySelector.test.ts pin test pins Jet Black, a dye no earlier slot picks, so it cannot detect the earlier-slot duplicate | LOW | Untested behavior | packages/core | no | MAIN |
| [BUG-140](findings/BUG-140.md) | logger context string values skip sanitizeErrorMessage key=value/JSON-key redaction | LOW | Logic | packages/logger | no | MAIN |
| [BUG-141](findings/BUG-141.md) | logger redactSensitiveFields spread-copies toJSON objects (Date/URL), logging them as {} | LOW | Edge case | packages/logger | no | MAIN |
| [BUG-142](findings/BUG-142.md) | contrast-card.ts tone/tier judged on the raw ratio while 13C·1 prints it rounded to 1 dp (2.96 shows '3.0' in failing red) | LOW | Edge case | packages/svg | no | MAIN |
| [BUG-143](findings/BUG-143.md) | emitted-glyphs.ts scanner fails open on \u escapes in literals and on a keyword-preceded regex (return /'/) | LOW | Edge case | packages/svg | no | MAIN |
| [BUG-144](findings/BUG-144.md) | frame-budget.test.ts type-floor/text-extent gate omits glamour, swatch, a11y, dye-info and budget-ledger cards | LOW | Untested behavior | packages/svg | no | MAIN |
| [BUG-145](findings/BUG-145.md) | glamour-card.ts look label drawn at 10.5 px, below the documented 11 px type floor | LOW | Logic | packages/svg | no | MAIN |
| [BUG-146](findings/BUG-146.md) | gradient.ts ROW_WIDTHS.lead=28 ellipsises two-digit merged step ranges ('9–10' -> '9–…', '10–12' -> '10…') | LOW | Edge case | packages/svg | no | MAIN |
| [BUG-147](findings/BUG-147.md) | test-utils createMockD1Database first() returns undefined (real D1: null) when the mock fn returns undefined | LOW | Edge case | packages/test-utils | no | MAIN |
| [BUG-148](findings/BUG-148.md) | test-utils KV/R2 mock list(): cursor resume never ends when the cursor's key was deleted; insertion order instead of lexicographic | LOW | Edge case | packages/test-utils | no | MAIN |
| [BUG-149](findings/BUG-149.md) | worker-kit jsonDepthLimit: case-sensitive Content-Type check lets oauth JSON bodies skip the depth/__proto__ guard | LOW | Edge case | packages/worker-kit | no | MAIN |
| [BUG-150](findings/BUG-150.md) | worker-kit rateLimitMiddleware deny paths drop Retry-After/X-RateLimit-* when formatError returns a raw Response | LOW | Logic | packages/worker-kit | no | MAIN |
| [BUG-151](findings/BUG-151.md) | worker-kit KVRateLimiter.reset/resetAll read a single kv.list page (no cursor loop) | LOW | Edge case | packages/worker-kit | no | MAIN |
| [BUG-152](findings/BUG-152.md) | ci.yml workflow-level concurrency ci-${{ github.ref }} + cancel-in-progress: true cancels main-push and nightly-schedule runs against each other | LOW | Race | root (CI/scripts) | no | MAIN |
| [BUG-153](findings/BUG-153.md) | Production deploy workflows' paths filters omit pnpm-lock.yaml / pnpm-workspace.yaml / turbo.json / tsconfig.base.json | LOW | Edge case | root (CI/scripts) | no | MAIN |
| [BUG-154](findings/BUG-154.md) | publish-packages.yml Publish loop records FAILED+= and keeps publishing dependents of a failed package | LOW | Error handling | root (CI/scripts) | no | MAIN |
| [BUG-155](findings/BUG-155.md) | check-dead-code.ts findOrphanModules / findTestOnlyMembers read EXCLUDED_REFERRERS raw instead of via referrerTexts | LOW | Logic | root (CI/scripts) | no | MAIN |
| [BUG-156](findings/BUG-156.md) | check-doc-versions.ts promises failure on a non-semver version claim but silently drops the row | LOW | Untested behavior | root (CI/scripts) | no | MAIN |

### REFACTOR

| ID | Title | Pri | Effort | Deploy unit | Origin |
|---|---|---|---|---|---|
| [REFACTOR-001](findings/REFACTOR-001.md) | Review custom_id grammar and status list duplicated across discord-worker, moderation-worker and presets-api with no parity check | LOW | MEDIUM | apps/discord-worker | PR-#227 + PR-#225 + PR-#224 |
| [REFACTOR-002](findings/REFACTOR-002.md) | searchPresetsForAutocomplete is called without logger, so its catch returns [] silently while the user-presets path logs. | LOW | LOW | apps/discord-worker | MAIN |
| [REFACTOR-003](findings/REFACTOR-003.md) | budget-calculator.ts mirrors the svg ledger geometry with literals (350-43-27, 24, 40, 32, 47) instead of the exported LEDGER_* constants | LOW | LOW | apps/discord-worker | MAIN |
| [REFACTOR-004](findings/REFACTOR-004.md) | glamour-block DYEABLE_SLOTS duplicates core chara-gposers private DYEABLE with a 'change both' comment | LOW | LOW | apps/web-app | MAIN |
| [REFACTOR-005](findings/REFACTOR-005.md) | swatch-tool.ts (3146 lines) and gradient-tool.ts (2755 lines): duplicated desktop/mobile selector code already drifts (mobile steps skip pinnedSteps.clear), a dead left panel and drawer, and a mojibake literal at gradient-tool.ts:825 | LOW | HIGH | apps/web-app | MAIN |
| [REFACTOR-006](findings/REFACTOR-006.md) | auth JWTPayload doc falsely claims a re-export from types and mislabels sub | LOW | LOW | packages/auth | MAIN |
| [REFACTOR-007](findings/REFACTOR-007.md) | logger orphaned MAX_STRINGIFY_NODES JSDoc sits above AUTH_SCHEMES | LOW | LOW | packages/logger | MAIN |
| [REFACTOR-008](findings/REFACTOR-008.md) | Stale comments: ci.yml check-bundle-size scope, web-app vitest coverage-report baseline, orphaned docblock above asReferrers | LOW | LOW | root (CI/scripts) | MAIN |
| [REFACTOR-009](findings/REFACTOR-009.md) | OPEN_ITEMS Phase 0 entry and DOMAIN_DEPRECATION inventory line numbers are stale | LOW | LOW | root (CI/scripts) | MAIN |

### OPT

| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
| [OPT-001](findings/OPT-001.md) | main.ts:111 boot awaits getServicesStatus() network probe used only by a dev-only log, delaying the v4 shell | MEDIUM | I/O | apps/web-app |
| [OPT-002](findings/OPT-002.md) | chara acquisition/ko/zh JSON tables (3.4 MB raw) are evaluated at isolate start for every route | LOW | Bundle | apps/api-worker |
| [OPT-003](findings/OPT-003.md) | preset.ts favorite list fans out one getPreset per favourite (up to 50) | LOW | I/O | apps/discord-worker |
| [OPT-004](findings/OPT-004.md) | stats.ts summary pages all of today's user keys it never displays | LOW | I/O | apps/discord-worker |
| [OPT-005](findings/OPT-005.md) | preferences legacy-key migration re-reads two dead KV keys on every call for users with no prefs blob | LOW | I/O | apps/discord-worker |
| [OPT-006](findings/OPT-006.md) | renderer.ts renderSvgToPng never .free()s Resvg or RenderedImage, leaving each render's wasm allocations to FinalizationRegistry timing | LOW | Memory | apps/og-worker |
| [OPT-007](findings/OPT-007.md) | mixer-tool.ts field-cell click renders the field twice; harmony-tool.ts market change runs a superseded price pass | LOW | Algorithm | apps/web-app |
| [OPT-008](findings/OPT-008.md) | preset-tool.ts handleSearchInput/sort: refetches the API pool with a spinner on Saved/Mine tabs whose pools are local | LOW | I/O | apps/web-app |
| [OPT-009](findings/OPT-009.md) | IndexedDBCacheBackend.loadFromStorage hydrates the price cache with one serial readonly transaction per key | LOW | I/O | apps/web-app |
| [OPT-010](findings/OPT-010.md) | logger redactSensitiveFields rebuilds the normalized redact Set per node per call | LOW | Caching | packages/logger |

### Superseded by the 2026-10-04 dead-code audit

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` in swatch/gradient | `2026-10-04-dead-code/DEAD-003` | the `copy-hex` context action is never emitted; DEAD-003 removes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | `2026-10-04-dead-code/DEAD-008` | test-only preset; DEAD-008 removes it |

## Status basis

Nothing was fixed during the analysis; every row is OPEN. The audit modified no source file.

## Positive controls

Verified at the commit and not worth re-filing next time. Per-slice detail is in `evidence/review-*.md`.

- **Character names never leave the device:**
  - web-app's resolve request sends only gear model keys and the glasses id;
  - `/glamour` and `/swatch` never destructure the nickname;
  - the glamour `.md` export and its file name carry no name;
  - parse-error text is sanitized before it reaches a public embed.
  - **Exception, disclosed in PRIVACY.md:** on-device collection saves can keep a nickname-derived record name. Collection exports and their file names then carry it.
- **The revision-bound moderation flow is sound end to end:**
  - presets-api's conditional UPDATE binds revision and status, with a `changes()`-gated audit row in one batch;
  - the AFTER trigger cannot recurse;
  - moderation-worker has one strict parser, and every legacy or 409 click refreshes and never acts.
- **The #224 retention cron is wired as claimed:**
  - production-only (`[env.production.triggers]`, pinned by a test);
  - `allSettled` inside `waitUntil`;
  - timestamp formats match each column's writers.
- **The #229 limiter contract matches both `wrangler.toml` blocks.** Namespace ids are unique account-wide, the service scope is detected the same way as in `/v1` middleware, and a binding typo fails a test.
- **#228 removed the retired origin** from the shared authorize/callback allowlist, and a test asserts no `projectgalatine` origin in production.
- **OAuth:** the state HMAC is constant-time with `exp` enforced; S256 PKCE binds to the signed state before any upstream call; JWTs are pinned to HS256 with claim types validated.
- **Edge hardening:** every api-worker upstream fetch has `redirect: 'manual'` and a 10 s timeout, and streaming body caps hold. image-worker's pre-decode dimension gate fails closed.
- **Committed core data is byte-equivalent to the generator's output:**
  - committed core locale JSON matches `build-locales.ts` output, with all 125 ids in all 6 locales;
  - schema-v2 dye data is consistent: consolidation groups, metallic set and the frozen facewear map.
- **Teardown:** every subscription and listener in the v4 shell, sidebar, drawer and header is torn down; `v4-layout` navigation sequencing guards after every await.
- **CI gate:** `check-worker-logs.ts` is fail-closed and thorough, and all four repo gates exit 0 at this commit.

## Rejected suspicions

All 63 rejections are in [evidence/verdicts.tsv](evidence/verdicts.tsv), each with its reason. These are the ones most likely to be re-chased:

- **Decided behaviour, not defects:**
  - **Disclosed in PRIVACY.md:**
    - a file loaded in Swatch is sent for name resolution when the Glamour Reader opens;
    - on-device saves fall back to the character nickname.
  - **Documented elsewhere:**
    - the lazy write-path prunes in presets-api stay beside the cron;
    - Pages middleware runs on every request;
    - the Discord service bindings are shared between dev and production.
- **Unreachable in production:**
  - `DyeGrid` and `CollapsiblePanel` paths that the only mount path (`v4-layout.ts:600-706`) never builds;
  - image-worker's null-JSON `/extract` (no routes, service binding only);
  - the bot editing a pending preset (presets-api returns 404 first).
- **Misread runtime:**
  - a non-Latin1 `X-User-Discord-Name` header does not throw on workerd (probed with miniflare);
  - a listener exception in jsdom does fail the run (probed with a temporary repro test).
- **Already rejected in earlier audits:**
  - per-IP limiter keys not bucketing IPv6 /64 (2026-08-29 security);
  - the retired-domain routes still in `wrangler.toml`: the runbook's documented order is to delete the route line, deploy, then remove the dashboard domain. They stay a question for you, above.
- **Earlier deep-dive fixes that hold:** these were re-checked and still hold:
  - modal-stack listener re-binding;
  - the preset vote-check generation guard;
  - `v4-layout` navigation sequencing;
  - the OAuth state and return-path handling in `auth-service`;
  - the preset-edit baseline;
  - swatch's colours request versioning.

## Recommendations

1. **Make `ConfigController` the single owner of tool settings.** BUG-001 (HIGH), BUG-019, BUG-022, BUG-027 and BUG-012 are one design gap: each tool keeps local copies that a full-config broadcast overwrites, or that it never seeds. Test with a real controller; the current mocks never fire `subscribe`, which is why none of this was caught.
2. **Every tool suite should mount against a non-default persisted config and fire one language switch** (BUG-011, BUG-076). Four tools empty their results on a language switch today (BUG-021).
3. **Run `test:coverage` in CI, or drop the thresholds that nothing enforces.** bot-logic sits at 88.38 % branches against its own 90 % (BUG-127).
4. **Pick one moderation-notification path** (BUG-004, BUG-003). Today the bot and the presets-api webhook both post for bot submissions, and the webhook renders every edit as new.
5. **Harden request handling worker-wide.** Each of these is a small shared helper:
   - **Null JSON bodies:** they reach handlers as a 500 (BUG-056, BUG-064).
   - **Limiter keys:** oauth's `/auth/*` limiter keys on the raw percent-encoded path while Hono routes on the decoded one (BUG-007).
   - **Content-Type case:** a case-sensitive check skips worker-kit's JSON depth guard (BUG-149).
6. **Share the review `custom_id` grammar** (REFACTOR-001) through one package, or add a parity test across the three units, before the next format change.
7. **Keep asking "what edit would make this test fail?"** This round added BUG-071, BUG-075, BUG-138, BUG-139 and BUG-144 to the 2026-09-16 list.
8. **Run the whole-graph gate on a trial merge of each batch,** as the dead-code audit recommends: the affected-only CI filter cannot see cross-unit contracts.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| BUG-001 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-002 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-003 | FIX COMMITTED, NOT DEPLOYED (PR #256 + PR #257, open) | `8c264798`, `f1174a47`, `a9dac980` |
| BUG-004 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-005 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-006 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-007 | OPEN | — |
| BUG-008 | OPEN | — |
| BUG-009 | OPEN | — |
| BUG-010 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-011 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-012 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-013 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-014 | FIX COMMITTED, NOT DEPLOYED (PR #244, open, Sprint 1 not 5) | `f20683f8` + `68599b74` |
| BUG-015 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-016 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-017 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-018 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-019 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-020 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-021 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-022 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-023 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-024 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-025 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-026 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-027 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-028 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-029 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-030 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-031 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-032 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-033 | OPEN | — |
| BUG-034 | OPEN | — |
| BUG-035 | OPEN | — |
| BUG-036 | OPEN | — |
| BUG-037 | OPEN | — |
| BUG-038 | OPEN | — |
| BUG-039 | OPEN | — |
| BUG-040 | OPEN | — |
| BUG-041 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-042 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-043 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-044 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-045 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-046 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-047 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-048 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-049 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| BUG-050 | OPEN | — |
| BUG-051 | OPEN | — |
| BUG-052 | OPEN | — |
| BUG-053 | FIXED 2026-10-05 (PR #225) | `6f2bb05c` |
| BUG-054 | OPEN | — |
| BUG-055 | OPEN | — |
| BUG-056 | OPEN | — |
| BUG-057 | OPEN | — |
| BUG-058 | OPEN | — |
| BUG-059 | OPEN | — |
| BUG-060 | OPEN | — |
| BUG-061 | OPEN | — |
| BUG-062 | OPEN | — |
| BUG-063 | FIX COMMITTED, NOT DEPLOYED (PR #224 + PR #256, open) | `12e7f887`, `b7b8500b` |
| BUG-064 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-065 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-066 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-067 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-068 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-069 | FIX COMMITTED, NOT DEPLOYED (PR #256, open) | `8c264798` |
| BUG-070 | OPEN | — |
| BUG-071 | OPEN | — |
| BUG-072 | OPEN | — |
| BUG-073 | OPEN | — |
| BUG-074 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `2023108b` |
| BUG-075 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-076 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| BUG-077 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-078 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-079 | FIX COMMITTED, NOT DEPLOYED (PR #244, open) | `f20683f8` + `68599b74` |
| BUG-080 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-081 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-082 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-083 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-084 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-085 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-086 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-087 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-088 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-089 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-090 | FIX COMMITTED, NOT DEPLOYED (PR #254, open) | `742a3061` + `647d8f9c` |
| BUG-091 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-092 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-093 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-094 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-095 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-096 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-097 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-098 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-099 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-100 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-101 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-102 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-103 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-104 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-105 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-106 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-107 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-108 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-109 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-110 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| BUG-111 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| BUG-112 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-113 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-114 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-115 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-116 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-117 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-118 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-119 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-120 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `3d5b84bd` |
| BUG-121 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-122 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-123 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| BUG-124 | OPEN | — |
| BUG-125 | OPEN | — |
| BUG-126 | OPEN | — |
| BUG-127 | OPEN | — |
| BUG-128 | OPEN | — |
| BUG-129 | OPEN | — |
| BUG-130 | OPEN | — |
| BUG-131 | OPEN | — |
| BUG-132 | OPEN | — |
| BUG-133 | OPEN | — |
| BUG-134 | OPEN | — |
| BUG-135 | OPEN | — |
| BUG-136 | OPEN | — |
| BUG-137 | OPEN | — |
| BUG-138 | OPEN | — |
| BUG-139 | OPEN | — |
| BUG-140 | OPEN | — |
| BUG-141 | OPEN | — |
| BUG-142 | OPEN | — |
| BUG-143 | OPEN | — |
| BUG-144 | OPEN | — |
| BUG-145 | OPEN | — |
| BUG-146 | OPEN | — |
| BUG-147 | OPEN | — |
| BUG-148 | OPEN | — |
| BUG-149 | OPEN | — |
| BUG-150 | OPEN | — |
| BUG-151 | OPEN | — |
| BUG-152 | OPEN | — |
| BUG-153 | OPEN | — |
| BUG-154 | OPEN | — |
| BUG-155 | OPEN | — |
| BUG-156 | OPEN | — |
| REFACTOR-001 | OPEN | — |
| REFACTOR-002 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| REFACTOR-003 | OPEN | — |
| REFACTOR-004 | FIX COMMITTED, NOT DEPLOYED (PR #254, open) | `742a3061` + `647d8f9c` |
| REFACTOR-005 | FIX COMMITTED, NOT DEPLOYED (PR #255, open) | `51a058de` + `ccda155f` + `7c187084` |
| REFACTOR-006 | OPEN | — |
| REFACTOR-007 | OPEN | — |
| REFACTOR-008 | OPEN | — |
| REFACTOR-009 | PARTIALLY FIXED 2026-10-05 (OPEN_ITEMS half; DOMAIN_DEPRECATION in Sprint 20) | `223b839f` |
| OPT-001 | FIX COMMITTED, NOT DEPLOYED (PR #247, open) | `665bf564` + `ad87be42` |
| OPT-002 | OPEN | — |
| OPT-003 | OPEN (needs presets-api `?ids=`) | — |
| OPT-004 | FIX COMMITTED, NOT DEPLOYED (PR #257, open) | `a9dac980` |
| OPT-005 | PARTIALLY FIXED (PR #257, open) | `a9dac980` |
| OPT-006 | OPEN | — |
| OPT-007 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `ccfc0d81` |
| OPT-008 | FIX COMMITTED, NOT DEPLOYED (PR #245, open) | `ce5d71cf` + `b667d98d` |
| OPT-009 | FIX COMMITTED, NOT DEPLOYED (PR #252, open) | `8a826c40` |
| OPT-010 | OPEN | — |

## Next steps

[REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) is one merged plan for this catalog and the 2026-10-04 dead-code catalog. It supersedes that audit's `CLEANUP_PLAN.md`.
- Correctness first: the HIGH and the MEDIUM bugs.
- One deploy unit per sprint, with the dead-code cleanups folded into their unit's sprint.
- Package publishes before their consumers' deploys.
- Structural refactors last.

Nothing is changed until the maintainer approves the plan.
