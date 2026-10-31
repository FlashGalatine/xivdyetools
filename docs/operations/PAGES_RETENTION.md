# Pages deployment retention

**Source prepared 2026-10-28; apply activation held.** This companion to the
[history cleanup](../audits/2026-10-26-security/evidence/remediation-finding-009-2026-10-26.md)
keeps the current deployment in each of `xivdyetools` and `xivdyetools-beta`.
The production project's canonical Pages domain is the legacy
`xiv-colorexplorer.pages.dev`; its project API name is `xivdyetools`.

Both web deploy workflows run smoke checks, then retention **without `--apply`**.
The CLI also requires `PAGES_RETENTION_APPLY=true` before it will delete anything.
Changing that environment variable alone cannot activate the checked-in calls.
No live cleanup was performed while preparing this implementation.

## Dry-run and origin verification

Use the exact successful deployment URL and full commit SHA from the selected run.
Run from `apps/web-app` with the matching `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` already supplied through the selected protected environment.
Do not put credentials in command arguments or evidence. The beta token stays separate
from production. Read-only checks need account-scoped Pages Read; apply needs Pages Write.

```bash
node scripts/smoke-test-pages.js \
  --deployment-url "$DEPLOYMENT_URL" --domain https://xivdyetools.app \
  --expect-robots none --project xivdyetools \
  --commit "$EXPECTED_COMMIT" --headers-file dist/_headers

node scripts/retain-pages-deployments.mjs \
  --project xivdyetools --deployment-url "$DEPLOYMENT_URL" \
  --commit "$EXPECTED_COMMIT"
```

For beta, select `xivdyetools-beta`, `https://beta.xivdyetools.app`,
`--expect-robots noindex` and the beta deployment's URL/SHA and matching built headers.
Never reuse production values to make a beta check pass.

The scripts pin the account/project identity and domain/branch configuration, require
the expected deployment to be current, and validate all inventory pages before forming
a deletion plan. Unexpected API schema, pagination, aliases, new/in-progress deployments,
changed current identity or an API failure stops the run. The dry-run output is the
reviewable plan; it is not proof that any historical host was removed.

Smoke checks use API-reported current metadata and the built `_headers` policy. They
check matching HTML and parsed CSP across custom, canonical, deployment-hash and reported
branch origins. Retired aliases/hash hosts must return an actual HTTP 404 with redirects
disabled. A DNS error, timeout or redirect is a failed check, not deletion evidence.

## Apply acceptance

Before a separate reviewed activation, confirm credentials, protected environment,
current URL/SHA, the complete dry-run inventory and the exact retained/deleted identities.
Activation needs both a reviewed workflow edit adding `--apply` after integration and
the protected environment setting. Re-review beta cancellation/concurrency before that
edit: a cancelled run can leave partially completed cleanup. Keep feature-branch pushes
from changing the destructive mode. The current source deliberately leaves it inactive.

The executor refreshes protection before each sequential delete. It never escalates
to force after an error; only an explicitly validated non-production branch alias can
qualify for the API's force option. An ambiguous DELETE stops rather than being blindly
replayed. Reconcile fresh current/candidate state before another authorized run.

Cloudflare's documented deletion API has no conditional current-ID transaction. An
external rollback can race the final GET/DELETE despite workflow serialization; coordinate
manual rollbacks and record that limit. The API may refuse the latest branch deployment.
Do not broaden force or project scope to bypass a refusal.
See [Cloudflare deletion semantics](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/delete/)
and [preview deployment retention](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

After apply, retain the sanitized plan/result, a complete fresh inventory preserving
the current production/beta deployment, successful positive-origin probes and actual
404 receipts for deleted hash/retired alias hosts. Resolve partial failures explicitly.
Until those checks succeed, [FINDING-009](../audits/2026-10-26-security/findings/FINDING-009.md)
remains partial. Do not attach secrets, raw authenticated API bodies or private user data.
