# FINDING-032: Web-app OAuth client — unvalidated `?provider=` persisted to sessionStorage; API base read from a DOM-clobberable `window.PRESET_API_URL`

## Severity
**LOW** (PLAUSIBLE) — the first causes a silent sign-in failure via a crafted link; the second is a latent bearer-token-redirection primitive that is not exploitable in the current load order. Reviewer IDs: WEB-3, WEB-4. Coordinator-verified (`auth-service.ts:206-211`).

## Category
CWE-20 · CWE-829

## Location
- `apps/web-app/src/services/auth-service.ts:206-211, 340, 608-642` — `urlParams.get('provider')` is cast to `AuthProvider` and stored without validation; `login()` never clears it, so a later Discord code exchange may be routed to the XIVAuth callback.
- `apps/web-app/src/services/community-preset-service.ts:142-148` — `window.PRESET_API_URL` (unused, clobberable by an injected `<a id="PRESET_API_URL">`) overrides the API base; with FINDING-031's `*.workers.dev` allowance a markup injection could point authenticated requests at an attacker host.

## Recommendation
Validate `provider` against the `{'discord','xivauth'}` set and clear it on `login()`/logout; delete the `window.PRESET_API_URL` override (build-time `VITE_*` config only).

## References
- Evidence: `../evidence/review-web-app.md` (WEB-3, WEB-4)
