# A-DISCORD notification-binding companion — 2026-10-27

**State:** prepared in draft [PR #346](https://github.com/FlashGalatine/xivdyetools/pull/346),
with source CI and automatic Discord beta passing. Provider source: `9e6ae7cd`, draft
[PR #345](https://github.com/FlashGalatine/xivdyetools/pull/345). Production release/cutover remain separate.
This is the separate presets **2.8.1 PATCH** companion to
[A-DISCORD's private provider](remediation-discord-2026-10-27.md). FINDING-039 remains OPEN
until verified producer cutover and a separately authorized binding-only activation.

## Exact change

Both existing `DISCORD_WORKER` service bindings add `entrypoint = "PresetNotifications"`.
Their existing `xivdyetools-discord-worker` production service target is retained, including
the top-level configuration's existing shared target. No notification client, `Fetcher` type,
JSON request, bearer authentication, retry logic, schema, retention or policy changes are made.
Version tables, the technical changelog and living binding/runbook descriptions reflect this.

The provider must be integrated into this branch before its PR is opened, with both version
rows preserved. Its production deployment and actual named-entrypoint verification must precede
this companion's production deployment; separate PRs prevent independent deploy jobs racing.
Real submission, edit and preview notifications must then be verified before a later activation
sets `PRESET_WEBHOOK_BINDING_ONLY=true`. Both provider configurations remain false during this
preparation. Inventory external/manual callers before disabling public compatibility.

Rollback restores and verifies public compatibility before moving the consumer back to its old
default binding. Retain the named provider export while any consumer selects it. Failed-notification
records expose failures for review; list/resolve endpoints are not automatic redelivery.

## Verification

- Tests parse actual Wrangler configuration and require exactly one Discord binding per
  environment, the unchanged production target, and the named entrypoint.
- Genuine RED: **12 passed / 2 assertion failures** before the entrypoint fields were added.
- Restored GREEN: **14/14**. A valid-TOML wrong-entrypoint mutant fails one assertion;
  exact original config bytes were restored, then **14/14** passed again.
- Scoped build/type/lint: **7/7 tasks**; tests **6/6 tasks**, **57 files / 1,396 tests**.
  No runtime source changed and no coverage threshold/exclusion changed.
- Version check: **34/34 claims** match package manifests.
- Independent ordinary and post-merge reviews: specification and quality PASS; no findings.
  Provider production deployment and later delivery verification remain required gates.

Provider source was merged without conflict into the isolated companion at `48d65d1e`.
The diff from provider contains only the reviewed companion configuration, test and release/docs
paths. Both app version rows survive: Discord **5.9.7**, presets **2.8.1**; bot-logic remains **4.12.0**.
Fresh post-merge verification passes: **8/8** Discord dependency builds, **7/7** presets static tasks,
**6/6** test tasks with **1,396/57**, actual Workerd **7/7**, versions **34**, links **1,063/259** and
reachability **642/639**. The actual production-config dry run passes locally at **263.42 KiB raw /
66.51 KiB gzip**, with fake credentials and an isolated profile; it does not verify a live provider.

No live service call, migration, package publication, workflow hold, deployment, command
registration or activation is selected here. The private XIVAuth report remains outside Git.

## Published source receipts

Source `ae26ddc3fbfef4eca5a2c7806f7809ff5101a8a8` is published in draft #346, stacked on #345.
[CI 40624786941](https://github.com/FlashGalatine/xivdyetools/actions/runs/40624786941) passes all
four jobs, including **167 Playwright tests**, lint/types/tests/build, production security audit
and Gitleaks. [Automatic Discord beta 40624743878](https://github.com/FlashGalatine/xivdyetools/actions/runs/40624743878)
deploys successfully and registers **18 commands**. No web beta was selected.

CI retains the existing nonblocking `validation-service.ts:249` unsafe-any lint annotation;
that runtime file is unchanged by this companion. Staged and full stacked-history secret scans
pass with 100% redaction. The provider's receipt-only commit `f13e8266` is integrated; this update
changes evidence only. Runtime source, both app versions and the false activation flags are
unchanged. These receipts establish draft source/deployment readiness, not live production
notification delivery or authorization to activate binding-only mode.
