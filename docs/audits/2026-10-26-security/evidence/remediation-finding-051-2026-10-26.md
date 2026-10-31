# FINDING-051 execution evidence — 2026-10-26

The maintainer explicitly authorized enabling enforce_admins and strict branch
protection on main in FlashGalatine/xivdyetools. Times below are UTC; all actions
occurred on October 26 in America/New_York (EDT).

## Baseline — 2026-10-27 03:56:12 UTC

Saved the full GET /repos/FlashGalatine/xivdyetools/branches/main/protection response
in [the before record](main-protection-2026-10-26.before.json).
enforce_admins.enabled and required_status_checks.strict were both false.
Four required checks were present, each bound to GitHub App 15368:

- Lint, Type-check, Test, Build
- Security audit (production dependencies)
- E2E (Playwright, chromium)
- Secret scan (gitleaks)

## Authorized changes — 2026-10-27 03:56:45–03:56:47 UTC

```text
POST /repos/FlashGalatine/xivdyetools/branches/main/protection/enforce_admins
response: enabled = true

PATCH /repos/FlashGalatine/xivdyetools/branches/main/protection/required_status_checks
body: {"strict":true}
response: strict = true; all four existing checks and app IDs retained
```

Both commands exited 0. Only the two narrow endpoints were called; no full-rule
replacement, check-list rewrite, branch push or repository code change occurred.

## Verification — 2026-10-27 03:56:47 UTC

A fresh full GET was saved in [the after record](main-protection-2026-10-26.after.json).
It confirms enforce_admins.enabled = true and required_status_checks.strict = true.

A semantic comparison parsed both JSON records, copied the before object, changed
only the two requested booleans to true, and required exact object equality with
the after object. It passed and exited 0. The [verification result](main-protection-2026-10-26.verification.json)
records that all other settings are unchanged, including the four required-check
names and app bindings, force-push/deletion restrictions, signature protection and
linear-history setting (still false).

FINDING-051 and OPS-BRANCH-PROTECTION are complete. The 2026-10-03 FINDING-024
deferral is closed. The separate linear-history operations item remains open.
No deploy, publish, PR merge or workflow run was performed.
