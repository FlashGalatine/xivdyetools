# FINDING-050 enable attempt and eligibility evidence — 2026-10-26

The maintainer authorized enabling non-provider patterns and validity checks in
FlashGalatine/xivdyetools. Neither option was enabled. Times below are UTC;
observations occurred on October 26 in America/New_York (EDT).

## Baseline and attempts

GET /repos/FlashGalatine/xivdyetools confirmed a public repository with owner.type
User and permissions.admin true. Secret scanning, push protection and Dependabot
security updates were enabled; both requested options were disabled.

At 2026-10-27 03:48:55 UTC, PATCH of the repository with this body returned success,
but both the response and an independent GET retained the disabled values:

```json
{
  "security_and_analysis": {
    "secret_scanning_non_provider_patterns": { "status": "enabled" },
    "secret_scanning_validity_checks": { "status": "enabled" }
  }
}
```

An isolated PATCH then used only the documented non-provider-pattern setting,
with X-GitHub-Api-Version: 2026-03-10. Its successful response and another fresh
GET also left the option disabled. HTTP success was not treated as completion.

## UI and eligibility

The signed-in repository Settings / Advanced Security page at
https://github.com/FlashGalatine/xivdyetools/settings/security_analysis showed
Secret Protection's Disable button (the feature is on) and Push protection
checked. It exposed neither a Non-provider/Generic patterns nor a Validity checks
control. No UI setting was changed.

Current official documentation:

- [Generic patterns, renamed from non-provider patterns](https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enabling-secret-scanning-for-generic-patterns):
  eligibility lists organization-owned repositories on GitHub Team or Enterprise
  Cloud with GitHub Secret Protection enabled.
- [Validity checks](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/customize-leak-detection/enable-validity-checks):
  eligibility lists organization-owned repositories on GitHub Team with Secret
  Protection enabled.

The documented requirements, owner type, absent controls and unchanged readbacks
identify a feature-eligibility blocker in the current configuration. Neither API
explicitly returned an eligibility error; that explanation is based on the
combined live and documentation evidence.

## Final readback — 2026-10-27 03:51:49 UTC

| Setting | Final value |
|---|---|
| secret_scanning | enabled |
| secret_scanning_push_protection | enabled |
| secret_scanning_non_provider_patterns | disabled |
| secret_scanning_validity_checks | disabled |
| dependabot_security_updates | enabled |

FINDING-050 and OPS-SECRET-SCANNING remain open/blocked on feature eligibility.
No accepted deferral, ownership transfer, paid-plan change, alternative scanner,
workflow modification, deployment or publish was performed. The CI-comment
correction remains companion work for R-CI.
