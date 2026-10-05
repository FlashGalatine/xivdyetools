# review-gap-2: XIVAuth ban and identity contract (FINDING-014; PR #224/#225/#228)

## Map
| Step | Where | Value |
|---|---|---|
| oauth mints JWT | apps/oauth/src/services/jwt-service.ts:129,142 | `sub = users.id` (internal UUID, `crypto.randomUUID()` at user-service.ts:93); `discord_id = users.discord_id` |
| XIVAuth login | apps/oauth/src/handlers/xivauth.ts:354-360 | `findOrCreateUser` finds by `xivauth_id` first (user-service.ts:73), so a later Discord link keeps the SAME `users.id` |
| acting id (web) | apps/presets-api/src/middleware/auth.ts:71-77, 361-376 | snowflake if present, else `sub`; `jwtSub`/`jwtDiscordId` set ONLY here |
| acting id (bot) | auth.ts ~296-345 | `X-User-Discord-ID` snowflake only; `jwtSub`/`jwtDiscordId` never set |
| ban check | middleware/ban-check.ts:48-64,147 | `discord_id IN ids OR xivauth_id IN ids`, ids = [acting, sub, discord_id] |
| ban write | apps/moderation-worker/src/services/ban-service.ts:489-507 | target = `presets.author_discord_id`; UUID target is written to BOTH `discord_id` and `xivauth_id` |
| re-key | presets.ts:333-398 (PATCH /refresh-author) -> identity-rekey-service.ts:39 | web login only, unbanned only |

## Answers to the task's questions
1. `banned_users.xivauth_id` holds `users.id` (the internal UUID), NOT the XIVAuth account UUID `users.xivauth_id`. A UUID-keyed author's `presets.author_discord_id` is `resolveJWTUserId` = `sub` = `users.id`, and the moderator picks that value (ban-service.ts:105-110 autocomplete, :489 `isXivAuthUuid`). The column name is misleading; no code outside oauth ever sees the XIVAuth account UUID.
2. presets-api's IN clause DOES match it on the web path: `jwtSub` = `users.id` (auth.ts:371, ban-check.ts:147). Both sides agree. The "Sprint 4" and "Sprint 6" remarks in ban-check.ts:30,41 are stale: banUser already writes `xivauth_id` (ban-service.ts:489,503).
3. Scenario (XIVAuth-only author banned, then links Discord, then bot `/preset submit`): `isUserBanned` returns FALSE. See gap2-01.
4. `rekeyIdentity` trigger: only `PATCH /refresh-author`, only web auth, only `jwtSub && jwtDiscordId && sub != discordId`, only when `isUserBanned([sub, discordId])` is false (presets.ts:368-380). Never invoked from the bot path. presets-core-05 is the unrelated ORDER BY tiebreaker finding, not a rekey trigger; the relevant sibling is presets-core-06 (equal ids), already filed.

## Candidates

### gap2-01 | BUG | HIGH | apps/presets-api/src/middleware/ban-check.ts:147 (bot branch auth.ts ~296-345) | PR-#224
Claim: a ban on an XIVAuth-only identity (UUID U) is shed on the bot path once the account links Discord (snowflake S). The bot supplies only S; `jwtSub`/`jwtDiscordId` are web-branch-only, so ids = [S] and no `banned_users` row (discord_id=U, xivauth_id=U) matches. presets-api's database has no S<->U mapping (it lives in oauth's users table), and the re-key is deliberately skipped for banned ids.
Failing state: banned_users(discord_id=U, xivauth_id=U); user links Discord on the web (same users.id U, discord_id=S); user runs `/preset submit` or edit in Discord.
Wrong outcome: `requireNotBanned` -> `isUserBanned(db,[S, undefined, undefined])` false -> submission accepted under author S. `hideUserPresetsStatement` hides only author=U rows, never S. The web path blocks the same user (ids include U), so the ban holds on one surface and not the other. The 2026-10-03 fix closed the web half only.
Tests: identity-rekey.test.ts:120-150 covers only tokens carrying both ids; no bot-auth (X-User-Discord-ID) test. Covered: no.
Excerpt:
  ban-check.ts:147  isUserBanned(c.env.DB, [auth.userDiscordId, auth.jwtSub, auth.jwtDiscordId])
  auth.ts:371       jwtSub: jwtPayload.sub,   // inside the web branch only
Fix direction: persist the S<->U link in presets-api at web sign-in (a small `identity_links` table written by refresh-author BEFORE and independent of the ban/re-key skip), and have `isUserBanned` expand a lone snowflake through it; or have moderation-worker, when banning a UUID, resolve its `discord_id` via oauth and record it too.

### gap2-02 | BUG | LOW | apps/presets-api/src/handlers/presets.ts:368-380 | PR-#224
Claim: for a banned XIVAuth-only user who links Discord, rows authored later as S (bot path, gap2-01) are never re-keyed or unified with U; refresh-author returns `rekeyed:false` silently. After an unban it self-heals on the next web login (identity-rekey.test.ts:262). Latent and bounded.
Failing input: ban U, link Discord, bot-submit as S, unban. Wrong outcome: presets split across two author ids until next web sign-in. Covered: partly. Fix: same identity link as gap2-01.

### gap2-03 | REFACTOR | LOW | apps/presets-api/src/middleware/ban-check.ts:22-47; apps/moderation-worker/src/services/ban-service.ts:489 | PR-#224
Claim: the `xivauth_id` column name implies the XIVAuth account id but it stores `users.id`; ban-check.ts:30,41 still say moderation-worker "Sprint 6 / Sprint 4" is pending though it shipped.
Fix: state "oauth `users.id`" in the comments, drop the sprint remarks.

### gap2-04 | UNTESTED | LOW | apps/presets-api/src/services/identity-rekey-service.ts:39 | PR-#224
Claim: nothing drives the bot-auth path against a linked-then-banned identity, and the ban-race test (identity-rekey.test.ts:223) is the only NOT_BANNED coverage; equal-id is presets-core-06. Covered: partly.

## POSITIVE
- Web-path ban check is correct end to end: `sub=users.id` is bound and matches both ban columns (ban-check.ts:57-61); link-then-web-use does not shed the ban (identity-rekey.test.ts:121).
- rekeyIdentity batch is one transaction and every statement carries NOT_BANNED, so a ban landing between read and write moves nothing (:22-25, test :223).
- findOrCreateUser keeps `users.id` stable across Discord linking (user-service.ts:73-84), so U is a durable key.

## REJECTED
- "banned_users.xivauth_id is the wrong id, so the IN clause never matches": it holds users.id and `sub` is users.id, so they match.
- presets-core-05 as a rekey trigger: it is the pagination tiebreaker finding.
- Rekey wiping votes for equal ids: already filed as presets-core-06.

## COVERED (9)
apps/oauth/src/services/jwt-service.ts, apps/oauth/src/services/user-service.ts, apps/oauth/src/handlers/xivauth.ts, apps/presets-api/src/middleware/auth.ts, apps/presets-api/src/middleware/ban-check.ts, apps/presets-api/src/handlers/presets.ts (refresh-author), apps/presets-api/src/services/identity-rekey-service.ts, apps/moderation-worker/src/services/ban-service.ts, apps/moderation-worker/src/utils/response.ts; skimmed apps/presets-api/tests/handlers/identity-rekey.test.ts
