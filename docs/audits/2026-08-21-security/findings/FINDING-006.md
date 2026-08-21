# FINDING-006: moderation-worker autocomplete queries production D1 with no moderator/guild check — leaks the banned-user list and author name→Discord-ID mapping

## Severity
**MEDIUM** (gap CONFIRMED, reach PLAUSIBLE) — every other handler enforces the `MODERATOR_IDS` allowlist; autocomplete does not. Whether non-moderators can trigger it depends on where `/preset` is visible: commands are registered **globally** by default (`scripts/register-commands.ts:117-138`, no `default_member_permissions`, `dm_permission` or guild pin) and on the app's "Public Bot" toggle (not verifiable from the repo). Reviewer IDs: MOD-1, MOD-3. Coordinator-verified.

## Category
CWE-862 Missing Authorization · CWE-200 Exposure of Sensitive Information

## Location
- `apps/moderation-worker/src/index.ts:254-333` — `handleAutocomplete()` rate-limits by user then dispatches; no moderator/channel/guild check.
- `apps/moderation-worker/src/index.ts:339-392` — `getBanUserAutocompleteChoices` / `getUnbanUserAutocompleteChoices` → `banService.searchPresetAuthors` / `searchBannedUsers` (direct D1, `services/ban-service.ts:50-164`); responses are `"<username> (discord:<id>) - N presets"` and the live banned list.
- `apps/moderation-worker/src/index.ts:292-295` — the rate-limit increment is fire-and-forget (not in `waitUntil`), so even that throttle is best-effort (MOD-3).

## Description
Autocomplete interactions are signed by Discord, so only real users typing into the command can trigger them — but nothing restricts *which* users. Anyone who can see the `/preset ban_user` / `unban_user` options enumerates currently-banned users (sensitive moderation data) and resolves author display names to Discord IDs.

## Evidence
```ts
// index.ts handleAutocomplete — no moderator check anywhere in the function
if (subcommandName === 'ban_user')   choices = await getBanUserAutocompleteChoices(env, query, logger);
else if (subcommandName === 'unban_user') choices = await getUnbanUserAutocompleteChoices(env, query, logger);
```
SQL is fully parameterised (`LIKE ? ESCAPE '\'`); this is an authorization gap, not injection.

## Impact
Disclosure of the banned-user list and author identities to non-moderators; small unauthenticated D1 read load.

## Recommendation
- Apply the same moderator check (and channel/guild pin) at the top of `handleAutocomplete`; return `choices: []` otherwise.
- Register the command with `default_member_permissions` (e.g. Manage Guild), `dm_permission: false` / `contexts: [GUILD]`, pinned to the moderation guild; disable "Public Bot" for the moderation app.
- Move the rate-limit increment into `ctx.waitUntil`.

## References
- Evidence: `../evidence/review-moderation-worker.md` (MOD-1, MOD-3, authorization matrix)

## Status
**FIXED 2026-08-21** — `fix(moderation-worker): moderator-gate autocomplete, id-only ban custom_ids (FINDING-006/007)`: moderation-worker 1.5.0 — `handleAutocomplete` enforces `MODERATOR_IDS` (non-moderators get `choices: []`, D1 never queried), increment under `ctx.waitUntil`; `register-commands` sets `default_member_permissions` (Manage Server), `dm_permission: false`, guild-only contexts (re-register required).
