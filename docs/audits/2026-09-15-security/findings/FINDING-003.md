# FINDING-003: GitHub webhook buffers an unauthenticated body before its size check
**Severity:** MEDIUM · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **CWE:** CWE-400

## Location
- `apps/discord-worker/src/index.ts:506` — only Content-Length is checked before line 514 reads the entire body; the later limit at line 517 uses UTF-16 string length, not bytes; HMAC verification is at line 528.

## Evidence
- Trigger: `POST /webhooks/github` with no Content-Length and a streamed body beyond 1 MiB. When the webhook secret and announcement channel are configured, body buffering occurs before any successful HMAC authentication.
- Source ordering verified by two reviewers; this route implements its own read and is not repaired by FINDING-001's shared-auth fix. Availability impact follows the same full-body buffering primitive; no production load test performed.
- The post-read `rawBody.length` check also permits more UTF-8 bytes than its intended 1 MiB cap when non-ASCII text is supplied; count raw streamed bytes instead of string code units.
- [Cloudflare's memory guidance](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) recommends streaming rather than buffering full untrusted bodies.

## Fix
- Enforce a 1 MiB streaming byte limit with early cancellation, then verify HMAC over the bounded original bytes. Add a test that counts consumed chunks, including a missing-length request and invalid signature.

## Status
OPEN
