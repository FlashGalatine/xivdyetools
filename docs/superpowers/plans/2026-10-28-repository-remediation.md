# R-CI and R-DOCS-DECISIONS implementation

**Status:** implemented and verified 2026-10-28; operational activation is held.

**Scope:** execute the two repository sprints in the [dated remediation plan](../../audits/2026-10-26-i18n/REMEDIATION_PLAN.md#sprint-r-ci--repository-toolingworkflows). Source base: `b109d9d9c1a6bf1fe9bf8b5f9cbe3c652c9da11b`.

**Global constraints:** isolated checkout; no merge, package publication, deployment, live cleanup, secret changes, policy activation or private user-data collection. Preserve all application activation holds. Keep actual Perspective policy changes until key deletion. Evidence distinguishes source preparation from live closure. Each file has one writer; coordinator owns shared script registration, audit status/evidence, Git operations and external prose.

### Task 1: Publishing privilege separation

Implement FINDING-049 in `.github/workflows/publish-packages.yml`, new `scripts/publish-packages.ts` and `scripts/publish-packages.test.ts`. Build/test/pack without OIDC; upload tarballs and a bound manifest. A main-only production publisher downloads the same-run artifact by ID, checks identities, digests and packed manifests against reviewed source, then publishes in dependency order using native pnpm 11 OIDC with lifecycle scripts disabled. Do not execute artifact-supplied helpers or install/build/test in the publisher. Preserve single/all-modified detection, exact dependency availability and transitive failure propagation. Add red-first and mutation tests and a local lifecycle dry-run fixture; no registry writes. Report trust limits.

### Task 2: Pages retention and origin checks

Implement FINDING-009 companion in new `apps/web-app/scripts/retain-pages-deployments.mjs` and `.test.js`, existing `smoke-test-pages.js` and `.test.js`, and the two web deploy workflows. Default dry-run; exact two-project identity allowlist; complete paginated inventory, current deployment URL/SHA checks, repeat protection checks before sequential deletion, fail closed on drift/errors. Preserve current production/beta; no blind force or automatic retries of ambiguous deletes. Integrate matching CSP/current custom, canonical, hash and reported branch-alias probes, and actual 404 checks for retired hosts. Apply requires a separate protected activation gate left inactive; feature pushes cannot activate cleanup. No live mutation. Test malformed API, races, pagination, force restrictions, probes and workflow wiring.

### Task 3: Data-subject request runbook

Implement FINDING-053 in new `docs/operations/DATA_SUBJECT_REQUESTS.md` and the operations index. Use exact source-backed D1/KV/R2/Discord/browser/analytics inventories and a private verification/export/deletion/acceptance procedure covering the existing 30-day promises. Identity scope must be independently verified; ban association is not access authority. Include active-ban and recovery-operation holds, inactive session enforcement and unknown JWT limits, precise R2 capture/delete/cache order, vote counts, dead letters, quota handling, analytics and browser limitations. Do not change policy or run live user operations. Return unresolved policy/activation dependencies explicitly.

### Task 4: Dependency floor and documented decisions

Coordinator owns `pnpm-workspace.yaml`, lockfile, root script registration and workflow guard tests, `docs/architecture/security-trade-offs.md`, root `CLAUDE.md` and operation links. Raise the VitePress Vite floor to `>=6.4.5 <7` and correct the stale comment while preserving release-age protections. Verify FINDING-030 already-corrected beta secret guidance and FINDING-035 checklist without duplicating changes. Document FINDING-046's existing v2 path-only signature contract, independent authorization of every query-controlled operation, and the separate coordinated v3 migration prerequisite. No new protocol or runtime authorization change. Correct secret-scanning CI wording without claiming blocked provider features are enabled.

### Task 5: Review and repository gates

Run focused behavior and mutation tests, then root script/type/docs/log/dead-code gates and applicable whole-repository build/type/lint/test gates. Review each independent group and obtain an Astra security review of publisher credentials/artifact handling, destructive retention safeguards, and deletion/identity/session guidance. Fix findings using the assigned writer. No weakened tests or thresholds.

### Task 6: Evidence and local completion

Coordinator records dated evidence, finding statuses and execution updates in the affected source remediation plans, preserving historical snapshots. Record remaining live acceptance/default-branch Dependabot and activation dependencies. Scan the outgoing diff for secrets, stage only owned files and make local commit(s). Keep the private XIVAuth report out of Git. No unrelated application release/version bump or automatic push.
