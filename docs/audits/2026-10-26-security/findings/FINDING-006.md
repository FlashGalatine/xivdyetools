# FINDING-006: Sign-in modal says browsing has "no rate limit", but presets-api rate-limits every /api/* request to 100/min per IP
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy copy); limiter lives in presets-api · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/src/locales/en.json key preset.gateBrowseNote (in-product account-gate copy) · **CWE:** CWE-451

## Location
- `apps/web-app/src/locales/en.json:1009` — Sign-in modal says browsing has "no rate limit", but presets-api rate-limits every /api/* request to 100/min per IP

## Evidence
- en.json:1009 "gateBrowseNote": "No account, no rate limit."; presets-api/src/index.ts:162 app.use('/api/*', publicRateLimitMiddleware); rate-limit.ts:54 const PUBLIC_LIMIT = PUBLIC_API_LIMITS.default; rate-limit.ts:138 if (!c.req.raw.headers.get('CF-Connecting-IP')) return next();
- Reach: Any visitor who opens the sign-in modal sees the "Browse and search" row with the note "No account, no rate limit." (rendered at signin-modal.ts:40). The web-app's browse calls go straight to https://api.xivdyetools.app/api/v1/presets (community-preset-service.ts:84, :346), and those calls pass through publicRateLimitMiddleware.
- presets-api index.ts:162 mounts publicRateLimitMiddleware on '/api/*', ahead of auth. It applies PUBLIC_API_LIMITS.default (100 per 60s, rate-limit.ts:54) keyed on CF-Connecting-IP and skips only requests that have no CF-Connecting-IP, which means service bindings (rate-limit.ts:133-140). The RL_PUBLIC binding is declared in both envs (wrangler.toml:46, :116), so anonymous browsing is rate-limited and the copy is literally false in all 6 locales. The text is false but harmless (100/min is generous, and signing in does not lift the limit either), so this is LOW policy-copy accuracy and not a security weakness. Preconditions: None. The text is shown to every visitor who opens the sign-in modal, and the limiter applies to every edge request that carries CF-Connecting-IP.
- Live state the repo cannot show: Whether production uses the native RL_PUBLIC binding or the memory fallback changes only how the limit is enforced, not whether one exists. Both paths enforce 100/min.

## Fix
- Reword preset.gateBrowseNote so it no longer claims there is no limit, e.g. "No account needed.". Update all six locale files so the locale-quality and parity gates stay green, and leave the limiter unchanged.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/src/locales/en.json:1009, ja.json:1009 ("アカウント不要、レート制限なし。"), de.json:1009 ("Ohne Konto, ohne Limit."), fr.json:1009 ("Sans compte, sans limite."), ko.json:1009 ("계정 불필요, 속도 제한 없음."), zh.json:1009 ("无需账号，无速率限制。"). There are no .md policy siblings, since this key is only UI copy.

## Status
OPEN
