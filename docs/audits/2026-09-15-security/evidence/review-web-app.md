# Web app security review — 2026-09-15

## Routes, authority, and sinks

| Surface | Authority / sink | Evidence |
|---|---|---|
| Static SPA | Browser-local settings, palettes, and OAuth JWT; no server-rendered user markup | `src/services/auth-service.ts:269-335`; `src/shared/logger.ts:69-75` |
| OAuth callback | PKCE verifier + CSRF state in sessionStorage; same-origin return path only; token exchange, then localStorage JWT | `src/services/auth-service.ts:357-439, 636-750` |
| `.chara` import | Parsed locally; only bounded model-number payload reaches api-worker; telemetry emits only boolean + producer bucket | `src/components/chara-import.ts:294-397`; `PRIVACY.md:18-25` |
| Telemetry | Opt-in, in-memory batched beacon to api-worker; allowed fields are limited server-side | `src/services/telemetry-service.ts:32-39, 97-136, 198-238` |

## Candidates

| Candidate | Severity / exposure | File:line | Claim | Evidence |
|---|---|---|---|---|
| Privacy disclosure omits operational IP-keyed limiting | P2 privacy / any API or telemetry caller when KV fallback is active | `PRIVACY.md:90-92`; `apps/api-worker/src/middleware/rate-limit.ts:125-150` | The policy says IP addresses are never collected, while rate limiting derives a client-IP key and stores it in KV when the native binding is absent. | This is outside Analytics Engine and its short window is operational abuse control, but it is still server-side processing/persistence of a raw IP key. Document the exception/retention or avoid raw-IP KV keys. |

## Positive controls

- No application `postMessage` or message-event listener was found in tracked web source; no cross-window trust boundary exists.
- OAuth checks both stored CSRF nonce and code verifier, removes them before exchange, validates provider, sanitizes the return path, and revokes remotely before clearing local state (`src/services/auth-service.ts:363-414, 723-750`).
- Telemetry defaults off, dynamically honours GPC, drops queued data on opt-out, sends no identifier, uses coarse producer buckets, and emits only in-memory batches (`src/services/telemetry-service.ts:97-118, 176-238`).
- CSP limits scripts to self, forbids objects/frames/forms, restricts connections to first-party xivdyetools hosts, and limits `.chara` icons to the api-worker proxy (`public/_headers:14-31`).
- `innerHTML`/Lit `unsafeHTML` sites are documented static SVG/icon or sanitized/allowlisted presentation paths; no user-controlled value was found flowing directly into these sinks. Static public assets use content-hashed `/assets/*`; HTML is revalidated (`public/_headers:54-63`).

## Rejected suspicions

- `.chara` uploads, image data, names, and raw producer strings are not sent in telemetry: parsing is local and producer is normalized before `track()` (`src/components/chara-import.ts:294-337`; `src/services/telemetry-service.ts:176-185`).
- GPC or a disabled toggle cannot flush an existing batch: `flush()` clears and returns when `isEnabled()` is false; the server independently drops `Sec-GPC: 1` (client `telemetry-service.ts:198-206`; server `apps/api-worker/src/telemetry/router.ts:53-57`).
- Browser development console calls involving preset text/OAuth callback values are not a production remote logging sink; production uses `createBrowserLogger({isDev:false})` (`src/shared/logger.ts:69-75`; `src/services/preset-submission-service.ts:307,572`).

## Coverage and limits

Covered tracked source/config: `apps/web-app/src`, `public/_headers`, Vite beta header merge, OAuth, telemetry, `.chara`, browser logs, and privacy/analytics docs. Read-only source review; no build, runtime, deployment, or third-party endpoint probe. Image/preset API server behavior is outside this unit except for client sink and disclosure tracing.
