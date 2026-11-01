# Review: presets-api second pass — moderation, votes, categories, auth, schema (key `r2-presets-api-moderation-auth`)

Checkout HEAD 13c386e5 (branch claude/project-security-audit-3b5195). Read-only. No probes were run; every claim below is a file:line read in this checkout. First-round reviews `review-presets-api-routes.md` / `review-presets-api-services.md` were read so as not to re-file their items.

## 1. Route / module table and authz matrix (files in scope)

Chain (index.ts): requestId :51 → logger :56 → validateEnv :63-86 → security headers :89-99 → CORS :102-155 → `/api/*` IP limiter :162 → body cap :167 → JSON depth :170 → `authMiddleware` on `*` :173 → `/api/*` per-user limiter :182 → Content-Type gate :186-224 → routers :256-259 → notFound :266 → onError :278.

| Method | Path | Anon | User | Owner/author | Moderator | Guard / CAS (file:line) |
|---|---|---|---|---|---|---|
| GET | `/moderation/pending` | 401 | 403 | 403 | all `status='pending' OR preview_image_status='pending'`, no LIMIT | moderation.ts:150; preset-service.ts:530-535 |
| PATCH | `/moderation/:id/status` | 401 | 403 | 403 | 4 target statuses; expected_revision+expected_status required (409 REVISION_REQUIRED/STALE_REVIEW); UPDATE+log one batch, `changes()>0`; **no author-ban check** | moderation.ts:163, 181, 197-200, 224-243; preset-service.ts:458-464 |
| PATCH | `/moderation/:id/revert` | 401 | 403 | 403 | reason 10-200; binding; snapshot dyes re-validated; WHERE revision+status+raw snapshot; **no author-ban check** | moderation.ts:260, 277, 292-316, 329-351; preset-service.ts:481-501 |
| PATCH | `/moderation/:id/preview-image` | 401 | 403 | 403 | key regex + `startsWith(id/)` + pending in WHERE; audit row in batch | moderation.ts:370, 389-396, 424-450 |
| GET | `/moderation/:id/history` | 401 | 403 | 403 | bound `preset_id` | moderation.ts:473, 478-485 |
| GET | `/moderation/stats` | 401 | 403 | 403 | constant SQL | moderation.ts:495, 502-511 |
| GET | `/moderation/failed-notifications` | 401 | 403 | 403 | LIMIT 50, projection only | moderation.ts:524; notification-service.ts:509-519, 463-499 |
| PATCH | `/moderation/failed-notifications/:id/resolve` | 401 | 403 | 403 | bound id | moderation.ts:540; notification-service.ts:555-568 |
| GET | `/moderation/:id` | 401 | 403 | 403 | registered last (:565) so literals win | moderation.ts:566 |
| POST | `/votes/:presetId` | 401 | approved only (404 otherwise); ON CONFLICT DO NOTHING; recount | own | same | votes.ts:30, 39, 168-185, 64-77 |
| DELETE | `/votes/:presetId` | 401 | approved only | own | same | votes.ts:206-221, 120-131 |
| GET | `/votes/:presetId/check` | 401 | own vote only | – | – | votes.ts:234-250 |
| GET | `/categories`, `/categories/:id` | public | public | – | – | categories.ts:75-93, 101-147 (bound id) |

Auth (middleware/auth.ts): bot = Bearer equals `BOT_API_SECRET` (SHA-256 digest compare :141-152, :269) → v2 HMAC over method/path/body/timestamp/nonce/identity (:309-324) → single-use nonce in KV `botnonce:` 120 s, format-checked (:207-236, :338). A Bearer equal to the bot secret never falls through to JWT (:269 vs :353). Unsigned bot auth only when `BOT_SIGNING_SECRET` is unset AND `ENVIRONMENT` is development/test (:273-290). Web = HS256 JWT, issuer pinned when `JWT_ISSUER` set (:100-102), `jti` revocation (:106-109); acting id = `discord_id` claim else `sub` (:71-77). Moderator = acting id in `MODERATOR_IDS` (:125-133, :341, :365), computed server-side on both paths, never taken from a header. `X-User-*` headers are only honoured inside the signed bot branch.

## 2. Candidates

