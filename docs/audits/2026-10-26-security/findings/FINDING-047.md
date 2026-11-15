# FINDING-047: Logger value-shape redaction misses Discord webhook / interaction-token URLs (hardening gap, no live leak path)
**Severity:** INFO · **Exposure:** INTERNAL · **Deploy unit:** logger · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/logger/src/core/base-logger.ts:839` — Logger value-shape redaction misses Discord webhook / interaction-token URLs (hardening gap, no live leak path)

## Evidence
- const SECRET_VALUE_PATTERNS: RegExp[] = [ BEARER_VALUE_PATTERN, DISCORD_TOKEN_VALUE_PATTERN, HEX64_VALUE_PATTERN, ];
- Reach: No attacker path exists today. A developer would have to add a future log call that puts a URL built by discord-worker utils/discord-api.ts:76/165/340 (`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`) under a key that is not on the redaction list (url, followup), or into the message text. Only then would the token reach worker log output.
- The claim is accurate. SECRET_VALUE_PATTERNS (base-logger.ts:839-843) holds only Bearer, the Discord bot-token shape and a whole-value 64-hex run, and SANITIZE_RULES (887+) has no webhook-path rule, so a `/webhooks/<id>/<token>` URL is redacted only through its key name (webhookUrl/webhook_url, pinned in hardening.test.ts:64-71). No tracked call site logs such a URL: discord-worker's safe* helpers log only status and body (discord-api.ts:270, 315, 371), and moderation-worker strips the URL itself with sanitizeUrl (utils/discord-api.ts:62/184/220). Interaction tokens also expire after 15 minutes, and Workers Logs is pinned off, so t… Preconditions: A future log call puts a webhook or follow-up URL in a message, or under a context key that does not end in token/secret/password/apikey and is not on CORE_REDACT_FIELDS. No such call exists at HEAD 13c386e5.
- Live state the repo cannot show: Whether anyone reads raw worker console output through wrangler tail. Workers Logs and Logpush are pinned off by the workers:check-logs gate.

## Fix
- Add a linear, global free-text rule to SANITIZE_RULES, for example /(\/webhooks\/\d+\/)[A-Za-z0-9._-]+/g → '$1[REDACTED]', and add its worst-case adversarial input to hardening.test.ts. Optionally move moderation-worker's url-sanitizer pattern into the logger so both workers share one implementation.

## Status
OPEN
