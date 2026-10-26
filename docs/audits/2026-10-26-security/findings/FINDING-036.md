# FINDING-036: OAuth state is HMAC'd with JWT_SECRET (the JWT signing key) with no domain separation: latent cross-protocol risk, not exploitable today
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** oauth · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-323

## Location
- `apps/oauth/src/utils/state-signing.ts:38` — OAuth state is HMAC'd with JWT_SECRET (the JWT signing key) with no domain separation: latent cross-protocol risk, not exploitable today

## Evidence
- state-signing.ts:37-38 `const encodedState = base64UrlEncode(json); const signature = await signJwtData(encodedState, secret);` / jwt-service.ts:53-54 `signJwtData(data, secret) { return hmacSign(data, secret); }` / packages/auth/src/jwt.ts:116-117 `if (parts.length !== 3)`
- Reach: Any client can call GET /auth/discord or /auth/xivauth with its own state, code_challenge and return_path (bounded by validateStateParam/validateReturnPath, oauth-flow.ts:166-186). The worker answers with HMAC-SHA256(JWT_SECRET, base64url(JSON)) via signState (oauth-flow.ts:203), which travels in the provider redirect URL.
- The facts check out: signState (state-signing.ts:35-40) and signPayload (jwt-service.ts:83-84) both call signJwtData = hmacSign with the same JWT_SECRET, with no prefix or derived subkey. It is not exploitable. The state signing input is base64url and never contains '.', while a JWT signing input always does. Every JWT verifier requires exactly 3 parts (packages/auth/src/jwt.ts:116-117, 139-140), verifyState requires exactly 2 (state-signing.ts:61), and HMAC as a PRF leaks nothing about the key to someone who can request signatures. The only other JWT_SECRET consumer is presets-api's JWT verify (auth.ts:100), so the risk is latent:… Preconditions: None to reach the oracle. Exploitation would need a future feature that HMACs data under JWT_SECRET whose format matches a state (2 dot-separated parts) or a JWT-verifiable structure. No such feature exists in the tracked code.

## Fix
- Derive a separate state key, for example HMAC(JWT_SECRET, "oauth-state-v1"), or sign "state.v1:" + encodedState, in signState and verifyState. During the 10-minute state TTL, also accept the old signature (or just accept that in-flight logins fail once at deploy).

## Status
OPEN
