# A/R/H release and adoption preparation — 2026-10-29

**Preparation only. Production activation remains on hold.** This pass converts the prepared
source stack into an operational release checklist. It authorizes no main/master merge,
package publication, deployment, remote migration, workflow dispatch, announcement or flag
change. M removals and terminal F work remain gated.

Reference source: `cea587fa276b502a246f6c5fe0d1cfe9a03ef55f`
([PR #365](https://github.com/FlashGalatine/xivdyetools/pull/365)). Freshly fetched main:
`13c386e5983fe58ff17ac08fb5712239feb2e696`.
The [runbook](../../../operations/REMEDIATION_RELEASE_2026_10.md) is the operator deliverable;
the [normalized receipt](release-adoption-2026-10-29.json) pins the observations, source trees,
workflow inputs and migration hashes. Recheck live facts and selected source before execution.

## Fresh read-only observations

The collector captured registry responses and GitHub PR metadata at
`2026-10-29T13:34:27.2028368Z`; per-registry-request UTC times are retained in the receipt.
All seven registry requests succeeded. Types 3.3.0 already exists and its package tree is
unchanged from observed main. The six pending versions remain absent at those lookups:

| Package | Registry latest | Pending target |
|---|---|---|
| logger | 2.3.0 | 2.4.0 |
| auth | 2.0.2 | 3.0.0 |
| core | 5.15.0 | 5.16.0 |
| worker-kit | 1.5.0 | 1.6.0 |
| SVG | 4.4.0 | 4.4.1 |
| bot-logic | 4.11.0 | 4.12.0 |

The repository had 34 open PRs; 33 are the selected #333–365 stack. Their exact heads, bases,
draft states and check summaries are retained. This is a dated observation, not permission to
merge or a claim that isolated release cuts passed. The cumulative source diff from main has
1,252 files. Its root `CHANGELOG-laymans.md` is unchanged from that main snapshot.

Read-only GitHub environment/branch-policy/workflow listings show all eight production
deployment workflows active. Production has one branch-policy protection rule and permits
`main`; it has no required-reviewer or wait-timer protection. Beta has no protection rules.
The production hold presently relies on not merging or dispatching. The runbook recommends a
separately authorized human approval control and requires its readback before integration;
**no control was configured here**. Raw account metadata stays in ignored scratch; only the
relevant normalized facts and raw-file hashes are committed.

## Trigger and source-cut proof

An offline driver parses the eight production YAML files with locked YAML 2.9.1 and evaluates
their path patterns with locked picomatch 4.0.7. **51 assertions pass** across branch/event/
environment declarations, representative package paths, global paths, source observations,
the phase proof and unchanged tracked configuration. The receipt retains the selected inputs,
hashes and resulting fanout:

| Source change | Production workflows matched |
|---|---|
| logger | All eight |
| auth | OAuth, presets, moderation, Discord |
| core or SVG | API, Discord, moderation, OG, web |
| worker-kit | All seven backend workflows |
| bot-logic | Discord, moderation |
| Lock/workspace/Turbo/base TypeScript | All eight |

This static path analysis is not a hosted workflow rehearsal. Each actual integration must
verify the runs GitHub creates and their exact source. The root Discord announcement webhook
is independent of the Actions production environment; preserve its file until separately
authorized. Beta services share production bindings/data and are not substitute isolated
acceptance environments.

Current main still has the combined credential-bearing publisher build/publish job. The
prepared R-CI split and main-only publisher are source changes awaiting integration. R-CI's
lock/workspace changes also match all eight production workflows, so even that prerequisite
needs an effective hold first. No isolated per-release source cut was built or validated here.
Existing full-stack checks do not prove a different partial integration.

## Presets/Discord cycle and offline configuration proposal

The current presets configuration selects Discord's named `PresetNotifications` provider.
Discord's new favorites consumer also requires the capped presets batch endpoint. Releasing
either integrated consumer blindly against the old other service is unsafe. The proposed
order is OAuth provider → presets base with default notification binding → Discord provider
and batch consumer → presets named-binding companion.

An ignored scratch proposal removes exactly two `entrypoint = "PresetNotifications"` fields
from presets TOML, one top-level and one production. Locked smol-toml 1.9.1 parses the original
and both proposed phases; **four parses and 21 assertions pass**. Every other parsed field and
all remaining bytes, targets, resources and false flags are preserved. The second phase is
byte-identical to the current integrated configuration. The committed receipt includes both
phase hashes, the two-field diff and unchanged before/after tracked-config hash.

This proves the bounded configuration transformation only. No tracked TOML, version or test
was changed. The default-binding source cut needs its own compatibility tests and full gates;
existing named-binding tests belong with the companion. If the first cut ships as 2.8.1,
2.8.2 is only a provisional future companion reservation, pending review of all release
branches and intervening releases. Cached historical phase refs are labeled local snapshots,
not fresh remote-head/exclusivity evidence.

Rollback must preserve both edges. Keep the named notification and OAuth identity providers
while consumers select them. Restore public/default notification compatibility before reverting
the presets binding. Keep the capped batch endpoint while the new Discord consumer remains
deployed; removing it first requires a deployed, verified compatible Discord rollback.

## Acceptance and recovery preparation

The runbook binds OAuth migration 0002 before OAuth and presets migration 0016 before presets
and moderation, including the false-flag paths. Exact migration hashes are recorded. No D1
schema probe, row read, export or mutation was performed. Current schema, approved recovery
ownership/destination and once-only application remain live operator gates. Code rollback
must preserve additive schema, pending operations, locks and provider compatibility; unknown
remote outcomes do not become confirmed refusals after a timeout.

Six web and six bot disclosures precede new confirmation data use. Session/metadata/identity/
notification flags remain false in source; inactive modes still change some user behavior and
need availability acceptance. Activation and actual policy/key changes remain separate.
The corrected six-language manual must actually reach consumers before lower image limits.

A-IMAGE retains its independent Cloudflare CPU/resource, aggregate-memory and manual-delivery
gates. The user reports that the Community inquiry was approved and awaits replies. No new
Cloudflare reply, numeric remote-preview budget, production equivalence or acceptance result
is inferred. No new hosted test or public message was made. The prior 42-request attempt and
local profiling remain historical evidence, with their recorded failures and limits.

## Review and validation

Roles resolved for this run: fixed collection **gpt-6-luna / low**; trigger/acceptance and
offline configuration work **gpt-6.1-sol / medium**; security-critical packet review
**gpt-6-astra / high**. The coordinator retains prose, Git actions and authorization decisions.
The review required the reverse batch-provider rollback safeguard above; it is incorporated.
The final read-only review found no remaining blocking security or authority inaccuracies
after the clarification. It accepted the forward sequence and proposal/live-state distinctions.
This is no release execution approval.

Frozen offline dependency installation passed. All six documentation/root gates exited zero:

| Gate | Result |
|---|---|
| `pnpm docs:check-links` | 1,149 links across 267 documentation files; zero unresolved |
| `pnpm docs:check-versions` | 34 claims; zero mismatches |
| `pnpm test:scripts` | 220 passed; zero failed/skipped |
| `pnpm type-check:scripts` | Passed |
| `pnpm dead-code:check` | 648 production / 651 test files scanned; reachability gate passed |
| `pnpm workers:check-logs` | All seven configurations passed |

A separate offline receipt readback passed 77 comparisons: 32 input hashes, two migration
hashes, both source/main trees for 17 units, eight workflow hashes and the unchanged presets
configuration hash. The staged filename-aware Gitleaks scan found zero leaks; the whitespace
check passed. Final outgoing history scanning and hosted CI are separate PR checks. No
application source changed in this pass.

Earlier source validation belongs to the exact reference commit: PR #365's combined graph
passed 62 tasks with zero cache hits, 17,873 tests in 612 files, and green CI including Chromium.
Those are inherited results from the [provenance follow-up](remediation-item-name-provenance-2026-10-29.md),
not rerun claims for proposed isolated releases. The [earlier local handoff](remediation-release-prerequisites-2026-10-29.md)
used synthetic local artifact identities and is not real CI provenance or a published artifact.

No finding status/count is advanced. All publication, migration, deployed acceptance and
activation receipts remain pending in the runbook. Private XIVAuth/Cloudflare material remains
outside Git.
