# review-discord-core — deep-dive 2026-09-02

Unit `discord-core` · deploy unit `discord-worker` (CF Worker, `deploy:production` on merge to main).
Scope: every non-test `.ts` under `apps/discord-worker/src/` **except** `handlers/` and `commands/`, plus
`wrangler.toml` / `package.json` (read-only) and `scripts/`. Repo root = worktree at `origin/main` e7ac4042.

---

## 1. Map

| Module | Role |
|---|---|
| `src/index.ts` (1306 L) | Hono app: CORS → requestId → logger → env-validation → security headers; routes `GET /health`, `POST /webhooks/preset-submission`, `POST /webhooks/github`, `POST /` (interactions). Owns `handleCommand` / `handleAutocomplete` / `handleComponent` / `handleModal`, the dye/clan/preset autocomplete builders, `formatDyesForEmbed`, `maybeSendFirstRunNotice`, `app.onError` |
| `services/command-trace.ts` | CommandTrace lifecycle: `startCommandTrace` → `tracedExecutionContext` → `markCommandOutcome` → `finishCommandTrace` (drain w/ `DRAIN_DEADLINE_MS` 20 s) ; `classifyError`, `bucketLocale`, `subcommandOf`, `trackedCommandName`, `buttonKindOf`, `trackButtonClick` |
| `services/analytics.ts` | AE `writeDataPoint` (8 blobs / 3 doubles) + KV counters (`stats:`, `usertrack:`), `getStats` |
| `services/rate-limiter.ts` | Per-isolate limiter singleton over worker-kit (`RL_5…RL_70` → KV fallback), alias + subcommand scope resolution, `formatRateLimitMessage` |
| `services/preferences.ts` (596 L) | `prefs:v1:{userId}` single-blob get/mutate/put, per-key validation, legacy `i18n:user:` / `budget:world:v1:` migration, resolve helpers |
| `services/preset-favorites.ts` | `xivdye:preset_favorites:v1/v2:{userId}` blobs, add/remove/list, lazy v1→v2 name migration |
| `services/preset-api.ts` | presets-api client (service binding → URL fallback), v2 HMAC signature, 10 s `AbortSignal`, autocomplete search |
| `services/image-client.ts` + `image-input-errors.ts` | image-worker `POST /extract` client (10 s), input-rejection marker table |
| `services/budget/universalis-client.ts` | api-worker `UNIVERSALIS_PROXY` client (10 s), aggregated price mapping, module-scope world/DC caches, `validateWorld`, `getWorldAutocomplete` |
| `services/budget/price-cache.ts` | Cache-API price cache, 300 s fresh / 900 s stale-if-error, `fetchWithCache` |
| `services/budget/budget-calculator.ts` | 13G ledger: candidate net → dedup market IDs → group pricing (A vendor 216 vs board / B,C board / board-only) → gil-per-ΔE sort → pixel cap |
| `services/budget/quick-picks.ts` | 22 stainID-keyed quick picks |
| `services/svg/renderer.ts` + `fonts.ts` | resvg-wasm init (cached promise, reset on reject) + 10 bundled TTFs (`getFontBuffers`) |
| `services/i18n.ts` / `bot-i18n.ts` | locale resolution from KV, per-locale `Translator` factories |
| `services/changelog-parser.ts` / `announcements.ts` | `## [x.y.z] - date` parser; release-announcement embed + `sendAnnouncement` |
| `services/emoji.ts` | per-application stainID → `<:name:id>` lookup |
| `utils/` | `discord-api.ts` (follow-up / edit / sendMessage, 5–10 s timeouts, `allowed_mentions`), `response.ts`, `sanitize.ts`, `text.ts`, `brand.ts`, `env-validation.ts`, `github-verify.ts` |
| `types/` | `env.ts`, `budget.ts`, `preferences.ts`, `preset.ts`, `github.ts`, `markdown.d.ts` |
| `wrangler.toml` | top-level = **beta** (`…-dev`, no routes); `[env.production]` = live bot; six `[[ratelimits]]` per env; `Data` rule `**/*.ttf`, `Text` rule `**/*.md` |

