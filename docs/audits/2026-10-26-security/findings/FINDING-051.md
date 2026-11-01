# FINDING-051: main branch protection still has enforce_admins and strict off after the 2026-10-03 remediation PRs it waited on merged
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** CI (GitHub repo settings) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693
**Supersedes:** 2026-10-03-security/FINDING-024 (residual: enforce_admins and strict still off)

## Location
- `docs/operations/OPEN_ITEMS.md:36` — main branch protection still has enforce_admins and strict off after the 2026-10-03 remediation PRs it waited on merged

## Evidence
- Live GET protection (2026-10-26): "strict":false, "enforce_admins":{"enabled":false}, contexts [Lint..., Security audit..., E2E..., Secret scan (gitleaks)], no required_pull_request_reviews. OPEN_ITEMS.md:36: "`strict` and `enforce_admins` stay off until the 2026-10-03 remediation PRs are merged." gh pr view: 224/229/234 MERGED 2026-10-05.
- Reach: Only the repo admin, the sole collaborator, can do this: push straight to main, or merge while Secret scan (gitleaks) is red. The path-filtered deploy-*.yml workflows fire on that push with no needs: on CI, so the gitleaks gate never blocks it.
- I read the live state with a GET to gh api branches/main/protection: enforce_admins.enabled=false, required_status_checks.strict=false, no required_pull_request_reviews, and the 4 required contexts include Secret scan (gitleaks). OPEN_ITEMS.md:36 and FINDING-024's Status both say strict/enforce_admins were held off only "until the 2026-10-03 remediation PRs are merged"; I spot-checked #224, #229 and #234, all MERGED on 2026-10-05, so the deferral's condition is met but the settings were never revisited. The impact is limited to the admin skipping their own gate (an attacker holding the admin account could just change the protection), and GitHub push protection still applies, so INFO rather than a reachable weakness; it is not in security-trade-offs.md and not in either earlier audit's positive controls.
- Preconditions: The actor needs GitHub admin rights on FlashGalatine/xivdyetools, and today that is only the owner. For a secret leak to land, the secret also has to match no pattern that GitHub push protection knows.
- Live state the repo cannot show: GitHub branch protection on main, which I read live via a GET to gh api on 2026-10-26. A ruleset or a later settings change would supersede it.

## Fix
- Turn on enforce_admins and strict on main (or add a ruleset that requires a PR), confirm with gh api, and tick the OPEN_ITEMS.md §1 item and FINDING-024's deferral note.
- If the solo-maintainer bypass is wanted, record it as an accepted trade-off in docs/architecture/security-trade-offs.md and change OPEN_ITEMS.md:36 so the "until merged" condition goes away.
- **Maintainer decision:** Repo settings choice: turn on enforce_admins and strict now that the 2026-10-03 remediation PRs have merged, or record the deferral as accepted.

## Status
FIXED 2026-10-26 — maintainer-authorized admin enforcement and strict status-check protection enabled on main through narrow API endpoints. Fresh readback confirms both true; full before/after comparison confirms only those two booleans changed, preserving all four required checks and app bindings. [Execution evidence](../evidence/remediation-finding-051-2026-10-26.md). The old FINDING-024 deferral is closed; the separate linear-history item remains open. No code deploy or repository commit was needed for the live action.
