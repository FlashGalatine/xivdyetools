# Review: moderation-worker (2026-10-03, commit 0ab33466)

Scope: apps/moderation-worker (source, read-only), packages/auth/src/discord.ts (the verifier it uses), presets-api migration 0014 and the moderation status handler for the DB-write comparison. No probes run, no scripts written.

## 1. Entry points and authz matrix

Public surface: production custom domains moderation-bot.xivdyetools.app and moderation-bot.xivdyetools.projectgalatine.com (wrangler.toml env.production routes). workers_dev=false. The top-level (dev) worker has no routes. Only two Hono routes: `GET /health` and `POST /` (src/index.ts).

Middleware order (src/index.ts): requestId, logger (UA logging not opted in), security headers, env-validation gate (fail-closed 500 when RL_* bindings are missing in production), route.

| Entry | Callable by | Guards before handler | Body / param caps |
|---|---|---|---|
| GET /health | anyone | none needed (returns {status:ok}) | none |
| POST / PING | holders of a valid Discord signature | Ed25519 via verifyDiscordRequest (packages/auth/src/discord.ts) | 100 000 B streamed cap plus Content-Length precheck; timestamp window -300 s/+60 s checked before the body is read |
| /preset moderate (pending, approve, reject, stats) | MODERATOR_IDS | signature; native limiter RL_COMMAND (index.ts enforceCommandRateLimit); channel == MODERATION_CHANNEL_ID (commands/preset.ts:~395); isModerator (preset.ts:~403) | preset_id must be UUIDv4 (isValidUuid); reject reason >= 10 chars; reasons clamped to 1024 on output; JSON depth 10 |
| /preset ban_user | moderators, moderation channel | same chain (isModerator preset.ts:~517) | target must be snowflake or lowercase UUID (isBanTargetId); custom_id `ban_confirm_<id>` <= 48 chars |
| /preset unban_user | moderators, moderation channel | same chain (preset.ts:~627) | same target gate |
| Autocomplete (preset_id, user) | moderators only; others get an empty list | signature; isModerator (index.ts handleAutocomplete) then RL_AUTOCOMPLETE | query truncated to 100, LIKE-escaped, LIMIT 25 |
| Buttons preset_approve_/reject_/revert_ | moderators | signature; command limiter (index.ts handleComponent); UUID gate; isModerator | UUID only |
| Buttons ban_confirm_/ban_cancel_ | moderators | signature; limiter; isModerator; isBanTargetId | id only |
| Modals preset_reject_modal_, preset_revert_modal_, ban_reason_modal_ | moderators | signature; limiter; UUID or isBanTargetId; isModerator; reason >= 10 chars | Discord max_length 500/200; server does not re-cap but the 100 KB body cap and output clamp bound it |
| Select menus, unknown component/modal | n/a | answered "not supported" / "Unknown" | n/a |

Outbound: Discord REST (fixed base, 5 s AbortSignal); PRESETS_API service binding (10 s signal) with HTTP fallback to the fixed PRESETS_API_URL var. Bindings: KV (rate-limit fallback, legacy locale read), D1 DB (xivdyetools-presets, read/write), RL_COMMAND, RL_AUTOCOMPLETE.

## 2. Positive controls

- Ed25519 over the raw bounded bytes before any parse: packages/auth/src/discord.ts (Content-Length precheck, timestamp window, streaming reader that cancels at the cap, verifyKey over the same bytes). src/index.ts calls it first, then safeParseJSON (maxDepth 10). This closes 2026-09-15 FINDING-001 for this unit.
- MODERATOR_IDS gate on every path: slash (preset.ts three subcommands), autocomplete, all buttons including ban cancel, all three modals; ids are snowflake-validated (services/preset-api.ts isModerator). presets-api re-checks.
- custom_id parsing is bounded: UUID or snowflake/UUID regex before any D1 or path use (utils/response.ts isValidUuid, isBanTargetId); ban custom_id carries the id only.
- All D1 SQL is prepare().bind() (services/ban-service.ts); LIKE input is escaped with ESCAPE (utils/sql-helpers.ts). The only interpolated fragments are the constants MODERATION_LOG_COLUMNS and SQL_UUID_V4.
- Audit rows (2026-08-29 FINDING-018): ban, hide, unban and restore each write moderation_log in the same db.batch as the effect; the unban row is conditional on `changes() > 0`; the batch aborts loudly if migration 0013 is missing. No username in the rows.
- 2026-09-15 FINDING-004/005 interplay: the direct hide/restore UPDATEs change `status`, and migration 0014's AFTER UPDATE OF status trigger bumps content_revision for every writer, so a presets-api edit/status/revert holding an older revision matches 0 rows and returns 409 (apps/presets-api/migrations/0014_add_content_revision.sql; moderation.ts passes presetRow.content_revision to prepareStatusUpdate). The trigger is enough for the revision race; the remaining gap is restore blast radius (c1).
- Bot to presets-api: v2 signature only (services/preset-api.ts request(): method, pathname, body, nonce, timestamp, identity); v1 not sent; presets-api replay-checks the nonce. No X-User-Discord-Name is sent, so no display name travels to the API.
- Logs: ban line carries ids, count and reasonLength only (modals/ban-reason.ts "User banned"; 2026-08-29 FINDING-011 holds). Unban line carries ids and count. No logger call interpolates a user object; the worker-kit logger middleware does not log UA/IP unless opted in, and this worker does not opt in.
- allowed_mentions: baseBody() defaults ALLOWED_MENTIONS_NONE on every Discord REST send/edit (utils/discord-api.ts); interaction responses go through withAllowedMentions (utils/response.ts). User text passes through the sanitizeEmbedText wrappers (utils/embed-text.ts), including masked-link label escaping.
- Rate limiting: native [[ratelimits]] per Discord user (wrangler.toml, production namespaces 1031/1032), applied after signature and before the heavy work for commands, components and modals; production refuses service when bindings are missing; fail-open is logged (FINDING-012).
- Error handler is generic (dev arm only when ENVIRONMENT=development on the routeless dev worker); sanitizeErrorMessage keeps D1/SQL text out of channels; ban-service returns generic strings and keeps the raw cause for logs.
- Security headers and Cache-Control: no-store on all responses. No secrets in [vars].

