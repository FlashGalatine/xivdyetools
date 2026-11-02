# FINDING-023: oauth never clears or re-checks a row's Discord link, so a Discord id once attached stays the presets-api identity after XIVAuth stops asserting it
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** oauth · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-613
**Related:** 2026-10-03-security/FINDING-014 (residual of the identity re-key fix)

## Location
- `apps/oauth/src/services/user-service.ts:182` — oauth never clears or re-checks a row's Discord link, so a Discord id once attached stays the presets-api identity after XIVAuth stops asserting it

## Evidence
- user-service.ts:182-183 `let discordId = existing.discord_id; if (!existing.discord_id && discord_id) {` (no else branch); jwt-service.ts:141 `discord_id: user.discord_id ?? undefined`
- Reach: An XIVAuth user whose oauth row once got snowflake D (via xivauth.ts:343-353 -> findOrCreateUser at xivauth.ts:386-390) keeps signing in through /auth/xivauth/callback after D is unlinked upstream (XIVAuth social_identities_controller.rb destroy). The row is found by xivauth_id (user-service.ts:73-77), attachIdentities keeps existing.discord_id (:182-200), and jwt-service.ts:141 mints discord_id=D, which presets-api uses as the acting id for edit/delete/vote/moderator checks.
- Code matches the claim: :182-200 only fills an empty discord_id and has no branch that clears or compares it when linkedDiscordId is null or different; oauth exposes no unlink or account-delete route (index.ts:290-293 mounts only authorize/callback/xivauth/token). D's real owner signing in via Discord (callback.ts:239-244, xivauth_id null) lands on the same row through the discord_id lookup (:81-86) and cannot evict the stale xivauth_id; only a different XIVAuth account asserting D replaces it (:202-208). Impact is LOW because a harmful case needs a prior mis-link (candidate 01's precondition, or a temporary Discord-account comprom… Preconditions: The XIVAuth account must have once asserted D while signing in to xivdyetools, and D must later be unlinked upstream. For harm, the XIVAuth holder must not be D's owner (upstream email auto-merge mis-link per candidate 01, or a temporarily compromised Discord account linked and then unlinked).
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): production `xivdyetools-users` holds 19 users, **4** linked to both a Discord id and an XIVAuth id; only those rows can be in the stale-link state. Whether any is stale needs a comparison with XIVAuth's current links (not done).

## Fix
- On XIVAuth sign-in, when the row's discord_id is set and upstream no longer asserts it (null or different), detach the XIVAuth link from that row (null its xivauth_id and give the XIVAuth account a fresh row) instead of minting the stale D. Keep the Discord-anchored row and its D intact so bans keyed on D cannot be shed by unlinking. Add tests for both the unlink and the re-link-elsewhere cases.
- **Maintainer decision:** product trade-off: whether oauth clears or replaces `discord_id` when XIVAuth stops asserting it (affects legitimately linked users). The production population is small (4 of 19 users are linked to both ids); a check for stale rows needs a comparison with XIVAuth's current links.

## Status
OPEN
