# Server apps review

- Snapshot: 6da3ff5b, eight apps except web-app; worker routing gpt-6.1-sol high, instruction-only custom role per coordinator.
- Read-only audit; only this review, candidates-workers.json and read-files-workers.txt are written. No tests, builds, external probes or Git writes.
- Coverage authority: read-files-workers.txt. All 281 inventoried files reviewed: 217 runtime /src TypeScript/JavaScript files and 64 auxiliary source/config files (TS/JS/MJS/Vue/Python/SQL/CSS). READ_CODE means executable/type lines read in bounded numbered slices; standalone comments/blank lines generally omitted. Vue scripts/templates and styles were read separately; READ_STYLE marks the standalone stylesheet. Truncated batches were revisited with smaller ranges. No PENDING files remain.
- Unit totals (runtime plus auxiliary): api-worker 65; discord-worker 71; image-worker 6; moderation-worker 29; oauth 19; og-worker 28; presets-api 48; stoat-worker 15. Tracked test files/test scaffolding, generated JSON/data/font assets, Markdown, lockfiles and TOML/JSON configs are outside this source ledger. Relevant tests and unit/root guidance were read separately. No runtime source file remains partly reviewed.

## Candidates
- Eight candidates in candidates-workers.json: seven BUG and one OPT, all provisional LOW. Coordinator owns independent verification and final IDs/severity.
- workers-01: last-slot concurrent submissions both roll back but their append-only quota events survive (presets.ts:1075,1095; rate-limit-service.ts:379). Existing overshoot test uses one mocked request (tests/handlers/presets.test.ts:688), so it cannot detect lack of a winner.
- workers-02: primary-only category promotion can repeat a retained secondary (presets.ts:611,1519; validation-service.ts:331; preset-service.ts:687). Existing cases provide secondaries, never this merged-state combination (tests/handlers/presets.test.ts:2975,3001,3059).
- workers-03: POST returns vote_count=0 after auto-vote commits (preset-service.ts:430; presets.ts:1081,1163). Success test checks name/status, not vote count (tests/handlers/presets.test.ts:606).
- workers-04: preview author uploads/deletes lack image-key CAS and zero-change handling, leaving orphan objects under overlap (presets.ts:1191,1313,1330,1412). Re-upload test is sequential (tests/handlers/presets.test.ts:1865,1895); moderator key binding tests are a positive control, not coverage for this path.
- workers-05: legal escaped names overflow the one-description favorite list (discord preset.ts:1324,1334; sanitize.ts:23; preset-favorites.ts:34).
- workers-06: 50-favorite list still makes 50 getPreset calls (discord preset.ts:1310); carries forward OPEN Oct4 OPT-003 and overlaps security FINDING-024.
- workers-07: favorite list catches 503/429/network errors as removed presets (discord preset.ts:1311,1318; preset-api.ts:240). No favorite-list cases exist in preset.test.ts.
- workers-08: /glamour ignores safeEdit=false, so delivery failure defaults to successful telemetry (glamour.ts:185; discord-api.ts:259; command-trace.ts:235). glamour.test.ts:16 mocks true; :147 checks payload. Separate from package-owned truncation math.

## Positive controls
- presets-api status/revert writes condition on revision/status and batch their audit rows behind changes(): apps/presets-api/src/handlers/moderation.ts:224,329.
- Preview moderation binds the exact image key plus pending state: apps/presets-api/src/handlers/moderation.ts:425,445.
- Self-rekey is guarded and rekey mutations also test bans atomically: apps/presets-api/src/services/identity-rekey-service.ts:45,50.
- Retention failure propagates through scheduled waitUntil after summary collection: apps/presets-api/src/retention-job.ts:101,132.
- OAuth POST callbacks bind PKCE to signed provider state before token exchange: apps/oauth/src/handlers/callback.ts:119; apps/oauth/src/handlers/xivauth.ts:149.
- Image processing checks container dimensions before decode and frees independent Photon images: apps/image-worker/src/photon.ts:187,212,279,294.
- Chara pending work is registered with the owning request's waitUntil, capacity bounded, and cleaned by exact entry identity: apps/api-worker/src/chara/lookup-loader.ts:23,109,111,152.

## Rejected suspicions
- Fully cached chara responses returning version=null are the explicit response contract, not a new regression: apps/api-worker/src/chara/types.ts:106; apps/api-worker/docs/reference/chara.md:60. Web client uses unversioned icons (coordinator checked downstream).
- Duplicate categories cannot double category counts because the SQL joins through OR/EXISTS, not one row per JSON element: apps/presets-api/src/handlers/categories.ts:47. workers-02 concerns stored invariant/UI consistency only.
- Stoat MessageContextStore is insertion-order rather than LRU, but reaction consumers remain unwired; no user-facing defect filed: apps/stoat-worker/src/services/message-context.ts:38; apps/stoat-worker/src/index.ts:79.
- Image-worker null JSON /extract is the earlier deep-dive rejection: service-binding-only surface and strict internal caller; not refiling it (apps/image-worker/src/index.ts:135; docs/audits/2026-10-04-deep-dive/DEEP_DIVE_REPORT.md:307).
- First-run send failure is deliberately non-retrying: marker written before send by explicit policy (apps/discord-worker/src/index.ts:880). No new candidate.
- Favorite autocomplete whole-list writes can overwrite concurrent favorites, but Oct4 BUG-047 explicitly identifies this as the known KV read-modify-write limitation and leaves it ungraded (findings/BUG-047.md:10); not refiled. Current deadline/error handling addresses that finding's graded defect (apps/discord-worker/src/index.ts:1375,1392,1439).
- OG card/page ranking divergences are explicitly documented accepted gaps (apps/og-worker/CLAUDE.md:180 onward): companion counts, perceptual override, extractor dedupe, legacy spelling/URLs. No speculative duplicates filed.

## Existing audit overlap
- Security 2026-10-26/FINDING-018 concerns unreserved upstream moderation work; workers-01 separately concerns quota consumed by two refused creations.
- Security 2026-10-26/FINDING-019 preview decode refunds, FINDING-020 16-bit decode memory, FINDING-015 ban/status race, FINDING-023 stale OAuth link, FINDING-025 dual identity bans are tracked elsewhere, not duplicated.
- Security G37 is an explicit deep-dive handoff. workers-08 handles adapter delivery accounting; coordinator/package reviewer owns the separate library embed-tail calculation. The helper does log failure: the defect is false success telemetry and undelivered result, not absent logs.
- Oct26 dead-code report overlaps were considered: DEAD-014 (attachment fileText), DEAD-018/019 (api-worker redundant branches/exports), KEEP-025 (row-cache revalidation), KEEP-042/043 (version response/icon pin) were not duplicated. Historical IDs here refer to docs/audits/2026-10-26-xivcharakit-dead-code/DEAD_CODE_REPORT.md.
- Parked stoat-worker produced no new candidate; any later finding there must carry P3 per coordinator.

## Validation limits
- Static source and targeted test review only. No tests, builds, benchmarks, deployments, live API probes or Git writes performed by this worker. Coordinator owns gates and runtime repros. Candidate test_gap fields identify exact missing scenarios; none is presented as an executed reproduction.
