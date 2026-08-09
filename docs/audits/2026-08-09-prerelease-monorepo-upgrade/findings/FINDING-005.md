# [FINDING-005]: `presets-api` advertises the bot identity headers in CORS `allowHeaders`

## Severity
LOW (hardening / attack-surface hygiene — **not exploitable**)

## Category
A05:2021 Security Misconfiguration · CWE-1220

## Location
- File: [apps/presets-api/src/index.ts](../../../../apps/presets-api/src/index.ts)
- Line: 126

## Deploy Unit
`presets-api`

## Exposure
INTERNET-UNAUTH (the header list is publicly readable via a preflight response)

## Rotation Required
NONE.

## Description

The CORS preflight response permits browsers to send `X-User-Discord-ID` and
`X-User-Discord-Name`:

```ts
// apps/presets-api/src/index.ts:126
allowHeaders: ['Content-Type', 'Authorization', 'X-User-Discord-ID', 'X-User-Discord-Name'],
```

These are the **server-to-server bot identity headers**. They are consumed only by
`authMiddleware`, and only inside the bot-auth branch.

## Why this is NOT an auth bypass

This was traced end to end before being filed, because on its face it looks like header-spoofed
impersonation. It is not:

```ts
// apps/presets-api/src/middleware/auth.ts:119-171 (abridged)
if (c.env.BOT_API_SECRET && (await timingSafeEqualStr(token, c.env.BOT_API_SECRET))) {
  if (!c.env.BOT_SIGNING_SECRET) {
    if (isDevOrTest) { /* unsigned allowed in dev/test only */ }
    else { /* production: reject — do not authenticate */ }
  } else {
    const isValidSignature = await verifyBotSignature(
      signature, timestamp, userDiscordId, userName, c.env.BOT_SIGNING_SECRET);
    if (!isValidSignature) { /* do not authenticate */ }
    else { auth = { …, userDiscordId, userName, authSource: 'bot' }; }
  }
}
```

`X-User-Discord-ID` is honoured only when **all** of the following hold:

1. `Authorization: Bearer <token>` where `token` equals `BOT_API_SECRET` (constant-time compare),
2. `BOT_SIGNING_SECRET` is configured — production **rejects bot auth outright** without it, and
3. `X-Request-Signature` is a valid HMAC-SHA256 over `timestamp:userDiscordId:userName`, within
   a 5-minute window.

A browser has none of these secrets. Sending the headers from a page achieves nothing: the
request falls through to `authSource: 'none'` and the route guards return 401/400. The
inline comment at `auth.ts:120-122` shows the impersonation vector was anticipated and
deliberately closed by the signature requirement.

## Impact

No exploitable impact. The cost is informational: the preflight response tells any observer
that this API has a bot-identity header convention, which is a small reconnaissance aid. It
also leaves a trap for future maintainers — a later refactor that relaxes the signature check
would silently turn this into a real impersonation vector, because the browser-facing
permission is already in place.

## Recommendation

Remove the two headers from `allowHeaders`:

```ts
allowHeaders: ['Content-Type', 'Authorization'],
```

Browsers never legitimately send them — the web client authenticates with a JWT in
`Authorization`, and the bots are server-to-server callers that are **not subject to CORS at
all**. Removing them is behaviour-preserving for every real client.

Verify by confirming the `discord-worker` → `presets-api` and `moderation-worker` →
`presets-api` paths still work; both call through Service Bindings / direct fetch, neither
performs a CORS preflight, so no change is expected.

Bundle this with [FINDING-002](FINDING-002.md) — same file, same middleware, one review, one
deploy.

## References
- CWE-1220: Insufficient Granularity of Access Control
- `apps/presets-api/CLAUDE.md` § HMAC Signature Format (Bot Auth)
