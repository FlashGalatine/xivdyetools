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

The existing deployment workflow path filters include `packages/auth/**` for multiple consumers. Merging the entire implementation branch would trigger those deployments together. Agree on controlled release sequencing before merging; local commit boundaries alone do not serialize GitHub Actions.

Deploy the preview API guard before the Discord revision-bearing button producer. Unversioned actions must fail closed during the transition. Existing buttons require a fresh review; no deployment may temporarily accept an unversioned approval.

Discord 5.5.4 also recovers old preset-ID-only buttons: a moderator click fetches the current pending image, replaces the displayed image and controls, and requires a second click to approve or reject that exact revision. It performs no moderation write on the first click. Failed lookups or message edits leave the controls retryable. There is no failed-notification replay dispatcher, so inserting dead-letter rows is not a recovery procedure.

## Completion evidence

After each authorized deployment, verify the deployed version and exercise bounded requests or synthetic test presets in the appropriate environment. Confirm the actual interaction route uses auth's bounded reader, GitHub oversize input returns 413, stale image decisions return 409, and stale owner/moderator operations preserve the newer state. Only then close the deployment-dependent audit findings.

Gitleaks remains an audit prerequisite until an actual tree/history scan is recorded. The earlier blocked reports are not clean scans.