---

## 2. Candidates

### discord-core-01 — BUG — **HIGH** — `apps/discord-worker/src/index.ts:125-133`
**Claim.** `formatDyesForEmbed` resolves preset dyes through `dyeService.getDyeById()`, which is keyed by the
**legacy itemID** space (5729–48227), but every preset's `dyes` array is **stainIDs 1–254** — so every
moderation and submission-log embed prints raw numbers instead of dye names.

Failing input → wrong outcome: a preset webhook with `dyes: [1, 2, 3]` (Snow White / Ash Grey / Goobbue Grey)
renders the embed field **"1, 2, 3"**. Every preset submission is affected — moderators approve/reject from
this embed.

Proof chain (all read, not assumed):
* `apps/presets-api/src/services/validation-service.ts:217-222` rejects any dye id `>= 5000` and requires
  `id <= 254` — the payload cannot contain a legacy itemID.
* `apps/presets-api/src/handlers/presets.ts:974-983` spreads the stored preset verbatim into the webhook body.
* `packages/core/src/services/dye/DyeDatabase.ts:331-335` builds `dyesByIdMap` from `dye.id` / `dye.itemID`
  (`= legacyItemID`, min 5729 across all 125 rows — verified against `dyes.json`); stainIDs live in a separate
  `dyesByStainIdMap` reached only by `getByStainId`.
* The sibling call site was already fixed: `handlers/commands/preset.ts:971` uses `dyeService.getByStainId`.

```ts
function formatDyesForEmbed(dyeIds: number[]): string {
  return dyeIds
    .map((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);   // ← itemID map; stainIDs miss
      if (!dye) return dyeId.toString();          // ← prints "1, 2, 3"
      return getLocalizedDyeName(dye.itemID, dye.name);
    })
    .join(', ');
}
```

Covered by test: **no** — see discord-core-13.
Fix: `dyeService.getByStainId(dyeId)` (mirror `handlers/commands/preset.ts:971`), or route through one shared
`resolvePresetDye` helper so both call sites cannot drift again.

---

### discord-core-02 — BUG — **MEDIUM** — `apps/discord-worker/src/services/announcements.ts:83-94` (+ `src/index.ts:617-636`)
**Claim.** `sendAnnouncement` `await`s `sendMessage` but discards the `Response`, so a Discord **4xx/5xx**
resolves as success and the `announced:v:<version>` memo is written anyway — permanently suppressing that
release's announcement.

Failing input → wrong outcome: Discord answers 403 (missing `SEND_MESSAGES` in the announcement channel) or
400 (embed rejected). `sendAnnouncement` returns normally; `index.ts:630` writes
`announced:v:5.2.0` with a 90-day TTL; every GitHub *Redeliver* then short-circuits at `index.ts:606`
("Already announced") and the release is never announced. Only a network error / the 5 s `AbortSignal`
timeout throws.

This directly contradicts the invariant documented at `index.ts:624-628` — *"Memoised only after the send
succeeded: a failed announcement leaves no key behind, so a Redeliver can still get the release out."*

```ts
export async function sendAnnouncement(botToken, channelId, entry, repoUrl): Promise<void> {
  const embed = formatAnnouncementEmbed(entry, repoUrl);
  await sendMessage(botToken, channelId, { embeds: [embed] });  // Response dropped
}
```

Covered by test: **no** — see discord-core-14.
Fix: return / check `res.ok` (the pattern `index.ts:338-346` and `455-461` already use for the two preset
webhooks) and let `index.ts` skip the memo + answer 502 on a rejected send.

---

### discord-core-03 — BUG — **MEDIUM** — `apps/discord-worker/src/services/budget/budget-calculator.ts:286-287`
**Claim.** The OPT-006 stale-if-error signal never reaches the user: `pricesStale` and `pricesAsOf` are
computed and returned on `BudgetLedgerFindResult`, and **nothing anywhere reads either field**
(`grep pricesAsOf|pricesStale` over `apps/discord-worker/src` returns only the producer and the type).

