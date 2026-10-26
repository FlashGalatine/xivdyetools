# FINDING-026: PRIVACY.md 'browsing sends nothing about you' is false for signed-in viewers: opening a preset detail sends the user's JWT to GET /api/v1/votes/:id/check
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** web-app (policy) · **Rotation:** NONE · **Policy:** AMEND apps/web-app/PRIVACY.md section 'Network access' item 3 (Community presets) — qualify 'browsing sends nothing about you' as 'browsing while signed out' · **CWE:** CWE-451

## Location
- `apps/web-app/PRIVACY.md:82` — PRIVACY.md 'browsing sends nothing about you' is false for signed-in viewers: opening a preset detail sends the user's JWT to GET /api/v1/votes/:id/check

## Evidence
- PRIVACY.md:82 "Community presets (`api.xivdyetools.app`): browsing sends nothing about you." / community-preset-service.ts:543-548 fetchWithTimeout(`${this.apiUrl}/api/v1/votes/${encodeURIComponent(presetId)}/check`, { method: 'GET', headers: { ...authService.getAuthHeaders() } })
- Reach: A signed-in web-app user opens any community preset: preset-detail.ts:621 (connectedCallback) and :676 (updated on preset change) call checkVoteStatus() (:686), which calls community-preset-service.ts:528-548 hasVoted(), sending GET api.xivdyetools.app/api/v1/votes/:presetId/check with authService.getAuthHeaders(). presets-api votes.ts:232-250 authenticates the JWT and queries votes by user_discord_id, so the server learns which account viewed which preset.
- The code matches the claim: while signed in, browsing preset details sends the account's bearer token tied to a preset id, so "browsing sends nothing about you" is untrue for signed-in users. The impact is limited to the policy wording. The check route stores and logs nothing (votes.ts:232-250 only runs a SELECT), observability is pinned off (presets-api wrangler.toml:65-66, :131-132), and the client caches the result per preset (community-preset-service.ts:535-539), so the call is one per preset per cache window, not one per open. Under the rubric, policy text that is false but harmless is LOW, not the reviewer's INFO. Preconditions: The viewer is signed in (authService.isAuthenticated()) and opens a preset with an apiPresetId. Signed-out browsing returns early at preset-detail.ts:689 and community-preset-service.ts:530 and sends nothing.
- Live state the repo cannot show: Persisting nothing assumes the deployed presets-api keeps observability disabled with no Logpush or tail consumer, as the repo's wrangler.toml and the CI workers:check-logs gate require.

## Fix
- The vote-state check is needed for the UI. Amend item 3 of the Network access section in every language: say that browsing while signed out sends nothing, and that while signed in, opening a preset sends your sign-in token so the app can show whether you already voted, and that nothing about it is stored. Optionally minimize by deferring the check until the vote button is used.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/PRIVACY.ja.md:40, apps/web-app/PRIVACY.de.md:92, apps/web-app/PRIVACY.fr.md:98, apps/web-app/PRIVACY.ko.md:40, apps/web-app/PRIVACY.zh.md:40. No locales/*.json key carries this sentence (en.json:1005 'Browsing and saving work without an account.' and :1009 'No account, no rate limit.' remain true).

## Status
OPEN
