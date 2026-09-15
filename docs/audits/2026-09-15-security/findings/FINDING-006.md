# FINDING-006: OG metadata logs emit raw User-Agent and complete share URLs
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** og-worker · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `apps/og-worker/src/index.ts:539-546` — info log includes the raw crawler User-Agent, full URL including query, and generated title.
- `apps/web-app/PRIVACY.md:90-94` — opt-in Usage Analytics excludes UA/page URLs; separate OG documentation describes share URL access but does not explain operational log fields or retention. This is a disclosure/minimization gap, not proof that the analytics promise governs all operational logs.

## Evidence
- A supported tool URL requested with a crawler-shaped User-Agent reaches this log. Arbitrary extra query values and UA suffixes survive in the log context even though the Analytics Engine point is coarse and validated.
- The logger's secret redaction is not general URL/query/UA minimization; `logUserAgent: false` on request middleware does not affect this explicit call. Two source reviewers verified emission.
- Persistent collection depends on Workers Logs, tailing or another configured log sink; production retention was not inspected. Crawler UA normally identifies social-platform infrastructure, not the end user. Keep this LOW hardening finding distinct from a confirmed personal-data or AE leak.

## Fix
- Keep only tool, validated locale and crawler category; remove raw UA, full URL and user-derived title from normal logs. Test the logger output as well as AE fields against the privacy promise.

## Status
OPEN
