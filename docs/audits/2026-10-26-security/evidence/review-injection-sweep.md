# Review: injection-sweep (cross-unit) — 2026-10-26, HEAD 13c386e5

Reviewer tier: worker. Read-only. Inputs: `evidence/outbound-fetch.txt`, `evidence/parse-sinks.txt`,
`evidence/html-sinks.txt` (chara rows), `git grep` over tracked `apps/*/src`, `packages/*/src`,
`apps/web-app/functions`. One scratch probe (outside the repo):
`scratchpad/chara-probe.mjs` against `packages/core/dist/chara.js`.

## Sink table (injection classes x units)

| Class | Sinks opened | Result |
|---|---|---|
| SQL built by string/template | presets-api `preset-service.ts:236-305` (whereClause / orderBy from a fixed switch), `:660-716` (setClauses literals), `rate-limit-service.ts:120`; oauth `user-service.ts:262-289` (fields literals); moderation-worker `ban-service.ts:367-452` (`MODERATION_LOG_COLUMNS`, `SQL_UUID_V4`, `restoreGuard(alias)` with code-only alias), `:101-120` LIKE `ESCAPE '\\'` + `.bind` | Every interpolated fragment is a code constant; every value is `.bind()`-ed. No finding. |
| Open redirect | oauth `oauth-flow.ts:75,215,303` (signed state + `validateRedirectUri` exact origin+path); web-app `functions/_middleware.ts:17-21` (fixed hostname swap); og-worker `index.ts:637,674,1376,1405` (`env.APP_BASE_URL` only) | No finding. |
| SSRF / fetch targets | discord-worker `chara-attachment.ts:42-58,108-129` (https + exact CDN host set, `redirect:'manual'`, 10 s, 8 KiB counted); `glamour.ts:55-99` (binding or env URL, fixed path); `index.ts:710-713` (fixed repo URL); api-worker `chara/xivapi.ts:263,344-378` (env base, `redirect:'manual'`, 3xx refused), `chara/icons.ts` | No finding. One hardening gap: candidate -02. |
| Header / CRLF | `c.header`/`headers.set` sweep (all apps/packages): only constants, numbers, validated UUID request ids (`worker-kit/request-id.ts:58-75`, no app opts out of `validateFormat`), upstream ETag into an internal cache header; `Content-Disposition: inline` constant (`chara/router.ts:329`). | No injection. Non-security note in REJECTED (Discord display name as header). |
| Prototype pollution | `Object.assign` / spread sweep; web-app `config-controller.ts:125-138`; `.chara` parser via probe | No global pollution path. |
| ReDoS | every `new RegExp(` in src (presets-api moderation words escaped; web-app `glamour-block.ts:210` static facewear names; `language-service.ts:207` code keys; logger rules documented linear); multi-quantifier regex sweep | Only `chara-gposers.ts:120` is super-linear — already a 2026-10-03 rejected item (see REJECTED). |
| XML/SVG | `packages/svg/src/base.ts:29-37` escapeXml (+ XML-illegal strip); `glamour-card.ts:240-398`, `swatch-card.ts` — every non-escaped `${}` is a number or generator-built chip; all text through `cardText` | No finding. |
| Log injection | worker-kit structured JSON logs; request id UUID-validated; bot-logic command logs carry only `failureKind`; `harmony.ts:189` raw `wheel` unreachable (see REJECTED) | No finding. |
| KV / Cache / R2 keys | discord-worker `prefs:v1:${userId}` (signed snowflake); auth `revoked:${jti}`; api-worker `chara/cache.ts:43-53` (lookupKey from validated uint16 lanes, namespace = JSON of canonical-regex-checked version/schema), `chara/icon-cache.ts:24-29` (`encodeURIComponent(JSON.stringify([...]))`); og-worker `ogCacheKey` (`index.ts:421-450`, normalized) | No separator injection. |
| Path handling | api-worker `/v1/chara/icon/:iconId` `CANONICAL_ICON_ID` + one canonical `version` (`router.ts:291-314`); universalis `^[\d,]+$` (`universalis/router.ts:220`) | No finding. |
| Content-Type / sniffing | api-worker global nosniff/XFO after `next()` (`index.ts:77-92`) also covers the raw icon `Response`; icon PNG signature-checked (`icons.ts:56`), `CSP: sandbox` | No finding. |
| Decompression bombs | no `DecompressionStream`/inflate in src; `.chara` 8 KiB caps before parse; `Base64Image` never read | No finding. |
| Integer / NaN | api-worker `parseIntParam` strict + `MAX_PAGE`; og-worker `CANONICAL_INT`; presets-api pagination | Candidate -01. |

## Candidates

