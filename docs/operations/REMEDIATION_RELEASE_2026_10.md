# October 2026 A/R/H release and adoption runbook

**PREPARATION ONLY — production activation is on hold.** No main/master merge, package
publication, remote migration, deployment, activation, workflow dispatch or announcement is
authorized by this document. Each execution gate below requires a later explicit authorization.

Reference source: `cea587fa276b502a246f6c5fe0d1cfe9a03ef55f` ([PR #365](https://github.com/FlashGalatine/xivdyetools/pull/365)).
Release-cut baseline: `13c386e5983fe58ff17ac08fb5712239feb2e696`. Recheck main before execution.
The [isolated-cut evidence](../audits/2026-10-26-security/evidence/remediation-isolated-cuts-2026-10-29.md)
and [normalized receipt](../audits/2026-10-26-security/evidence/isolated-release-cuts-2026-10-29.json)
bind the candidate heads, trees, scoped companions, gates and observations used here.
The earlier source-stack PRs (#337 to #365 and #367) and #390 were closed as superseded on
2026-10-31; their branches stay as review history (section 9). Use the isolated cut queue below
when selecting future releases; reopening and merging a source-stack PR would bypass that split.

## 1. Establish an effective production hold before integration

**Configured on 2026-10-29:** the `production` environment now requires review by
`FlashGalatine`; administrator bypass is disabled. Its existing custom branch policy still
permits exactly `main`. Self-review prevention is off so the sole maintainer can explicitly
approve a run they initiated. No wait timer was added. Two fresh GET readbacks matched the
configured rule; no deployment was approved or dispatched to exercise the approval UI.

The configured gate protects jobs selecting `production`. Continue **not merging, dispatching
or approving** while activation is held. A logger-only merge matches all eight production workflows;
auth matches four, core/SVG five, worker-kit seven and bot-logic two. Lock/workspace/Turbo/base
TypeScript changes match all eight. These independent jobs can start before npm publication or
provider acceptance. Package builds consume workspace source; unavailable registry versions do
not prevent app deployment.

Before any production integration, recheck the reviewer, administrator-bypass and main-only
rules. Approval UI behavior remains a live execution gate, not a tested preparation result.
[GitHub documents environment approvals separately from branch restrictions](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).
The five queue-status queries returned zero runs at the recorded check. Recheck for stale work
before any later approval; none was canceled in this pass. **Rule (2026-10-31):** reject or cancel every stale production run that is waiting for review or pending in its workflow's concurrency group before the next merge that matches the same workflow, and never cancel an approved run in progress; each deploy workflow's single concurrency group has `cancel-in-progress: false`, so a stale run left waiting can hold up the selected one (section 9; unit acceptance AP-06). Approve only an explicitly authorized,
selected source/run. Approving the package publisher must not approve any app deployment.

The root `CHANGELOG-laymans.md` announcement is a separate Discord webhook path. A production
Actions approval gate does not suppress it. Every prepared cut preserves main's
root announcement file until the announcement is separately selected and authorized. An
alternative announcement hold needs separate review. Per-app bundled changelogs have their own release
boundary. Do not send a real webhook as a preparation test.

All three automatic Discord/OG/web beta workflows exclude flat `codex/release-cut-*` branches
in the bootstrap cut. Every candidate uses that exact flat prefix; do not push the private
builder branch or rename cuts outside it. Hosted branch-run checks found no beta deployments.
Other feature pushes can still run those beta workflows. Those are not isolated
production-data test environments: several service bindings target production, and web beta
uses production preset data. No beta dispatch or live acceptance exercise is authorized here.

## 2. Construct and validate selected source cuts

The reference cumulative stack changes **1,252 files** from observed main. Its 33 PRs (#333–365) are
source/review boundaries, not an executable production release queue. Do not merge the stack
in PR-number order or infer a hold from draft status, successful CI or unpublished packages. (2026-10-31: the audit-docs PRs #333-#336 are carved out of this rule and merge first, in order; see section 9.)

The new queue contains 18 source cuts, built cumulatively from the release-cut baseline in an
isolated worktree, plus a documentation receipt companion. Each source cut has its own scoped
ownership, whole-graph and root gates, applicable coverage and bundle/font checks, and secret
scans. Turbo cache reuse is recorded per cut. Discord's final two-file documentation qualification
has a separate receipt from its validated runtime tree. Hosted CI binds each final PR head.
The normalized receipt records exact heads, trees, parents and controlled deviations; it does
not imply live provider, schema, policy or resource acceptance.

| Cut | Prepared unit | Candidate | Draft PR | Hosted CI |
|---|---|---|---|---|
| 00 | bootstrap | `9e6341ddc9cf` | [#369](https://github.com/FlashGalatine/xivdyetools/pull/369) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40898033080) |
| 01 | logger 2.4.0 | `c2410fa919d2` | [#370](https://github.com/FlashGalatine/xivdyetools/pull/370) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40898690789) |
| 02 | auth 3.0.0 | `9958553e11a3` | [#371](https://github.com/FlashGalatine/xivdyetools/pull/371) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40899976140) |
| 03 | core 5.16.0 | `0fed2b3744c2` | [#373](https://github.com/FlashGalatine/xivdyetools/pull/373) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40902784155) |
| 04 | worker-kit 1.6.0 | `489b9c5e9282` | [#374](https://github.com/FlashGalatine/xivdyetools/pull/374) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40902809507) |
| 05 | svg 4.4.1 | `f42786596cf1` | [#375](https://github.com/FlashGalatine/xivdyetools/pull/375) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40904626927) |
| 05a | discord-fonts-prerequisite 5.9.1 | `c2d6231190d6` | [#376](https://github.com/FlashGalatine/xivdyetools/pull/376) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40911743491) |
| 06 | bot-logic 4.12.0 | `ebba1baaa08a` | [#377](https://github.com/FlashGalatine/xivdyetools/pull/377) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40914423702) |
| 07 | oauth 3.2.0 | `cb728e14ebd0` | [#378](https://github.com/FlashGalatine/xivdyetools/pull/378) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40915136281) |
| 08 | presets-base 2.8.1 | `ca352abc7c7f` | [#379](https://github.com/FlashGalatine/xivdyetools/pull/379) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40915830404) |
| 09 | discord 5.9.7 | `47e297d1893f` | [#380](https://github.com/FlashGalatine/xivdyetools/pull/380) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40917240469) |
| 10 | presets-named 2.8.2 | `f54c8d832ba2` | [#381](https://github.com/FlashGalatine/xivdyetools/pull/381) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40917430325) |
| 11 | api 0.21.1 | `c0985720f9e7` | [#382](https://github.com/FlashGalatine/xivdyetools/pull/382) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40920237972) |
| 12 | web 5.16.4 | `0e5c660bda76` | [#383](https://github.com/FlashGalatine/xivdyetools/pull/383) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40920869184) |
| 13 | og 2.12.2 | `d81fece2ed6c` | [#384](https://github.com/FlashGalatine/xivdyetools/pull/384) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40921201682) |
| 14 | moderation 1.9.0 | `99a7ae4dd7da` | [#385](https://github.com/FlashGalatine/xivdyetools/pull/385) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40921843268) |
| 15 | image 1.3.5 | `fe087b42348b` | [#386](https://github.com/FlashGalatine/xivdyetools/pull/386) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40922146681) |
| 16 | stoat 0.3.4 | `315f40075dae` | [#387](https://github.com/FlashGalatine/xivdyetools/pull/387) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40922169825) |

These are stacked review boundaries, not a bulk merge instruction. Immediately before a later
authorized integration, reconcile current main, the selected delta, dependency publications and
provider/schema gates; rerun affected checks after any rebase or content change. Keep the
approval gate in place throughout. Never weaken assertions to manufacture an intermediate release.

Promote the R-CI publisher separation and reviewed repository hardening before real publication.
Current main still has the older combined credential-bearing build/publish job; the prepared
split/main-only publisher is not yet live. R-CI also changes lock/workspace files, so its full
source cut has production fanout and needs the verified hold above. Preserve Pages retention
dry-run mode. Retain the root announcement hold and review policy-bearing app paths separately.

Select final package content, including later H adoption fixes, rather than an early A snapshot:
core's native JSON import attributes, bot-logic's locale import attributes and the six corrected
image-manual locales must survive. The source-tree OIDs in the receipt identify the reference
content; any candidate deviation needs review. An in-repo `workspace:*` success does not prove
that an external npm install works.

## 3. Publish and verify packages individually — held

Use the reviewed Actions publisher on an approved `main` SHA only, after the source/control
gates above. Dispatch one explicitly selected package at a time; do not use `all-modified` for
this wave. Freeze integration while selecting a run and verify its actual source SHA. Its
artifact must come from that same run and pass the existing publisher's complete verification.

| Order | Package | Pending target | Required registry upstream |
|---|---|---|---|
| Existing | types | 3.3.0 | Already published; source tree unchanged from observed main; no republish |
| P1 | logger | 2.4.0 | None |
| P2 | auth | 3.0.0 | None; accepted encoding inputs narrow, so retain the MAJOR decision |
| P3 | core | 5.16.0 | logger 2.4.0, types 3.3.0 |
| P4 | worker-kit | 1.6.0 | logger 2.4.0 |
| P5 | SVG | 4.4.1 | core 5.16.0, types 3.3.0 |
| P6 | bot-logic | 4.12.0 | core 5.16.0, SVG 4.4.1, types 3.3.0; complete manual source |

All six targets were absent at the recorded registry lookups. Refresh exact-version metadata
before every dispatch. Record version, tarball integrity, packed internal pins, real attestation,
source/run/artifact identities and native consumer results. The completed local six-package
consumer exercised 27 native exports, six locale/manual payloads and three real private-producer
JWT cases under Node 22. It compared all 600 packed dist files with the frozen cut-06 build.
Packing and lifecycle-suppression controls used pnpm 11.17; the separate final consumer used
pnpm 10.27 and installed strictly offline after controlled exact public dependency cache fills.
This is local validation, not CI provenance or an actual registry-release artifact. Stop on identity/pin mismatch or an
unexplained existing version. Do not overwrite or blindly republish immutable versions.

The declaration companions for P3 and P6 ([#393](https://github.com/FlashGalatine/xivdyetools/pull/393), [#401](https://github.com/FlashGalatine/xivdyetools/pull/401)) were combined with cut 06 into a verification tip ([#408](https://github.com/FlashGalatine/xivdyetools/pull/408)) that passed a fresh local native proof, and that proof found a third declaration defect in logger 2.4.0 itself, which the published 2.3.0 shares. A repair ([#407](https://github.com/FlashGalatine/xivdyetools/pull/407)) is prepared and recommended before P1; whether to require it is the maintainer's decision. See [section 9](#9-earlier-minor-reconciliation--2026-10-30).

After auth publication, rerun the private test-utils producer against the actual registry
artifact. Test-utils 3.0.0 is private and must never be published. After each other publication,
verify the actual registry artifact before moving to its dependent package or app.

## 4. Resolve the presets/Discord deployment cycle

Presets supplies the capped batch lookup required by the new Discord favorite-list consumer.
Discord supplies `PresetNotifications`, which the integrated presets TOML already selects.
Those edges require **two presets source/configuration releases**, unless a different split is
explicitly designed and verified.

| Phase | Prepared source/configuration cut | Live acceptance before the next phase |
|---|---|---|
| C1 | OAuth 3.2.0, after migration 0002; `IDENTITY_SPLIT_ENABLED=false`, no outbound `BAN_CONTINUITY` binding | Deployed private `IdentityLookup`, current-session/revision behavior and ordinary logins |
| C2 | Presets base cut: final eligible 2.8.1 behavior after migration 0016, with the **default** Discord binding retained | OAuth provider dependency, legacy notification compatibility, capped acting-user batch lookup, quota/image/session-disabled behavior |
| C3 | Discord 5.9.7 with `PresetNotifications` exported and public compatibility retained | Both default and named paths, real manual delivery and capped favorites; no binding-only activation |
| C4 | Presets 2.8.2 configuration companion selecting `PresetNotifications` | Actual submission/edit/preview delivery; verify default/public rollback path remains available |

C2 removes exactly the two named-entrypoint fields while preserving existing targets, resources
and false flags. It carries default-binding assertions plus real notification transport/retry
tests. Wrong-path, dropped-field, disabled-retry and premature-named-selection mutations fail.
C4 restores those two fields and changes the same configuration assertions to require the named
provider; the transport and handler tests remain. Both cuts passed their own full gates and
production-configuration compile-only Wrangler checks. Live provider/delivery acceptance is held.

C4's manifest, technical changelog and version tables now prepare **2.8.2**, distinct from C2's
2.8.1. The recorded scan of 44 pending PR heads found no 2.8.2 conflict and no unavailable head.
Recheck registry versions and intervening releases before any publication/integration; a reserved
version and a green draft PR do not authorize either configuration's deployment.

## 5. Migrations and recovery — held

Schema checks and changes are distinct. Before any mutation, verify the exact account,
database/environment, current schema, file SHA and approved recovery ownership/location.
No database export, row lookup, schema probe or migration was executed during this pass.

| Database | Before dependent deployment | Read-only schema preflight to prepare |
|---|---|---|
| OAuth `xivdyetools-users`, top-level production | `apps/oauth/migrations/0002_identity_transitions.sql`, once | `PRAGMA table_info(users)` and schema definitions for `identity_operations`, `identity_operation_locks` and their constraints/index |
| Presets `xivdyetools-presets`, `--env production` | `apps/presets-api/migrations/0016_ban_identity_continuity.sql`, before presets **and** moderation | Definitions for `ban_identity_memberships`, `ban_continuity_operations`, `moderation_ban_confirmations`, their capacity triggers and retention/lookup indexes |

Use `wrangler d1 execute --file` for a specifically approved migration, never `d1 migrations
apply` or a fresh-schema replay against an existing database. If objects already exist or the
schema is partially applied, stop and reconcile definitions; do not infer success from object
names or blindly replay. Presets membership queries require 0016 even while feature flags are
false. Fresh databases use their separately reviewed fresh-schema route.

Local SQLite preservation/transaction tests are not a production backup/restore rehearsal.
Any backup/export needs an approved exact destination and access/retention scope; keep user data
and private receipts out of Git. Preserve additive schema, immutable pending operations and
locks during code rollback. A timeout or expiry does not prove a remote operation was refused.
After identity/ban activation, rolling back code or restoring either database independently can
undo authorization history; stop for a coordinated recovery decision rather than assuming a
flag toggle or old binary restores safety.

## 6. Remaining app and activation acceptance — held

| Unit | Pending target | Additional release gate |
|---|---|---|
| API | 0.21.1 | Real response budgets/cache behavior, canonical icons, controlled item-name data and limiter behavior after upstream package verification |
| Web | 5.16.4 | Bundle/smoke checks, actual policy/modal/tool behavior; disclose new identity uses before they run |
| OG | 2.12.2 | Real card/copy/cache behavior; retain later F-OG work |
| Moderation | 1.9.0 | 0016, OAuth provider, presets compatibility, both deployed disclosure units, command registration and explicit private review acceptance |
| Image | 1.3.5 | **Independent hard hold:** Cloudflare CPU-policy/resource acceptance, conservative aggregate-memory assessment and deployed corrected manual before lower caps |
| Stoat | 0.3.4 | Private/parked verification only; no activation or deployment |

Moderation's inactive confirmation mode refuses new ban/unban paths. Inactive OAuth also
refuses detected relationship changes. False flags do not mean unchanged user behavior:
approve availability/sign-in impact before shipping these cuts. The raw-HMAC legacy-state
window ended 2026-10-28; preserve its fixed cutoff and account for one sign-in retry.

Keep these source flags false until their own later activation change and acceptance:

- Presets `OAUTH_SESSION_CHECK_ENABLED`, `PRESET_METADATA_MODERATION_ENABLED`.
- Moderation `LINKED_BAN_CONFIRMATION_ENABLED`.
- OAuth `IDENTITY_SPLIT_ENABLED`, with no outbound `BAN_CONTINUITY` binding.
- Discord `PRESET_WEBHOOK_BINDING_ONLY`.

Verify the six web and six bot privacy variants are deployed before new confirmation storage
or display. Consumer activation precedes OAuth's separate continuity-binding/split activation.
Require approved test identities and private-response checks for stale/pending sessions and
particular-ban expansion/unban scope; do not perform these operations against arbitrary users.
Metadata moderation is a separate activation after both review consumers are accepted.

The image limits are effective constants on deployment, **not a false feature flag**. Keep its
workflow unapproved until resource acceptance closes. The stopped 42-request proposal failed
after three matched responses and a fourth 503; its exception does not authorize another hosted
run. Cloudflare's numeric preview policy and production equivalence remain unverified. Caller
updates also need demonstrated compatibility with whichever image version is actually deployed.

Inventory external/manual notification callers before binding-only activation. Keep named
providers exported while consumers select them, including OAuth's `IdentityLookup` while
presets/moderation select it. On rollback, restore and verify public/default notification
compatibility before moving the presets binding back; failed-notification records do not imply
automatic redelivery. Verify actual submit/edit/preview delivery after C4.

The reverse favorites edge also survives rollback: after C3, retain the capped presets batch
endpoint while the new Discord favorites consumer remains deployed. Before rolling presets
back below that provider, first deploy and verify a reviewed compatible Discord rollback.
Keeping notification compatibility alone does not protect this batch dependency.

## 7. Independent repository/operational gates

Pages retention stays dry-run. Enabling deletion requires the separately reviewed `--apply`
and `PAGES_RETENTION_APPLY=true` controls together, serialized execution, protected-current
deployment IDs and live retained/retired-origin receipts. Deletion is not reversed by Worker
rollback. See [PAGES_RETENTION.md](PAGES_RETENTION.md).

Perspective key deletion remains a separate, explicitly authorized operation. Execute its
existing [same-day policy checklist](../../DEPRECATIONS.md) for both privacy and Terms families
and translated variants; do not claim deletion in advance. GitHub scanner eligibility and
default-branch Dependabot closure remain their own open operational gates.

Conditional M source and draft PRs are now prepared in the [M release runbook](REMEDIATION_M_RELEASE_2026_10.md).
Shipping still waits for corrected prerequisite artifacts, external-consumer review and deployed
acceptance. The Core and Bot declaration companions must precede P3 and P6 publication, and the logger
declaration companion is prepared and recommended before P1 (section 9); historical
receipts remain unchanged. No merge before October 30 or later and new explicit approval with
satisfied prerequisites. F-DISCORD/F-OG remain terminal after major/text adoption; unchanged-font
acceptance is not terminal-sprint completion.

## 8. Required receipt for every authorized release

Record the following in private operator evidence where appropriate; publish only redacted
aggregate references in the audit evidence. A blank or mismatched required field blocks release.

| Field | Required evidence |
|---|---|
| Authorization/hold | Human-authorized unit/action, effective protection readback, other workflows still held |
| Source | Approved main/candidate SHA, source-tree diff review, exact configuration and flags |
| Build | Fresh candidate gate/coverage/bundle/font receipts; source and dependency identities |
| Publish | Exact package/version, same-run artifact identity, integrity/attestation and registry install checks |
| Schema | Approved database/environment, preflight definitions, migration SHA, once-only result, recovery owner |
| Provider | Named entrypoint and compatibility accepted before dependent binding |
| Deploy | Exact workflow/run/head SHA, Cloudflare deployment identity and command-registration result |
| Acceptance | Unit-specific behavior, manual/disclosure delivery, authorized test scope and cleanup |
| Stop/recovery | Failure identity, held dependents, rollback compatibility, unresolved operations preserved |

On missing registry versions, unexpected source/configuration, provider absence, resource error,
wrong delivery or unknown identity outcome: stop the dependent release and preserve receipts.
Successful local tests or HTTP health alone do not close these acceptance gates.

The later [conditional F and offline adoption packet](REMEDIATION_F_RELEASE_2026_10.md) records
the final selected text, Discord font verification, OG regional fallback/cache fix and refreshed
native major artifacts. It supplements source preparation only. This runbook's earlier minor
publication, provider/schema/disclosure/manual and separately authorized deployment/activation
requirements remain open. Use each receipt only for its frozen source; changes integrated into
an earlier minor candidate require refreshed artifact/consumer verification there too.

## 9. Earlier-minor reconciliation — 2026-10-30

**PREPARATION ONLY.** This records the reconciliation of the earlier minors (logger 2.4.0 through bot-logic 4.12.0, and web 5.16.4) with the corrective companions prepared after the isolated cuts. It authorizes no merge, package publication, deployment or activation. Every cut below is a draft pull request on a flat `codex/release-cut-*` ref (excluded from all three automatic beta workflows) and changes no version number. Heads, trees, gate results and archive hashes are in the [reconciliation receipt](../audits/2026-10-26-security/evidence/earlier-minor-reconciliation-2026-10-30.json); the narrative and reproduction recipe are in the [evidence note](../audits/2026-10-26-security/evidence/remediation-earlier-minor-reconciliation-2026-10-30.md).

| Cut | Draft PR | Head | Based on | Role |
|---|---|---|---|---|
| e-00 | [#407](https://github.com/FlashGalatine/xivdyetools/pull/407) | `f461b94578c7` | cut 01 | Logger 2.4.0 declaration repair. Prepared; recommended before P1 |
| e-01 | [#408](https://github.com/FlashGalatine/xivdyetools/pull/408) | `71ed0595ccf9` | cut 06 | **Verification tip, not for merge in this form.** Cut 06 plus the logger repair, [#393](https://github.com/FlashGalatine/xivdyetools/pull/393) and [#401](https://github.com/FlashGalatine/xivdyetools/pull/401); its tree equals merging them |
| e-02 | [#409](https://github.com/FlashGalatine/xivdyetools/pull/409) | `b0efa0f26518`; `7fbd756b2c30` after the 2026-10-31 changelog and docs commit | e-01 | PR #390's German and French dye-name corrections, as the maintainer decided on 2026-10-30; Core stays 5.16.0 |
| e-03 | [#410](https://github.com/FlashGalatine/xivdyetools/pull/410) | `e1293ba5e069` | cut 12 | Web 5.16.4 Vite development bridge for Core's native JSON import attributes (development only) |

### What was found

1. **A third declaration defect: logger.** `@xivdyetools/logger` builds with `stripInternal`, yet six declarations that its barrels re-export as published API (`ConsoleAdapter`, `JsonAdapter`, `NoopAdapter`, `BaseLogger`, `LogEntry`, `createWorkerLogger`) carry an `@internal` tag. The emitted declarations are deleted while the re-exports stay, so a consumer compiling with `skipLibCheck: false` meets TS2305 errors inside the package's own `.d.ts` files. **The already-published logger 2.3.0 has the same defect** (read from its registry tarball on 2026-10-30). The first native proof of the integrated tip found it: the ten Core and Bot Logic repairs compiled clean and only logger failed. e-00 repairs it inside the pending 2.4.0 with no new version. It is **prepared and recommended before P1**; whether to require it before the logger publisher runs is the maintainer's release-policy decision, not an approved gate. A 2026-10-30 follow-up (preparation-session record; [unit acceptance checklist](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md), unit 1) also found that under `skipLibCheck: true` the six symbols silently become `any`, and that importing `createWorkerLogger` from `/worker` fails under either setting.
2. **Earlier strict-declaration receipts do not cover logger.** The M and F wave receipts recorded strict acceptance for Core, SVG and Bot Logic entry points only, and the F tip still ships the unrepaired logger source. e-00 merges cleanly onto the A/R/H end state and onto the F tip.
3. **The companions combine cleanly.** e-01's tree equals merging the logger repair, #393 and #401 onto cut 06 in any order. Core's and Bot Logic's `dist` are byte-identical to the backport archives; the tarballs differ only in the key order that `pnpm pack` writes into `package.json`.
4. **Text selection converges.** e-02 takes #404's blobs unchanged wherever the baseline is identical, so the Core 6 line later merges as a no-op for those files. The generator reproduced the committed German and French payloads exactly. If e-02 is adopted, the frozen Core 5.16.0 archive is the e-02 refresh and Core 6 ships no text change.
5. **Web 5.16.4 now has the development check.** e-03 carries the plugin, unit test and Hair/Skin e2e spec that #402 carries (identical blobs) and leaves `docs/versions.md` untouched so it cannot collide with #402's row when both merge.

### Intended merge order, when a merge is separately authorized

First the audit-docs PRs [#333](https://github.com/FlashGalatine/xivdyetools/pull/333) to [#336](https://github.com/FlashGalatine/xivdyetools/pull/336), in order: they are docs only and outside the deploy queue (2026-10-30 open-PR audit), and section 2's rule against merging in PR-number order concerns the source stack, not them. When cut 00 and cut 17 (#388) are later updated with `main`, take the cuts' versions of the add/add `FINDING-009.md` (both) and `FINDING-046.md` (#388) files. Then the image hold guard [#412](https://github.com/FlashGalatine/xivdyetools/pull/412), with the `IMAGE_WORKER_DEPLOY_HOLD` repository variable set as soon as #412 is on `main` and before cut 00 merges (2026-10-31; unit acceptance unit 15, AP-32 and section 6); then cut 00, whose `deploy-image-worker.yml` run is the guard's first live check and must end skipped; cut 01, then e-00; cut 02; cut 03, then #393; cuts 04, 05, 05a and 06, then #401 and [#415](https://github.com/FlashGalatine/xivdyetools/pull/415); retarget e-02 to `main` (its diff is then the text selection alone); the app cuts; cut 12, then e-03 and [#416](https://github.com/FlashGalatine/xivdyetools/pull/416) in either order; cut 14, then its documentation companion [#413](https://github.com/FlashGalatine/xivdyetools/pull/413); the moderation activation release [#414](https://github.com/FlashGalatine/xivdyetools/pull/414) comes last in the queue, after M8's accepted inactive deploy. After it, [#366](https://github.com/FlashGalatine/xivdyetools/pull/366), [#372](https://github.com/FlashGalatine/xivdyetools/pull/372) and [#389](https://github.com/FlashGalatine/xivdyetools/pull/389) merge (ruling of 2026-10-31; If #414's activation gates are still open when the rest of the queue is done, the maintainer may merge these three first; they share only version rows in `README.md` and `docs/versions.md` with #414.): #366's root `package.json` `test:scripts` conflict is resolved to the union on #366 itself, so no cut head moves, and #372, a draft since 2026-10-31, drops its root `CHANGELOG-laymans.md` hunk at its post-queue rebase. Approve nothing implicitly. Reject or cancel every production run that is waiting for review or pending in its workflow's concurrency group and is not the selected run, before the next merge that matches the same workflow; never cancel an approved run in progress. Each deploy workflow has one concurrency group with `cancel-in-progress: false` (for example `.github/workflows/deploy-og-worker.yml:32-34`), so a stale run left waiting can hold up the selected one. In particular, reject e-02's og-worker run: og 2.12.0 would serve `lang=de` and `lang=fr` cards cached under the old names for up to 7 days, and cut 13's version change re-keys that cache (unit acceptance unit 13).

Rulings of 2026-10-31 (unit acceptance section 6) that bear on this order, none of which authorizes a merge or deployment:

- **e-02 by retarget (R2).** #409 reaches `main` by retarget, not by cherry-pick. Before merging it, check that its merged tree equals `main` merged with `7fbd756b`. e-01 ([#408](https://github.com/FlashGalatine/xivdyetools/pull/408)) is verification evidence and never merges; close it after #409 merges.
- **No standalone Discord 5.9.1 deploy (R3).** Reject the discord-worker production run that cut 05a's merge starts. Unit 9 (Discord 5.9.7) carries the additive fonts.
- **One batch announcement (R4).** One root `CHANGELOG-laymans.md` entry for the whole batch merges as its own docs-only pull request after the last player-facing unit is accepted. [#372](https://github.com/FlashGalatine/xivdyetools/pull/372) adds no entry of its own: its root `CHANGELOG-laymans.md` lines become candidates for this one. Sending it stays a separate selection.
- **Beta acceptance retired (R1).** Production acceptance of the deployed A/R/H consumers stands in for beta acceptance before Core 6.0.0 ([M](REMEDIATION_M_RELEASE_2026_10.md), [F](REMEDIATION_F_RELEASE_2026_10.md)). Beta dispatch stays unauthorized.

### #390 and the source stack, closed 2026-10-31

The maintainer closed [#390](https://github.com/FlashGalatine/xivdyetools/pull/390) and the source-stack PRs #337 to #365 and #367 as superseded on 2026-10-31, after the open-PR audit, each with a closing note. #366 is independent and stays open. Closing deleted nothing: the branches are kept, and GitHub keeps each closed PR's head ref, so every source SHA this runbook and its receipts cite stays reachable.

- **#390.** Its dye-name data, tests, research files and doc edits land unchanged in [#409](https://github.com/FlashGalatine/xivdyetools/pull/409) (Core 5.16.0) and [#404](https://github.com/FlashGalatine/xivdyetools/pull/404) (Core 6). Its Core 5.15.1 bump, that version's `docs/versions.md` row and its root `CHANGELOG-laymans.md` entry were not carried; the core 5.16.0 row here and core's changelog record the rename instead. The entry's line, "German dye names now use the game's color names, and French dye names use the game's capitalization", is a candidate for the batch announcement once one is authorized.
- **Ported before closing.** These items had been dropped by the cuts:
  - `/glamour`'s 5/minute limit note (from #337) is now in Discord 5.9.1's changelog on [#415](https://github.com/FlashGalatine/xivdyetools/pull/415) (`1c9833a18454`, then `97e4ca95e357` keeping #337's shared-budget caveat and `c962daeef7f7` tying it to an approved run). #415 already starts the Discord run, so no run is added.
  - On this branch: the `docs/versions.md` registry paragraph (from #338), re-checked against npm on 2026-10-31, with the bundling note, the presets compatibility row at 2.8.2, the 5.9.1 row, the `/glamour` compatibility row (from #337) and five more compatibility rows (Web App 5.16.1+ and Discord 5.9.2+ from #338, Discord 5.9.3+/OG 2.12.1+ from #339, Discord 5.9.4+/Moderation 1.8.3+/Stoat 0.3.4+ from #340, API 0.21.1+ from #341); the core `.chara` bullet in `docs/architecture/overview.md` (from #338), reworded for the conditional Core 6 removal; the `identity-moderation.md` row in `docs/architecture/index.md` (from #343); #390's `docs/research/index.md` row; and the analytics spec's 2026-10-27 status note (from #341).
- **Left on the branches for the audit-docs companion.** The source stack adds 59 and changes 104 files under `docs/audits`; 5 of them reach this queue, byte-identical to the source tip. The five 2026-10-28 plans under `docs/superpowers/plans/` (from #350, #351, #352, #362 and #363) stay with them, because their links point into those audit files. The companion also needs a fresh gitleaks allowance for `remediation-image-owned-buffers-memory-2026-10-28.json`, because the source stack's 13 `.gitleaksignore` fingerprints for it are bound to commit `1815fe82`. The companion follows the A/R/H cuts and restates each finding status against the cut that shipped it. Until it merges, `docs/audits` on `main` keeps the #336 statuses.
- **Merge note.** [#372](https://github.com/FlashGalatine/xivdyetools/pull/372) and [#389](https://github.com/FlashGalatine/xivdyetools/pull/389) also add a row at the top of `docs/research/index.md`, so their rebase after the queue, which they already need for renumbering, now also conflicts on that line: keep every row. #366's row merges cleanly with it (#366 still conflicts on root `package.json`'s `test:scripts`; under the 2026-10-31 ruling it merges after the queue, with that conflict resolved to the union on #366 itself).

### Image hold

The Cloudflare Community inquiry on the preview CPU ceiling (topic 974619) had one post and no replies when read on 2026-10-30 at 13:00 UTC. The Image CPU, memory and manual gates are unchanged and remain open.

### Preparation checklists

The read-only preparation documents that accompany this section are listed in the [operations index](index.md): the [unit acceptance checklists and approvals register](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md), the [held-migration preflight and recovery checklist](REMEDIATION_SCHEMA_RECOVERY_2026_10.md), the [notification-caller inventory](REMEDIATION_NOTIFICATION_CALLERS_2026_10.md) and the [external-consumer inventory](REMEDIATION_EXTERNAL_CONSUMERS_2026_10.md).
