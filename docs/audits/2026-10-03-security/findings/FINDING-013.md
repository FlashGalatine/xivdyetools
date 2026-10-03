# FINDING-013: Bot PRIVACY_POLICY §4 omits that /stats preferences samples up to 100 stored prefs:v1 records to compute adoption percentages
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** AMEND apps/discord-worker/PRIVACY_POLICY.md §4 How We Use Your Data (Usage statistics row) — variants: `apps/discord-worker/PRIVACY_POLICY.md`, `apps/discord-worker/PRIVACY_POLICY.ja.md`, `apps/discord-worker/PRIVACY_POLICY.ko.md`, `apps/discord-worker/PRIVACY_POLICY.zh.md`, `apps/discord-worker/PRIVACY_POLICY.de.md`, `apps/discord-worker/PRIVACY_POLICY.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 2 (Step 3a) · **Note:** New purpose for disclosed data: AMEND, or stop sampling.

## Location
- apps/discord-worker/src/handlers/commands/stats.ts:445-459 — handlePreferencesSubcommand reads up to PREFERENCE_SAMPLE_SIZE (100, :377) prefs:v1:* values and counts which of language/blending/matching/clan/gender/world/market are set
- apps/discord-worker/src/handlers/commands/stats.ts:72-79 — isAuthorized gate (STATS_AUTHORIZED_USERS); the result is an ephemeral embed of percentages only (:469-519, flags 64)
- apps/discord-worker/PRIVACY_POLICY.md:95 — the §4 'Usage statistics (/stats)' row lists only the analytics fields; :90 says preferences are used only to 'Save your preferences'

## Evidence
- stats.ts:447-458: const values = await Promise.all(sample.map((key) => env.KV.get(key.name)...)); ... if (prefs.clan) clanSet++; if (prefs.gender) genderSet++; if (prefs.world) worldSet++; if (prefs.market !== undefined) marketSet++;
- PRIVACY_POLICY.md:95: | Usage statistics (`/stats`) | Command name and subcommand, outcome class, latency, server-or-DM flag, client language bucket, copy-button kind, User ID (counted, never listed) | (no mention of the preference records)
- No sink beyond the ephemeral embed: nothing is written to KV, D1 or AE and no logger call is made on this path (_logger is unused). The stored fields are already disclosed in §2 row 28, so this is drift in how the data is used, not undisclosed collection.

## Fix
- Extend the §4 'Usage statistics (/stats)' row, and optionally the §2 Preferences purpose, to say that operators see aggregate percentages from a sample of up to 100 saved preference records, showing which settings are set and never the values or who set them
- Apply the same wording to the .ja/.ko/.zh/.de/.fr siblings (six-file AMEND, a new stated purpose). Alternative with no policy edit: drop the sampling and derive adoption from the Analytics Engine rows the policy already lists.

## Status
OPEN
