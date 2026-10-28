# A-DISCORD notification-binding companion — 2026-10-27

**State:** source preparation; provider integration and final remote receipts pending.
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
- Independent ordinary review: specification and quality PASS; no findings. Provider
  integration/deployment and later delivery verification remain explicit required gates.

No live service call, migration, package publication, workflow hold, deployment, command
registration or activation is selected here. The private XIVAuth report remains outside Git.
