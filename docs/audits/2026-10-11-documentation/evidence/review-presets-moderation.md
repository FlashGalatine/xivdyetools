# Evidence: presets-moderation cluster (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for these units.

## Coverage

| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| docs/projects/moderation-worker/overview.md | living | apps/moderation-worker, packages/types | all (tree, commands, custom_id grammar, bindings, secrets, deploy cmds, l10n, anchors) | reviewed |
| docs/projects/presets-api/database.md | living | apps/presets-api | all (tables, indexes, migrations, commands) | reviewed |
| docs/projects/presets-api/endpoints.md | living | apps/presets-api | all routes, bodies, 409 shapes, quotas, auth headers | reviewed |
| docs/projects/presets-api/moderation.md | living | apps/presets-api | all | reviewed |
| docs/projects/presets-api/overview.md | living | apps/presets-api | all | reviewed |
| docs/projects/presets-api/rate-limiting.md | living | apps/presets-api | all | reviewed |

## Candidates

### cand-presets-moderation-01 (MEDIUM, inaccurate)
- Docs: moderation.md:31-34 ("an absent PERSPECTIVE_API_KEY ... the local word list alone decides"); overview.md:183-210 (flow: local clean -> Perspective [clean] -> approved; no no-key branch); moderation.md:71 (auto-approve if clean).
- Source: apps/presets-api/src/services/moderation-service.ts:372-386 (`if (!perspectiveResult)` returns `passed:false, method:'unscored'`, FINDING-019); handlers/presets.ts:1039 (`passed ? 'approved' : 'pending'`); types.ts:73-84. With no key every submission and text edit queues as `pending`. Shipped in presets-api 2.4.0 (f1b54a0f, 2026-10-04), served.
- Why it matters: the doc tells the operator to delete the key before 2026-12-31 as a graceful degradation; in fact that queues everything for manual review. (The code comment at moderation-service.ts:213-216 repeats the stale claim, out of doc scope; presets-api/CLAUDE.md states the truth.)
- Fix: moderation.md:31-34 -> "An absent PERSPECTIVE_API_KEY skips the call, but a clean local pass is then reported as `method: 'unscored'` (`passed: false`) and the preset is queued as `pending` (FINDING-019); production must keep the key until Perspective shuts down, after which every submission queues for a moderator." Add the no-key branch to the overview.md flow.

### cand-presets-moderation-02 (MEDIUM, missing)
- Docs: database.md:184-199 migrations table ends at 0014 (+002).
- Source: apps/presets-api/migrations/0015_rewrite_legacy_dead_letters.sql:1-8 (hand-run AFTER the 2.4.0 deploy; rewrites legacy failed_notifications.payload rows; idempotent).
- Fix: add row `0015_rewrite_legacy_dead_letters.sql | Hand-run after the 2.4.0 deploy: rewrites pre-2026-08-30 failed_notifications.payload rows to the reduced { type, preset_id, moderation_status? } shape; idempotent`. Also database.md:11 header text "migrations/0002...".

### cand-presets-moderation-03 (MEDIUM, inaccurate)
- Docs: moderation-worker/overview.md:40-45 (`wrangler secret put DISCORD_TOKEN` ... "from apps/moderation-worker/").
- Source: apps/moderation-worker/wrangler.toml:11 (top-level name is `xivdyetools-moderation-worker-dev`, workers_dev=false); production is `[env.production]` (line ~62). A bare `wrangler secret put` writes to the dev worker; production needs `--env production`. presets-api/overview.md:~240 already documents this trap.
- Fix: use `wrangler secret put <NAME> --env production` and note the bare form sets the dev worker's copy.

### cand-presets-moderation-04 (LOW, inaccurate) supersedes 2026-09-21-documentation/DOC-017
- Docs: moderation-worker/overview.md:103-106 tree lists env.ts, ban.ts, preset.ts only.
- Source: apps/moderation-worker/src/types/ contains ban.ts env.ts modal.ts preset.ts.
- Fix: add `│   ├── modal.ts               # Modal (submission) types` between env.ts and ban.ts (file order: ban, env, modal, preset).

### cand-presets-moderation-05 (LOW, missing)
- Docs: presets-api/overview.md:58-79 (tree omits middleware/ban-check.ts, body-validation.ts, rate-limit.ts, services/category-service.ts, identity-rekey-service.ts, moderation-retention-service.ts, notification-service.ts, preview-image-service.ts, validation-service.ts, utils/, retention-job.ts); overview.md:81-110 (endpoint tables omit /categories/:id, PATCH/DELETE /presets/:id, rate-limit, refresh-author, preview-image, votes/check, moderation revert/history/stats/failed-notifications, GET /moderation/:id); overview.md:157 and moderation.md Moderation Log table action lists omit `image_approve` / `image_reject`; overview.md:183 "Three-Layer" vs moderation.md "Two-Tier" wording.
- Source: ls apps/presets-api/src/{middleware,services,utils}, src/retention-job.ts; handlers/*.ts routes (see endpoints.md, which is complete); database.md:~86 lists the image actions.
- Fix: refresh the tree, point the endpoint tables at endpoints.md ("abridged"), add the two image actions, and mention the daily Cron retention job.

### cand-presets-moderation-06 (LOW, spelling, supersedes none)
- 2 confirmed: endpoints.md:151 "normalised" (prose); moderation-worker/overview.md:114 "sanitisation" (ASCII-tree comment prose, not an identifier).
- Fix: normalized; sanitization. Top documents: endpoints.md, moderation-worker/overview.md.

## Priors
- DOC-017: STILL_PRESENT (cand-04).

## Seeds
- Sprint 26 custom_id grammar: confirmed accurate. moderation-worker/overview.md:130-145 formats `preset_approve_<uuid>:<revision>:<status>`, reject/revert/reject_modal/revert_modal match packages/types/src/preset/review-custom-id.ts:18-22,98-110; tree note "lives in @xivdyetools/types since REFACTOR-001" matches. No candidate.

## Positive controls
- Deploy targets (bare deploy = routeless dev; deploy:production) match wrangler.toml and package.json for both workers. db:migrate scripts and the d1 execute --file procedure match presets-api package.json.
- Env validation lists (moderation-worker secrets, presets-api six production-required bindings plus JWT_SECRET/JWT_ISSUER/INTERNAL_WEBHOOK_SECRET) match validateEnv.
- Rate-limit values (RL_COMMAND 25/60, RL_AUTOCOMPLETE 70/60, RL_PUBLIC 100/60), daily caps 10/10/20/30, category cache 60s/30s, nonce 120s, limit clamp 50, Perspective 0.7 and 5 s timeout, preview key <=128 all verified.
- All same-page and cross-doc anchors in the six files resolve.

## Rejected suspicions
- "3 subcommands" (moderation-worker table): register-commands.ts defines moderate, ban_user, unban_user. Correct.
- 7 live tables in database.md: matches schema.sql. (failed_notifications has no column section; noted only, low value, folded into cand-05 scope? not filed.)
- `/api/v1/presets/featured` listed after `:id` in overview: documentation order only.

## Spelling per-document
| document | confirmed |
|---|---|
| docs/projects/presets-api/endpoints.md | 1 |
| docs/projects/moderation-worker/overview.md | 1 |
| database.md, moderation.md, overview.md, rate-limiting.md | 0 |
Total 2; dictionary rows: both confirmed; no rejects.
