# FINDING-011: Privacy policy says the CSP allows nothing beyond the listed first-party hosts, but connect-src allows every *.xivdyetools.app subdomain
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md § Network access (or make it true by narrowing connect-src) · **CWE:** CWE-451

## Location
- `apps/web-app/public/_headers:31` — Privacy policy says the CSP allows nothing beyond the listed first-party hosts, but connect-src allows every *.xivdyetools.app subdomain

## Evidence
- _headers:31 `connect-src 'self' https://*.xivdyetools.app;` vs PRIVACY.md:74-75 "The app talks only to these first-party hosts (the site's Content-Security-Policy allows nothing else)"
- Reach: Any visitor reading the Network access section of PRIVACY.md (line 74-75) or its five translations sees "these first-party hosts (the site's Content-Security-Policy allows nothing else)". The CSP served from public/_headers:31 actually allows `connect-src 'self' https://*.xivdyetools.app`.
- The list names data., api., auth. and shots. (plus Discord's CDN as a third party), but the wildcard also allows og., developers., beta. and any future subdomain. The security-headers test only checks that each source is first-party (src/__tests__/security-headers.test.ts:108-113). The bundle only fetches from listed hosts (developers. appears only as an About-modal link; beta is 'self'), and every allowed origin is operator-controlled. So the parenthetical is imprecise wording with no data effect. The 2026-10-03 audit lists "first-party connect-src" as a positive control, which covers the wildcard's security, not this sentence. Preconditions: None for the text mismatch. There is no data effect: every origin the wildcard allows is first-party and operator-controlled, and the app fetches only from listed hosts.
- Live state the repo cannot show: The claim that no *.xivdyetools.app subdomain serves third-party or user-controlled content rests on DNS and the Cloudflare zone, which cannot be checked from the repo.

## Fix
- Preferred: narrow connect-src to the exact hosts the bundle fetches (https://api., auth., data.xivdyetools.app) and pin that set in security-headers.test.ts, which makes the sentence literally true.
- Otherwise reword the parenthetical to "the site's Content-Security-Policy allows only xivdyetools.app and its own subdomains" in all six PRIVACY files.
- **Maintainer decision:** Choose whether to narrow connect-src to the listed hosts (make the policy true) or reword the policy parenthetical.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/PRIVACY.md:74-75; apps/web-app/PRIVACY.ja.md:36; apps/web-app/PRIVACY.de.md:83-84; apps/web-app/PRIVACY.fr.md:88-89; apps/web-app/PRIVACY.ko.md:36; apps/web-app/PRIVACY.zh.md:36. No src/locales/*.json key carries this sentence; git grep for the CSP wording in the six locale files finds nothing.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; local full-repository verification and affected CI/beta pass; prerequisite publication and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
