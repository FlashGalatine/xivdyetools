# Documentation audit 2026-09-18 — cluster: architecture-maintainer-reference

Worktree: `C:\dev\XIVProjects\xivdyetools\.claude\worktrees\docs-audit-2026-09-18` @ `origin/main` `0fec18f4` (2026-09-18)

## Coverage

| file | sections reviewed | result |
|------|--------------------|--------|
| docs/architecture/index.md | all | reviewed |
| docs/architecture/overview.md | all | reviewed |
| docs/architecture/dependency-graph.md | all | reviewed |
| docs/architecture/service-bindings.md | all | reviewed |
| docs/architecture/data-flow.md | all | reviewed |
| docs/architecture/api-contracts.md | all | reviewed |
| docs/architecture/security-trade-offs.md | all | reviewed |
| docs/maintainer/index.md | all | reviewed |
| docs/maintainer/adding-dyes.md | all | reviewed |
| docs/maintainer/dye-maintainer-tool.md | all | reviewed |
| docs/reference/index.md | all | reviewed |
| docs/reference/glossary.md | all | reviewed |
| docs/reference/ffxiv-terminology.md | all | reviewed |

All 13 files read in full. No partial reads.

## Candidates

### CAND-1 — WRONG — MEDIUM
**File:** `docs/architecture/api-contracts.md:483` (and the `ErrorCode` table at `:733-734`)
**Claim:** `PATCH /moderation/:presetId/status`'s "409 (concurrent moderation)" response is documented as
`{ "success": false, "error": "DUPLICATE_RESOURCE", "message": "Preset status changed concurrently — reload and retry" }`,
and the Error Codes table (line 733) lists `CONFLICT` as "Reserved" while attributing "a concurrent moderation write" to `DUPLICATE_RESOURCE` (line 734).
**Reality:** `apps/presets-api/src/handlers/moderation.ts:159-166` (and the mirror-image block in the `/revert` handler, `:241-248`) returns exactly the message "Preset status changed concurrently — reload and retry" with `error: ErrorCode.CONFLICT` (`"CONFLICT"`), not `DUPLICATE_RESOURCE`. `DUPLICATE_RESOURCE` in this router is reserved for a *different* 409 — the dye-signature-collision branch (`dyeSignatureConflictResponse`, `moderation.ts:55-75`), whose message is "Another visible preset already uses this dye combination", not the one documented. `apps/presets-api/src/utils/api-response.ts:31-48` confirms `CONFLICT` and `DUPLICATE_RESOURCE` are two distinct `ErrorCode` values. So `CONFLICT` is not "Reserved" — it is the live code for this exact response — and `DUPLICATE_RESOURCE`'s description incorrectly folds the concurrent-moderation case into itself.
**Evidence:** `docs/architecture/api-contracts.md:483,733,734` vs `apps/presets-api/src/handlers/moderation.ts:159-166,241-248,55-75` and `apps/presets-api/src/utils/api-response.ts:31-48`.

### CAND-2 — MISSING — MEDIUM
**File:** `docs/architecture/api-contracts.md:475-479`
**Claim:** "The update and its `moderation_log` row (`approve` / `reject` / `flag` / `unflag`) land in one batch... `revert` is the fifth action this API writes; `xivdyetools-moderation-worker` writes four more of its own straight to the shared D1 — `ban` and `unban`... plus one `hide` / `restore`..." — i.e. presets-api itself only ever writes `approve`/`reject`/`flag`/`unflag`/`revert` to `moderation_log`.
**Reality:** `apps/presets-api/src/handlers/moderation.ts:436-454` (`getActionFromStatusChange`) has a sixth branch: when a moderator's `PATCH /moderation/:presetId/status` sets `status: "pending"` on a preset that wasn't `flagged`, the function falls through to `return 'requeue'`. `status: "pending"` is a documented, accepted target for this same endpoint (`api-contracts.md:474`, confirmed live by `MODERATION_VALIDATION_RULES.validStatuses` in `apps/presets-api/src/services/validation-service.ts:49`, which includes `'pending'`), so this branch is reachable in production, not dead code — the comment at `moderation.ts:446-452` explains it was added specifically to stop a prior bug where this case was mislabeled `'approve'` in the audit trail. `moderation_log.action` is an unconstrained TEXT column (no CHECK), so this widened vocabulary needed no migration and left no other signal. `GET /moderation/:presetId/history` (documented at `api-contracts.md:505-509`) can therefore return an `action: "requeue"` row the doc's action vocabulary doesn't mention.
**Evidence:** `docs/architecture/api-contracts.md:475-479` vs `apps/presets-api/src/handlers/moderation.ts:130,436-454` and `apps/presets-api/src/services/validation-service.ts:49`.

