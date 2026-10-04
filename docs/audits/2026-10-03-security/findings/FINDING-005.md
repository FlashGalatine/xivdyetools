# FINDING-005: banned_users / moderation_log keep the Discord id, a username copy, the free-text ban reason and moderator ids indefinitely, and neither privacy policy lists them or gives a retention period
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker + presets-api · **Rotation:** NONE · **Policy:** AMEND apps/discord-worker/PRIVACY_POLICY.md §2 Data We Collect, §5 Where Your Data is Stored, §8 Data Retention; apps/web-app/PRIVACY.md §Network access item 3 — variants: `apps/discord-worker/PRIVACY_POLICY.md`, `apps/discord-worker/PRIVACY_POLICY.ja.md`, `apps/discord-worker/PRIVACY_POLICY.ko.md`, `apps/discord-worker/PRIVACY_POLICY.zh.md`, `apps/discord-worker/PRIVACY_POLICY.de.md`, `apps/discord-worker/PRIVACY_POLICY.fr.md`, `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md` · **CWE:** CWE-359
**Reconcile case:** 2 (Step 3a)

## Location
- apps/presets-api/schema.sql:161-172 — banned_users: discord_id, username ("Username at time of ban"), moderator_discord_id, reason TEXT NOT NULL; no TTL; moderation_log :137-146 keeps reason + target_discord_id
- apps/moderation-worker/src/services/ban-service.ts:452 — INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason, banned_at); no DELETE FROM banned_users/moderation_log exists in apps/ (grep)
- apps/discord-worker/PRIVACY_POLICY.md:104,163-177 and apps/web-app/PRIVACY.md:65-75 — bot policy says only 'Moderation history' (no retention row); web document lists only account record, presets and votes

## Evidence
- schema.sql:165-167: `username TEXT NOT NULL, -- Username at time of ban` / `moderator_discord_id TEXT NOT NULL` / `reason TEXT NOT NULL, -- Reason for ban (10-500 chars)`
- PRIVACY_POLICY.md §8 rows end at 'Moderation-notification failure records' and 'Daily submission / edit counters'; it has no row for bans or moderation-log records. §2 lists Username only to 'Attribute community preset submissions'
- web PRIVACY.md item 3: 'Presets and votes you submit are stored under that account'. It says nothing about ban records, moderator reasons, submission_events (30 d) or dead letters, although web accounts (XIVAuth UUID accepted by isBanTargetId) can be banned and their submissions write these rows

## Fix
- Minimize first, **without a schema change**: `banned_users.username` is `NOT NULL` and moderator ban search selects and sorts by it (`ban-service.ts:172-180`), so keep it while a ban is active, blank it (`''`) on unban, and set a retention for lifted bans and `moderation_log` reasons, pruned on the write path (no cron exists). Never drop the column while any worker still reads or writes it.
- Then AMEND both policies (six-file edit each, bump every `Last updated`; an AMEND is a significant change, so bot policy §11 calls for a Discord announcement): add ban records and moderation-log entries (ids, moderator reason, timestamps) with their retention to bot §2/§5/§8 and to web PRIVACY.md item 3.
- Coordinate with FINDING-008 and FINDING-009, which edit the same web item; update `apps/moderation-worker/README.md` if it describes ban storage.

## Status
OPEN — minimization in code (`f1b54a0f`, `c7fd9eba`); the bot policy AMEND (moderation records and retention, six languages) in `d1fdb89a` (branch `fix/security-2026-10-03-sprint5`, discord-worker 5.8.0; PR #227, open). The web PRIVACY item 3 AMEND is Sprint 8. Optional one-off backfill for bans lifted before the deploy: `UPDATE banned_users SET username = '', reason = '' WHERE unbanned_at IS NOT NULL`.
