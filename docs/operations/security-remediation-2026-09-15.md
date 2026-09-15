# Security remediation — 2026-09-15 rollout

Local fixes and commits do not change deployed workers. The [audit plan](../audits/2026-09-15-security/REMEDIATION_PLAN.md) defines six findings and independent release steps. PR #183's review and merge were authorized on 2026-09-15. The procedure below supersedes the earlier partial-merge procedure: a full PR merge is safe only while deployment workflows are held and the database/API prerequisites are enforced.

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

Verify `content_revision INTEGER NOT NULL DEFAULT 0` and the trigger before deploying the API. The top-level and production presets-worker bindings both use database `xivdyetools-presets`, ID `e17d68a1-5a44-4c88-b02b-07d053cbe321`. Both Discord environments bind to the production `xivdyetools-presets-api` service. There is no separate beta database migration or beta presets API prerequisite in this configuration.

Apply the file **once** against the production binding. `ALTER TABLE ADD COLUMN` is not idempotent: do not rerun the full file if the column already exists. If a prior attempt created only the column, apply just the reviewed trigger statement from the migration after inspecting the database. Capture a D1 Time Travel bookmark before changing the schema; preserve it as recovery evidence without restoring production data automatically.

The migration is compatible with old writers because the database increments revisions. Deploy the guarded API immediately afterward: old API handlers can still perform stale writes until replaced. Preserve the additive column and trigger during any code rollback. Reverting to an old API handler reopens the concurrency vulnerabilities.

Do not use `wrangler d1 migrations apply`; this project's migration history is applied by explicit files.

## Auth and worker rollout boundaries

Publish auth 2.0.2 through the **Publish Packages to npm** GitHub Actions workflow, using trusted publishing. Do not publish from a local shell. Verify the registry result, then separately verify the Discord and moderation worker bundles and deployments.

The existing deployment workflow path filters include `packages/auth/**` for Discord, moderation, presets-api and OAuth. The full PR also changes paths that trigger API, image, web and OG deployments. Merging the entire implementation branch without holds would trigger independent deployments together. Local commit boundaries alone do not serialize GitHub Actions, and `environment: production` does not imply a required approval pause. The presets deployment workflow does not apply migration 0014.

### Selected release procedure: held full-PR merge and ordered deployments

Keep a maintenance window free of unrelated merges until the original workflow states are restored. Record actual workflow states and release evidence when executing this procedure; the instructions themselves are not evidence of execution.

1. Record the current enabled/disabled state of all eleven deployment workflows listed below, then disable them. Inspect queued/running jobs and finish them before proceeding; disabling a workflow does not cancel existing jobs. Do not cancel unrelated work without checking its ownership. Leave CI, secret scanning and package publishing enabled. Confirm the holds through GitHub's workflow API.

| Environment | Workflows to hold |
|---|---|
| Production | `deploy-api-worker.yml`, `deploy-discord-worker.yml`, `deploy-image-worker.yml`, `deploy-moderation-worker.yml`, `deploy-oauth.yml`, `deploy-og-worker.yml`, `deploy-presets-api.yml`, `deploy-web-app.yml` |
| Beta | `deploy-discord-worker-beta.yml`, `deploy-og-worker-beta.yml`, `deploy-web-app-beta.yml` |

2. Verify the exact PR head, completed reviews and required CI checks. Apply and verify migration 0014 once as described above. Merge that reviewed head through GitHub with the required checks enforced. Preserve the significant-step commits with a merge commit. Record the resulting `main` commit; do not depend on intermediate commits becoming separately deployed revisions.
3. Dispatch `publish-packages.yml` on the verified `main` revision with the single package selection `@xivdyetools/auth`. Wait for success and verify registry version 2.0.2. Do not select `all-modified`.
4. Deploy the five units below in order. For each, verify `main` still points to the recorded merge commit, enable its workflow, manually dispatch at `main`, verify the run's `headSha`, wait for success and health checks, then disable the workflow again before advancing. Record the workflow run ID and deployed version. API/image/web have no security-finding deployment action in this sequence and remain undispatched.

| Order / workflow | Acceptance boundary |
|---|---|
| 1. `deploy-presets-api.yml` | Exact pending image key required; missing/wrong/stale keys fail closed. Stale owner edits, moderator status changes and reverts conflict without overwriting newer state or inserting an audit row. Successful moderation writes and audit entries remain atomic. |
| 2. `deploy-moderation-worker.yml` | Confirm the deployed bundle uses auth 2.0.2's bounded Discord reader and conflict handling remains intact. |
| 3. `deploy-discord-worker.yml` | Confirm bounded Discord input and the independent 1 MiB GitHub stream cap before HMAC. New controls carry the displayed image key. Legacy controls refresh that image and require a deliberate second click; lookup/edit failures remain retryable. |
| 4. `deploy-oauth.yml` | Verify the auth consumer bundle and normal OAuth health/login behavior. The workflow's bare production deploy command is intentional. |
| 5. `deploy-og-worker.yml` | Verify a crawler request succeeds and its metadata event contains only the intended coarse fields. |

5. Beta Discord acceptance is downstream of the **production** presets API. When beta testing is authorized, dispatch its held workflow against the verified release revision and check its own bot bindings. OG beta is independent. Do not apply another D1 migration or deploy a separate beta presets API.
6. Restore each workflow to its recorded original state, recheck queued jobs, and end the maintenance window. Re-enabling a workflow does not replay the held push event. A workflow that was already disabled must remain disabled. If migration, publication, deployment or acceptance fails, stop the sequence and retain compatible database additions; do not advance downstream consumers or silently remove the holds. Distinguish passing deployment health checks from any interactive acceptance still pending.

Deploy the preview API guard before the Discord revision-bearing button producer. Unversioned actions must fail closed during the transition. Existing buttons require a fresh review; no deployment may temporarily accept an unversioned approval.

Discord 5.5.4 also recovers old preset-ID-only buttons: a moderator click fetches the current pending image, replaces the displayed image and controls, and requires a second click to approve or reject that exact revision. It performs no moderation write on the first click. Failed lookups or message edits leave the controls retryable. There is no failed-notification replay dispatcher, so inserting dead-letter rows is not a recovery procedure.

## Completion evidence

After each authorized deployment, verify the deployed version and exercise bounded requests or synthetic test presets in the appropriate environment. Confirm the actual interaction route uses auth's bounded reader, GitHub oversize input returns 413, stale image decisions return 409, and stale owner/moderator operations preserve the newer state. Only then close the deployment-dependent audit findings.

The original Gitleaks coverage gap was addressed during implementation with fresh, redacted tracked-tree and available-history scans. Keep the earlier blocked reports as historical evidence; see the [implementation report](../audits/2026-09-15-security/IMPLEMENTATION_REPORT.md) for the scanner version, scope and results.