## 3. Rejected items

- Query string not covered by the v2 signature: known INFO (08-29 FINDING-015 closing note, PKG-03); calls are service-binding traffic.
- No guard against banning a moderator or yourself (08-29 MOD-04): unchanged INFO from the earlier audit; actors are trusted moderators. Not re-filed.
- Interaction replay inside the 5-minute window: handlers are idempotent or conditional (unique active-ban index, unban changes() guard, presets-api conditional status).
- Module-scope moderatorIdsCache and limiterInstance: hold env-derived config only, no per-request data; revocation applies on the next deploy.
- BOT_SIGNING_SECRET / BOT_API_SECRET not required by validateEnv in production: a missing secret produces requests presets-api refuses. INFO only.
- Dev worker binds production D1/KV (08-29 MOD-06): unchanged, routeless.
- Embed copy-back in edit calls (originalEmbed fields): comes from bot-authored messages in a Discord-signed payload.
- console.error of Discord error bodies (utils/discord-api.ts safeEdit*): API error JSON, no user content; token URLs pass sanitizeUrl.
- Logging a non-moderator's Discord id on autocomplete denial (index.ts) and userId on command/rate-limit lines: pseudonymous Discord user id, the one personal field the bot policy lists; no name, guild, channel or option value.
- Ban/modal reason has no server-side max: Discord enforces 500, output is clamped to 1024, body capped at 100 KB.

## 4. Files covered

apps/moderation-worker: wrangler.toml; src/index.ts; src/utils/{verify,embed-text,discord-api,response,sql-helpers,env-validation}.ts; src/types/modal.ts; src/services/{ban-service,preset-api,i18n}.ts and the KV/locale lines of bot-i18n.ts; src/middleware/rate-limit.ts; src/handlers/commands/preset.ts; src/handlers/buttons/{index,ban-confirmation,preset-moderation}.ts; src/handlers/modals/{index,ban-reason,preset-rejection}.ts; scripts/register-commands.ts (token-handling lines only); safe-json.ts and url-sanitizer.ts (headers and option lines only). Not read in full: types/{ban,env,preset}.ts, the remainder of bot-i18n.ts, tests.
Outside the unit: packages/auth/src/discord.ts; presets-api migrations 0006 and 0014; presets-api handlers/moderation.ts (status patch) and handlers/presets.ts (ownerEditOutcome); worker-kit middleware/logger.ts (UA opt-in grep); discord-worker preset-notifications.ts:153; 2026-08-29 and 2026-09-15 reports plus the 09-15 moderation review; both privacy policies (grep for ban/moderation); evidence pii-sinks.txt and policy-claims.txt.

PII reconciliation (pii-sinks, apps/moderation-worker): no analytics datapoints. The only KV write is the rate-limit counter keyed by command or autocomplete plus the Discord id (60-120 s, matches policy section 8). Log calls carry ids and counts only. D1 writes: moderation_log (ids, moderator reason) and banned_users (discord id, display-name copy, free-text reason, moderator ids, timestamps), see c2.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/moderation-worker/src/services/ban-service.ts:549 and 608-622 | Unban restores every `hidden` preset of the author to `approved` in one batch with no dye-signature collision handling; hidden rows are outside the partial unique index, so a colliding visible preset makes the whole batch fail and the ban cannot be lifted. |
| c2 | LOW | INTERNET-UNAUTH | apps/moderation-worker/src/services/ban-service.ts:452; apps/discord-worker/PRIVACY_POLICY.md section 8 | banned_users keeps a display-name copy, a free-text moderator reason and moderator ids with no disclosure or retention line (policy lists only "Moderation history" in D1). |
| c3 | INFO | INTERNET-AUTH | apps/moderation-worker/src/services/preset-api.ts:356-367; apps/discord-worker/src/handlers/commands/preset-notifications.ts:153 | Text approve/reject sends only `{status, reason}` and the button carries only the preset id, so a stale embed or `approve <id>` approves whatever is current and a stale click can override a newer moderator decision. |

## 6. Handoffs

- Operations: confirm migrations 0013 and 0014 are applied in production (hand-run per docs/operations/security-remediation-2026-09-15.md); the trigger in 0014 is what makes the direct hide/restore writes revision-safe.
- i18n: several moderator-facing literals are hardcoded English (for example "Unknown action", "Invalid preset ID format.", "Reason", "Rate limit exceeded", "Unbanned by moderator").
- Documentation: if c2 is accepted, the ban-record retention line goes in all six policy files and apps/moderation-worker/README.md.