Failing input → wrong outcome: Universalis (or `UNIVERSALIS_PROXY`) is down; `price-cache.ts:220-238`
re-reads the cache with `acceptStale: true` and serves entries **up to 15 minutes old**; `/budget` renders
the ledger with those prices and no warning, so the user reads a 15-minute-old market price as current.
`price-cache.ts:215-218` explicitly promises otherwise: *"The caller surfaces `stale: true` in the embed."*

Secondary (same block, `budget-calculator.ts:271-274`): `pricesAsOf` takes `priceTimestamps[0]` — the first
entry in map-insertion order, which `fetchWithCache` fills cache-first — not the oldest or newest, so even
when it is wired up it will report an arbitrary entry's timestamp.

```ts
const priceTimestamps = Array.from(prices.values()).map((p) => p.fetchedAt).filter(Boolean);
const pricesAsOf = priceTimestamps.length > 0 ? priceTimestamps[0] : new Date().toISOString();
return { …, pricesAsOf, pricesStale: stale };   // neither field is ever read
```

Covered by test: **no** (`budget-pipeline.integration.test.ts` asserts `price.fetchedAt` is defined; nothing
asserts the flag reaches an embed).
Fix: surface `pricesStale` as a `STATE.warning` embed line in `handlers/commands/budget.ts`, and make
`pricesAsOf` `Math.min` over the timestamps.

---

### discord-core-04 — BUG — **MEDIUM** — `apps/discord-worker/src/index.ts:1201-1210`
**Claim.** The one-time favorites name back-fill is `await`-ed inside the same `try` as the lookup, so a KV
write failure costs the user **all** their autocomplete suggestions, not just the migration.

