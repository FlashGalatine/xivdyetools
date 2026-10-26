# FINDING-050: GitHub secret scanning non-provider patterns and validity checks are disabled (settings real, benefit narrower than claimed)
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** CI + repo settings · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693
**Related:** 2026-10-03-security/FINDING-030

## Location
- `.github/workflows/ci.yml:102` — GitHub secret scanning non-provider patterns and validity checks are disabled (settings real, benefit narrower than claimed)
- `.gitleaks.toml:17` — Secret scanning non-provider patterns and validity checks are disabled

## Evidence
- security_and_analysis: secret_scanning enabled, secret_scanning_push_protection enabled, secret_scanning_non_provider_patterns disabled, secret_scanning_validity_checks disabled; visibility public. ci.yml:102-104 says GitHub's own secret scanning + push protection is the complement that covers full history and blocks pushes.
- Reach: No attacker path. A maintainer commits a non-provider secret, such as a private key, connection string or auth header, on a path that gitleaks does not scan or allowlists. GitHub's provider-pattern scanning and push protection would not flag it.
- Live `gh api repos/FlashGalatine/xivdyetools` (GET, 2026-10-26) shows a public repo with secret_scanning and push_protection enabled, and with non_provider_patterns and validity_checks disabled. The historical POST_MERGE_CHECKLIST.md:488-494 already noted both toggles as disabled and out of scope, and no trade-off doc accepts them. The claim overreaches in two places, so it is PARTIAL. First, non-provider patterns detect private keys, connection strings and HTTP auth headers, not the random-string HMAC/JWT secrets the claim names. Second, validity checks only triage provider-token alerts and prevent nothing. Gitleaks (ci.yml:105-13… Preconditions: A non-provider secret (private key, DB URL with password, Basic/Bearer header) is committed outside gitleaks' event-diff coverage or under an allowlisted path (*.test.ts, __tests__/). The candidate's anchor .gitleaks.toml:17 (useDefault) is only context: the real subject is the repo settings plus c…
- Live state the repo cannot show: GitHub repo Code security settings (read via GET gh api on 2026-10-26). Not verified: whether both toggles are free for this public, user-owned repo on its plan.

## Fix
- Turn on "Non-provider patterns" (and optionally "Validity checks") under Settings -> Code security as cheap defense in depth. Then update the ci.yml:102-104 comment so it does not suggest GitHub scanning covers generic secrets.
- **Maintainer decision:** Repo settings choice only the maintainer can make: enable non-provider patterns and validity checks in Code security.

## Status
OPEN
