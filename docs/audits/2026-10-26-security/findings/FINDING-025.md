# FINDING-025: Ban keyed on one identity leaves the author's other-identity presets public and approvable
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker · **Rotation:** NONE · **Policy:** NONE: discord-worker/PRIVACY_POLICY.md section 'Moderation Records' and web-app PRIVACY.md describe only what a ban record stores. They do not promise that every preset of a… · **CWE:** CWE-863
**Related:** 2026-10-03-security/FINDING-014

## Location
- `apps/moderation-worker/src/services/ban-service.ts:686` — Ban keyed on one identity leaves the author's other-identity presets public and approvable

## Evidence
- ban-service.ts:686-691 UPDATE presets SET status = 'hidden', updated_at = ? WHERE author_discord_id = ? AND status = 'approved' .bind(now, discordId); :489 const xivAuthId = isXivAuthUuid(discordId) ? discordId : null; :42 ON (b.discord_id = p.author_discord_id OR b.xivauth_id = p.author_discord_id)
- Reach: An XIVAuth-only user submits presets on the web (keyed by oauth sub UUID), links Discord, then submits through the bot (keyed by snowflake) before the next web sign-in runs refresh-author. A moderator bans the snowflake: hideUserPresetsStatement (ban-service.ts:684-691) hides only author_discord_id = snowflake, so the UUID-keyed approved presets stay public and isPresetAuthorBanned (:38-48) still lets pending UUID-keyed ones be approved.
- All three code facts hold: the hide UPDATE binds the single target id (:686-691), banUser fills xivauth_id only when the target is itself a UUID (:489), and the MOD-4 approval guard joins banned_users on p.author_discord_id only (:42), so a snowflake ban never matches UUID-keyed rows. After the ban, presets.ts:371-379 skips the re-key and identity-rekey-service.ts NOT_BANNED (:22-25) blocks it too, so the split stays in place for good. The impact is bounded: requireNotBanned (presets-api ban-check.ts:147) checks userDiscordId, jwtSub and jwtDiscordId, so the banned user cannot post, edit or vote from either client; what remains is… Preconditions: The author must hold presets under both the XIVAuth sub UUID and the Discord snowflake at ban time. That happens when they submit on the web while XIVAuth-only, link Discord, and submit through the bot before any web sign-in runs refresh-author, or when they never sign in on the web again after lin…
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): production `xivdyetools-presets` has 16 approved presets by 7 authors — **1** UUID-keyed (XIVAuth-only) and 6 snowflake-keyed — so at most one author can hold the split today. Aggregate counts cannot show whether that author's linked id is among the six.

## Fix
- moderation-worker cannot resolve the sub-to-snowflake link itself (it has no oauth binding). Have the ban flow ask presets-api or oauth for the linked ids over a service binding and hide and match both. Otherwise show the moderator every author id sharing that author_name or linked identity in the ban confirmation, and add a test for the snowflake-ban-with-UUID-presets case.
- **Maintainer decision:** how the ban learns an author's other identity (a presets-api or oauth lookup over a service binding). The live population is at most one author (1 UUID-keyed author of 7 in production); an id-level overlap check was deliberately not run, to avoid reading identifiers.

## Status
OPEN