Failing input → wrong outcome: a legacy-v1 favourites user opens `/preset favorite remove` and types. Each
keystroke resolves the missing names (up to **50 parallel presets-api service-binding calls**, each with a
10 s timeout, inside Discord's 3-second autocomplete budget) and then writes the blob back. Several
keystrokes land before the first write is visible, so multiple `put`s hit the same key within a second;
a rejected write throws, the outer `catch` at 1217 returns `[]`, and the user sees **no options at all**.

```ts
const missing = entries.filter((e) => !e.name);
if (missing.length > 0) {
  const resolved = await Promise.all(missing.map((e) => presetApi.getPreset(env, e.id).catch(() => null)));
  for (let i = 0; i < missing.length; i++) missing[i].name = resolved[i]?.name ?? missing[i].id;
  await savePresetFavoriteEntries(env.KV, userId, entries, logger);   // failure kills the whole result
}
```

Covered by test: **no** (`preset-favorites.migration.test.ts` covers the service, not this call site).
Fix: build the choices from `entries` first, then wrap the write in its own `try`/`catch` (or hand it to a
`waitUntil`) — the migration is an optimisation, never a precondition for answering.

---

### discord-core-05 — BUG — **MEDIUM** — `apps/discord-worker/src/services/preferences.ts:171-243`
**Claim.** `setPreference` is a full get→mutate→put of the single `prefs:v1:{userId}` blob, and
`handlers/commands/preferences.ts:305-343` calls it once **per option in a loop** — so
`/preferences set` with k options issues k reads and k writes **to the same KV key inside one request**.
Workers KV documents a 1-write-per-second-per-key limit; `/preferences set` registers **14** settable options
(`commands/schemas.ts:584-716`).

Failing input → wrong outcome: `/preferences set matching:… count:… theme:… market:…` — the later `put`s
are rate-limited, `setPreference`'s `catch` returns `{ success: false, reason: 'error' }`, and the handler
renders them in the failures field (`handlers/commands/preferences.ts:398-400`). The user is told two of
four preferences failed for no reason they can act on. Even when all succeed it is 2k KV operations where
one read + one write would do.

Covered by test: **no** (`preferences.exhaustive.test.ts` sets one key at a time against a mock KV with no
per-key write throttle — the mock is exactly why this cannot fail in CI).
Fix: add `setPreferences(kv, userId, patch)` that reads once, applies every validated key, and writes once;
keep `setPreference` as a one-key wrapper.

---

### discord-core-06 — BUG — **MEDIUM** — `apps/discord-worker/src/services/fonts.ts:51-61` + `src/services/font-coverage.test.ts:163-177`
**Claim.** The bundled font set is subsetted **from locale data only**, but user-authored text is rendered
verbatim into the resvg cards, so non-Latin preset names/descriptions/author names render as tofu.

Measured against the ten committed TTFs (cmap union, same reader the gate uses):
`union = 2,437 codepoints`; **923 / 20,992** CJK ideographs (U+4E00–U+9FFF) and **484 / 11,172** Hangul
syllables (U+AC00–U+D7A3). Probes: `桜の夢` → tofu on 桜, 夢 · `花嫁` → tofu on 嫁 · `龍の鱗` → tofu on 龍, 鱗 ·
`귀여운` → tofu on 귀 · Thai / Arabic / emoji → tofu.

Producer (outside my scope, cited for the chain): `handlers/commands/preset.ts:983-996` passes
`name: preset.name`, `description: preset.description`, `authorName: preset.author_name` — **raw**, by design
("the svg layer XML-escapes itself") — into `generatePresetSwatch`, then `renderSvgToPng`.

`font-coverage.test.ts:163-177` enumerates `LocaleLoader` data + `packages/bot-logic/src/i18n/locales/*.json`
+ `CONSOLIDATED_DYES` + `MATCHING_METHOD_TAGS` + a fixed `CODE_GLYPHS` string. Nothing in that set is user
text, so the gate is green while a Japanese or Korean preset card is unreadable. `utils/sanitize.ts` strips
control / zero-width / bidi characters but has no notion of renderability.

Covered by test: **no** — the gate's scope is the defect.
Fix (the 3 MiB gzip cap rules out shipping full faces): filter user-authored strings against the bundled
cmap union before they reach the SVG — drop or replace uncovered codepoints, and fall back to the embed text
(which Discord renders with system fonts) when a title would be emptied.

---

### discord-core-07 — BUG — **MEDIUM** — `apps/discord-worker/src/services/budget/universalis-client.ts:345-374`
**Claim.** `validateWorld` catches **every** error and returns `null`, which the caller cannot distinguish
from "this world does not exist".

Failing input → wrong outcome: `UNIVERSALIS_PROXY` is down or slow. `getCachedWorlds` throws
`UniversalisError(408|500)`, the catch swallows it, `validateWorld` returns `null`;
`handlers/commands/budget.ts:144` → `:208-214` answers **"world not found"** naming the user's own valid
world, and because the handler treats it as a user condition the analytics row is `answered` rather than
`upstream_universalis` — so a proxy outage is invisible in AE.

```ts
  } catch (error) {
    if (logger) logger.error('Failed to validate world', …);
    return null;                 // outage and "unknown world" are the same value
  }
```

Covered by test: **no**.
Fix: rethrow (or return a discriminated `{ ok:false, reason:'upstream' }`) so the handler can say "market
data is unavailable" and `classifyError` can class it as `upstream_universalis`.

---

### discord-core-08 — BUG — **LOW** — `apps/discord-worker/src/services/preferences.ts:489-500`
**Claim.** The legacy `budget:world:v1:{userId}` migration copies `worldPref.world` into the unified blob
**without** the FINDING-019 shape guard, while `language` on the same path *is* validated with `isValidLocale`.

Failing input → wrong outcome: a `budget:world:v1:` blob written before the guard existed can hold an
arbitrarily long / control-character world string. On first `getUserPreferences` it is copied into
`prefs:v1:{userId}` verbatim and then flows to `validateWorld` → the Universalis proxy path and (if it
resolves) into the shared price-cache key `buildPriceCacheUrl(world.toLowerCase(), itemId)`.

```ts
const worldPref = JSON.parse(legacyWorldData) as { world?: string };
if (worldPref.world) { prefs.world = worldPref.world; hasMigrated = true; }   // no length / control check
```

Covered by test: **no**.
Fix: run `validatePreferenceValue('world', worldPref.world)` before adopting it (drop it when invalid).

---

### discord-core-09 — BUG — **LOW** — `apps/discord-worker/src/index.ts:826-830` + `:719-748`
**Claim.** The 5.0 first-run notice is `waitUntil`-ed **before** the interaction response exists and posts an
interaction follow-up, while flagging KV first — so a lost race costs the notice permanently.

Failing input → wrong outcome: `maybeSendFirstRunNotice` starts concurrently with the handler; it does
`KV.get(firstrun)` → `KV.put(firstrun)` → `KV.get(prefs)` → `sendFollowUp`. If that reaches Discord before
Discord has processed the interaction response, `POST /webhooks/{app}/{token}` answers 404 *Unknown Webhook*.
The flag was written at line 729 ("a failed send must never become a repeat notice"), so the user never sees
the notice; the only trace is `logger.warn('First-run follow-up rejected')`.

Covered by test: **no**.
Fix: start the notice from inside the handler's own post-ack path (or gate it on the response having been
produced) rather than racing the ack.

