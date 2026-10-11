# Review: specs-presets (2026-10-11, HEAD 42c35e87 = served 16a6123f source)

## Coverage
| Path | Tier | Units | Sections reviewed | Result |
|---|---|---|---|---|
| docs/specifications/community-presets.md | living | presets-api, discord-worker, moderation-worker, web-app | all 1,375 lines read; schema, API, auth, moderation, commands, web UI, phases, secrets, rate limits checked against source | reviewed |
| docs/specifications/index.md | living | presets-api (+ budget facts in passing) | all 129 lines; budget 2-20/default 8 and 22 quick picks spot-checked | reviewed |

## Candidates
- cand-specs-presets-01 MEDIUM inaccurate: community-presets.md:311 Base URL `presets-api.xivdyetools.workers.dev`; wrangler.toml sets `workers_dev = false`, production is `api.xivdyetools.app` (env.production routes).
- cand-specs-presets-02 MEDIUM inaccurate: endpoint paths. Doc :472/:504 `POST|DELETE /api/v1/presets/:id/vote` -> src/index.ts:257 + handlers/votes.ts:166,204 `/api/v1/votes/:presetId` (and `GET /votes/:presetId/check` :232; already-voted is HTTP 409). Doc :519/:543 `PATCH /presets/:id/status`, `GET /presets/pending` -> handlers/moderation.ts:148,161 under `/api/v1/moderation`. Doc :337 limit max 100 -> presets.ts:250 caps at 50. POST success is 201 and carries `remaining_submissions` (presets.ts:1160-1166); a pending duplicate owned by someone else returns bare 409, no vote (presets.ts:174-215), contrary to :606-609.
- cand-specs-presets-03 MEDIUM missing: endpoint list omits shipped routes: GET /presets/mine (presets.ts:282), GET /presets/rate-limit (:307), PATCH /presets/refresh-author (:334), PATCH|DELETE /presets/:id (:560,:410), POST|DELETE /presets/:id/preview-image (:1178,:1380), GET /categories/:id (categories.ts:101), moderation revert/preview-image/history/stats/failed-notifications (moderation.ts:258-565).
- cand-specs-presets-04 MEDIUM inaccurate: auth. Doc :316-320 and :1236 say bot Bearer `BOT_API_SECRET` only, "Bot-only" submission. Truth: bot calls also need HMAC v2 headers + single-use nonce, `BOT_SIGNING_SECRET` (auth.ts:195-290, types.ts:137); web callers use an oauth-issued JWT (auth.ts:292-330) and submit/vote/edit directly. Secrets list :1256-1267 omits BOT_SIGNING_SECRET, JWT_SECRET, INTERNAL_WEBHOOK_SECRET (types.ts:137,154).
- cand-specs-presets-05 MEDIUM inaccurate: moderation pipeline. Doc :613-821, :1313-1314, auto-approve :811-815. Truth (moderation-service.ts:349-392): `moderateContent(name, description, env, logger)` has no locale/language detection, no `franc`, no `bad-words`; en list is the single entry `ai slop` (data/profanity/en.ts); Perspective is not optional in effect: no `PERSPECTIVE_API_KEY` returns method `unscored`, passed:false -> queued for a moderator (:377-384); an unanswered call queues too (`perspective_unavailable`, :222-231); attributes also INSULT/PROFANITY (:195-199); API sunsets 2026-12-31 (:203-215). Secrets table :802-804 "Required: No" misleads.
- cand-specs-presets-06 MEDIUM inaccurate (status annotations): Phase 4 :1317-1318 tick webhook and DM notifications as done, but :871-876 says that path was deleted 2026-09-01 and :1262 says the secrets were removed; :825-834 still opens in present tense ("the system sends"). Phase 2 :1300 "5 slots" vs six (`dye1`-`dye6`, discord-worker schemas.ts ~1090-1135).
- cand-specs-presets-07 LOW inaccurate: schema section. :80 "migrations 0002-0013" but migrations/ runs to 0015 (0014_add_content_revision, 0015_rewrite_legacy_dead_letters); presets table omits `content_revision` and its trigger (schema.sql:36-58); moderation_log action list :173-174 omits `image_approve | image_reject` (schema.sql:23). :602 "generated column" contradicts :126-128 (plain column).
- cand-specs-presets-08 LOW inaccurate: :5 "Types defined locally in each consumer" and :234 "SHARED TYPES (xivdyetools-core)"; the preset types live in @xivdyetools/types (packages/types/src/preset/; presets-api/src/types.ts:14-27 re-exports them).
- cand-specs-presets-09 LOW inaccurate: Web App Integration :1109-1156 (mock with a `Community` category, "Use the /submit-palette command on Discord") and Future Enhancements :1364 "Web App Submissions - Add Discord OAuth" are not labelled proposals and contradict :67-68; web-app ships submit/edit (components/preset-submission-form.ts, preset-edit-form.ts). File Changes Summary :1326-1356 lists `xivdyetools-worker/...` paths that do not exist and carries no history label.
- cand-specs-presets-10 LOW missing: Rate Limits :1244-1248 lists only the submit cap; rate-limit-service.ts:24-45 also caps flagged edits 10/day, preview uploads 20/day, text edits 30/day.
- cand-specs-presets-11 LOW spelling: see below.

## Positive controls
Eight seeded categories match schema.sql:17-24; partial unique index and 0007 drop of `community`; submission_events kinds; 10 submissions/day; 100/min per user and per IP with RL_PUBLIC; banner at :969-983 matches registry (`/preset` subcommands, moderate|ban_user|unban_user on moderation-worker with pending/approve/reject/stats); featured top 10; sort popular|recent|name; name 2-50, desc 10-200, dyes 3-6, tags 10x30, secondary categories 2; index.md budget match line 2-20 default 8 and 22 quick picks.

## Rejected
- community-presets.md:104 `colours`: verbatim quote of the schema.sql:24 seed (standing rejection pattern).
- index.md:109-110 "22 quick-pick presets" sits under a web+Discord item but the list is discord-worker only (services/budget/quick-picks.ts); too ambiguous, other cluster owns budget spec.
- Seed (1): not a defect to flag labelled "Not shipped" body (:878-948); only the ticked Phase 4 boxes and the unlabelled present-tense lead-in are wrong.

## Spelling per document
| Document | Confirmed |
|---|---|
| docs/specifications/index.md | 2 (:95 Colour, :97 centre) |
| docs/specifications/community-presets.md | 0 (:104 rejected) |
Total 2.
