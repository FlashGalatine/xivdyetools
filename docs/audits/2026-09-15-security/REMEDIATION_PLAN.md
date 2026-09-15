# Remediation plan — 2026-09-15

**Sources:** [current security catalog](SECURITY_AUDIT_REPORT.md), 6 findings. **Status basis:** 6 outstanding, 0 fixed, 0 superseded, 0 KEEP, 0 confirmed rotations. The 2026-08-29 security catalog records all 31 items fixed; those are historical controls, not new tasks.

**Ordering:** reachable security issues first; one deploy unit per release step; package publication before consumer rollouts; each Sprint 0 finding ships individually out-of-band. No evidence of an active attack was established. Implementation begins after the user authorizes fixes; this document does not authorize merge/deploy.

## Sprint 0 — urgent independent fixes and rollouts

| ID | Tier | Deploy unit | Action |
|---|---|---|---|
| FINDING-001 | P0 | auth | Replace whole-body buffering with a bounded reader; preserve signature bytes and API error behavior; add early-cancel regression test |
| FINDING-003 | P0 | discord-worker | Independently bound the GitHub webhook body before HMAC; test missing Content-Length and early cancellation |
| FINDING-002 | P0 | presets-api | Require the reviewed image revision and atomically approve/reject that revision only; reject stale/unversioned actions |

These are **three independent fix releases**, not one batch. Details and acceptance checks:

1. **Auth publication:** verify `pnpm turbo run build type-check lint test --filter=@xivdyetools/auth`; decide package version against the registry, update its changelog, then merge and use Actions **Publish Packages to npm**. The package must retain correct signature verification below the cap and stop/cancel input immediately above it.
2. **Auth consumer rollout — discord-worker:** a separate unit gate/release via `deploy-discord-worker.yml`; confirm the fixed helper is bundled. This is a dependency rollout of the first row, not a second finding assignment.
3. **Auth consumer rollout — moderation-worker:** separate unit gate/release via `deploy-moderation-worker.yml`; confirm the same early byte-limit behavior on its public interaction route.
4. **GitHub webhook fix:** its own discord-worker gate/release, independent of the shared helper rollout. No source-level fix in auth changes this route's private reader.
5. **Preview API guard:** presets-api gate/release via `deploy-presets-api.yml`. An absent/stale revision must fail closed; approval/rejection must affect exactly one pending image revision. Test both sequential replacement and an interleaved write. Audit all approval paths, including the website moderation queue.
6. **Preview action producer rollout — discord-worker:** separate gate/release carrying the revision from notification into the button and signed client request. Old notifications must safely conflict or be refreshed; do not temporarily allow unversioned approvals. If the web moderation UI also sends these actions, give its adapter its own web-app gate/release and bundle check.

The API guard may briefly reject old moderation buttons during rollout; a compatibility path that accepts them would preserve the vulnerability. Decide the refresh/reissue user flow before implementing, without widening the authority of any old action.

**Rotation checklist:** none currently required. If the outstanding secret scan finds a real credential, rotate/revoke it before pushing any removal commit; removal alone never closes a leak.

## Sprint 1 — presets-api: preserve moderation decisions under concurrency

| ID | Tier | Exposure | Action |
|---|---|---|---|
| FINDING-004 | P1 | INTERNET-AUTH | Condition owner edits on the authorized record revision; reject/re-evaluate stale writes |
| FINDING-005 | P1 | INTERNET-AUTH | Condition reverts on the reviewed revision/snapshot; preserve atomic audit-log insertion |

Both changes enforce the same record revision contract but protect distinct actors and operations. Each needs a deterministic interleaved-operation test that proves a newer hide/flag/rejection remains in effect. If a persisted revision field needs a migration, prepare its compatible rollout and exact `wrangler d1 execute --file` runbook first; do not assume `d1 migrations apply` is the project path.

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`, then the whole-graph gate before a separately authorized merge; production deployment uses `deploy-presets-api.yml`.

## Sprint 2 — og-worker: terminal privacy hardening

| ID | Tier | Exposure | Action |
|---|---|---|---|
| FINDING-006 | P2 | INTERNET-UNAUTH | Remove raw crawler UA, complete URL and derived title from normal logs; assert fixed coarse fields only |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-og-worker`, then the whole-graph gate before a separately authorized merge; deploy with `deploy-og-worker.yml`. A bare local deploy targets the live beta, so it is not a safe verification command.

## Existing backlog and conflict handling

- [2026-09-02 deep-dive plan](../2026-09-02-deep-dive/REMEDIATION_PLAN.md) retains its unfinished test-strengthening and response/REST-helper convergence work. Current security fixes take precedence; that refactor must follow, because it reshapes the same bot files. No security fix waits for a new shared Discord package.
- [2026-09-01 dead-code catalog](../2026-09-01-dead-code/DEAD_CODE_REPORT.md) and [2026-09-03 i18n catalog](../2026-09-03-i18n/I18N_AUDIT_2026-09-03.md) remain the status basis for their separate scopes. No current confirmed vulnerability is superseded by an approved removal from those catalogs. Their unresolved non-security work remains in its existing records, not silently declared complete or rescheduled by this audit.
- This is the authoritative plan for the six current security findings. Old catalog statuses were consulted for release conflicts; old open non-security claims were not re-audited.

## Verification and completion rules

- Complete Gitleaks tree/history scanning as a separate audit-evidence prerequisite when the binary becomes available. The existing blocked outputs must not be renamed as clean results.
- Use one writer, stage only authorized paths, and use one commit per fix or small unit sprint. Do not stash unrelated user work.
- Every unit boundary gets its gate; run `pnpm turbo run build type-check lint test` before any merge. Web changes also need `pnpm --filter xivdyetools-web-app run build:check`.
- Publishing uses Actions/OIDC with a version decision; each consumer deployment follows separately. Confirm workflow path triggers for shared-package-only commits before relying on automatic rollout.
- Update both each finding's status and the catalog status table after verified fixes. A deployment-dependent finding remains open until the relevant deployments and acceptance checks are done.
- **Superseded findings:** none. **KEEP register:** none. Each of the six current IDs has exactly one primary sprint assignment above; dependent rollouts are explicitly identified as rollouts.