### r2-presets-api-moderation-auth-01 (LOW, INTERNET-AUTH) — presets-api never enforces the author ban on moderator approve/revert
`PATCH /moderation/:id/status` and `/revert` carry no ban lookup (moderation.ts:161-252, 258-361; `git grep -n -i banned apps/presets-api/src/handlers/moderation.ts` → no hits), and `requireNotBanned` is mounted only on the presets and votes routers (presets.ts:131, votes.ts:30), checking the *caller*, not the author. A ban hides only `approved` presets (moderation-worker ban-service.ts:677-691), so a banned author's pending/flagged rows stay in `GET /moderation/pending` (preset-service.ts:530-534) and the only guard is moderation-worker's separate pre-read (`preset-moderation.ts:186`, `commands/preset.ts:284`, `preset-rejection.ts:268`), not atomic with the write. Server-side counterpart of `moderation-worker-01` (same root, different fix location: add `AND NOT EXISTS (banned_users … author …)` to `prepareStatusUpdate`/`prepareRevert` for target `approved`). Precondition: a ban landing between the pre-check and the PATCH, or any future client of the API that skips the pre-check.

### r2-presets-api-moderation-auth-02 (LOW, INTERNET-AUTH) — an owner can keep a moderator's status/revert permanently STALE_REVIEW with uncapped tag/category/link edits
The `content_revision` trigger fires on `tags`, `category_id`, `secondary_categories`, `example_link`, `author_name` (schema.sql:64-78 = migrations/0014:5-19). An owner edit that touches only those is not `textChanged` (presets.ts:653-655), so it reserves no daily slot (the `text_edit` reservation is inside `if (textChanged)`, :665-700) and on an approved preset writes no status and notifies nobody (:533-536); it is bounded only by the 100/min per-user limiter, and the owner's UPDATE binds the server's own fresh read of the revision (:798-805). Every moderator `/status` (e.g. approved → rejected) or `/revert` is bound to the revision the moderator reviewed (preset-service.ts:461, 485), and moderation-worker's reject path is a human loop (confirm → modal → typed reason; commands/preset.ts:235-244, 295-300), so an author looping `PATCH /presets/:id {"tags":[...]}` about once a second makes every reject answer 409 STALE_REVIEW and keeps an offensive approved preset public. Bounded: ban (moderation-worker direct D1 hide, not revision-bound) and moderator `DELETE /presets/:id` still work; `PATCH /refresh-author` with two tokens carrying different display names (presets.ts:387-393) is a second, slower lever.

### r2-presets-api-moderation-auth-03 (INFO, LOCAL) — stale operator comment on the Perspective sunset contradicts FINDING-019
moderation-service.ts:212-214 says "with no key configured this whole tier is skipped and the local word list decides", but :373-384 (FINDING-019) queues every local pass as `unscored`/pending when no key is set; CLAUDE.md for the app states the correct behaviour. An operator reading only the code comment before 2026-12-31 would expect auto-approval to continue; the effect is fail-closed (everything queued), so no exposure.

## 3. Positive controls (verified this checkout)

