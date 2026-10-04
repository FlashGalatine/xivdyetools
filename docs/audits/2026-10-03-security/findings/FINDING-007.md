# FINDING-007: Bot PRIVACY_POLICY §2/§4 lists 'Discord Username', but preset.ts sends the display name (global_name) as the published author_name, and the prefs record's updatedAt timestamp is not listed
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** AMEND apps/discord-worker/PRIVACY_POLICY.md §2 Data We Collect (Discord Username and Preferences rows), §4 How We Use Your Data (Community presets row) — variants: `apps/discord-worker/PRIVACY_POLICY.md`, `apps/discord-worker/PRIVACY_POLICY.ja.md`, `apps/discord-worker/PRIVACY_POLICY.ko.md`, `apps/discord-worker/PRIVACY_POLICY.zh.md`, `apps/discord-worker/PRIVACY_POLICY.de.md`, `apps/discord-worker/PRIVACY_POLICY.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 2 (Step 3a) · **Prior verdict:** the 2026-08-29 discord-worker reviewer accepted "Username" as covering the display name in an evidence note only (`2026-08-29-security/evidence/review-discord-worker.md:276`), never in that report's Rejected suspicions; both verifiers here upheld the distinction (username and `global_name` are different Discord fields, and the privacy stance lists display names separately).

## Location
- apps/discord-worker/src/handlers/commands/preset.ts:76-81 — userName = global_name || username (member first, then user), passed to submit and edit
- apps/discord-worker/src/services/preset-api.ts:96-97 — sends it as the X-User-Discord-Name header; presets-api/src/middleware/auth.ts:254 reads it, and handlers/presets.ts:1029 plus preset-service.ts:429 store and publish it as author_name
- apps/discord-worker/PRIVACY_POLICY.md:20,92 — discloses 'Discord Username' / 'User ID, Username, Preset content' only

## Evidence
- preset.ts:76-81: const userName = interaction.member?.user?.global_name || interaction.member?.user?.username || interaction.user?.global_name || interaction.user?.username || 'Unknown';
- PRIVACY_POLICY.md:20: | Discord Username | Attribute community preset submissions | Until data deletion requested |  — and :92: | Community presets | User ID, Username, Preset content |
- presets-api preset-service.ts:154 and 179 say the gallery shows 'the display name', which confirms the published author identity is the display name, not the username.

## Fix
- Minimize (no policy edit): send `interaction.(member.)user.username` only in `preset.ts:76-81`; existing `author_name` rows keep display names until refreshed (`presets.ts:328-361`).
- Or AMEND §2 line 20 and §4 line 92 (six files) to "Discord display name (or username if none is set), shown publicly as the preset author" — a new public commitment for the §8 gate.
- Either way, add the preference record's `updatedAt` timestamp to the §2 Preferences row (or stop storing it).

## Status
FIX COMMITTED, NOT DEPLOYED — bot policy AMEND (display name; the preferences record's last-changed time) in six languages, `d1fdb89a` (branch `fix/security-2026-10-03-sprint5`, discord-worker 5.8.0; PR #227, open).
