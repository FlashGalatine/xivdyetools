# October 2026 A/R/H release and adoption runbook

**PREPARATION ONLY — production activation is on hold.** No main/master merge, package
publication, remote migration, deployment, activation, workflow dispatch or announcement is
authorized by this document. Each execution gate below requires a later explicit authorization.

Source snapshot: `cea587fa276b502a246f6c5fe0d1cfe9a03ef55f` ([PR #365](https://github.com/FlashGalatine/xivdyetools/pull/365)).
Observed main: `13c386e5983fe58ff17ac08fb5712239feb2e696`. Recheck both before execution.
The [dated evidence](../audits/2026-10-26-security/evidence/remediation-release-adoption-2026-10-29.md)
and [normalized receipt](../audits/2026-10-26-security/evidence/release-adoption-2026-10-29.json)
bind the package trees, versions, PR heads, trigger inputs and observations used here.

## 1. Establish an effective production hold before integration

Live read-only checks found all eight production deployment workflows active. The production
environment permits the `main` branch and has **no required-reviewer or wait-timer rule**.
The beta environment has no protection rules. Nothing was changed.

The present hold is therefore enforced by **not merging or dispatching**, rather than by a
configured deployment approval. A logger-only merge matches all eight production workflows;
auth matches four, core/SVG five, worker-kit seven and bot-logic two. Lock/workspace/Turbo/base
TypeScript changes match all eight. These independent jobs can start before npm publication or
provider acceptance. Package builds consume workspace source; unavailable registry versions do
not prevent app deployment.

**Recommended control, not implemented:** before any production integration, separately approve
and configure a required-human-review gate on `production`, preserve its main-only branch rule,
and verify its reviewer and bypass behavior. Identify a reviewer who can actually approve the
intended runs; a single-maintainer setup must not accidentally prohibit its only reviewer.
[GitHub documents environment approvals separately from branch restrictions](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).
Cancel stale queued deployments and approve only the selected, exact-source workflow run.
Approving the package publisher must not approve any app deployment. An alternative workflow
pause/activation design needs its own reviewed authorization; no pause or gate is assumed here.

The root `CHANGELOG-laymans.md` announcement is a separate Discord webhook path. A production
Actions approval gate would not suppress it. The integration candidate must preserve main's
root announcement file until the announcement is separately selected and authorized, or have
another explicitly reviewed announcement hold. Per-app bundled changelogs have their own release
boundary. Do not send a real webhook as a preparation test.

Feature pushes can run the existing Discord/OG/web beta workflows. Those are not isolated
production-data test environments: several service bindings target production, and web beta
uses production preset data. No beta dispatch or live acceptance exercise is authorized here.

## 2. Construct and validate selected source cuts

The cumulative stack changes **1,252 files** from observed main. Its 33 PRs (#333–365) are
source/review boundaries, not an executable production release queue. Do not merge the stack
in PR-number order or infer a hold from draft status, successful CI or unpublished packages.

Build each proposed integration in an isolated worktree from freshly checked main. Bind its
exact source SHA, package tree differences and production configuration to a receipt. The full
source snapshot passed the graph, but **isolated per-release cuts have not been validated by
this packet**. Every cut needs its own scoped and whole-graph gates, applicable coverage,
bundle/font checks, version/changelog review and secret scan before main integration. Never
weaken assertions to manufacture an intermediate release.

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
source/run/artifact identities and native consumer results. The earlier synthetic local handoff
is a rehearsal, not CI provenance or a release artifact. Stop on identity/pin mismatch or an
unexplained existing version. Do not overwrite or blindly republish immutable versions.

After auth publication, rerun the private test-utils producer against the actual registry
artifact. Test-utils 3.0.0 is private and must never be published. After each other publication,
verify the actual registry artifact before moving to its dependent package or app.

## 4. Resolve the presets/Discord deployment cycle

Presets supplies the capped batch lookup required by the new Discord favorite-list consumer.
Discord supplies `PresetNotifications`, which the integrated presets TOML already selects.
Those edges require **two presets source/configuration releases**, unless a different split is
explicitly designed and verified.

| Phase | Proposed source/configuration cut | Acceptance before the next phase |
|---|---|---|
| C1 | OAuth 3.2.0, after migration 0002; `IDENTITY_SPLIT_ENABLED=false`, no outbound `BAN_CONTINUITY` binding | Deployed private `IdentityLookup`, current-session/revision behavior and ordinary logins |
| C2 | Presets base cut: final eligible 2.8.1 behavior after migration 0016, with the **default** Discord binding retained | OAuth provider dependency, legacy notification compatibility, capped acting-user batch lookup, quota/image/session-disabled behavior |
| C3 | Discord 5.9.7 with `PresetNotifications` exported and public compatibility retained | Both default and named paths, real manual delivery and capped favorites; no binding-only activation |
| C4 | Presets configuration companion selecting `PresetNotifications` | Actual submission/edit/preview delivery; verify default/public rollback path remains available |

For C2, an offline TOML proposal removes only the two `PresetNotifications` entrypoint fields,
preserving service targets, resources and false flags. Four parses/21 assertions pass; phase B
is the byte-identical integrated configuration. **This is not a built or validated C2 release.**
Its default-compatibility tests and full gates remain required. The existing named-config tests
belong with C4; do not skip them or falsely assert named binding in C2.

**Version reservation, not a manifest edit:** if C2 ships as 2.8.1, prepare C4 as a separately
reviewed compatible patch, provisionally 2.8.2, with its own version/changelog/receipt. Recheck
the selected cut, all pending release branches and intervening releases before reserving it.
Do not reuse 2.8.1 to ambiguously
identify two different release configurations. Existing source manifests remain unchanged here.

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

M-CORE/M-SVG/M-BOT-LOGIC still wait for shipped/adopted deprecations, oracle migration and explicit
acceptance; this pass starts no M removal or oracle rewrite. F-DISCORD/F-OG remain terminal
after major/text adoption. Current unchanged-font acceptance is not terminal-sprint completion.

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
