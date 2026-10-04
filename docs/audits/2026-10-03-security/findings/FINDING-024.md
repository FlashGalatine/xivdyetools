# FINDING-024: main branch protection does not require 'Secret scan (gitleaks)' (ci.yml secret-scan) and has enforce_admins off, while deploy-*.yml deploy on push to main with no dependency on CI
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** CI · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693

## Location
- .github/workflows/ci.yml:87-91 — `secret-scan` job named 'Secret scan (gitleaks)'; it runs on push/PR, but nothing on main requires it
- docs/operations/OPEN_ITEMS.md:29-32 — still-open item: 'add Secret scan (gitleaks) to the required checks'; required checks today are only Lint/Type-check/Test/Build, Security audit, E2E
- .github/workflows/deploy-oauth.yml:3-7 — production deploy fires on `push: branches: [main]` with no `needs:` on CI (the same holds for the other deploy-*.yml)

## Evidence
- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): `branches/main/protection` → contexts `["Lint, Type-check, Test, Build","Security audit (production dependencies)","E2E (Playwright, chromium)"]`, `strict: false`, `enforce_admins: false`, no required reviews — `Secret scan (gitleaks)` is not required.
- contributing.md:110-113: 'a red PR cannot be merged without an explicit admin bypass'. With enforce_admins false, the sole collaborator (admin, review-ci-supply-chain.md:43) can push directly or merge while gitleaks is red.
- Mitigation stays in place: GitHub secret scanning + push protection is enabled (review-ci-supply-chain.md:43), so a leak would only get through as a pattern push protection does not know.

## Fix
- Add 'Secret scan (gitleaks)' to main's required status checks (this closes OPEN_ITEMS.md §1 item 3), and consider strict=true
- Optionally turn on enforce_admins or a ruleset that requires a PR, so the gitleaks gate also applies to the admin's direct pushes before the path-filtered deploys fire
- Re-check with `gh api repos/FlashGalatine/xivdyetools/branches/main/protection` and tick the dated item in OPEN_ITEMS.md

## Status
OPEN — settings only (maintainer): add `Secret scan (gitleaks)` to main's required checks; the job has no path filter. `strict` / `enforce_admins` held until the open PRs are merged. Re-read with `gh api repos/FlashGalatine/xivdyetools/branches/main/protection`. The `OPEN_ITEMS.md` pointer is in `3a158847` (branch `fix/security-2026-10-03-sprint11`; PR #233, draft).
