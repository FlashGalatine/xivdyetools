# Security remediation final integration review

## Verdict

**PASS.** No application-code blocker or cross-slice security regression was found in `71fc2233..3095b8ce`. The six fixes compose correctly, their version/changelog records agree, and the original findings correctly remain OPEN pending authorized deployment and acceptance checks.

## W1 disposition — RESOLVED IN RUNBOOK

The updated `docs/operations/security-remediation-2026-09-15.md:32-55` selects a coherent workflow-control procedure rather than relying on local commit order or an assumed production-environment pause:

- It records the original state and holds all five affected production deploy workflows plus the Discord and OG beta workflows, while leaving CI, secret scanning, and package publishing enabled.
- It explicitly inspects and cancels or finishes already queued/running jobs because disabling a workflow does not cancel them.
- It uses cumulative, ordered merge endpoints and temporarily re-enables only the unit being manually dispatched at the just-merged `main` revision. This prevents push-triggered cross-workflow races while preserving independent Sprint 0 releases.
- It includes all four auth-path consumers: Discord, moderation, presets-api, and OAuth.
- It deploys the exact-image-key presets API before the Discord key-bearing producer, applies and verifies migration 0014 before the first revision-aware owner API, and keeps beta Discord held until the separate beta API/database satisfies the same prerequisites.
- It records commit/run IDs, stops downstream rollout on failure, preserves compatible database additions, and restores each workflow to its recorded original state, including workflows that began disabled.

No remote hold has been applied by this documentation change. Recording current workflow states, resolving queued jobs, and establishing the seven holds remain mandatory deployment prerequisites before the first release merge/push.

## Integration findings

| Area | Result | Evidence |
|---|---|---|
| Auth API compatibility | PASS | `verifyDiscordRequest(request, publicKey, options?)` and its `{ isValid, body, error? }` result remain unchanged. The new negative-cap behavior is fail closed; ordinary bodyless, below-cap, timestamp, header, and error paths retain their contract. |
| Auth consumer coverage | PASS | Discord imports auth directly (`apps/discord-worker/src/index.ts:17,706`); moderation re-exports it through `src/utils/verify.ts` and calls it at `src/index.ts:159`. Both depend on `workspace:*`, so their builds bundle the patched source. OAuth and presets-api also consume auth but do not call this Discord verification helper. |
| Signature/raw-byte preservation | PASS | `packages/auth/src/discord.ts:143-147` decodes once for downstream JSON parsing but passes the original assembled `Uint8Array` to `verifyKey`. Chunk boundaries and malformed UTF-8 cannot change the bytes being authenticated. The stream is cancelled on first over-cap chunk (`:128`) and the reader lock is released. |
| Independent GitHub cap | PASS | `apps/discord-worker/src/index.ts:510-549` rejects declared oversize bodies early, bounds actual streamed bytes, cancels on the first overflow, and invokes HMAC only after an in-cap body is assembled. Valid multibyte UTF-8 remains byte-for-byte equivalent through decode for the existing string HMAC helper. |
| Preview producer/consumer contract | PASS | Presets-api requires the exact pending `preview_image_key` in its final UPDATE; discord validates the canonical UUID key, embeds it in both buttons, and signs it in the request body. Invalid/unversioned actions fail closed. Legacy ID-only controls perform a read-and-refresh only and require a second key-bound click. |
| Preview races and failure paths | PASS | Replacement between display and click produces 409 and cannot approve/delete the newer object. Replacement during legacy refresh can only display an immutable stale key whose second click also conflicts. Missing pending state retires controls; transient lookup/edit failures preserve retryability and use safe ephemeral follow-up handling. |
| Content revision domain | PASS | Migration/schema trigger covers content, owner, status, and revert snapshot columns while excluding votes, preview-only fields, and timestamps. Old moderation-worker hide/restore updates touch `status`, so the migration makes them advance the token without a coordinated source release. |
| Owner/status/revert CAS | PASS | Owner UPDATE binds ID, authenticated owner, and captured revision. Status binds observed status plus revision. Revert binds revision plus exact raw `previous_values`. The trigger's monotonic counter closes same-state and ABA races; zero-row results return 409. |
| Atomic moderation audit | PASS | Status/revert keep UPDATE first and `INSERT ... WHERE changes() > 0` second in one D1 batch. Stale writes insert no audit; uniqueness or audit failures retain rollback and dye-signature collision handling. The reviewed local Wrangler D1 check establishes the trigger does not corrupt top-level `changes()` semantics. |
| Internal-field exposure | PASS | `content_revision` remains on `PresetRow`; every returned row is converted through field-by-field `rowToPreset`, which omits it. Preview keys remain hidden from public preset serialization and are exposed only in moderator/notification paths that require them. |
| OG privacy fix | PASS | `apps/og-worker/src/index.ts:159` disables middleware user-agent logging, and the route event at `:535` emits only normalized tool, locale, and crawler category. Full URL, generated title, and raw UA are gone; the unused human-readable label helper was removed. |
| API compatibility | PASS | External behavior changes are confined to intended security contracts: unversioned/stale preview decisions and stale owner/moderator writes now return 409/validation responses; successful response shapes remain stable. The internal revision is not added to public types. |
| Release metadata | PASS | Auth 2.0.2, discord 5.5.4, moderation 1.7.1, presets-api 2.3.3, and OG 2.10.1 agree across package files, changelogs, root README, and `docs/versions.md`. Presets-api changelog entries preserve the 2.3.1 API guard -> 2.3.2 migration/owner CAS -> 2.3.3 moderator CAS dependency order. |
| Finding status | PASS | `docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md:94-99` leaves all six findings OPEN. The runbook closes them only after deployed-version and bounded acceptance checks (`docs/operations/security-remediation-2026-09-15.md:62`). |

## Regression-test assessment

The added tests cover streamed early cancellation, exact-cap multibyte and raw-byte Ed25519 verification, independent GitHub streaming limits before HMAC, exact preview-key producer/consumer behavior, legacy refresh without a first-click write, stale preview replacement, content-revision ABA/ownership races, stale status/revert behavior with audit suppression, transaction rollback, and coarse-only OG logging. The test cases exercise production builders/routes rather than duplicating the critical SQL or stream logic.

Per review constraints, I did not rerun the whole graph or focused tests. Prior slice results and the local Wrangler D1 migration/`changes()` verification were treated as supplied evidence; this review independently checked the final source-to-test and rollout relationships.

## Deployment prerequisites

1. Confirm the production and beta D1 column/trigger state, then apply migration 0014 exactly once where absent.
2. Execute the selected workflow-hold procedure: record original states, establish all seven holds, and resolve queued/running jobs before the first release merge/push.
3. Publish and verify auth 2.0.2 through the trusted-publishing workflow.
4. Deploy and verify presets-api before enabling discord's key-bearing producer; preserve the migration on rollback.
5. Verify every auth-triggered consumer bundle/deployment, including the OAuth and presets-api workflows that are easy to overlook.
6. Run the documented bounded post-deployment probes, then update finding/catalog statuses from OPEN only when the relevant deployed behavior is confirmed.