- Every moderation handler calls `requireModerator` as its first statement (moderation.ts:150, 163, 260, 370, 473, 495, 524, 540, 566); 401 vs 403 split (auth.ts:422-428).
- FINDING-017 holds: status/revert fail closed without `expected_revision`+`expected_status` (moderation.ts:129-142, 197-200, 292-295); `REVIEW_STATUSES` from `@xivdyetools/types` for the reviewed status, the narrower four-status validator for the target (:121-128, :181); stale → 409 with a fresh `current` read, deleted → 404 `Preset not found` (the body moderation-worker's `PRESET_MISSING` matches, moderation-worker preset-api.ts:372-380; api-response.ts:127-128).
- Status + audit row and revert + audit row are single D1 batches gated by `changes() > 0` (moderation.ts:224-234, 329-341); dye-signature collisions answer 409 naming the blocker, not 500 (BUG-041, :235-238, :342-346).
- Revert re-validates the snapshot's dyes before writing and binds the exact raw `previous_values` string (moderation.ts:310-316; preset-service.ts:485).
- Preview-image approve/reject bound to the reviewed immutable key + `preview_image_status='pending'`; DB first, R2 delete after, failure logged without the key (moderation.ts:389-396, 424-462).
- Votes: approved-only gate on POST and DELETE so the routes never confirm a non-public preset (votes.ts:39, 181, 218); `INSERT … ON CONFLICT DO NOTHING` on PK (preset_id, user_discord_id) (schema.sql:120-126) prevents double votes; count recomputed from rows in the same batch (votes.ts:64-77, 120-131); vote writes do not bump `content_revision` (trigger column list).
- Submit-duplicate path votes only on an approved duplicate and returns a bare 409 for someone else's pending one (presets.ts:171-205).
- Bot auth: v2-only, nonce single-use and format-checked before it becomes a KV key, nonce never logged (auth.ts:168-236, 292-346); unsigned bot path impossible in production (:273-290).
- JWT: shared verifier enforces HS256, numeric exp, non-empty sub (packages/auth/src/jwt.ts:193-199, 236-270); issuer pinned; oauth always mints `jti` (apps/oauth/src/services/jwt-service.ts:124-132). The oauth state HMAC is over a dot-free base64url string (apps/oauth/src/utils/state-signing.ts:35-40), so a state signature can never be a valid JWT signature over `header.payload` despite the shared `JWT_SECRET`.
- Ban check matches acting id, JWT `sub` and JWT `discord_id` against both ban columns, bound placeholders only, fails closed 503 outside development (ban-check.ts:48-64, 89-111, 147).
- Re-key: both ids from the same verified token, web path only, one batch with a per-statement ban guard, self-move refused (presets.ts:371-384; identity-rekey-service.ts:22-25, 39-70).
- Dead-letter listing is LIMIT 50 and a projection (`type`, `preset_id`, `moderation_status`); legacy fat payloads never re-served (notification-service.ts:463-519); migration 0015 rewrites them in place.
- CORS exact-match allowlist, loopback only in development, `X-User-*` not in `allowHeaders` (index.ts:105-149). Error handler hides message/stack unless development (:278-298).
- Local profanity matcher: all words regex-escaped into one flat alternation, CJK split out (moderation-service.ts:30-32, 57-90); Perspective key in header, `doNotStore`, 5 s timeout, every failure → queued (:243-333).
- Category ids validated against a DB-sourced cached list (category-service.ts:33-59); categories routes bind the id and return public data only.
- Schema/migrations agree with code: trigger text identical in schema.sql:64-78 and 0014:5-19; partial unique dye index matches the duplicate queries' status filter (0006:43-45, preset-service.ts:594, 619); `submission_events.kind` CHECK includes `text_edit` (0012); `moderation_log.preset_id` nullable + `target_discord_id` (0013).

## 4. Rejected

- Revert keeps the flagged edit's `example_link` / `category_id` / `secondary_categories` (preset-service.ts:482-485 restores only name/description/dyes/tags): the owner can already change those on an approved preset without review (first-round `presets-api-routes-01`); no added reach.
- `/status` with `expected_status === status` (e.g. approved → approved) writes an `approve` log row for a no-op (`changes()` counts the matched row): moderator-only audit noise, no state change.
- `GET /moderation/pending` and `GET /presets/mine` have no LIMIT (preset-service.ts:530-534, 567-577): the first is moderator-only and bounded by the daily submission caps; the second returns only the caller's own rows. `page` on `GET /presets` is clamped ≥1 and `limit` 1-50 (presets.ts:249-250); an absurd page at worst 500s.
- Vote sybils via an unlinked XIVAuth account plus a Discord identity: inherent to account-based voting; linking merges and de-duplicates (identity-rekey-service.ts:48-68).
- `GET /votes/:id/check` has no approved gate: answers only about the caller's own vote, so it reveals nothing about a non-public preset to anyone else.
- `discord_id` claim attacker influence for XIVAuth-linked accounts: covered end to end by `review-gap-xivauth-identity-claim.md`; on this side both ids come from one HS256-verified, issuer-pinned token.
- `scripts/migrate-presets.ts` interpolates `preset.category` and `JSON.stringify(tags)` unescaped (:104-108): input is the repo's own `packages/core/src/data/presets.json` (15 palettes, no quote in any category or tag — checked with a node one-liner), output is printed, never executed by the script.
- Moderator may set `hidden` → approved, `/status` reason unvalidated, 404 path echo, `GET /` environment, Content-Type `includes()`, module-scope category promise, dev-worker preview URLs: already filed or rejected by the first round / 2026-10-03.
- `banned_users.username` stored (schema.sql:165): written by moderation-worker, not this unit; policy reviewers own disclosure.

## 5. Files covered (21)

`apps/presets-api/src/handlers/` moderation.ts, votes.ts, categories.ts, presets.ts (130-230, 280-410, 500-830); `src/middleware/` auth.ts, ban-check.ts; `src/` index.ts, types.ts (grep); `src/services/` moderation-service.ts, category-service.ts, identity-rekey-service.ts, notification-service.ts (130-200, 440-569), preset-service.ts (217-300, 440-722); `src/data/profanity/` index.ts (+6 lists by size); `schema.sql`; `migrations/` 0002-0015 and 002_add_composite_indexes.sql; `scripts/migrate-presets.ts`. Cross-reads: moderation-worker `services/preset-api.ts`, `services/ban-service.ts:670-710`, `handlers/commands/preset.ts:270-300`; `packages/auth/src/jwt.ts`; `apps/oauth/src/utils/state-signing.ts`.
