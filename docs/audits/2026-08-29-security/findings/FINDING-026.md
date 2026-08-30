# FINDING-026: every web-app page load opens a TLS connection to `universalis.app` (`preconnect` / `dns-prefetch`) that production never uses — contradicting the guide's "first-party hosts only"
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **CWE:** CWE-359

## Location
- `apps/web-app/src/index.html:67-68` — `<link rel="dns-prefetch" href="https://universalis.app">`, `<link rel="preconnect" href="https://universalis.app" crossorigin>`
- `apps/web-app/src/services/api-service-wrapper.ts:49-53` — production calls only `https://data.xivdyetools.app/universalis`
- `apps/web-app/public/_headers:25` — `connect-src` still lists `universalis.app`; `security-headers.test.ts:100-102` admits it

## Evidence
- The visitor's IP and SNI reach a third party on every visit with no request ever following; `apps/web-app/PRIVACY.md:35-40` says the app talks only to the first-party hosts listed (and to Universalis only via the proxy).

## Fix
- Remove both hints; drop `universalis.app` from the production `connect-src` (dev can keep a separate header set); tighten the header test to reject it.

## Status
OPEN
