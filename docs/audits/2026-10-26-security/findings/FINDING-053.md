# FINDING-053: 30-day deletion and 'full data export' promises have no runbook enumerating the stores to purge
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** web-app + discord-worker (policy) / docs/operations · **Rotation:** NONE · **Policy:** NONE (process fix: the policy text is accurate, so add an operations runbook rather than changing the policy) · **CWE:** n/a

## Location
- `apps/discord-worker/PRIVACY_POLICY.md:154` — 30-day deletion and 'full data export' promises have no runbook enumerating the stores to purge

## Evidence
- PRIVACY_POLICY.md:154 "Contact us to request a full data export"; PRIVACY_POLICY.md:~172 "We will process deletion requests within 30 days."; PRIVACY.md:270 "We handle deletion requests within **30 days**."
- Reach: A user emails or DMs the maintainer asking for deletion or a full export under bot PRIVACY_POLICY.md section 7 (lines 154, ~172) or web PRIVACY.md 'Deleting your data' (line 270). The maintainer must then find every per-user store by hand, because no tracked doc or script lists them.
- The bot policy offers a full data export at PRIVACY_POLICY.md:154 and deletion within 30 days. Web PRIVACY.md:270 promises the same deletion window. git grep over docs/operations, docs/maintainer, docs/developer-guides, docs/architecture, docs/reference, scripts and the app READMEs/CLAUDE.md finds no deletion or export procedure, and there is no deleteUser/purge/export tooling in apps/*/src. The per-user stores are spread out: oauth users (users.sql:15); presets-api presets, votes, moderation_log, banned_users, failed_notifications, submission_events (schema.sql:32-215) plus R2 previews; discord-worker KV prefs:v1, the legacy i18n:… Preconditions: A user actually files a deletion or export request. The risk is an incomplete purge or export (for example the favorites v1 key, legacy pref keys or submission_events within their 30-day window), not exposure to a third party.
- Live state the repo cannot show: Whether the maintainer keeps an untracked private procedure cannot be seen from the repo.

## Fix
- Add docs/operations/DATA_SUBJECT_REQUESTS.md listing every per-user store with its key or column, plus the D1 queries and KV prefixes for export and deletion (including the Discord-post cleanup and the active-ban exception). Optionally add a read-only export script. Link the runbook from docs/operations/index.md.
- **Maintainer decision:** Only the maintainer knows whether a private deletion/export procedure exists. If not, approve adding a tracked operations runbook that lists every per-user store.

## Status
OPEN