- **injection-sweep-01 (INFO, INTERNET-UNAUTH, presets-api)** — `apps/presets-api/src/handlers/presets.ts:249` clamps `page` below only: `Math.max(1, Number.parseInt(page ?? '', 10) || 1)`. `?page=` + 400 nines parses to `Infinity` (`node -e` probe: `Infinity`, offset `Infinity`; `1e20` gives offset `2e21`), which `preset-service.ts:283-292` binds as `OFFSET ?`. The BUG-016 comment beside it says D1 rejects a NaN bind as a 500; whether D1 also 500s on `Infinity` / a non-int64 offset is a precondition this review could not run. Impact: an anonymous self-inflicted 500, no data. api-worker already caps with `MAX_PAGE` (`routes/dyes.ts:289`).
- **injection-sweep-02 (INFO, INTERNAL upstream, api-worker)** — `apps/api-worker/src/chara/xivapi.ts:432` and `:453` read XIVAPI search / Glasses bodies with unbounded `response.json()`, while the same client caps discovery at 32 KiB (`:164`, `:327`) and icons at 1 MiB (`icons.ts:44-55`). Reachable only if the pinned XIVAPI host (env `XIVAPI_BASE`, redirects refused at `:378-396`) returns an oversized body; impact bounded to that isolate's memory.

## POSITIVE controls (verified this run)

- No template SQL with user data anywhere in `apps/*/src`; LIKE searches escape `%_\` and declare `ESCAPE '\\'` (presets-api `preset-service.ts:251-253`, moderation-worker `ban-service.ts:113,120`).
- `.chara` parser (core 5.15.0 / xivcharakit 0.1.0-beta.4) under hostile input (probe): 4000-deep arrays and 1300-deep objects refused `CharaInputError MAX_DEPTH` in ~2 ms; `1e309` refused `INVALID_NUMBER`; `__proto__` / `constructor.prototype` keys kept as own data, `({}).polluted` stays `undefined`; 7000-space strings parse in ~1 ms.
- `/v1/chara/resolve`: integer-only allowlisted body, 8 KiB streamed cap, `no-store`; icon route canonical-decimal id, single canonical `version`, PNG signature check, `nosniff` + `CSP: sandbox`.
- XIVAPI client and Discord attachment fetch both use `redirect: 'manual'` and refuse 3xx; the attachment host set is exact (`cdn.discordapp.com`, `media.discordapp.net`).
- Cache keys are canonicalized and structured (JSON-encoded tuples, fixed synthetic origin), so no user part can collide with another key's separator.
- SVG cards: `escapeXml` escapes all five XML specials and strips XML-illegal code points; the new `/glamour` and `/swatch` cards route every string through `cardText`.
- worker-kit `requestIdMiddleware` replaces a non-UUID `X-Request-ID` (no app opts out), closing request-id log/header injection.
- Glamour export HTML flavour escapes all text (`web-app/src/shared/glamour-markdown.ts:112-136`).

## REJECTED

- **Template SQL in presets-api / oauth / moderation-worker** — the interpolated parts are code constants (`conditions`, `orderBy` switch, `setClauses`, `MODERATION_LOG_COLUMNS`, `restoreGuard('p'|'presets')`); values bound.
- **Quadratic `text()` regex `/\s*[\r\n]+\s*/g` (`core/src/services/chara/chara-gposers.ts:120`)** — re-file of the 2026-10-03 rejected "Quadratic GPOSERS text() regex" (BUG handoff); unchanged, inputs are XIVAPI names, the build-time acquisition table or the viewer's own note.
- **`[harmony] unknown colour wheel "<raw>"` log (`bot-logic/src/commands/harmony.ts:189`)** — unreachable from Discord: the option has fixed `choices` (`discord-worker/src/commands/schemas.ts:203-207`) and the handler passes `parseColorWheelId(...)` output (`handlers/commands/harmony.ts:53`).
- **`new RegExp(\`\\b${color.name}\\b\`)` (`web-app/src/components/glamour-block.ts:210`)** — static `facewearColors` data, not user input.
- **`mergeWithDefaults` assigns a stored `__proto__` (`web-app/src/services/config-controller.ts:129-134`)** — `merged[name] =` only changes the fresh `merged` object's prototype, not `Object.prototype`; the user's own localStorage.
- **Example-link allowlist admits subdomains of reddit.com / x.com (`presets-api/src/services/validation-service.ts:409-476`)** — no verified open redirector on an allowlisted host; https + host check hold; policy side already FINDING-028.
- **Icon 400 reflects `received: rawId` (`api-worker/src/chara/router.ts:298-302`)** — JSON envelope with `nosniff`.
- **`/=+$/` trim (`web-app/src/services/auth-service.ts:901`)** — runs on the app's own base64 output.
- **Raw Discord `global_name` sent as `X-User-Discord-Name` (`discord-worker/src/services/preset-api.ts:96-97`, source `handlers/commands/preset.ts:70-75`)** — not injection (Headers rejects CR/LF by throwing). A non-Latin-1 display name may make the header set throw depending on workerd's ByteString handling; unverified, functional only — BUG handoff, not a security candidate.

## FILES COVERED

28 files opened and read at the cited lines; grep sweeps (SQL, redirect, header, regex, merge, key, fetch, decode, numeric) over all tracked `apps/*/src`, `packages/*/src`, `apps/web-app/functions`.
Directories: `apps/api-worker/src/{chara,lib,universalis}`, `apps/discord-worker/src/{handlers/commands,services,utils}`, `apps/presets-api/src/{handlers,services}`, `apps/oauth/src/{handlers,services}`, `apps/moderation-worker/src/services`, `apps/og-worker/src`, `apps/web-app/{functions,src/components,src/services,src/shared}`, `packages/{svg,core/services/chara,bot-logic/commands,logger/core,worker-kit/middleware}/src`.
