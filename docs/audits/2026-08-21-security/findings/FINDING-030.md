# FINDING-030: Repository hygiene — `.dev.vars.<env>` files are not git-ignored, a revoked OAuth secret sits unredacted in a committed audit doc, secret scanning is not wired into CI

## Severity
**LOW** — the public repository currently contains no live secret (verified by pattern and git-history scans: `../evidence/potential-secrets.txt`, `../evidence/git-history-secrets.txt`); these gaps make a future leak more likely and harder to catch. Reviewer IDs: INF-5, INF-7, INF-8. Coordinator-verified (`git check-ignore`, `git grep`).

## Category
CWE-540 Inclusion of Sensitive Information in Source Code · CWE-1059

## Location
- `.gitignore:10` — `.dev.vars` is ignored but `.dev.vars.production` / `.dev.vars.preview` / `.dev.vars.local` are **not** (wrangler reads env-specific files with exactly those names).
- `docs/audits/2026-01-25/findings/FINDING-003-exposed-xivauth-secret.md:20` — the old `XIVAUTH_CLIENT_SECRET` value (rotated 2026-01-25 per the doc; committed via `30c769a2`) remains in HEAD and history.
- `docs/.pre-commit-config.yaml`, `docs/.secrets.baseline:41-42` — detect-secrets config lives under `docs/` where no hook runs; baseline empty since Jan 2026; no CI secret scanner.

## Recommendation
Add `.dev.vars.*` to `.gitignore`; redact the value in the old finding (and, if the repo's history is considered sensitive, note that rotation already happened — no rewrite needed); enable GitHub secret scanning + push protection (free for public repos) or add `gitleaks`/`trufflehog` to `ci.yml`; move the pre-commit config to the repo root or delete it.

## References
- Evidence: `../evidence/review-infra-stoat.md` (INF-5, INF-7, INF-8)