### CAND-3 — MISSING — LOW
**File:** `docs/architecture/data-flow.md:60-74`
**Claim:** The "JWT Payload Structure" example shows the full minted JWT payload as
`{ sub, iat, exp, iss, username, global_name, avatar, auth_provider, discord_id }` — 9 fields, no `jti`.
**Reality:** `apps/oauth/src/services/jwt-service.ts:125-146` (`createJWTForUser`) mints a `jti` (`crypto.randomUUID()`, line 125) as part of every token's payload (line 133), and it is load-bearing — `services/jwt-service.ts:244-245` and the revocation/blacklist machinery described throughout `apps/oauth/CLAUDE.md` and `docs/architecture/api-contracts.md`'s own JWT Structure example (which correctly includes `"jti": "token-uuid"`) key off it. `data-flow.md`'s parallel example of the identical payload omits this field, understating the real shape by one claim (a `jti`-unaware reader of only this page would not know revocation exists).
**Evidence:** `docs/architecture/data-flow.md:60-74` vs `apps/oauth/src/services/jwt-service.ts:125,133` (cross-checked against the correct example at `docs/architecture/api-contracts.md:58-75`).

### CAND-4 — WRONG — LOW
**File:** `docs/architecture/dependency-graph.md:169-171`
**Claim:** "28 internal symbols are marked `@internal` and excluded from the barrel export."
**Reality:** `git grep -c "@internal" packages/core/src` finds 17 occurrences total, across exactly 4 files (`constants/index.ts:1`, `utils/index.ts:5`, `services/dye/DyeDatabase.ts:3`, `services/color/ColorConverter.ts:8`) — not 28. Likely a stale count from an earlier state of the package (core is now at 5.3.0; the dead-code/deep-dive audits since have removed or retagged several symbols per `packages/core/CLAUDE.md`'s dead-code-gate section, which independently describes ~76 `@public`-tagged barrel exports, a different and unrelated number).
**Evidence:** `docs/architecture/dependency-graph.md:169-171` vs `git grep -n "@internal" packages/core/src` (17 hits, 4 files, enumerated above).

## Positive controls (checked, confirmed correct — do not re-chase)

- Dependency graph vs `package.json` `dependencies`/`devDependencies`: every edge in `dependency-graph.md`'s Dependency Matrix (types/logger/auth/worker-kit/test-utils/core/svg/bot-logic → their declared consumers, plus the "transitive only" `LOGGER -.-> {oauth,presets-api,og-worker,api-worker}` and `TEST -.-> …` notes) matches the actual `dependencies`/`devDependencies` blocks of all 17 `package.json` files read (`apps/*/package.json`, `packages/*/package.json`).
- `service-bindings.md`'s `wrangler.toml` excerpts reproduce real **production** values verbatim: discord-worker `RL_15` `namespace_id = "1043"`; presets-api `RL_PUBLIC` `namespace_id = "1011"`; moderation-worker `RL_COMMAND`/`RL_AUTOCOMPLETE` `1031`/`1032`; oauth `RL_AUTH_10` `1021`.
- presets-api prod `TOKEN_BLACKLIST` KV id (`0d6f3be3b4704e91a83e6387b9769e45`) matches oauth's top-level (=production) `TOKEN_BLACKLIST` id exactly, confirming the "shared with oauth" claim in `service-bindings.md` and `overview.md`.
- moderation-worker prod `KV` id (`1fcb7e037ccd4172a47fccd97cf8e753`) matches discord-worker prod `KV` id exactly, confirming "shared with the production discord-worker namespace".
- `overview.md`'s "17 registered commands" / discord-worker command category breakdown matches `apps/discord-worker/src/commands/registry.ts`'s `COMMAND_REGISTRY` exactly (17 entries, same 5 categories, same names, incl. `/a11y` as `accessibility`'s second registration).
- `security-trade-offs.md`'s "Known gap, not closed by 1.2.0" claim about `rateLimitMiddleware` guarding `logger.warn(...)` on `c.get('logger')` alone with no `console.warn` fallback is exactly what `packages/worker-kit/src/middleware/rate-limit.ts:143-156,180-190` does.
- `docs/architecture/security-trade-offs.md`'s FINDING-005 code references (`moderationUnavailable()`, `checkWithPerspective()`, `reserveDailyEvent(db, user, 'text_edit')` before `moderateContent`) match `packages/core`/`apps/presets-api/CLAUDE.md`'s own description of the same code (BUG-015, 2026-09-16 deep-dive) — internally consistent.
- Consolidation numbers: `packages/core/src/data/dyes.json` has 125 entries, 105 with a non-null `consolidationType` (A=85, B=9, C=11); `packages/core/src/config/consolidated-ids.ts` has `A: 52254, B: 52255, C: 52256`. Matches `docs/reference/glossary.md`, `docs/maintainer/adding-dyes.md`, and `docs/architecture/overview.md`/`dependency-graph.md` exactly (incl. "105 of the 125", "11 Cosmic dyes", "9 Ishgardian").
- `packages/core/src/data/facewear_colors.json` has 11 entries — matches "11 Facewear colours" everywhere in the cluster.
- `apps/presets-api/src/handlers/presets.ts:232-247` (status-filter guard, pagination clamps `page ≥ 1`, `limit` 1–50 default 20) matches `api-contracts.md`'s `GET /presets` query-parameter table exactly, including "hidden is never listable" (`MODERATOR_STATUSES` excludes `'hidden'`, so `?status=hidden` 400s before ever reaching the `preset-service.ts` `safeStatus` fallback).
- `apps/presets-api/src/services/preset-service.ts:334-339` (`getFeaturedPresets`, `LIMIT 10`) matches "Top 10 approved presets by `vote_count`" in `api-contracts.md`.
- `apps/presets-api/src/handlers/votes.ts` (addVote/removeVote/check) matches the Votes API section of `api-contracts.md` exactly, incl. the 409 `already_voted` shape and DELETE always answering 200.
- `apps/presets-api/src/utils/api-response.ts`'s `ErrorCode` object (13 members) matches the `api-contracts.md` Error Codes table 1:1 in name and count (only the two rows in CAND-1 have a wrong *description*, not a wrong *membership*).
- `apps/oauth/src/services/jwt-service.ts:125-146` confirms the 9/10-claim JWT shape (`sub, iat, exp, iss, jti, username, global_name, avatar, auth_provider[, discord_id]`) matches `api-contracts.md`'s JWT Structure example exactly, including `jti` (contrast CAND-3, where `data-flow.md`'s parallel example omits it).
- `apps/api-worker/src/universalis/config/cache.ts` TTL/SWR constants (aggregated 300s+120s, data-centers/worlds 86400s+21600s) match `data-flow.md`'s Caching Strategy table exactly.
- `docs/maintainer/dye-maintainer-tool.md`'s tombstone content is internally consistent with `adding-dyes.md`'s "Canonical Procedure" header and with `DEPRECATIONS.md`'s existence (not itself in this cluster, but referenced correctly).
- All outbound relative links found in this cluster (to `../versions.md`, `../audits/...`, `../operations/...`, `../projects/...`, `../developer-guides/...`, `../research/...`, `../historical/...`) resolve to real files — no broken links found.
- `ffxiv-terminology.md`'s "Dye Categories (9 categories)" and "Acquisition Methods (7)" tables reproduce `packages/core/src/data/locales/en.json`'s `categories`/`acquisitions` objects exactly (9 and 7 keys respectively, including the residual `Facewear`/`Facewear Collection`/`Crafting`/`Cosmic Fortunes` entries that are *not* in `dye-vocabulary.ts`'s `DYE_CATEGORIES`(8)/`DYE_ACQUISITIONS`(4) — those are a different, narrower vocabulary that `adding-dyes.md` correctly describes separately, so this is not a contradiction).

## Rejected (looked wrong, were right)

- Suspected conflict between `ffxiv-terminology.md`'s 9-entry "Dye Categories" table (includes `Facewear`) and `adding-dyes.md`/`packages/core/CLAUDE.md`'s "8 categories, Facewear is not one of them": not a bug. The two pages describe two different, correctly-scoped vocabularies — the locale file's translated-label set (9 keys, unpruned) vs. `dye-vocabulary.ts`'s `DYE_CATEGORIES` closed vocabulary actually assigned to dye entries (8 keys). Both docs are accurate about what they each claim to describe.
- Suspected drift in `data-flow.md`'s "Color Matching Flow" (`new DyeService(dyeDatabase)`): `DyeService`'s constructor signature (`new DyeService(dyeData?, options?)`, per `packages/core/CLAUDE.md`) still accepts this call shape; not deprecated, not wrong.
- `overview.md`'s per-app "Recent Highlights" sections (e.g. web-app stopping at v5.0.0/v4.x, discord-worker at v5.0/v4.x) look stale next to current versions (web-app 5.11.0, discord-worker 5.5.7) but the page never claims to be a *current*-version table — mentioning past releases is explicitly allowed by the audit brief, and `overview.md` itself disclaims current versions at the top ("Current versions: see versions.md — this document deliberately carries none").

## Summary

4 candidates (2 MEDIUM, 2 LOW), all fully evidenced against source in this worktree. No HIGH-severity findings in this cluster — no wrong deploy/migration/secret instructions were found; the api-contracts.md error-code mislabeling (CAND-1) is the closest to operationally significant (a client branching on `error` code for the concurrent-moderation case would use the wrong discriminator) but does not itself cause data loss or a security bypass, hence MEDIUM not HIGH.
