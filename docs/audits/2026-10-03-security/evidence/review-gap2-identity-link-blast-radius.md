# Review gap2-identity-link-blast-radius (2026-10-03)

Scope: every presets-api query keyed on the resolved acting id, across the XIVAuth-only -> Discord-linked switch (c2 sibling). Ban case itself excluded (delta-commits#c2).

## 1. Entry points and authz (identity-keyed paths only)
| Entry | Guards before handler | Id used | Keyed on |
|---|---|---|---|
| POST/DELETE /votes/:presetId | authMiddleware, router requireNotBanned (votes.ts:30), requireAuth, requireUserContext | auth.userDiscordId (votes.ts:176,210) | votes PK (preset_id,user_discord_id) schema.sql:124 |
| GET /votes/:id/check | requireAuth | same | votes.ts:236 |
| GET /presets/mine (my-submissions) | requireAuth | same | preset-service.ts:572 `WHERE p.author_discord_id = ?` |
| PATCH /presets/refresh-author | requireAuth | same | presets.ts:360-364 |
| DELETE /presets/:id | requireAuth, ban, canSeePreset | owner = author_discord_id === userDiscordId, or moderator | presets.ts:408 |
| PATCH /presets/:id, preview image set/remove | same | strict equality, no moderator | presets.ts:552, 1103, 1300 |
| POST /presets | rate limit by id | rate-limit-service.ts:79,116 | presets + submission_events |
Caps unchanged from earlier audits; not in scope.

Resolution point: auth.ts:70-77 resolveJWTUserId returns discord_id if the JWT carries one, else sub. oauth stamps discord_id on the row in attachIdentities (user-service.ts:183-200) and the JWT mints `discord_id: user.discord_id ?? undefined` (jwt-service.ts:142). A pre-link access token (<=3600 s, jwt-service.ts:121) still resolves to the UUID until refresh. No code anywhere migrates author_discord_id / votes / submission_events on link (git grep of apps/oauth and apps/moderation-worker for author_discord_id: only ban-service reads).

## Per-query behaviour across the switch (XIVAuth-only UUID U -> snowflake D)
(a) Votes: PK is (preset_id, user_discord_id) (schema.sql:124); ON CONFLICT DO NOTHING (votes.ts:61). Vote as U, link, vote as D: two rows, vote_count recomputed by COUNT (votes.ts:64-67) = 2. Same person double-votes once per link. Impact: one extra vote per preset per account, one-time per account (link is one-way); Sybil via a second account is already free. Old U vote can no longer be seen (/check keys on D, votes.ts:236) or removed (DELETE keys on D, votes.ts:178), so the preset's count is permanently inflated by a vote the user cannot retract. Also the author auto-vote (presets.ts:990) sits under U.
(b) Quota: getSubmissionCountToday (rate-limit-service.ts:79) and getEventCountToday (:116) both key on the id. After link the counters read 0 for D, so the daily submission/edit/preview caps reset once per account. Bounded: one extra day's quota, once per account.
(c) Owner access: after link, my-submissions (preset-service.ts:572) returns nothing from U; edit (presets.ts:552), preview set/remove (1103,1300) return 403; DELETE (408) returns 403 unless moderator. The user loses self-service view/edit/delete of all UUID-authored presets, which remain public with their name. Policy routing: PRIVACY.md:64-73 and TOS 65-74,156 send removal requests to the maintainer, who can delete by preset id, so a data-subject request is still satisfiable; the code does not fail the promise but self-service removal (which the web UI offers) silently stops working and the user is not told. Not a rights failure as documented; a stranding bug.
(d) refresh-author (presets.ts:360-364) updates only author_discord_id = D rows; U-authored rows keep the old display name forever and the user cannot rename them or have them refreshed (privacy: stale username remains public).
(e) Reverse direction: none found. attachIdentities never clears or changes an existing discord_id (user-service.ts:200-228), a Discord-first account stays on D, and a conflicting Discord owner is never merged (user-service.ts:206-214). No unlink flow in oauth handlers. Linking two local accounts is explicitly unsupported, so no UUID-ownership takeover path. UUIDs are unguessable, so no third party can claim U-authored rows.
Accepted trade-off? docs/architecture/security-trade-offs.md has no entry (grep for UUID/XIVAuth-only/link: none). Only a code comment (ban-check.ts:40-52: "pre-existing, not new"); docs/architecture/api-contracts.md:80 documents the fallback but not the switch. Not accepted.

## 2. Positive controls
- Vote add/remove atomic via db.batch with recomputed counter, ON CONFLICT DO NOTHING (votes.ts:56-70, 119-130).
- Vote gate requires status approved (votes.ts:48, FINDING-016); canSeePreset guard before owner checks (presets.ts:401, 545).
- Ban router-level on every mutating vote method, fails closed 503 (votes.ts:30; ban-check.ts:99-112).
- attachIdentities never overwrites an existing Discord link nor merges rows (user-service.ts:206-228); concurrent link race handled (user-service.ts:235-252).
- All queries use prepare().bind().

## 3. Rejected
- Takeover of U-authored presets by another party after link: UUIDs random, only reachable with the user's own token.
- Vote double count by re-linking repeatedly: link is one-time (discord_id set once, never overwritten, user-service.ts:206).
- Pre-link token reuse after link causing a split: both ids belong to the same person; just a transient coexistence (<=1 h) that can create writes under U after link, widening the same stranded set (folded into c1).
- Moderator escalation across the switch: MODERATOR_IDS is checked against the resolved id (auth.ts:365); a moderator linking Discord would gain moderator status only if their snowflake is listed, which is the intended design.

## 4. Files covered
apps/presets-api/src/middleware/auth.ts (1-330), ban-check.ts, handlers/votes.ts, handlers/presets.ts (330-412, 545-556, 1095-1108, 1295-1304 plus grep of all id sites), services/preset-service.ts (560-580 plus grep), services/rate-limit-service.ts (60-135 plus grep), schema.sql (votes, submission_events), migration listing; apps/oauth/src/services/user-service.ts (120-260), jwt-service.ts (110-145); apps/web-app/PRIVACY.md 64-74, TERMS_OF_SERVICE.md 63-76, 150-158; docs/architecture/security-trade-offs.md (grep); moderation-worker ban-service (grep).

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/presets-api/src/middleware/auth.ts:70-77 (consumers presets.ts:408,552; preset-service.ts:572; votes.ts:61,236) | Linking Discord to an XIVAuth-only account switches the acting id; UUID-authored presets/votes are orphaned: user loses view/edit/delete/preview, refresh-author skips them, an old vote is permanent and a second vote under the snowflake is allowed, daily quota resets once. Shares c2's fix (a stable per-account id, or migrate author_discord_id/votes/submission_events/banned_users on link). Not an accepted trade-off. |

## 6. Handoffs
- Documentation: PRIVACY.md/TOS removal text should note that presets from before a Discord link need maintainer removal; add the switch to security-trade-offs.md or api-contracts.md:80 if kept as-is.
- Plain bug: refresh-author returns success with updated: 0 after link, no hint to the user.
