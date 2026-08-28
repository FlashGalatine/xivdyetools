# FINDING-022: Bot analytics stores guild IDs and per-user daily tracking keys, contradicting the published privacy policy

## Severity
**LOW** — compliance/transparency issue, not a breach. Reviewer ID: DW-6. Coordinator-verified (`PRIVACY_POLICY.md` table: Guild ID "Not stored (ephemeral)"; `analytics.ts:55-56` writes `guildId || 'dm'` as blob3 and `usertrack:{date}:{userId}` KV keys).

## Category
CWE-359 Exposure of Private Personal Information (policy mismatch)

## Location
- `apps/discord-worker/PRIVACY_POLICY.md:17-20`
- `apps/discord-worker/src/services/analytics.ts:49-66, 179-191`

## Recommendation
Either stop writing guild IDs to Analytics Engine (hash them, or record only a DM/guild boolean) or update the policy to state that guild IDs and daily per-user activity are retained (and for how long).

## References
- Evidence: `../evidence/review-discord-worker.md` (DW-6)

## Status
**FIXED 2026-08-21** (discord-worker 5.0.0)
- discord-worker 5.0.0: Analytics Engine blob3 is `'guild' | 'dm'` (raw guild id never written); `PRIVACY_POLICY.md` gained a Usage Analytics section (AE events, 30-day KV counters, 30-day `usertrack:{date}:{userId}` keys), a Guild ID row and use / storage / retention tables. Open: confirm the Analytics Engine retention figure (written as 3 months).
