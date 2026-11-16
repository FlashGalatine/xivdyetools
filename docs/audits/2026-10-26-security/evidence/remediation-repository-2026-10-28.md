# R-CI and R-DOCS-DECISIONS — execution evidence, 2026-10-28

**Base:** `b109d9d9c1a6bf1fe9bf8b5f9cbe3c652c9da11b`.
**Branch:** `codex/sprint12-repository-20261028`.
**Scope:** the two repository sprints in the [merged plan](../../2026-10-26-i18n/REMEDIATION_PLAN.md#sprint-r-ci--repository-toolingworkflows).
Source implementation and independent reviews are complete; repository gate receipts follow below.

No production merge, npm publication, Worker/Pages deployment, live deletion, secret change,
policy activation or per-user data access occurred. Existing application activation holds
remain. The private XIVAuth report remains outside Git.

## Dependency floor — FINDING-031

- Raised `vitepress>vite` to `>=6.4.5 <7` and corrected the stale FINDING-036 comment.
- Installed VitePress resolves Vite **6.4.5**. npm reports publication at
  `2026-10-21T05:35:48.976Z`; the unchanged `minimumReleaseAge: 1440` admits it.
  No release-age exemption or build-script permission was added.
- Lockfile changes replace Vite 6.4.3 and remove its old Rollup 4.59.0/platform snapshots;
  the new Vite resolution shares the existing Rollup 4.64.7. No unrelated version upgrade.
- Frozen installation passed. A sandbox `pnpm why` attempt could not open the package-store
  SQLite database; the normal-host read passed and confirmed the VitePress dependency.
- Read-only GitHub check on 2026-10-28: default-branch Dependabot alerts **13–17 remain open**,
  each naming first patched version 6.4.4. Branch resolution is patched; automatic closure
  remains a default-branch integration acceptance check. No alert was manually dismissed.

## Publishing privilege boundary — FINDING-049

The build/test/pack job has no OIDC permission. A separate main-only `production` publisher
downloads the same-run artifact by ID and checks repository/SHA/run/attempt, package set,
hashes, source identities/versions and packed dependencies before any publish. The helper
comes from freshly checked-out source, never the artifact. Native pnpm 11 runs from an
isolated temporary directory with lifecycle scripts disabled and without a repository install.

This prevents dependency/build/test/lifecycle code from receiving the publishing identity.
It does not prove build honesty: a compromised builder can produce malicious package bytes
and matching hashes. No actual npm publication or workflow dispatch was performed.

Review found archive-interpretation differences between external tar and pnpm. The final
stdlib reader accepts a strict bounded USTAR subset, validates canonical raw/prefix paths,
header/checksum/type/size/padding/end markers and exactly one manifest, and rejects extension
formats or nonzero trailing archive data. All seven real pnpm 11.17.0 package tarballs pass.
Packed registry/config overrides fail closed. Future unsupported archive formats require
review rather than a permissive fallback. Run-attempt binding requires rerunning the whole
workflow/build after a publish failure.

## Pages history companion — FINDING-009

The [2026-10-26 cleanup receipt](remediation-finding-009-2026-10-26.md) remains historical.
A fresh GET-only Cloudflare observation on 2026-10-28 found production current `970e253a`
with one deployment, and beta current `5c880756` at `b109d9d9` with eight deployments.
No deployment was deleted. Public origin GETs in the sandbox failed DNS resolution;
those failures prove neither a 404 nor preservation of a current origin.

The new companion defaults to dry-run and restricts operations to the exact two project
identities. It validates complete paginated inventories, expected deployment URL/commit and
fresh current protection, and stops on drift or ambiguous delete results. Both deploy
workflows call it after smoke checks without `--apply`. Deletion additionally requires
`PAGES_RETENTION_APPLY=true`; changing that setting alone cannot activate these calls.

Smoke checks compare the built CSP and current HTML across the custom, canonical, expected
hash and reported branch origins; retired hosts must return actual HTTP 404 without
redirects. Operational closure still requires a reviewed apply activation, serialized
post-deploy execution, retained/deleted receipts and successful live origin probes. The API
offers no atomic conditional delete; an external rollback can race the final protection check.

## Documentation and process

- **FINDING-030:** rechecked the already-corrected A-DISCORD source guidance. Beta must not
  receive `BOT_API_SECRET` or `BOT_SIGNING_SECRET`; the genuine-row warning is conditional
  on violating that boundary. No duplicate implementation or live secret reread. The
  2026-10-26 secret-name evidence remains inherited.
- **FINDING-035:** both web/bot Terms of Service are already in the Perspective sunset
  checklist. Actual six-file policy updates remain tied to key deletion, with the inherited
  before-2026-12-31 deadline. Neither policy nor key changed here.
- **FINDING-046:** documented the existing path-only v2 contract and independent query
  authorization in [security trade-offs](../../../architecture/security-trade-offs.md#bot-v2-signatures-bind-the-path-only)
  and auth JSDoc. Replay detection is explicitly best-effort/non-atomic KV, not guaranteed
  single use. Query signing would require a separately coordinated v3 migration.
- **FINDING-053:** added the [data-subject runbook](../../../operations/DATA_SUBJECT_REQUESTS.md)
  and operations index link. It inventories D1/KV/R2/Discord/browser/analytics, verified
  identity scope, export redaction, deletion ordering/count guards and the 30-day case
  deadline. Active-ban binding, unresolved recovery and inactive session-enforcement
  constraints are explicit holds. It supplies reviewed SQL components, not an authorized
  production runner or a new policy exception.
- **OPS-SECRET-SCANNING:** corrected the CI comment: Gitleaks generic patterns complement
  GitHub provider scanning; native non-provider patterns and validity checks remain
  eligibility-blocked. No settings or scanner rules weakened.

## Verification and review

- Runbook SQL: **22 statements** compile against fresh in-memory source schemas; synthetic
  deletion/recount, legacy dead-letter handling and snapshot drift accept/reject checks pass.
- Staged-path link gate: **1,131 links / 262 documents**, all resolve (before final evidence links).
- Independent Astra-high security review: FINDING-053 passes documentation acceptance;
  FINDING-046 passes after the nonce wording correction. Deployed parity, actual erasure,
  active-ban provider retention decisions and unknown-session limits remain operational checks.
- Publisher: **53/53 tests**, zero skips; **12/12 mutations caught**. Real native-pnpm
  lifecycle dry-run leaves the execution sentinel absent; all seven real packed manifests
  verify, including workspace dependency rewriting. No registry write.
- Pages retention/smoke: **120/120 tests**, including documented null/empty-object delete
  receipts and fresh current/candidate reconciliation. **6/6 mutations caught** across
  initial safeguards and the receipt correction. Syntax/formatting/scoped script lint pass.
- Independent Sol-xhigh regression review and Astra-high source review accepted both groups
  after the archive and receipt corrections. FINDING-009's live acceptance remains held.
- Root script suite: **220/220**, zero failures/skips; script type-check passed.
- Static gates: **34 version claims**, **1,134 links / 263 documents**, **7 worker configs**;
  dead-code scanned **648 production / 646 test files**. Bundle budgets and six-language
  i18n validation passed (**1,197 keys / locale; 1,168 references**).
- Whole-repository final graph: **PASS — 62/62 tasks**, **54 cached / 8 executed**, with
  **17 test tasks / 608 files / 17,680 tests passed**, no failed/skipped test summaries.
  The first forced run collected
  the nine receipt red-first assertions while their fix was being written; it is retained
  as a failed intermediate run. The next concurrent run timed out in unchanged moderation
  `env-validation-gate.test.ts` at its first cold app import. Focused **8/8** and full-unit
  **846/846 / 35 files** pass without code/timeout changes (**9/9 tasks; zero cache**).
  The passing serial rerun avoids concurrent application suites; no assertion or threshold relaxed.
  A restricted Miniflare loopback EACCES attempt is separate from the normal-host unit pass.
- Local Gitleaks **8.30.1** scanned the staged diff with zero findings. No scanner rules,
  fingerprints, test thresholds or timeout budgets were relaxed.

## Release boundary

### Linux CI fixture follow-up, 2026-10-28

The first PR #351 CI run failed one script test: `rejects duplicate packed manifests`
expected the manifest-count rejection but received `unsupported archive entry type`.
GNU tar encoded the repeated filesystem path as a hardlink; Windows bsdtar emitted two
regular members. The runtime correctly rejected the hardlink before reaching the intended
guard. [Failed check](https://github.com/FlashGalatine/xivdyetools/actions/runs/40790334707/job/123173696058).

The fixture now uses the existing USTAR member helper to construct two explicit regular
manifest entries. The exact duplicate-count assertion and runtime validator are unchanged.
An independent verifier confirmed the test-fixture classification. The complete local script
suite passes **220/220**, zero skips; removing the uniqueness guard in an ignored scratch
copy makes the repaired test fail. Linux CI must confirm the updated PR head independently.

Repository tools/docs only; no new application runtime release or package API change.
Auth JSDoc rides its existing Unreleased notes; Pages tooling notes fold into the prepared
web-app release. No root player-facing changelog entry or public announcement is needed.
Keep this branch local until a separate push/PR action. Existing A-sprint deployment and
package adoption prerequisites are unchanged.
