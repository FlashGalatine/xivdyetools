# Data-subject export and deletion requests

**Classification:** Internal operations. **Source review:** October 28, 2026.

Use this runbook for a privately verified request concerning account records, community
presets, bot preferences or related records. It implements the existing [web privacy
policy](../../apps/web-app/PRIVACY.md#deleting-your-data) and [bot privacy
policy](../../apps/discord-worker/PRIVACY_POLICY.md#7-your-rights). It does not change those
policies or authorize deployment, feature activation, a production operation or a new retention
exception. The policies promise to process deletion requests within **30 days** and preserve
active ban records and their Discord posts. A hold below requires escalation and tracking
within that existing deadline; it does not silently extend it.

This is a source-backed procedure, not evidence of deployed schema/configuration parity.
An operator must establish that parity before using the templates. No live user operation was
performed to prepare this document.

## 1. Open a private case and verify scope

1. Accept requests through the private contact routes in the policies. Record a case number,
   received time, 30-day due date, requested export/deletion scope, assigned maintainer and
   next review date. A public issue is not a suitable place for identity evidence.
2. Verify control of each requested principal privately: use an authenticated interaction or
   fresh sign-in through an existing supported flow and an authorized maintainer check. Do
   not ask for a password, provider access token, JWT or private XIVAuth roster/report by
   email or in a public issue. There is no dedicated data-request verification endpoint;
   if the available interaction cannot establish control, escalate verification.
3. A supplied display name or email is a search hint, not proof. OAuth has no email column.
   The private identity lookup returns internal ID, current Discord ID and identity revision,
   not fresh upstream verification. Verify historical/detached identities separately. A ban
   membership is evidence of that ban's scope; it grants no account access or deletion rights.
4. Build a reviewed allowlist with separate typed arrays: `internalIds`, `discordIds`,
   `providerXivAuthIds`, and `actingIds` (the verified internal UUIDs and Discord snowflakes
   that can own preset/vote/quota rows). Keep historical provenance and the proof for each
   inclusion. Never traverse a ban's associated identities and automatically add them all.
5. Include accounts that signed in but never submitted, users with votes/quota events only,
   and Discord bot users with no OAuth row. Empty presets do not mean an empty account.

Store raw evidence and exports in restricted private storage outside the repository. Keep
resource names, exact row/key manifests, timestamps, expected/actual counts, file hashes,
review decisions and retry results there. Put only case number, aggregate counts and an
issue description without identifiers in shared engineering records. Do not attach unredacted
ban reasons, other users' votes, provider IDs, recovery payloads or moderator IDs to an export.
Deliver only the verified subject's data through a verified private route, with third-party
information redacted. Agree an export/evidence disposal date with the case owner; this runbook
does not invent a retention policy for case files.

Sources: [OAuth user schema](../../apps/oauth/schema/users.sql),
[identity lookup/session checks](../../apps/oauth/src/services/identity-service.ts),
[acting-ID resolution](../../apps/presets-api/src/middleware/auth.ts), and
[policy identity boundaries](../../apps/web-app/PRIVACY.md#stored-identity-checks-and-ban-scope).

## 2. Select resources and establish execution holds

Check [deployment environments](DEPLOY_ENVIRONMENTS.md) and the effective deployed bindings,
revision and migrations. Do not infer isolation from an environment's name: presets-api's
checked-in dev and production blocks name the same presets database and thumbnail bucket.
OAuth production uses its top-level block; it has no `production` environment.

| Resource | Checked-in binding and target | Operator check |
|---|---|---|
| OAuth D1 | `DB`, `xivdyetools-users` | [OAuth config](../../apps/oauth/wrangler.toml); development database ID remains a placeholder |
| Presets D1 | `DB`, `xivdyetools-presets` | [Presets config](../../apps/presets-api/wrangler.toml); confirm migrations through identity/ban continuity |
| Preset R2 | `THUMBNAILS`, `xivdyetools-presets-preview-thumbnails` | Public URL base `https://shots.xivdyetools.app`; verify actual binding and purge configuration |
| Bot KV production | `KV`, `1fcb7e037ccd4172a47fccd97cf8e753` | [Bot config](../../apps/discord-worker/wrangler.toml) |
| Bot KV beta | `KV`, `7d76d17fbb16403c8bf40e16f5b58ba6` | Separate bot identity/proof and namespace; include only if requested and verified |
| OAuth revocation KV | `TOKEN_BLACKLIST`, production `0d6f3be3b4704e91a83e6387b9769e45` | Presets-api shares this namespace; OAuth development uses `891bbbe834ba4055a06b672b589094be` |
| Analytics Engine | `xivdyetools_bot_analytics`, beta `xivdyetools_bot_analytics_beta`; web `xivdyetools_web_analytics` | [Analytics guide](ANALYTICS_QUERIES.md); verify current provider retention and query access |
| Discord | Configured moderation and submission-log channels, including messages authored by either bot | Verify channel, message ownership and exact affected content privately |

Read-only D1 preflight, on **each selected database**:

```sql
SELECT type, name, sql FROM sqlite_master
WHERE type IN ('table', 'index', 'trigger') ORDER BY type, name;
PRAGMA foreign_key_check;
```

Compare with [OAuth schema](../../apps/oauth/schema/users.sql) and its
[migrations](../../apps/oauth/migrations/0002_identity_transitions.sql), and
[presets schema](../../apps/presets-api/schema.sql) and
[continuity migration](../../apps/presets-api/migrations/0016_ban_identity_continuity.sql).
Check each affected table's `PRAGMA table_info(table_name)` as needed. Do not replay a fresh
schema or apply a migration as part of a privacy request. Schema drift is a hold.

### Recovery and identity hold

Inventory operations/locks before changing any principal. OAuth `identity_operations` keeps
the immutable JSON payload/hash, expected provider relationships/revisions, deadline,
state/outcome and acknowledgement. `identity_operation_locks` reserves `user:{id}`,
`discord:{id}` and `xivauth:{providerId}` resources. Presets-api keeps matching
`ban_continuity_operations` receipts and `moderation_ban_confirmations` proposals.

If a related operation is pending, a remote result is unknown/applied without confirmed
completion, or a confirmation is `applying`, stop affected identity deletion. Have the identity
maintainer reconcile through the existing protocol, verify both databases and acknowledge the
outcome. An expired 15-minute deadline does not make unresolved state safe to delete. Never
manually erase locks, edit immutable payloads or delete one side of a recovery record to
unblock a case. Terminal operation records become cleanup-eligible 24 hours after the later
of deadline/acknowledgement; a confirmed missing-receipt abort uses finish time. Cleanup is
best-effort. Preserve unresolved records for operator review.

Sources: [transition payload and recovery](../../apps/oauth/src/services/identity-transition-service.ts),
[receipt cleanup](../../apps/presets-api/src/services/ban-continuity-retention.ts), and
[policy recovery disclosure](../../apps/web-app/PRIVACY.md#stored-identity-checks-and-ban-scope).

### Active-ban and security-evidence hold

Match every verified acting ID against both legacy ban columns and membership rows. Preserve
active bans, their memberships and active-ban Discord posts. A legacy `xivauth_id` ban column
can hold the OAuth internal account UUID: do not substitute the raw XIVAuth provider ID.
Memberships preserve existing restrictions across link changes; later bans do not automatically
spread to detached identities. Do not re-key records or shrink ban scope to simplify deletion.

**Do not delete an active-ban principal/provider binding with this runbook.** Removing an
OAuth row can let the same provider sign in to a newly generated UUID; an internal-ID-only ban
would then fail to identify it. The current policy explicitly preserves the ban but does not
fully resolve which OAuth binding must be retained for that case. Escalate this decision,
retain the minimum necessary existing binding pending review, and track the unresolved
account-erasure portion. Continue independently safe, verified portions of the request.
Do not invent a new permanent exception or promise full account erasure.

Moderation records can contain other subjects, moderators and security evidence. Export a
redacted subject-specific view. Do not delete rows merely because the requester acted as a
moderator, or erase a whole cross-linked ban. The ordinary retention rules below are not an
automatic new exception to a deletion request; if early deletion conflicts with necessary
evidence, the case owner must resolve and document the conflict before the deadline.

Sources: [ban checks](../../apps/presets-api/src/middleware/ban-check.ts),
[continuity scope](../../apps/presets-api/src/services/ban-continuity-service.ts),
[guarded re-keying](../../apps/presets-api/src/services/identity-rekey-service.ts),
[new principal creation](../../apps/oauth/src/services/user-service.ts), and
[active-ban policy](../../apps/web-app/PRIVACY.md#deleting-your-data).

### Session and concurrent-write hold

Agree a period with the requester during which they do not sign in, submit, upload, vote or
use bot preference commands; coordinate relevant operators. Cooperation alone does not stop
a stolen token. Verify effective enforcement before destructive work and recheck scope/counts
immediately before each batch. If concurrent writes cannot be excluded or detected, stop and
have the maintainer prepare a controlled execution method; there is no account-deletion lock
or atomic transaction spanning OAuth D1, presets D1, KV, R2 and Discord.

The prepared session-check code validates the current revision, provider and Discord binding,
but `OAUTH_SESSION_CHECK_ENABLED` is **false** in checked-in presets-api configuration; when
false, that check returns valid without consulting OAuth. `IDENTITY_SPLIT_ENABLED` is also
configured false in oauth. Moderation's `LINKED_BAN_CONFIRMATION_ENABLED` is configured
`"true"` in its production vars since 1.9.2; confirm the deployed version before relying on
it. This document does not enable any of them. Do not assert deployed activation from the
presence of code.

Known sessions can be revoked through the existing authenticated revoke flow; verify the
response reports successful revocation. Do not collect tokens in the case file. The blacklist
contains `revoked:{jti}` → `1`, with remaining token lifetime plus a 15-minute grace (minimum
60 seconds); it has no user-to-all-JTIs index. **Preserve blacklist entries.** Deleting them
would undo revocation. A revision increase or OAuth row deletion alone cannot immediately
invalidate unknown JWTs at consumers where session checks are inactive. Establish the effective
maximum remaining token lifetime and wait/recheck as necessary; the checked-in issuance default
is one hour, not proof of every extant token's expiry. If immediate complete revocation is
required and cannot be established, escalate that portion instead of declaring completion.
Account/provider changes, revision invalidation and recovery must be handled by the identity
maintainer before content deletion; no ad-hoc provider unlink SQL is supplied here.

Sources: [session switch](../../apps/presets-api/src/services/oauth-session-service.ts),
[presets config](../../apps/presets-api/wrangler.toml), [OAuth config](../../apps/oauth/wrangler.toml),
[moderation config](../../apps/moderation-worker/wrangler.toml),
[JWT issuance](../../apps/oauth/src/services/jwt-service.ts),
[revoke responses](../../apps/oauth/src/handlers/token.ts), and
[blacklist implementation](../../packages/auth/src/revocation.ts).

## 3. Inventory and export with bound allowlists

The SQL below is a **template for a maintainer-reviewed parameterized runner**, not a shell
script. `?1`, `?2`, etc. are bound JSON arrays of strings, not interpolated SQL or CLI text.
Validate ID types, deduplicate, reject an unexpectedly empty scope and retain the approved
arrays privately. Do not replace exact equality with `LIKE`, a display-name search or a
substring search. Run each statement against the database named above its block. Record
counts and raw snapshots before redacting delivery copies; paginate any tool that truncates
results. Never interpret a truncated result as a complete export.

### OAuth D1

Bindings: `?1=internalIds`, `?2=discordIds`, `?3=providerXivAuthIds`.

```sql
SELECT id, discord_id, xivauth_id, auth_provider, identity_revision,
       username, created_at, updated_at
FROM users
WHERE id IN (SELECT value FROM json_each(?1))
   OR discord_id IN (SELECT value FROM json_each(?2))
   OR xivauth_id IN (SELECT value FROM json_each(?3))
ORDER BY id;
```

A matching row containing a provider/Discord association not independently approved triggers
review; it does not expand permission. Revisions and provider bindings belong in the private
execution manifest, not an unredacted public report.

For operation discovery, bind `?1` to the exact verified raw IDs (all three typed sets), `?2`
to exact namespaced resource keys derived from those IDs. JSON-tree matching is discovery
only: inspect each matching payload's roles before assigning it to the case.

```sql
SELECT o.* FROM identity_operations o
WHERE EXISTS (
  SELECT 1 FROM json_tree(CASE WHEN json_valid(o.payload_json)
                              THEN o.payload_json ELSE '{}' END) j
  WHERE j.type = 'text' AND
    (j.value IN (SELECT value FROM json_each(?1))
     OR j.value IN (SELECT value FROM json_each(?2)))
)
OR EXISTS (
  SELECT 1 FROM identity_operation_locks l
  WHERE l.operation_id = o.id
    AND l.resource_key IN (SELECT value FROM json_each(?2))
)
ORDER BY o.created_at, o.id;

SELECT resource_key, operation_id FROM identity_operation_locks
WHERE resource_key IN (SELECT value FROM json_each(?2))
ORDER BY operation_id, resource_key;
```

Malformed recovery JSON, orphan locks or unverifiable payloads require identity-maintainer
review; do not guess ownership or delete them. Add only reviewed operation IDs to a separate
`operationIds` manifest. The schema has no stored email, avatar column, character roster or
provider tokens; legacy deployments must be checked against the removal migration before
making that claim about their data.

### Presets D1

For the first three statements, `?1=actingIds`. Capture all owned presets, including hidden,
rejected and pending rows; do not use the public API serializer as a complete export.

```sql
SELECT * FROM presets
WHERE author_discord_id IN (SELECT value FROM json_each(?1)) ORDER BY id;
SELECT preset_id, user_discord_id, created_at FROM votes
WHERE user_discord_id IN (SELECT value FROM json_each(?1)) ORDER BY preset_id, user_discord_id;
SELECT id, user_discord_id, kind, preset_id, created_at FROM submission_events
WHERE user_discord_id IN (SELECT value FROM json_each(?1)) ORDER BY id;
```

Freeze reviewed `presetIds` and each row's author, `content_revision`, image key/status and
timestamps in the private manifest. Presets include `previous_values` (pre-edit content),
`example_link` and `secondary_categories`; include those subject-owned values in an export.
Votes on their presets belong to other people: keep those IDs private during execution and
deliver aggregate counts, not a list of other voters.

For these discovery statements, `?1=actingIds`, `?2=presetIds`. Review matches in each role;
discovery results are not a deletion allowlist.

```sql
SELECT * FROM moderation_log
WHERE target_discord_id IN (SELECT value FROM json_each(?1))
   OR moderator_discord_id IN (SELECT value FROM json_each(?1))
   OR preset_id IN (SELECT value FROM json_each(?2)) ORDER BY created_at, id;
SELECT * FROM banned_users b
WHERE b.discord_id IN (SELECT value FROM json_each(?1))
   OR b.xivauth_id IN (SELECT value FROM json_each(?1))
   OR EXISTS (SELECT 1 FROM ban_identity_memberships m WHERE m.ban_id = b.id
              AND m.identity_id IN (SELECT value FROM json_each(?1)))
ORDER BY b.id;
SELECT m.* FROM ban_identity_memberships m
WHERE m.identity_id IN (SELECT value FROM json_each(?1)) ORDER BY m.ban_id, m.identity_id;
SELECT * FROM failed_notifications
WHERE json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.preset_id')
        IN (SELECT value FROM json_each(?2))
   OR json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.preset.id')
        IN (SELECT value FROM json_each(?2)) ORDER BY id;
```

For every matched ban, inspect its full membership privately using **reviewed ban IDs**; do
not expose or add its other identities to the request. Inspect malformed/legacy dead-letter
records with the maintainer; their current reduced payload contains preset ID/type/revision,
but older records may contain preset text or author details.

Bind `?1=operationIds` for receipts. For confirmations, bind `?1=actingIds`, `?2` to only the
reviewed ban IDs; a matching ban proposal can contain other identities and requires redaction.

```sql
SELECT * FROM ban_continuity_operations
WHERE id IN (SELECT value FROM json_each(?1)) ORDER BY id;

SELECT c.* FROM moderation_ban_confirmations c
WHERE c.actor_id IN (SELECT value FROM json_each(?1))
   OR c.ban_id IN (SELECT value FROM json_each(?2))
   OR EXISTS (
     SELECT 1 FROM json_tree(CASE WHEN json_valid(c.proposal_json)
                                 THEN c.proposal_json ELSE '{}' END) j
     WHERE j.type = 'text' AND j.value IN (SELECT value FROM json_each(?1))
   ) ORDER BY c.created_at, c.nonce;
```

Sources: [presets schema](../../apps/presets-api/schema.sql),
[notification formats](../../apps/presets-api/src/services/notification-service.ts), and
[OAuth transition payload](../../apps/oauth/src/services/identity-transition-service.ts).

### Bot KV and transient counters

For each independently verified Discord ID `U`, export the present values, key name and
expiry/metadata where available. All listing loops must follow every cursor until complete.

| Exact key or listing rule | Data / ordinary expiry |
|---|---|
| `prefs:v1:U` | Unified preferences and update time; no TTL |
| `i18n:user:U`, `budget:world:v1:U` | Legacy language/world preferences; check even if current key is absent |
| `xivdye:preset_favorites:v1:U`, `xivdye:preset_favorites:v2:U` | Both retained formats: preset IDs / IDs and saved names; no TTL |
| `firstrun:v5:U` | Notice-check marker; 180 days |
| List `usertrack:`; retain only valid `usertrack:YYYY-MM-DD:U` with exact final ID | Daily activity marker `1`; 30 days. Date-first ordering prevents one user-specific prefix |
| List exact prefix `ratelimit:user:U:` | Fallback keys `ratelimit:user:U:{command[:subcommand] or global}|{window}`; 120 seconds for 60-second windows |

Validate listed rate-limit key structure and exact ID before including any key. Native Workers
rate-limit counters use 60-second windows and have no per-user export/delete interface in this
codebase. Let them expire; do not reset a whole binding. `stats:` contains shared aggregates
with 30-day TTL, not attributable user records; do not delete or subtract estimated activity.
Historical prefixes not written by current code need historical/deployed provenance before
they can be added to the reviewed manifest.

OAuth revocation KV also has fallback `rl:{normalizedIP}:{path}|{window}` counters with short
expiry. They cannot be mapped from an account ID; do not infer the user's IP from unrelated
requests or bulk-delete that prefix. API IP counters likewise are not an account inventory.

Sources: [preferences](../../apps/discord-worker/src/services/preferences.ts),
[favorite formats](../../apps/discord-worker/src/services/preset-favorites.ts),
[first-run flag](../../apps/discord-worker/src/index.ts),
[activity keys](../../apps/discord-worker/src/services/analytics.ts),
[bot limiter](../../apps/discord-worker/src/services/rate-limiter.ts),
[KV key/TTL implementation](../../packages/worker-kit/src/rate-limiter/backends/kv.ts), and
[OAuth IP limiter](../../apps/oauth/src/services/rate-limit.ts).

### R2, Discord, analytics and browser inventory

| Store | Export and deletion boundary |
|---|---|
| R2 thumbnails | Export bytes only for exact keys captured from approved owned preset rows. Keys are `{presetId}/{UUID}.webp`, not account IDs. Record object existence/hash/content type. A narrowly scoped listing of `{presetId}/` can discover orphan candidates, but keys not referenced by a row need independent ownership review before export or deletion |
| Discord moderation/submission-log posts | Capture a private channel/message-ID manifest using preset IDs, image URLs, verified names/history and older explicit author IDs. Inspect messages from both bots, edits, images and combined pending lists. A name-only match is insufficient. Redact/edit a mixed-subject message where possible; do not delete other subjects' content. Preserve active-ban posts. Public command responses, user uploads and third-party copies are separate from these owned private-channel posts |
| Moderator ephemeral replies | Inventory known request-related replies if accessible; policy makes no promise about Discord deletion timing. Record inaccessible/expired replies as a limitation, not a confirmed erasure |
| Bot Analytics Engine | `blob2` holds Discord ID; raw data cannot be edited/deleted per user once written. Verify query capability, provider retention, sampling and pagination before offering a subject-specific export; never claim an exhaustive event history from sampled results. Escalate export feasibility if current tooling/authorization only supports aggregate unique-user counts |
| Web Analytics Engine | No account/session/client identifier; cannot reliably attribute events for per-user export or deletion. Do not reconstruct identities from coarse dimensions. Policy says about three months, subject to provider verification |
| Browser localStorage/sessionStorage | User-controlled data, not remotely accessible to the operator. Guide the requester through local export where available and site-data clearing for each used origin/profile/device; do not collect their token. See details below |
| Browser IndexedDB | Database `xivdyetools`, stores `price_cache`, `palettes`, `settings`; inspect legacy stores on the device before clearing. Current active use is price cache, but retained schema stores can contain legacy data. Operator cannot certify remote erasure |

Browser localStorage includes `xivdyetools_` preferences, per-tool configs, favorites,
collections, legacy saved palettes and potentially character-derived labels. Auth keys are
`xivdyetools_auth_token`, `xivdyetools_auth_expires`, `xivdyetools_auth_provider`.
SessionStorage includes `xivdyetools_pkce_verifier`, `xivdyetools_oauth_state`,
`xivdyetools_oauth_return_path`, `xivdyetools_oauth_return_tool`, `xivdyetools_oauth_provider`.
Sign out to attempt token revocation, then clear site data if the requester wants all local
work removed; explain that this also removes saved work. The `.chara` session service and
extractor images are memory-only; close/reset the relevant pages as well. Clearing browser
data does not delete server data or prove revocation of copied tokens.

Sources: [R2 lifecycle](../../apps/presets-api/src/services/preview-image-service.ts),
[Discord policy](../../apps/discord-worker/PRIVACY_POLICY.md),
[analytics schema and queries](ANALYTICS_QUERIES.md),
[browser keys](../../apps/web-app/src/shared/constants.ts),
[auth keys](../../apps/web-app/src/services/auth-service.ts),
[IndexedDB stores](../../apps/web-app/src/services/indexeddb-service.ts), and
[memory-only character session](../../apps/web-app/src/services/chara-session-service.ts).

## 4. Execute a reviewed deletion manifest

For an export-only case, stop after secure delivery and the recorded limitations. For deletion,
require a maintainer-reviewed manifest of exact records/keys/messages, expected counts,
exception decisions and session controls. Clear all holds for the affected portion first.
The following order is a preparation checklist for an operator, not authorization to run it.

1. Complete any requested export before deletion. Capture preset rows/image keys, the subject's
   votes on surviving presets, dead-letter IDs, approved log/event IDs, KV keys, Discord message
   IDs and related recovery records. Verify current author/revision/image keys against the
   snapshot immediately before writing. Stop on drift.
2. Complete the identity/session safeguards in section 2. Preserve active-ban bindings and
   unresolved recovery evidence. Prevent or detect new writes throughout the operation.
3. In **one presets D1 `DB.batch` transaction**, assert the manifest still matches, remove
   the subject's votes on surviving presets, recompute their `vote_count` from remaining votes,
   explicitly remove owned-preset votes, approved dead letters and preset moderation logs,
   then remove owned presets. Do not rely only on foreign-key cascades. Require returned
   rows/counts to match the manifest; any guard/count mismatch must roll back the batch.
4. Remove approved subject quota-event rows in that controlled execution after session/write
   safeguards. Normal preset self-deletion deliberately leaves quota events for 30 days; do
   not change that behavior or offer a quota-reset shortcut. A security-evidence conflict goes
   to case-owner review. User-level moderation rows and recovery/confirmation records need
   separately reviewed exact IDs and resolved retention/security decisions; there is no
   blanket `DELETE WHERE moderator_discord_id=...` or ban-member deletion recipe.
5. Using the keys of rows **actually deleted**, delete their R2 objects, then purge each exact
   public image URL. Keep the pre-delete manifest and `RETURNING` output until reconciliation.
   A database failure means no image deletion. An R2 failure after DB success is an orphan
   requiring retry, not a reason to repeat all DB mutations. Purging before R2 deletion can
   refill the cache with the still-existing object.
6. Delete only approved exact bot KV keys and verified Discord posts/content. Re-list KV with
   pagination and account for eventual consistency; repeat checks after its propagation window.
   Do not delete shared aggregates or token revocations. Coordinate bot use to avoid restoring
   keys during the check.
7. Remove a non-banned OAuth principal only after its relationships/revisions, sessions,
   operations/locks and affected data have been reconciled and the identity maintainer has
   approved the exact row snapshot. Perform the final OAuth row removal with a transactional
   expected-row/lock guard and check the affected count. No generic OAuth `DELETE` template is
   provided: the active-ban binding and inactive-session-check holds are material dependencies.
8. Verify each store independently. Cross-store partial completion remains an open case with
   specific retries; do not restore personal data automatically from an export.

### SQL shapes for the reviewed presets transaction

Each statement below binds `?1=actingIds` and `?2=presetIds` anew. They are **component
templates**, not a complete executable transaction: the maintainer's runner must prepend
snapshot/ownership/active-ban/recovery guards, bind arrays and compare expected counts inside
the transaction. D1's `DB.batch` rolls back on a failed statement; throwing only after a
successful batch has committed is too late. See the existing
[SQL guard pattern](../../apps/oauth/src/services/identity-transition-service.ts) and
[preset-delete implementation](../../apps/presets-api/src/handlers/presets.ts).

For example, a nonempty owned-preset manifest can use the following **in-transaction** guard.
Here `?1` has a different binding: the reviewed JSON array of preset snapshots containing
`id`, `author_discord_id`, `content_revision`, `preview_image_key`, `preview_image_status`
and `updated_at`. Validate unique IDs and that every manifest author is in `actingIds` before
execution. This is one snapshot guard, not a replacement for the identity, active-ban,
recovery or vote/event-count checks. Skip this owned-preset component for a vote-only account.

```sql
SELECT CASE WHEN json_array_length(?1) > 0 AND NOT EXISTS (
  SELECT 1 FROM json_each(?1) s WHERE NOT EXISTS (
    SELECT 1 FROM presets p
    WHERE p.id = json_extract(s.value, '$.id')
      AND p.author_discord_id IS json_extract(s.value, '$.author_discord_id')
      AND p.content_revision = json_extract(s.value, '$.content_revision')
      AND p.preview_image_key IS json_extract(s.value, '$.preview_image_key')
      AND p.preview_image_status IS json_extract(s.value, '$.preview_image_status')
      AND p.updated_at IS json_extract(s.value, '$.updated_at')
  )
) THEN 1 ELSE json('manifest_conflict') END;
```

The intentional invalid JSON raises an error on a mismatch so the batch rolls back. Separately
assert there are no unexpected owned rows/events/votes in the same transaction, and verify
all relevant active bans by the earlier discovery query. A changed scope needs a new review,
not automatic addition to the manifest. Numbered placeholders below are statement-local:
bind only the slots used by that statement, supplying lower numbered slots when `?3` is used.

```sql
-- Capture this result before mutation for export, count expectations and recount scope.
SELECT DISTINCT preset_id FROM votes
WHERE user_discord_id IN (SELECT value FROM json_each(?1))
  AND preset_id NOT IN (SELECT value FROM json_each(?2));

-- Delete the requester's votes; ?3 is the captured surviving affected-preset ID array.
DELETE FROM votes
WHERE user_discord_id IN (SELECT value FROM json_each(?1));
UPDATE presets SET vote_count = (SELECT COUNT(*) FROM votes WHERE preset_id = presets.id)
WHERE id IN (SELECT value FROM json_each(?3));

DELETE FROM votes WHERE preset_id IN (SELECT value FROM json_each(?2));
DELETE FROM failed_notifications
WHERE json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.preset_id')
        IN (SELECT value FROM json_each(?2))
   OR json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.preset.id')
        IN (SELECT value FROM json_each(?2));
DELETE FROM moderation_log WHERE preset_id IN (SELECT value FROM json_each(?2));
DELETE FROM presets
WHERE id IN (SELECT value FROM json_each(?2))
  AND author_discord_id IN (SELECT value FROM json_each(?1))
RETURNING id, preview_image_key;
```

Keep votes belonging to other people on surviving presets. Recompute counts using the
[vote-handler approach](../../apps/presets-api/src/handlers/votes.ts), not a guessed decrement.
Quota deletion, if approved after the holds, uses exact reviewed event IDs plus verified
`user_discord_id`, with expected-count guards; retain unrelated events. Do not turn discovery
queries over moderation/recovery JSON into bulk-delete predicates.

The [image service](../../apps/presets-api/src/services/preview-image-service.ts) deletes the
object before purging and records purge outcomes as `purged`, `skipped` or `failed`. Verify
origin absence as well as purge success. Edge `s-maxage` is one day; browser `max-age` is one
year and immutable. A skipped/failed purge requires follow-up and an accurately stated cache
limitation; downloaded images, Discord attachments and other people's browser copies cannot
be recalled by R2 deletion.

## 5. Verify, reconcile retention and close the case

Re-run the exact scoped inventory, not a broad database dump. Check zero remaining approved
owned preset/vote/event/KV records, unchanged active bans/memberships and protected identities,
no approved dead-letter references, correct surviving vote counts, expected OAuth state, R2
origin absence and cache outcomes, and the exact Discord message outcomes. Test any session
acceptance claim with the approved controlled method; do not mint or collect a real user's
token as a documentation check. Record new writes or inaccessible stores as unresolved.

| Ordinary retention / limitation | Case handling |
|---|---|
| Submission events: 30 days | Normal preset deletion does not remove these. Review scoped account-wide removal after session/abuse safeguards |
| Failed notifications: 30 days resolved, 90 unresolved | Delete exact owned-preset references with the preset; inspect legacy formats |
| Active bans/memberships and active-ban Discord posts | Preserve; account/provider-binding erasure remains a hold requiring explicit review |
| Lifted bans: 90 days; username/reason cleared on lift | Do not unban to complete a privacy request. Review requested earlier removal against evidence requirements |
| User-action logs: 12 months; preset logs: preset lifetime | Do not erase other people's/security records blindly. Escalate unresolved deletion/retention conflicts |
| Confirmations: ≤15-minute expiry, bounded cleanup; terminal continuity records: 24-hour eligibility after required acknowledgement/deadline | Eligibility is not guaranteed deletion time. Pending/unknown/applying states require reconciliation |
| Bot activity/aggregates: 30 days; first-run marker: 180 days; native/fallback counters: 60/120 seconds | Exact attributable KV keys can be removed; shared/native counters have separate limits |
| Analytics Engine: provider retention, about three months in policy | Bot per-user erasure unsupported; web events unattributable; verify export limits and do not claim full event export |
| Browser stores, third-party copies, ephemeral Discord replies | Give device guidance and state access/control limits; do not certify remote deletion |

Retention sources: [moderation cleanup](../../apps/presets-api/src/services/moderation-retention-service.ts),
[notification cleanup](../../apps/presets-api/src/services/notification-service.ts),
[quota cleanup](../../apps/presets-api/src/services/rate-limit-service.ts),
[continuity cleanup](../../apps/presets-api/src/services/ban-continuity-retention.ts), and
[daily sweep](../../apps/presets-api/src/retention-job.ts). Inspect successful execution before
claiming a sweep removed a specific row; best-effort code and a configured cron are not proof.

Before the 30-day due date, send a private case response stating the completed scope, export
delivery if requested, retained active-ban records, unsupported analytics erasure, browser/cache
limits and every unresolved item. Assign each unresolved item an owner, reason, next review
date and concrete resolution route. Escalate verification, policy, activation or platform gaps
early enough to address the existing promise; an exception register is not permission to call
an incomplete deletion complete. Close only when approved actions and follow-up checks are
finished or the case owner has explicitly resolved and communicated the remaining limitations.
