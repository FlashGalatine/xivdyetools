# FINDING-042: JWT and V2 bot signatures accept non-canonical encodings (signature malleability, no exploitable consumer)
**Severity:** INFO · **Exposure:** INTERNET-AUTH · **Deploy unit:** auth · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/auth/src/encoding/base64.ts:67` — JWT and V2 bot signatures accept non-canonical encodings (signature malleability, no exploitable consumer)
- `packages/auth/src/encoding/base64.ts:254` — JWT and V2 bot signatures accept non-canonical encodings (signature malleability)

## Evidence
- base64.ts:69 `let base64 = str.replace(/-/g, '+').replace(/_/g, '/');` ... :78 `const binary = atob(base64);`; hex.ts:23 `/^[0-9a-fA-F]*$/`
- Reach: A holder of a valid JWT can re-spell its signature segment (std alphabet, embedded whitespace, '=' padding, non-zero trailing bits). jwt.ts:160 decodes it with base64UrlDecodeBytes and crypto.subtle.verify accepts it. A captured V2 bot signature can likewise be upper-cased (hex.ts:23 accepts A-F), and hmac.ts:203 still verifies it.
- base64UrlDecodeBytes (base64.ts:67-78, not :254; the file is 105 lines) only remaps -/_, pads, and calls the forgiving atob. A local probe confirmed atob drops whitespace and ignores trailing bits ("QUJ=" and "QUI=" decode the same). Only the signature segment is malleable, because the signed input at jwt.ts:156 is the raw header.payload text. No consumer keys anything on the raw token or signature string: revocation keys on jti (oauth token.ts:131, jwt-service.ts:235), and the presets-api replay cache keys on the required nonce (middleware/auth.ts:159-213), so a re-spelled replay is still refused. The result is hardening only, wit… Preconditions: The attacker already holds a valid JWT, or has captured a V2 signature with a still-unused nonce inside the 60 s window. Re-spelling gives no new capability unless a future consumer keys a cache, blacklist, or dedupe on the raw token or signature string.

## Fix
- In base64UrlDecodeBytes, reject any input that does not match /^[A-Za-z0-9_-]*$/, has length%4==1, or fails the round trip base64UrlEncodeBytes(decoded)===input. In verifyBotSignatureV2/hmacVerifyHex, require lowercase hex (/^[0-9a-f]{64}$/) before verifying.

## Status
OPEN
