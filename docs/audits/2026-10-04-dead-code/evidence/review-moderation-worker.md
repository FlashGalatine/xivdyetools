# Dead-code review: apps/moderation-worker (preview/integration-2026-10-04)

Read-only review. Counts below are `git grep -w` over tracked files in apps/moderation-worker (src prod vs src/tests test files); wider repo checked for the "other" bucket where noted. symrefs.sh timed out on the full list (repo-wide grep per symbol), so an in-unit equivalent was used (`sym.sh` in the session scratchpad; same prod/tests buckets).

## Module map
- src/index.ts: routes /interactions (PING, command, autocomplete, component, modal), /health; handleComponent -> buttons/index.ts; handleModal -> modals.
- handlers/buttons: preset-moderation.ts (approve/reject/revert; revision-bound), ban-confirmation.ts.
- handlers/modals: preset-rejection.ts (reject + revert modal), ban-reason.ts.
- handlers/review-message.ts (new, #225): buildReviewEmbed/buildReviewButtons/refreshReview/editReviewMessage; used by buttons, modals, commands/preset.ts.
- utils/review-custom-id.ts (new, #225): parseReviewCustomId/buildReviewCustomId; the ONE parser for new + legacy ids.
- services: ban-service, preset-api, bot-i18n, i18n; middleware/rate-limit.ts; utils: discord-api, embed-text, env-validation, response, safe-json, sql-helpers, url-sanitizer, verify.
- scripts/register-commands.ts: /preset moderate|ban_user|unban_user; matches switch in commands/preset.ts:81-92 (6 lines removed by #225 left nothing orphaned).

## Commands and results
- `git ls-files apps/moderation-worker` : 35 non-test files, 31 test files.
- Export inventory (grep `^export`) then per-symbol prod/tests counts for ~150 exports. All have prod>=1 except: getPreset (prod=1 = its own definition, tests=7), resetRateLimiterInstance (prod=1 = own definition, tests=7), rateLimitMiddleware (prod refs only in rate-limit.ts docblock + def, tests=4).
- Same-file-only prod refs (exported for tests, used internally): editOriginalResponse/sendMessage/editMessage (called by safe* wrappers), isUserBannedByDiscordId (ban-service.ts:473,570), validateQueryInput (sql-helpers.ts:175), FollowUpOptions, type exports. Live.
- `git grep -w getPreset -- apps/moderation-worker ':!*.test.ts'` -> only preset-api.ts:353 (def) + CHANGELOG.
- `git grep -w rateLimitMiddleware ...` -> rate-limit.ts:20,22 (docblock), :260 def; not imported by index.ts (index.ts uses checkRateLimit/incrementRateLimit directly, lines 292-330, 371-405).
- `members.py src/services/bot-i18n.ts Translator` -> getLocale unitSrc=0 unitTest=13 (extSrc hits are other apps' own getLocale).
- Marker sweep (`@deprecated|TODO|LEGACY|legacy|OBSOLETE|HACK|compat`, non-test): only the #225 legacy-id docs, ban-reason.ts:64-90 / ban-confirmation.ts:70-80 legacy base64 suffix, preset-api.ts:119 (comment about removed v1 header, no code), rate-limit.ts:198,240 ("legacy config" comments).
- Skip/only sweep (`.skip|xit|it.todo|.only|describe.skip`): none.
- vi.mock targets all resolve to existing modules (ban-service, preset-api, discord-api, buttons/index, modals/index, rate-limit, @xivdyetools/auth).
- Env fields: every Env field is read in src (SUBMISSION_LOG_CHANNEL_ID at preset-moderation.ts:227, preset-rejection.ts:169,313; MODERATION_CHANNEL_ID preset.ts:101; RL_* via moderationRateLimitBindings; PRESETS_API/_URL preset-api.ts:87-169). wrangler.toml vars (ENVIRONMENT, DISCORD_CLIENT_ID, PRESETS_API_URL) all read.
- Deps: auth, auth/encoding, bot-logic, logger, types, worker-kit(+/rate-limiter), hono, test-utils (13 test imports), dotenv (scripts/register-commands.ts:14), tsx (package.json script), @types/node (tsconfig types), coverage-v8 (vitest cfg) -> all live.
- DEPRECATIONS.md: nothing listed for moderation-worker as retired (only the presets-api Perspective item).
- dead-code-check.txt: no @testonly/@entrypoint/@public entries in this unit.

## Candidates
1. rateLimitMiddleware (middleware/rate-limit.ts:260): no-op pass-through `await next()`, never mounted; only rate-limit.test.ts (4 refs) and a docblock `@example` (lines 20-22) reference it. Test-only; stale docblock claims "REFACTOR-002 @xivdyetools/rate-limiter" and the middleware usage. Not from #225 (older). srcLines ~14, testLines ~30.
2. getPreset (services/preset-api.ts:353): only caller removed earlier; tests-only (preset-api.test.ts:328-, 7 refs + v2 test mock). The 404->null mapping is exercised only by that test. srcLines ~12, testLines ~40.
3. Translator.getLocale (services/bot-i18n.ts:~203) test-only (13 test refs, 0 in-unit src). Also Translator.t's fallback branch (`value === undefined && this.locale !== 'en'` -> getNestedValue(this.fallbackData...)) is a no-op because constructor sets data === fallbackData === strings (bot-i18n.ts:~163-167); the `locale` field then only feeds the warn log. Borderline.
4. Legacy ban-id suffix path: ban-confirmation.ts:70-80 and ban-reason.ts:59-90 (`legacyEncodedUsername`, base64UrlDecode fallback) for `ban_confirm_{id}_{b64}` / `ban_reason_modal_{id}_{b64}` ids emitted before 2026-08-21 (FINDING-007). Both messages are ephemeral confirmation flows; pre-change ids cannot realistically still be clicked. Not new in this PR. Needs a decision, since tests cover it.
5. incrementRateLimit `_maxRetries` parameter (rate-limit.ts:233): unused, underscore-prefixed, both callers pass literal 3 (index.ts:324,400) solely to reach the `bindings` positional arg. Dead parameter; srcLines ~3.
6. Legacy review-button path (review-custom-id.ts binding:null; preset-moderation.ts refreshInstead :124; preset-rejection.ts :113/:232, tests in *-review.test.ts). NOT dead today: moderation messages posted before 1.8.0 still carry revision-less ids and discord-worker emits bound ids only after its own Sprint 5. File as Legacy/KEEP with a retirement trigger (after the oldest un-actioned moderation embed is past a stated horizon, or all pending presets re-posted), not removal.
7. Duplicated local types: ButtonInteraction defined in both handlers/buttons/index.ts:21 and preset-moderation.ts:46 (identical shape); index.ts local DiscordInteraction (index.ts ~line 60) duplicates exported types/env.ts:76 (whose only importer is commands/preset.ts). Not dead code, consolidation only; low value.

## Positive controls
- Old approve/reject/revert custom_id parsers: none left; resolveClick (preset-moderation.ts:97) and both modals go through parseReviewCustomId. No second parser or old embed builder survives; commands/preset.ts uses buildReviewEmbed/buildReviewButtons (review-message.ts).
- Old prefix-only isValidUuid-after-slice checks replaced; isValidUuid still used by review-custom-id.ts and preset.ts.
- register-commands.ts options match the handler switch.
- Test removals since 9/15 (url-sanitizer.test.ts -268, bot-i18n.test.ts -26) correspond to deleted helpers (DEAD-009/010/011/012 landed, `git log` 225df738, c6aa8c73); no references to the removed helpers remain.

## Rejected (checked, live)
- SUBMISSION_LOG_CHANNEL_ID: read in 3 prod sites (above).
- Two sanitizeErrorMessage (response.ts:188 user-facing; url-sanitizer.ts:122 log redaction used by discord-api.ts:63..268): different jobs, both used.
- resetRateLimiterInstance: resets the real module singleton limiterInstance; a reset hook (accepted category), 7 test uses. Keep.
- isUserBannedByDiscordId, validateQueryInput, editOriginalResponse/sendMessage/editMessage, FollowUpOptions: used inside their files.
- validateSecurityConfig: index.ts:106. isXivAuthUuid: ban-service.ts:489. clampChoiceName: index.ts + preset-api.ts.
- deps (see above), wrangler vars/bindings (RL_*, KV, DB, PRESETS_API all read).

## Prior KEEP register
- DEAD-018/019: not this unit. DEAD-021: not this unit.
- DEAD-020 (fallbacks): rate-limit.ts getLimiter KV fallback and preset-api.ts PRESETS_API_URL HTTP fallback (preset-api.ts:87,169) are present; trigger NOT met (no fallback retirement designed; wrangler dev worker still relies on KV path, env-validation.ts:148 only requires RL_* in production).

## Files covered
All 35 tracked non-test files plus the 31 test files for stale/skip/mock checks.
