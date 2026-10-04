# FINDING-014: presets-api resolveJWTUserId switches from sub (UUID) to discord_id once oauth links Discord to an XIVAuth-only account; isUserBanned checks discord_id only, so a UUID-keyed ban lapses and UUID-keyed presets, votes and quota are orphaned
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api + oauth · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-863
**Note:** Cross-ref 2026-09-16-deep-dive/BUG-001 residual and OPEN_ITEMS.md:122. LOW: a banned user can already evade with a fresh Discord account.

## Location
- apps/presets-api/src/middleware/ban-check.ts:56-62 — isUserBanned binds the one resolved id against banned_users.discord_id only (residual B1 is documented at :36-49 but not closed)
- apps/oauth/src/services/user-service.ts:183-199 — attachIdentities stamps the Discord id from an XIVAuth sign-in (xivauth.ts:354-359, linkedDiscordId) onto an XIVAuth-only row
- apps/presets-api/src/middleware/auth.ts:71-77 — resolveJWTUserId returns payload.discord_id once the token has one, otherwise sub (the UUID that moderation-worker banned, ban-service.ts:452-456)

## Evidence
- ban-check.ts:57-60: .prepare('SELECT 1 FROM banned_users WHERE discord_id = ? AND unbanned_at IS NULL LIMIT 1').bind(userId) — the xivauth_id column (indexed, schema.sql:179-181) is never consulted
- user-service.ts:183-198: if (!existing.discord_id && discord_id) { ...owner check... discordId = discord_id; logger?.info('Linked Discord identity to existing account' ...) }  ->  jwt-service.ts:142: discord_id: user.discord_id ?? undefined
- moderation-worker ban-service.ts:452-456: INSERT INTO banned_users (id, discord_id, ...) .bind(id, discordId, ...) — for an XIVAuth-only author discordId is the oauth sub UUID, and after the link the presets-api acting id is the snowflake, so the two never meet

## Fix
- moderation-worker: for an XIVAuth-only target, also record the identity in a field that survives linking. Either write the oauth users.id (sub) into a new ban column, or resolve the target's oauth row and store both ids. Today discord_id holds the UUID and xivauth_id is never written.
- presets-api: have authMiddleware keep both the JWT sub and its discord_id on AuthContext, and change isUserBanned to WHERE (discord_id = ? OR discord_id = ? OR <sub column> = ?) AND unbanned_at IS NULL, so a ban on either the pre-link UUID or the snowflake matches.
- Add an end-to-end test: ban a UUID author, mint a JWT for the same sub that now also carries discord_id, and expect requireNotBanned to return 403. Then close the OPEN_ITEMS.md:122 entry.

## Status
FIX COMMITTED, NOT DEPLOYED — presets-api part (ban check over every proven id; ban-guarded re-key on sign-in) in `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; PR #224, open); moderation-worker part (xivauth_id written and matched) in `c7fd9eba` (local branch `fix/security-2026-10-03-sprint4`, moderation-worker 1.8.0; PR #225, open). No oauth change was needed.