---

### discord-core-10 — BUG — **LOW** — `apps/discord-worker/src/services/preset-api.ts:159-167`
**Claim.** `await response.json()` runs **before** the `response.ok` check, so a non-JSON error body loses the
status code.

Failing input → wrong outcome: presets-api is unreachable / throws at the runtime level, or a route answers
plain text (`src/test-utils.integration.ts:47` returns exactly `new Response('Not found', {status:404})`).
`.json()` throws, the catch turns it into `PresetAPIError(500, 'Failed to communicate with preset API')`:
`getPreset`'s 404 → `null` mapping (`:240`) is bypassed, and `classifyError`
(`command-trace.ts:303-304`) records `upstream_presets` where the truth was `rejected`.

```ts
const data: T & {message?: string; error?: string} = await response.json();  // throws first
if (!response.ok) throw new PresetAPIError(response.status, data.message || …);
```

Covered by test: **no** (`preset-api.test.ts` always stubs JSON bodies).
Fix: read `await response.text()` once, branch on `response.ok`, and `JSON.parse` inside a try so the status
survives. (presets-api's own handlers do return JSON today — this is the runtime/edge path.)

---

### discord-core-11 — BUG — **LOW** — `apps/discord-worker/src/utils/env-validation.ts:91-99`
**Claim.** `validateEnv` splits `MODERATOR_IDS` on commas only, while the consumer `isModeratorId`
(BUG-073) deliberately accepts whitespace **or** comma separators.

Failing input → wrong outcome: `MODERATOR_IDS` set as newline-separated snowflakes (the shape BUG-073 added
support for, and the shape moderation-worker accepts). Moderation keeps working, but `validateEnv` reports
`Invalid Discord ID in MODERATOR_IDS: …` on **every request** (`result.valid === false` forever), and the
error message echoes the raw secret value into the once-per-isolate log line. It is non-fatal only because
the string matches none of the three fatal patterns at `index.ts:196-203`.

Covered by test: **no** (`env-validation.test.ts` uses comma-separated fixtures).
Fix: split with the same grammar `isModeratorId` uses (`/[\s,]+/`), and log the count, not the value.

---

### discord-core-12 — BUG — **LOW** — `apps/discord-worker/src/services/preset-api.ts:479-485`
**Claim.** `searchPresetsForAutocomplete` maps every returned preset with **no `.slice(0, 25)`** — the only
autocomplete builder in the worker without the Discord 25-choice guard (`index.ts:1110`, `:1144`, `:1169`,
`:1216`, `universalis-client.ts:417`, `budget-calculator.ts:347` all slice).

Failing input → wrong outcome: it relies entirely on `filters.limit = 25` being honoured by presets-api,
which clamps to `[1, 50]` with a **default of 20** (`apps/presets-api/src/handlers/presets.ts:240`). Any
future change that drops or ignores the parameter returns up to 50 choices and Discord rejects the whole
autocomplete with a 400 — the user sees "loading options failed".
Covered by test: **no**. Fix: `.slice(0, 25)` before `.map`.

---

### discord-core-13 — UNTESTED — `apps/discord-worker/src/index.test.ts:342-389`, `:397-450`, `:492`, `:536`
**Behaviour that should have been caught:** the moderation / submission-log embed renders **dye names**.
Every webhook fixture already uses the correct stainID shape (`dyes: [1, 2, 3]`, `[4, 5, 6]`, `[1]`) but the
assertions only cover the embed title, the absence of components, and the log line. Nothing reads the
`webhook.fields.dyes` value, so discord-core-01 is invisible.
Mutation proof: replacing `formatDyesForEmbed`'s body with `dyeIds.join(', ')` keeps every test in the file green.
Fix: assert the field value equals `'Snow White, Ash Grey, Goobbue Grey'` for `dyes: [1,2,3]`.

### discord-core-14 — UNTESTED — `apps/discord-worker/src/services/announcements.test.ts` (whole file)
**Behaviour that should have been caught:** a Discord rejection must not be reported as a successful
announcement. The file tests `formatAnnouncementEmbed` only (3 cases); `sendAnnouncement` — the function
whose dropped `Response` causes discord-core-02 — has no test at all, and `index.test.ts` has no
`/webhooks/github` case that stubs a non-2xx `sendMessage`.
Fix: a test that stubs `sendMessage` → 403 and asserts no `announced:v:` key is written.

### discord-core-15 — UNTESTED — `apps/discord-worker/src/services/budget/quick-picks.test.ts:29-49`
**Behaviour that should have been caught:** each quick pick's `targetDyeId` must resolve to the dye it is
named after. The suite asserts the range `1 ≤ id ≤ 254`, `typeof` shapes, and pins **only** `jet_black` (102)
and `pure_white` (101) — the other 20 picks could carry any in-range number.
Mutation proof: changing `neon_green.targetDyeId` from 99 to 98 keeps the file green while `/budget` prices
the wrong dye. (I verified all 22 are currently correct against `dyes.json`; the guard, not the data, is missing.)
Fix: `expect(dyeService.getByStainId(p.targetDyeId)?.name).toBe(p.name)` for every pick.

---

### discord-core-16 — OPT — `apps/discord-worker/package.json` (scripts) / CI
The 3,072 KiB **gzipped** Worker cap is load-bearing for this unit (10 bundled TTFs ≈ 2.14 MiB raw + resvg
WASM + the CJK subsets, documented at ~14 % headroom) but there is **no automated gate** — `grep` for
`3072`/`gzip` across `.github/workflows` and `apps/discord-worker` finds only the prose comment at
`services/fonts.ts:22-24`. The only check is a human running `wrangler deploy --dry-run`, and the deploy
happens automatically on merge to main. Fix: add a `check-bundle-size` step (`wrangler deploy --dry-run`,
parse the reported gzip total, fail over budget) to `lint` or CI, mirroring web-app's budget gate.

### discord-core-17 — REFACTOR — `apps/discord-worker/src/services/preset-api.ts:68,82-84`
`request()` accepts `options.requestId` and sets `X-Request-ID`, but **no caller anywhere passes it**
(`grep requestId apps/discord-worker/src` → only the middleware registration and this declaration). Neither
`budget/universalis-client.ts:126-132` nor `image-client.ts:53-59` sends one either, so `worker-kit`'s
request id stops at this worker's log lines and cannot be joined across the three service bindings. Fix:
thread `c.get('requestId')` down from the handlers, or delete the dead option.

### discord-core-18 — REFACTOR — `apps/discord-worker/src/services/budget/universalis-client.ts:250-259`
`DyePriceData` carries five fields nothing reads — `currentAverage`, `currentMaxPrice` (a literal copy of
`currentMinPrice`, "aggregated endpoint doesn't provide max"), `listingCount` (`Math.max(1, round(dailySaleVelocity))`
— a *sales velocity*, typed and named "Number of active listings"), `lastUpdate` (`worldUploadTimes[0]`, an
arbitrary world's upload time, not the queried one) and `fetchedAt`. The only consumer is
`budget-calculator.ts:176-177` (`currentMinPrice`). They are cached to the Cache API and to the ledger result
on every `/budget`. Fix: narrow the cached shape to what the ledger reads, or wire `lastUpdate` correctly
(max over `worldUploadTimes`) if freshness is meant to be shown (see discord-core-03).

---

## 3. POSITIVE — do not re-file

* **Request verification order is correct.** `packages/auth/src/discord.ts:78-129` checks Content-Length →
  required headers → **timestamp freshness (±300 s / +60 s skew)** → body read → byte-length cap (TextEncoder,
  not `String.length`) → `verifyKey`, and `index.ts:655-669` only `JSON.parse`s after `isValid`. Nothing
  parses a body before the Ed25519 check.
* **No cached-rejected-promise regression.** `svg/renderer.ts:60-67` still resets `wasmInitPromise` in a
  `.catch` on failure; `worldsCache`/`dataCentersCache`, `fontBuffersCache`, `limiterInstance` and bot-logic's
  `localeInstances` are all populated **only after success**.
* **`LocalizationService` singleton race stays fixed** — `packages/bot-logic/src/localization.ts:33-47` keeps a
  per-locale instance map; no shared `currentLocale` is mutated across an await.
* **The analytics trace is sound.** `tracedExecutionContext` forwards every `ExecutionContext` member
  explicitly (no widened cast), the drain loops over promises added *during* the drain, `withDeadline` clears
  its timer, and `finishCommandTrace` is idempotent; the deadline/marking paths are properly tested with fake
  timers (`command-trace.test.ts:137-170`).
* **Every outbound fetch is bounded.** presets-api 10 s, image-worker 10 s, Universalis 10 s, Discord 5 s
  (10 s multipart), the GitHub changelog 10 s — and `DRAIN_DEADLINE_MS` (20 s) sits above all of them.
* **No floating promises in this scope** — every side effect is `await`ed or `ctx.waitUntil`-ed, and
  `enqueueWrite` attaches the `.catch` before handing the promise to `waitUntil`.
* **Cross-application button routing is right.** The preview-image embed is deliberately posted with
  `DISCORD_TOKEN` because `previewimg_*` is handled *here* (`handlers/buttons/preview-image.ts:74-75`), while
  the preset moderation embed goes out under `MODERATION_BOT_TOKEN` and omits the buttons when it is unset.
* **Env-validation latching is correct** — only the *logging* is once-per-isolate (`envErrorsLogged`); the
  check itself, including the production-only `RL_*` block, runs on every request and 500s the request.

## 4. REJECTED

| Suspicion | Why dropped |
|---|---|
| `hexToDiscordColor` / `parseInt(hex,16)` → NaN in `color` | Every call site passes a database hex or a validated `#RRGGBB`; no user-controlled path reaches it. |
| `LOCAL_COMMAND_LIMITS[cmd]` / `COMMAND_ALIASES[cmd]` prototype lookup (`'constructor'`) | `commandName` comes from `interaction.data.name`, which is Ed25519-verified and constrained to registered commands. |
| `getDyeAutocompleteChoices` filters `category !== 'Facewear'` / `stainID != null` | Dead but harmless — schema v2 moved facewear out of `getAllDyes()`; all 125 rows have a stainID. |
| Budget `groups[0].rows[0]` crash on an empty ledger | Guarded — `handlers/commands/budget.ts:281-292` returns early on `alreadyFloor` and `:293` on `groups.length === 0`; a group only exists once a row is pushed into it. |
| `result.omitted` names overflow the 4096-char embed description | Worst case ≈ 119 omitted × ~16 chars ≈ 1.9 KB; arithmetic clears the limit. |
| Autocomplete choice name > 100 chars in `searchPresetsForAutocomplete` | 50 (preset name cap, `validation-service.ts:22`) + 8 + 4 + 32 (Discord display name) = 94 < 100. |
| `setPreference('count', "5")` stores a string | `validatePreferenceValue` parses but `setPreference` assigns the raw value — unreachable: Discord types `count` as INTEGER, so `opt.value` is always a number. |
| `worldsCache` / `dataCentersCache` locale cache-key collision | The caches hold raw Universalis data; localisation is applied after the read in `getWorldAutocomplete`. |
| `/webhooks/preset-submission` Content-Length bypass (missing header → `parseInt('0')`) | Behind `INTERNAL_WEBHOOK_SECRET` + `timingSafeEqual`, checked before the body is read; only the GitHub route adds the post-read re-check. Noted, not filed. |
| `preview_image_key` interpolated unencoded into `https://shots.xivdyetools.app/...` | Same-origin by construction; no host escape is reachable, and the value comes from an authenticated internal caller. |
| World names (`红玉海`, `카벙클`) tofu on the budget card | Verified the world string never reaches `generateBudgetLedger` — it is only in the embed text, which Discord renders with system fonts. |
| `autocomplete` falling through to the 15/min default tier | `packages/worker-kit/src/rate-limiter/presets/configs.ts:71` defines `autocomplete: 60 + 10 burst` → routes to `RL_70`, which both wrangler envs bind. |
| `getStats` `kv.list` without cursor pagination | `stats:` holds ~20 keys (`total`, `success`, `failure`, `cmd:<name>`); the unbounded `usertrack:` listing *is* paginated (`analytics.ts:318-324`). |
| `cutOnLineBoundary` can exceed `budget` | Only when `tail.length > budget`; every call site passes a ~60-char tail against a 4000-char budget. |

## 5. COVERED — 37 files read in scope, 12 cross-referenced

**In scope (read in full):** `apps/discord-worker/src/` → `index.ts`; `services/`{`analytics.ts`,
`announcements.ts`, `bot-i18n.ts`, `changelog-parser.ts`, `command-trace.ts`, `emoji.ts`, `fonts.ts`,
`i18n.ts`, `image-client.ts`, `image-input-errors.ts`, `preferences.ts`, `preset-api.ts`,
`preset-favorites.ts`, `rate-limiter.ts`}; `services/budget/`{`budget-calculator.ts`, `index.ts`,
`price-cache.ts`, `quick-picks.ts`, `universalis-client.ts`}; `services/svg/renderer.ts`;
`utils/`{`brand.ts`, `discord-api.ts`, `env-validation.ts`, `github-verify.ts`, `response.ts`,
`sanitize.ts`, `text.ts`}; `types/`{`budget.ts`, `env.ts`, `github.ts`, `markdown.d.ts`, `preferences.ts`,
`preset.ts`}; `test-utils.ts`, `test-utils.integration.ts`; `wrangler.toml`; `package.json`;
`scripts/subset-cjk-fonts.py`.

**Tests skimmed:** `index.test.ts`, `announcements.test.ts`, `command-trace.test.ts`,
`font-coverage.test.ts`, `budget/quick-picks.test.ts`, plus a repo-wide grep sweep for vacuous assertion
shapes across all 58 `*.test.ts` in the app.

**Cross-referenced to confirm claims (outside scope, read-only):** `packages/auth/src/discord.ts`;
`packages/core/src/config/consolidated-ids.ts`, `src/services/dye/{DyeDatabase,DyeService}.ts`,
`src/data/dyes.json`; `packages/bot-logic/src/localization.ts`;
`packages/worker-kit/src/rate-limiter/presets/configs.ts`;
`apps/presets-api/src/services/validation-service.ts`, `src/handlers/presets.ts`,
`src/utils/api-response.ts`; `apps/web-app/src/services/dye-service-wrapper.ts`;
`apps/discord-worker/src/handlers/commands/{budget,preferences,preset,preset-notifications}.ts`,
`src/handlers/buttons/{copy,preview-image}.ts` (call-site confirmation only — owned by another reviewer).
