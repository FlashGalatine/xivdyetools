# Review: discord-core (apps/discord-worker, deploy unit discord-worker)

Scope: `src/index.ts`, `src/commands/{schemas,localize,registry}.ts`, `src/services/**`
(excl. `handlers/`), `src/middleware/` (does not exist in this app), `src/utils/**`,
`src/types/**`. `handlers/` read only where needed to confirm a claim (it is another
reviewer's scope).

## 1. Map

| Module | Role |
|---|---|
| `index.ts` | Hono app: CORS, request-id/logger MW, env-validation MW, security-headers MW, `/health`, `POST /webhooks/preset-submission`, `POST /webhooks/github`, `POST /` (PING/command/autocomplete/component/modal router), first-run notice, global `onError` |
| `commands/schemas.ts` | Slash-command option/choice definitions (17 commands) |
| `commands/localize.ts` | Attaches `description_localizations`/`name_localizations` at register-time only (never at runtime) |
| `commands/registry.ts` | `COMMAND_REGISTRY` — roster of record for `/about` + parity tests |
| `services/rate-limiter.ts` | Native `[[ratelimits]]` bindings + KV fallback, per-isolate singleton |
| `services/command-trace.ts` | Per-interaction Tier-A analytics trace, traced `ExecutionContext`, drain-with-deadline |
| `services/analytics.ts` | Analytics Engine + KV approximate counters |
| `services/preferences.ts` | Unified KV preferences blob (documented KV RMW race, BUG-036, deferred) |
| `services/preset-api.ts` | Service-binding/URL client to presets-api, HMAC v2 signing, 10s timeout |
| `services/preset-favorites.ts` | KV favorites (v1→v2 denormalised migration) |
| `services/budget/*` | Universalis client (module-scope world/DC cache), Cache-API price cache with stale-if-error, 13G ledger calculator, quick picks |
| `services/svg/renderer.ts` | resvg-wasm init (self-healing rejected-promise cache) + render |
| `services/font-coverage.ts`, `fonts.ts` | Bundled font cmap parsing / renderable-codepoint filter |
| `services/i18n.ts`, `bot-i18n.ts` (not reviewed, unchanged) | Locale re-exports |
| `services/image-client.ts` | IMAGE_WORKER service-binding client, 10s timeout |
| `services/image-input-errors.ts` | Substring-marker table for image-worker rejections |
| `services/changelog-parser.ts`, `announcements.ts` | CHANGELOG-laymans.md parse + Discord embed |
| `utils/discord-api.ts` | REST helpers, all timed, `allowed_mentions` always set, safe wrappers |
| `utils/sanitize.ts`, `env-validation.ts`, `response.ts`, `text.ts`, `brand.ts`, `github-verify.ts` | Small focused helpers |
| `types/*` | `Env`, `DiscordInteraction`, preset/budget/github/preferences shapes |

## 2. Candidates

**discord-core-01** — BUG, MEDIUM — `src/index.ts:276-287` — `/webhooks/preset-submission` only checks the `Content-Length` header before buffering, unlike the sibling `/webhooks/github` route (same file, lines ~508-536) which explicitly rejects trusting `Content-Length` alone and streams+counts real bytes with a hard cap. `Content-Length` is client-supplied and can be omitted (defaults to `'0'`, passing the `> 10240` check) or understated; `c.req.json()` then buffers the actual body in full regardless. Failing input: a caller holding `INTERNAL_WEBHOOK_SECRET` sends a chunked request with no `Content-Length` and a multi-MB body → the 10 KB gate is bypassed and the whole body is buffered before any size check runs. Wrong outcome: the bounded-buffering guarantee the GitHub route's own comment describes ("Content-Length can be missing or spoofed") does not hold on this route. Why tests miss it: `github-body-limit.test.ts` exists and exercises exactly this streaming-cap behavior for `/webhooks/github`; there is no equivalent file/case for `/webhooks/preset-submission` (confirmed via grep — zero hits for `10240`/"Payload too large" outside the constant declaration in `index.test.ts`). Covered by test: no. Excerpt:
```ts
const contentLength = parseInt(c.req.header('content-length') || '0', 10);
if (contentLength > 10240) {
  logger.warn('Webhook payload too large', { contentLength });
  return c.json({ error: 'Payload too large' }, 413);
}
let payload: PresetNotificationPayload;
try {
  payload = await c.req.json();   // buffers the full body regardless of the header
```
Fix direction: stream and count real bytes the same way `/webhooks/github` does (or reuse a shared helper), rather than trusting `Content-Length`.

**discord-core-02** — REFACTOR (schema gap), LOW-MEDIUM — `src/commands/schemas.ts:1004-1019` (`/preset submit`) and `:1092-1114` (`/preset edit`) — `preset_name`/`name` and `description` options document "(2-50 characters)" / "(10-200 characters)" in their `description` string but carry no `min_length`/`max_length` attribute, unlike `world` (capped at 32 and pinned by `schemas.test.ts:56` against `WORLD_NAME_MAX_LENGTH`). Failing input: a user types a 3,000-character `preset_name` directly in the Discord client — Discord accepts it (STRING options default to a 6000-char ceiling) and the bot forwards it verbatim to presets-api. Wrong outcome: the documented 2-50/10-200 ranges are unenforced at the one layer that could reject it before a round trip; whatever presets-api does with an out-of-range value is outside this unit. Compounding risk (not separately filed, same root cause): `searchPresetsForAutocomplete` (`services/preset-api.ts:506-511`) and the two autocomplete helpers in `index.ts` (`getMyPresetsAutocompleteChoices:1221-1225`, `getFavoritedPresetsAutocompleteChoices` `:1282`) build autocomplete choice `name` strings as `${preset.name} (...)`/`${preset.name} (${status})` with no truncation to Discord's 100-char choice-name limit — `sanitizePresetName`'s 100-char cap (`utils/sanitize.ts`) is applied only on the embed-display path, never on the autocomplete path. Why tests miss it: `schemas.test.ts` tests `max_length` presence only for `world` (confirmed by reading the whole file — the only `max_length` assertions target the `WORLD_NAME_MAX_LENGTH` constant). Covered by test: no. Fix direction: add `min_length`/`max_length` to `preset_name`/`name`/`description` matching the documented ranges, and truncate autocomplete choice names to 100 chars defensively regardless of what presets-api enforces.

## 3. POSITIVE

- `services/svg/renderer.ts` correctly resets `wasmInitPromise = null` on rejection (BUG-013) so a transient WASM init failure doesn't poison the isolate forever — do not re-file.
- `services/command-trace.ts`'s traced `ExecutionContext` forwards every native member (`exports`/`props`/`cache`/`access`/`tracing`/`abort`) explicitly rather than widening a cast, and still calls `real.waitUntil()` so a rejection is visible to the runtime even though the trace also captures it.
- `utils/discord-api.ts`: every outbound fetch (follow-up, edit, channel message, file variants) carries both an `AbortSignal.timeout` and a default no-ping `allowed_mentions`; `safeEditOriginalResponse`/`safeSendFollowUp` convert throw-or-4xx into a checked boolean for background/`waitUntil` callers (BUG-035/BUG-039) — no floating-promise 4xx swallowing found anywhere in this unit.
- `services/preferences.ts` documents its own KV read-modify-write race (BUG-036) as a known, deliberately deferred limitation rather than silently shipping it — the honest self-audit is exactly what a reviewer wants to find.
- `services/budget/price-cache.ts`'s stale-if-error path (`fetchWithCache`) is a real, tested degrade-gracefully design, not a silent cache-poisoning risk.
- GitHub webhook handling authenticates the raw received bytes (HMAC) before UTF-8 decoding/BOM stripping, and pins the announced repository to a constant rather than trusting the payload — regression-checked, still intact.
- `services/font-coverage.ts`'s `filterToRenderable` fails OPEN (returns text unfiltered) when the coverage set looks implausibly small, with a documented, still-valid reason (empty buffers must never blank every card).

## 4. REJECTED

- `hexToDiscordColor` (`utils/response.ts:161-165`) returns `NaN` for malformed hex — every call site passes `dye.hex` from the trusted, schema-validated dye database, so this can't actually be reached with bad input.
- `utils/text.ts`'s `cutOnLineBoundary` can theoretically return a string longer than `budget` if `tail.length > budget` — both call sites (`DESCRIPTION_BUDGET = 4000` and the /changelog budget) use short static tails, so this is unreachable with the current constants.
- `services/image-client.ts:77-78` (`Number(header ?? 0)` → `NaN` on a malformed `X-Image-Width`/`X-Image-Height`) — image-worker is a same-team trusted service binding, not user input; would need image-worker itself to regress its own response contract, which is out of this unit's scope.
- `services/preset-favorites.ts`'s get→mutate→put (no CAS) is the same KV-RMW shape flagged generically in the brief's known-context list; `services/preferences.ts` documents the identical class of race as an accepted, deferred limitation (BUG-036) elsewhere in this same unit, so this is treated as the same known/accepted risk rather than a new finding.
- `index.ts:877-882` — `maybeSendFirstRunNotice` is scheduled via the raw `ctx.waitUntil` rather than the traced `handlerCtx.waitUntil` — initially looked like a missed-tracing bug, but `ctx` is still the real `ExecutionContext` (keeps the isolate alive correctly) and the first-run notice is deliberately independent of the command's own trace/outcome, so untraced is correct by design.
- `services/budget/universalis-client.ts`'s module-scope `worldsCache`/`dataCentersCache` — shared mutable state across requests/isolate, but read-only after population, 1h TTL, explicitly labelled OPT-001; not the unbounded/stale-forever pattern the brief warns about.

## 5. COVERED

37 non-test source files read in full or substantially (schemas.ts read in large targeted sections covering every option/choice block relevant to the checklist):
`index.ts`, `commands/schemas.ts`, `commands/localize.ts`, `commands/registry.ts`,
`services/analytics.ts`, `services/announcements.ts`, `services/bot-i18n.ts` (re-export only, not deep-read), `services/budget/budget-calculator.ts`, `services/budget/index.ts`, `services/budget/price-cache.ts`, `services/budget/quick-picks.ts`, `services/budget/universalis-client.ts`, `services/changelog-parser.ts`, `services/command-trace.ts`, `services/emoji.ts`, `services/font-coverage.ts`, `services/fonts.ts`, `services/i18n.ts`, `services/image-client.ts`, `services/image-input-errors.ts`, `services/preferences.ts`, `services/preset-api.ts`, `services/preset-favorites.ts`, `services/rate-limiter.ts`, `services/svg/renderer.ts`, `utils/brand.ts`, `utils/discord-api.ts`, `utils/env-validation.ts`, `utils/github-verify.ts`, `utils/response.ts`, `utils/sanitize.ts`, `utils/text.ts`, `types/budget.ts`, `types/env.ts`, `types/github.ts`, `types/preferences.ts`, `types/preset.ts`.

Test files skimmed (not exhaustively) to judge coverage/vacuity: `index.test.ts`, `github-body-limit.test.ts`, `commands/schemas.test.ts`, `services/analytics.test.ts`, `services/command-trace.test.ts`.

Not read: `types/markdown.d.ts` (13-line trivial ambient declaration). `handlers/` and `middleware/` (the latter does not exist in this app — no `src/middleware/` directory) are out of scope; a handful of `handlers/commands/*.ts` call sites were grepped/opened only to confirm claims about `hexToDiscordColor` and `extractImagePixels` consumers.
