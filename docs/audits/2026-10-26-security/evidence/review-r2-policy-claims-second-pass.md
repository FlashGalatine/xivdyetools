# Review: r2-policy-claims-second-pass (deploy unit: web-app + discord-worker (policy))

Second pass on the English policy lines the first policy reviewers listed as NOT COVERED
(review-policy-web-en.md:108-109). HEAD 13c386e5. Read-only; no probes. English only; every
candidate lists all six locale variants to edit.

## Claim table (policy line -> code)

| Policy line | Claim | Code checked | Result |
|---|---|---|---|
| PRIVACY.md:95-98, PRIVACY_POLICY.md:31 | flagged edit keeps "the version from before the first such edit, kept until a moderator restores it or the preset is deleted" | presets-api handlers/presets.ts:721-744 (snapshot only when `preset.status === 'approved' && !preset.previous_values`); stripAuditData :104-106; only revert clears it (moderation.ts:290-345) | Kept-until holds; trigger is narrower than stated (approved presets only) -> r2-02 |
| PRIVACY.md:50-62 (device inventory) | localStorage list + per-store clear paths | saved-presets-service.ts:22-50 (`v5_saved_presets`, up to 200 snapshots with `author`, `description`, `exampleLink`, `deletedByAuthor`); advanced-options-panel.ts:255-271 (no control touches it); preset-tool.ts:927 + config-sidebar.ts:1697-1703 (`keepDeleted` default true, only filters the view) | Store missing from the inventory -> r2-01 |
| PRIVACY.md:147-159, PRIVACY_POLICY.md:116 | moderation-channel / submission-log post contents | discord-worker preset-notifications.ts:154-224 (name, description, author name, category, dye count, footer preset ID); index.ts:379-390 (preview: name + image), :477-501 (source web/discord, dyes, tags), :517-534 (log: name, description, author, category); moderation-worker ban-reason.ts:187-205 (author name, presets hidden, Banned By moderator name, reason, no user ID); buttons/preset-moderation.ts:229-236, modals/preset-rejection.ts:176-179, :321-324 (preset name + moderator name + reason); commands/preset.ts:196-199 (pending list: name, author name, preset ID) | Holds ("such as" covers source/tags/preset id); no user ID in any channel post; ID-bearing ban confirm and unban reply are ephemeral (preset.ts:571, :609) |
| PRIVACY.md:252-255 | preset delete takes preview image, votes, moderation-log entries, failed-notification record; daily counts expire; posts stay | presets-api presets.ts:457-484 (one batch: votes, failed_notifications by `$.preset_id`/`$.preset.id`, moderation_log by preset_id, preset; then deletePreviewImage + edge purge) ; rate-limit-service.ts:146 (30 d) | Holds for our stores; silent on copies other viewers saved (r2-01) |
| PRIVACY.md:257-258 | sign-out deletes the token and asks the sign-in service to revoke it | auth-service.ts:775-808 (clearStorage :604-608 removes token/expiry/provider; POST /auth/revoke, 5 s bound); packages/auth revocation.ts:92 (`revoked:<jti>` only, TTL) | Holds |
| PRIVACY.md:270, PRIVACY_POLICY.md:154,172 | requests handled within 30 days; "full data export" on request | no runbook or script in docs/operations, docs/maintainer, apps/*/README (git grep "deletion request\|data export" = none) | Unbacked process promise -> r2-03 |
| PRIVACY.md:143-177, PRIVACY_POLICY.md:178-192 | 30 d / 30-90 d / 90 d / 12 mo / 120 s / 60 s / 180 d / 30 d KV | rate-limit-service.ts:146,163; notification-service.ts:198,205; moderation-retention-service.ts:22,31,68-83; ban-service.ts:605 (blanks username + reason on unban); discord-worker index.ts:881, analytics.ts:191,231; presets-api wrangler.toml:125-126 (prod cron; beta web-app uses the same api.xivdyetools.app + same D1 id) | All hold |
| PRIVACY_POLICY.md §2/§5 KV keys | prefs, favorites, first-run flag, counters, usertrack | preferences.ts:56,348 (no TTL), preset-favorites.ts:23,31,160-161 (no TTL; v2 holds id + name), index.ts:881 (180 d), analytics.ts:132-231 | Hold |
| PRIVACY_POLICY.md:47 AE row | columns incl. copy button hex/RGB/HSV, user ID for counting | analytics.ts:91-101; copy.ts:22 (`copy_hex/rgb/hsv`) | Holds |
| PRIVACY_POLICY.md:32, §7 | vote removable | schemas.ts:1146-1147 (`/preset vote` toggles), preset.ts:648-656 | Holds |
| Bot ToS §3 (TERMS_OF_SERVICE.md:21-33) | service list | registry.ts:27-57 (18 registrations); schemas.ts:324-333 (`/extractor color` = hex match) | Holds; no removed command named |
| Bot ToS §5:57, web ToS:60-61 | clean submissions "published immediately" | DEPRECATIONS.md:10-67 (key deletion queues everything; checklist edits only the two privacy policies) | Holds until key deletion; bot ToS missing from checklist -> r2-04 |
| PRIVACY.md:100-103 | Perspective gets text only, `doNotStore` | moderation-service.ts:255-274 | Holds |
| Last updated 2026-10-12 | | git log since 2026-10-12 on presets-api/moderation-worker/oauth src, preset-notifications.ts, discord-worker services, saved-presets-service.ts = no commits | Not stale |

## Candidates

- **r2-01 (LOW, INTERNET-UNAUTH)** `v5_saved_presets` is absent from "What is stored on your device"
  (PRIVACY.md:50-62). It holds up to 200 snapshots of other people's community presets with author
  name, description and example link (saved-presets-service.ts:22-50,129-144), survives the author's
  deletion by design (`deletedByAuthor`, `keepDeleted` default true, preset-tool.ts:927), and no
  bulk control clears it (advanced-options-panel.ts:255-271); only per-preset unsave
  (saved-presets-service.ts:147-153). PRIVACY.md:252-255 is also silent that an author's deletion
  does not reach these on-device copies (nor bot favorites' stored name, preset-favorites.ts:160).
  Resolution: AMEND (inventory bullet + clear path; one sentence in *Deleting your data*). Variants:
  PRIVACY.md/.ja/.de/.fr/.ko/.zh (fr also: policy-fr-01 wording).
- **r2-02 (INFO, INTERNET-AUTH)** PRIVACY.md:95-98 and PRIVACY_POLICY.md:31 say any held edit keeps
  the pre-edit version; code snapshots only an approved preset, write-once (presets.ts:737-744), and
  rows from before the rule may hold a non-approved snapshot. Over-disclosure, harmless. CORRECT:
  PRIVACY x6 and bot PRIVACY_POLICY x6.
- **r2-03 (INFO, LOCAL)** The 30-day deletion promise and the bot's "full data export"
  (PRIVACY_POLICY.md:154) have no runbook: no doc enumerates the stores a request must touch
  (oauth `users`, presets/votes/submission_events/moderation_log/banned_users, KV prefs/favorites
  v1+v2/firstrun/usertrack, Discord posts). Policy text is not false; fix is a procedure (code/doc),
  policy NONE.
- **r2-04 (INFO, INTERNET-AUTH)** Extension of policy-web-en-09: bot TERMS_OF_SERVICE.md:57 ("published
  immediately") goes stale on the same day the Perspective key is deleted, and DEPRECATIONS.md's
  checklist omits bot ToS x6 too. Add web ToS x6 + bot ToS x6 to the checklist.

## POSITIVE controls

- No moderation-channel or submission-log post carries a user ID; the two ID-bearing moderator views are ephemeral.
- Preset delete removes votes, dead letters and audit rows in one D1 batch, then the R2 object and edge cache.
- Dead-letter rows hold preset id/status/revision only (notification-service.ts:182-191).
- Bot nonce cache stores only the nonce (presets-api middleware/auth.ts:222-228); revocation stores only the jti.
- Unban blanks name and reason in the same statement (ban-service.ts:605); every retention constant matches policy text.
- Perspective request carries text + `doNotStore` only.

## REJECTED

- Moderator display name in posts is unlisted: it is staff data about the moderator's own action, not the user's.
- "Source: web/discord" and preset ID footer in moderation posts: covered by "such as"; not personal.
- moderation_log `created_at` vs ISO cutoff format: moderation-worker writes ISO (ban-service.ts:483,579); presets-api compares ISO.
- Over-limit rollback (presets.ts:1097-1100) skips moderation_log/failed_notifications/R2: none exist yet at that point.
- Beta site retention: beta talks to api.xivdyetools.app, same D1 as the production cron.
- Web ToS "collections": unreachable collection manager already filed as policy-web-en-02.

## FILES COVERED (31)

apps/web-app/{PRIVACY.md, TERMS_OF_SERVICE.md, src/services/{saved-presets-service,auth-service,community-preset-service}.ts,
src/components/advanced-options-panel.ts, src/components/v4/{preset-tool,config-sidebar}.ts, src/locales/en.json};
apps/discord-worker/{PRIVACY_POLICY.md, TERMS_OF_SERVICE.md, src/index.ts, src/commands/{registry,schemas}.ts,
src/handlers/commands/{preset,preset-notifications}.ts, src/handlers/buttons/{copy,preview-image}.ts,
src/services/{preferences,preset-favorites,analytics}.ts}; apps/moderation-worker/src/{handlers/commands/preset.ts,
handlers/buttons/preset-moderation.ts, handlers/modals/{ban-reason,preset-rejection}.ts, services/ban-service.ts};
apps/presets-api/{schema.sql, wrangler.toml, src/handlers/presets.ts, src/middleware/auth.ts,
src/services/{notification,moderation-retention,rate-limit,moderation}-service.ts}; apps/oauth/schema/users.sql;
packages/auth/src/revocation.ts; DEPRECATIONS.md; docs/operations/OPEN_ITEMS.md.
