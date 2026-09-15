# Security remediation — 2026-09-15 rollout

Local fixes and commits do not change deployed workers. The [audit plan](../audits/2026-09-15-security/REMEDIATION_PLAN.md) defines six findings and independent release steps. Publishing, merging and deploying require separate authorization.

## Revision migration before presets-api deployment

Apply [0014_add_content_revision.sql](../../apps/presets-api/migrations/0014_add_content_revision.sql) before presets-api 2.3.2 or later. `schema.sql` is for fresh databases; rerunning it does not add a column to an existing table.

From the repository root, inspect the target before applying the migration:

```powershell
pnpm --filter xivdyetools-presets-api exec wrangler d1 execute DB --env production --remote --command "PRAGMA table_info(presets)"
pnpm --filter xivdyetools-presets-api exec wrangler d1 execute DB --env production --remote --command "SELECT name, sql FROM sqlite_schema WHERE name = 'presets_content_revision_after_update'"
```

If neither the column nor trigger exists, apply the migration once:

```powershell
pnpm --filter xivdyetools-presets-api exec wrangler d1 execute DB --env production --remote --file migrations/0014_add_content_revision.sql
```

Verify `content_revision INTEGER NOT NULL DEFAULT 0` and the trigger before deploying the API. Repeat the inspection for the beta database without `--env production`; apply the migration there before a beta deployment too. `ALTER TABLE ADD COLUMN` is not idempotent: do not rerun the full file if the column already exists. If a prior attempt created only the column, apply just the reviewed trigger statement from the migration after inspecting the database.

The migration is compatible with old writers because the database increments revisions. Deploy the guarded API immediately afterward: old API handlers can still perform stale writes until replaced. Preserve the additive column and trigger during any code rollback. Reverting to an old API handler reopens the concurrency vulnerabilities.

Do not use `wrangler d1 migrations apply`; this project's migration history is applied by explicit files.

## Auth and worker rollout boundaries

Publish auth 2.0.2 through the **Publish Packages to npm** GitHub Actions workflow, using trusted publishing. Do not publish from a local shell. Verify the registry result, then separately verify the Discord and moderation worker bundles and deployments.

The existing deployment workflow path filters include `packages/auth/**` for Discord, moderation, presets-api and OAuth. Merging the entire implementation branch would trigger independent deployments together. Local commit boundaries alone do not serialize GitHub Actions, and `environment: production` does not imply a required approval pause.

### Selected release procedure: held workflows and ordered merges

This procedure is prepared for a separately authorized release; no workflow state has been changed. Keep a maintenance window free of unrelated merges until the original workflow states are restored.

1. Before the first branch push, record the current enabled/disabled state of `deploy-discord-worker-beta.yml` and `deploy-og-worker-beta.yml`, then disable those two beta workflows. Before any main merge, do the same for `deploy-discord-worker.yml`, `deploy-moderation-worker.yml`, `deploy-presets-api.yml`, `deploy-oauth.yml`, and `deploy-og-worker.yml`. Inspect queued/running jobs and explicitly cancel or finish them before proceeding; disabling a workflow does not cancel existing jobs. Leave CI, secret scanning and package publishing enabled. Confirm the holds in GitHub rather than assuming they exist.
2. Release the commit ranges below in order through separate reviewed merges. Do not merge the complete implementation branch at once. While holds are in effect, re-enable only the named deployment workflow for its manual dispatch at the just-merged `main` revision, wait for success, check the deployed behavior, then disable it again before the next merge. Record the immutable commit and workflow run ID for every release. This preserves the audit plan's independent Sprint 0 releases.

| Merge endpoint | Release action and acceptance boundary |
|---|---|
| `ef555e57` (includes audit `fa3517d2`) | Publish only `@xivdyetools/auth` through `publish-packages.yml` on `main`; verify registry 2.0.2. Then separately dispatch and verify the existing Discord consumer bundle. Separately dispatch/check OAuth and presets-api, which also consume auth and whose auto-deploys were held. No database revision migration is needed at this endpoint. |
| `0a357852` | Dispatch moderation worker; verify bounded Discord input and its consumer bundle. |
| `205f0be6` | Dispatch Discord worker; verify its independent GitHub stream cap before HMAC. |
| `3c07b6b9` | Dispatch presets-api; verify exact pending image key required, absent key rejected and stale key conflicts. |
| `247d368d` | Dispatch Discord worker; verify displayed image key reaches the signed review request. Legacy controls fail closed at this stage. |
| `74114ebf` | Apply and verify migration 0014 using the instructions above **before** enabling the API deployment; dispatch presets-api and test stale owner edits. |
| `0b5d814c` | Dispatch Discord worker; test legacy control refresh followed by a deliberate second review click. |
| `6b7d1b3c` | Dispatch presets-api; verify stale revert/status conflicts and atomic audit logging. |
| `3095b8ce` | Dispatch OG worker; inspect a synthetic crawler request's coarse metadata log. |

3. Later acceptance-documentation commits can merge after their link/version gates. Repeat the migration inspection for beta before authorizing a beta API deployment; its database is separate. Keep beta bot deployment held until its API supports the preview key and revision contracts. When beta testing is authorized, dispatch the held beta workflows against the verified release revision and check their own bindings.
4. Restore each workflow to its recorded original state, recheck queued jobs, and end the maintenance window. A workflow that was already disabled must remain disabled. If a release fails, stop the sequence and retain compatible database additions; do not advance downstream consumers or silently remove the holds.

Deploy the preview API guard before the Discord revision-bearing button producer. Unversioned actions must fail closed during the transition. Existing buttons require a fresh review; no deployment may temporarily accept an unversioned approval.

Discord 5.5.4 also recovers old preset-ID-only buttons: a moderator click fetches the current pending image, replaces the displayed image and controls, and requires a second click to approve or reject that exact revision. It performs no moderation write on the first click. Failed lookups or message edits leave the controls retryable. There is no failed-notification replay dispatcher, so inserting dead-letter rows is not a recovery procedure.

## Completion evidence

After each authorized deployment, verify the deployed version and exercise bounded requests or synthetic test presets in the appropriate environment. Confirm the actual interaction route uses auth's bounded reader, GitHub oversize input returns 413, stale image decisions return 409, and stale owner/moderator operations preserve the newer state. Only then close the deployment-dependent audit findings.

The original Gitleaks coverage gap was addressed during implementation with fresh, redacted tracked-tree and available-history scans. Keep the earlier blocked reports as historical evidence; see the [implementation report](../audits/2026-09-15-security/IMPLEMENTATION_REPORT.md) for the scanner version, scope and results.
