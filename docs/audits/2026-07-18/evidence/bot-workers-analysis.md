# Bot Workers Deep-Dive Analysis — 2026-07-18

**Scope:** `apps/discord-worker`, `apps/moderation-worker`, `apps/stoat-worker`
**Method:** Read-only source analysis; every finding verified against actual code with file:line references.
**Exclusions honored:** DEAD-XXX registry items (incl. the removed `utils/error-response.ts`, deleted in commit `106e94f` DEAD-113..120), the 2026-02 /budget fixes (batched fetching, `data.nq.listings` null guard, candidate `itemID > 0` filtering), and known domain facts (synthetic negative Facewear IDs, Patch 7.5 consolidation).

Paths are relative to `xivdyetools/`.

---

## BUG-01 — Approve/Reject buttons posted by the main bot are routed to a worker that cannot handle them

- **Kind:** BUG
- **Severity:** HIGH
- **Location:**
  - `apps/discord-worker/src/handlers/commands/preset.ts:979-999` (`notifyModerationChannel`) and `:1038-1076` (`notifyEditModerationChannel`)
  - `apps/discord-worker/src/index.ts:209-229` (`/webhooks/preset-submission`)
  - `apps/discord-worker/src/handlers/buttons/index.ts:64-81` (button dispatcher)
  - `apps/moderation-worker/src/handlers/buttons/index.ts:89-99` (the only handlers for these custom_ids)

**Description.** Three code paths in **discord-worker** post moderation-channel embeds carrying `preset_approve_{id}` / `preset_reject_{id}` buttons, sent with `env.DISCORD_TOKEN` — the **main bot application's** token (client ID `1447108133020369048`):

```ts
// preset.ts:983-996 (same shape in index.ts:209-229)
{
  type: 2, style: 3,
  label: adminT.t('webhook.buttons.approve'),
  custom_id: `preset_approve_${preset.id}`,
  ...
```

Discord delivers component interactions to the **application that owns the message**. The main bot's button dispatcher only recognizes `copy_hex_` / `copy_rgb_` / `copy_hsv_`:

```ts
// discord-worker/src/handlers/buttons/index.ts:64-81
if (customId.startsWith('copy_hex_')) { ... }
...
return ephemeralResponse('This button is not recognized.');
```

The `preset_approve_` / `preset_reject_` handlers exist **only** in moderation-worker, which is a *separate Discord application* (client ID `1453806659708129374`, its own interactions endpoint at `moderation-bot.xivdyetools.app`). Interactions from buttons on main-bot messages will never reach it.

**Reproduction.** Submit a preset via the web app (→ presets-api → `/webhooks/preset-submission` → embed in moderation channel) or via Discord `/preset submit` (pending path). Click **Approve** on the resulting embed. The main bot replies ephemerally: "This button is not recognized." The preset stays pending; the moderator must fall back to `/preset moderate` on the moderation bot.

**Why it evades testing.** Unit tests exercise moderation-worker's `handlePresetApproveButton` directly with mocked interactions, and discord-worker's tests only cover copy buttons. The failure lives at the Discord-side application-routing boundary, which no test (and no single-worker staging smoke test) crosses; it only shows when a real moderator clicks a real button on a message posted by the *other* application.

**Suggested fix (pick one):**
1. Post these embeds via the moderation bot's token (add a `MODERATION_BOT_TOKEN` secret to discord-worker, or forward the notification to moderation-worker over a service binding and let it post) — buttons then route to moderation-worker, which already handles them.
2. Handle `preset_approve_` / `preset_reject_` in discord-worker's button dispatcher (moderator check + `presetApi.approvePreset/rejectPreset` already exist in its `preset-api.ts`; reject needs a modal, which discord-worker currently doesn't implement — option 1 is simpler).
3. Minimum viable: drop the buttons from main-bot-posted embeds and include a "use `/preset moderate` on the moderation bot" hint, so the UI stops advertising a dead affordance.

*Caveat:* if in deployed reality both workers share one Discord application/token (contradicting both CLAUDE.mds and the distinct `DISCORD_CLIENT_ID` vars), severity drops to LOW (dead code in moderation-worker instead). Verify which application posts in the production moderation channel before fixing.

---

## BUG-02 — Env-validation guard disables itself after the first request per isolate

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/index.ts:94-108`

**Description.**

```ts
app.use('*', async (c, next) => {
  if (!envValidated) {
    const result = validateEnv(c.env);
    envValidated = true;                    // <-- set before the hard-fail check
    if (!result.valid) {
      logValidationErrors(result.errors);
      if (result.errors.some(e => e.includes('DISCORD_TOKEN') || e.includes('DISCORD_PUBLIC_KEY'))) {
        return c.json({ error: 'Service misconfigured' }, 500);
      }
    }
  }
  return next();
});
```

`envValidated` is flipped to `true` *before* the critical-secret check returns 500. Because env vars are static for the lifetime of a deployment, a worker deployed without `DISCORD_PUBLIC_KEY` will 500 exactly once per isolate, then let every subsequent request through to handlers running with a broken config (signature verification against `undefined`, webhook posts with a missing token, etc.). The guard protects only the first request — the opposite of its intent.

**Reproduction.** Deploy with `DISCORD_PUBLIC_KEY` unset; send two requests to the same isolate. First → 500 `Service misconfigured`; second → proceeds into `verifyDiscordRequest(c.req.raw, undefined)`.

**Why it evades testing.** Tests either run with a fully-populated mock env or assert only the first-request behavior; isolate-level state persistence across sequential requests isn't modeled.

**Suggested fix.** Cache the *result*, not just the fact of having run:

```ts
let envFatal: boolean | null = null;
if (envFatal === null) { const r = validateEnv(c.env); envFatal = !r.valid && r.errors.some(...); if (!r.valid) logValidationErrors(r.errors); }
if (envFatal) return c.json({ error: 'Service misconfigured' }, 500);
```

(Moderation-worker's equivalent at `apps/moderation-worker/src/index.ts:53-78` only logs and never hard-fails, so it does not share this bug.)

---

## BUG-03 — `/budget find` accepts a Facewear entry as the target dye, sending a negative itemID to the Universalis proxy

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:**
  - `apps/discord-worker/src/handlers/commands/budget.ts:121-127` (target resolution — no Facewear guard)
  - `apps/discord-worker/src/services/budget/budget-calculator.ts:108-113` (target market ID added to fetch set) and `:244-248` (`getDyeByName` searches *all* dyes)
  - `packages/core/src/config/consolidated-ids.ts:113` (`if (dye.itemID < 0) return dye.itemID; // Facewear`)

**Description.** The 2026-02 fix filtered *candidate* dyes with `itemID > 0` (`budget-calculator.ts:96`), but the **target** dye is resolved without any Facewear exclusion:

```ts
// budget.ts:121-124
const targetDyeId = parseInt(targetDyeInput, 10);
const targetDye = !isNaN(targetDyeId) ? getDyeById(targetDyeId) : getDyeByName(targetDyeInput);
```

`getDyeByName` (budget-calculator.ts:244-248) matches against `dyeService.getAllDyes()` with no `itemID > 0` filter. `getMarketItemID` passes negative IDs through unchanged, and `findCheaperAlternatives` seeds the fetch set with it:

```ts
// budget-calculator.ts:108-109
const targetMarketId = getMarketItemID(targetDye);
const marketIdSet = new Set<number>([targetMarketId]);
```

`fetchPrices` then builds `/api/v2/aggregated/{world}/-1127,5729,...` (universalis-client.ts:213-214). The universalis-proxy's item-ID validation (`^[\d,]+$` per the 2026-02 incident record) rejects the whole batch, so the **entire command fails** with a generic API error — not just the one bad item.

Autocomplete can't produce this input (it filters `itemID > 0` and emits numeric IDs), but `target_dye` is a free-text option: a user can type a Facewear color name (or a negative number) directly.

**Reproduction.** `/budget find target_dye:` + manually type any Facewear color name from `/dye list` output; command defers, then edits in "API error".

**Why it evades testing.** All test fixtures and autocomplete-driven manual testing use dyes that came through the filtered autocomplete path; free-text entry of a Facewear name is an input path with no coverage.

**Suggested fix.** In `handleFindSubcommand` right after resolution: `if (!targetDye || targetDye.itemID < 0) return ephemeralResponse(t.t('budget.errors.dyeNotFound', ...));` and/or exclude Facewear in `getDyeByName`. Also consider guarding `parseInt` accepting inputs like `"255 Brown"` (parses as `255`) by requiring a full-string numeric match.

---

## BUG-04 — Universalis aggregated parsing always reads DC-scope prices, even for world-scoped queries

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/budget/universalis-client.ts:226-244` (and the response typing at `:32-47`)

**Description.** The Universalis v2 `/aggregated/{worldDcRegion}/{ids}` response nests each statistic under `world` / `dc` / `region` keys, where `world` is populated when the query scope is a single world. The client reads **only `.dc`**:

```ts
// universalis-client.ts:226-233
const minListingPrice = item.nq?.minListing?.dc?.price;
if (minListingPrice == null) continue;
const averagePrice = item.nq.averageSalePrice?.dc?.price ?? minListingPrice;
...
const velocity = item.nq.dailySaleVelocity?.dc?.quantity ?? 0;
```

The interface itself (`:35-38`) omits the `world` key entirely. Consequences when the user has set a **specific home world** (via `/budget set_world Jenova` or the `world:` option):

- Prices shown are the *datacenter-wide minimum*, which may not exist on the user's world at all.
- Savings math and the "on {world}" label attribute DC prices to the world.
- If the correct semantics were world-scope, listings-empty detection is also wrong-scope.

**Reproduction.** Pick a dye with a large price spread across a DC (cheap on one world, expensive on another). `/budget find` with `world:<expensive world>` reports the cheap world's price.

**Why it evades testing.** Mocked Universalis responses in tests are hand-written to match the parser's expectations (dc-only), so the scope mismatch never surfaces; verifying requires comparing live per-world output against the market board.

**Suggested fix.** Add `world?: { price: number; ... }` to the response typing and prefer `item.nq.minListing.world ?? item.nq.minListing.dc ?? item.nq.minListing.region` (same for average/velocity), or intentionally document/label DC-scope pricing ("cheapest on {dc}, travel to buy"). Verify field availability against the live aggregated schema first.

---

## BUG-05 — `getPresetByName` fetches `limit: 1`, defeating its own exact-match logic

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/preset-api.ts:270-285`

**Description.**

```ts
const response = await getPresets(env, { search: name, status: 'approved', limit: 1 });
// Find exact match first, then partial match
const exactMatch = response.presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
return exactMatch || response.presets[0] || null;
```

With `limit: 1`, `response.presets` has at most one element — chosen by the API's search ranking, not by exactness. If a user's query "Rose" ranks "Rose Gold Dream" first, the preset literally named "Rose" is unreachable through this path; the wrong preset is returned silently.

**Reproduction.** Create approved presets "Rose Gold Dream" (high votes) and "Rose"; call a flow that resolves by typed name. The higher-ranked partial match wins.

**Why it evades testing.** Tests mock `getPresets` to return the expected preset; the ranking-vs-exactness interaction only appears with a realistic search backend and colliding names.

**Suggested fix.** Fetch `limit: 25` (one page) and keep the exact-match-then-first logic; or add an exact-name lookup endpoint to presets-api.

---

## BUG-06 — Deferred-interaction follow-ups: HTTP failures are invisible; error-path edits can reject unhandled inside `waitUntil`

- **Kind:** BUG
- **Severity:** MEDIUM (systemic)
- **Location (representative, same pattern throughout):**
  - `apps/discord-worker/src/handlers/commands/budget.ts:257-272` (success edit, result ignored) and `:293-295` (catch-path edit, not itself guarded)
  - `apps/discord-worker/src/handlers/commands/preset.ts:178-231, 459-529, 589-609` (all `process*Command` bodies)
  - `apps/moderation-worker/src/handlers/buttons/preset-moderation.ts:108-137` (success) and `:143-165` (catch)
  - Root cause enabler: `apps/discord-worker/src/utils/discord-api.ts:137-163` returns the raw `Response`; **no caller in either worker checks `.ok`**.

**Description.** Two related gaps in the defer → `ctx.waitUntil(process...)` → `editOriginalResponse` pattern:

1. **Silent 4xx/5xx.** `editOriginalResponse` / `sendFollowUp` return the fetch `Response`; every call site discards it. If Discord returns 400 (embed limits: description > 4096, total > 6000 — realistic for `/preset list` with long names, or budget descriptions in verbose locales), 401/404 (interaction token expired — tokens die after 15 minutes, and slow Universalis + retries can approach that), or 429, the user is left on "Bot is thinking..." forever and nothing is logged.
2. **Unguarded catch-path edit.** In every `catch` block the fallback `editOriginalResponse(...)` is awaited without its own try/catch. `AbortSignal.timeout(5000)` (discord-api.ts:17, 72, 161) makes a thrown `TimeoutError` a normal occurrence; when it throws, the `waitUntil` promise rejects — the error-report edit is lost *and* the original error context with it.

**Reproduction.** (1) `/preset list` in a category where 10 preset lines + tips exceed 4096 chars → Discord 400 → eternal "thinking". (2) Make Discord's webhook endpoint slow (>5 s) during a failing budget lookup → catch-path edit throws → user sees nothing.

**Why it evades testing.** Mocked `fetch` in tests always resolves `200 OK`; embed-size limits and token expiry only occur with real Discord payload sizes and real latency.

**Suggested fix.** One shared helper used by all background processors:

```ts
async function safeEdit(appId: string, token: string, opts: FollowUpOptions, logger?: ExtendedLogger) {
  try {
    const res = await editOriginalResponse(appId, token, opts);
    if (!res.ok) logger?.error('Follow-up edit failed', undefined, { status: res.status, body: await res.text().catch(() => '') });
  } catch (e) { logger?.error('Follow-up edit threw', e instanceof Error ? e : undefined); }
}
```

Use it for both success and catch paths (catch path is then throw-safe by construction).

---

## BUG-07 — KV read-modify-write on single-blob user data loses concurrent updates

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:**
  - `apps/discord-worker/src/services/user-storage.ts:108-138` (`addFavorite`), `:273-333` (`createCollection`), `:380-427` (`renameCollection`), `:439-477` (`addDyeToCollection`), `:489-521` (`removeDyeFromCollection`)
  - `apps/discord-worker/src/services/preferences.ts:128-196` (`setPreference`), `:238-245`
  - `apps/discord-worker/src/services/preset-favorites.ts` (same pattern)

**Description.** All favorites, collections, preset-favorites, and preferences for a user live in **one JSON value per user**, updated with get → mutate → put and no concurrency control:

```ts
// user-storage.ts:115-129
const favorites = await getFavorites(kv, userId, logger);
...
favorites.push(dyeId);
await kv.put(`${FAVORITES_KEY_PREFIX}${userId}`, JSON.stringify(favorites));
```

KV is last-write-wins and eventually consistent across colos (up to ~60 s propagation). Two interactions in flight for the same user — rapid successive `/favorites add` commands, or Discord + a second device, or (worst) two interactions landing on different colos — will silently drop one write. The existing code comment at `index.ts:729-736` (DISCORD-CRITICAL-002) acknowledges staleness for *autocomplete reads* but the lossy *write* path is the substantive issue: a user adds two dyes to a collection and one vanishes.

**Reproduction.** Fire `/collection add name:X dye:A` and `/collection add name:X dye:B` back-to-back (< the KV round-trip); the second read sees the pre-A state; final value contains only B.

**Why it evades testing.** Mock-KV tests are sequential and strongly consistent; the race needs overlapping real requests and/or cross-colo replication lag.

**Suggested fix.** Cheapest: per-item keys (one key per favorite/collection membership), matching the BUG-007 `usertrack:` approach already adopted in analytics — single `put`/`delete` becomes atomic. Structural: a per-user Durable Object. Interim: keep single-blob but document the limitation and merge-on-write (read-back verify like analytics does at least detects it).

---

## BUG-08 — `/stats` unique-user count silently caps at 1000 (KV `list()` pagination ignored)

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/analytics.ts:252` and `:282-283`

**Description.**

```ts
const userListResult = await kv.list({ prefix: `${USER_TRACK_PREFIX}${today}:` });
const uniqueUsersToday = userListResult.keys.length;
```

`KVNamespace.list()` returns at most 1000 keys per call; `list_complete` / `cursor` are never consulted. Once daily active users exceed 1000, `/stats` reports exactly 1000 forever. The stats-counter list at `:252` has the same latent issue (breaks past 1000 distinct `stats:*` keys — ~996 distinct command names, unlikely but the code shouldn't depend on it).

**Reproduction.** Seed 1500 `usertrack:{today}:*` keys; `getStats` returns `uniqueUsersToday === 1000`.

**Why it evades testing.** Mock KV list implementations return everything unpaginated; production only crosses 1000 DAU under real load.

**Suggested fix.** Loop with `cursor` until `list_complete` (values aren't needed — counting keys only), or maintain a daily counter incremented inside `trackUniqueUser`'s "not seen yet" branch (it already does a read-first check at `:205-208`, so the increment is naturally deduplicated).

---

## BUG-09 — stoat-worker: reaction context stored under the wrong message ID, overwritten in multi-match loops — and no reaction listener exists

- **Kind:** BUG
- **Severity:** MEDIUM (latent — feature-blocking)
- **Location:**
  - `apps/stoat-worker/src/commands/info.ts:106-125` (`sendDyeInfoResponse`)
  - `apps/stoat-worker/src/commands/info.ts:71-79` (`multiple` branch)
  - `apps/stoat-worker/src/index.ts:38-89` (only `ready` + `messageCreate` handlers registered)

**Description.** Three compounding problems in the reactions-as-buttons design:

1. **Wrong key.** The reply is sent and its return value discarded; context is stored under the **user's** message ID:

```ts
await ctx.message.channel?.sendMessage({ ..., interactions: { reactions: DYE_INFO_REACTIONS, restrict_reactions: true } });
// Track message context for reaction handling
ctx.messageContextStore.set(ctx.message.id, { command: 'dye-info', ... });
```

The reactions live on the **bot's reply**. Any future reaction handler will receive the *bot message's* ID and find nothing in the store.

2. **Overwrite on multi-match.** In the `multiple` branch (info.ts:71-79) every `sendDyeInfoResponse` call `set()`s the same `ctx.message.id`, so only the last dye's context survives even under the wrong-key scheme.

3. **No listener.** `index.ts` registers no reaction event handler at all, so the 🎨/🔢/📊/❓ reactions rendered on every dye-info reply (with `restrict_reactions: true`, inviting clicks) do nothing.

**Reproduction.** `!xd info snow` → reply appears with four reaction affordances; clicking any of them does nothing. (Latent parts 1–2 will bite whoever implements the listener: lookups by reacted-message ID miss.)

**Why it evades testing.** `info.test.ts` asserts the store was populated — it was, just under a key that will never be queried — and no test spans the send → reaction → lookup round trip.

**Suggested fix.** Capture the sent message: `const sent = await ctx.message.channel?.sendMessage(...); if (sent) ctx.messageContextStore.set(sent.id, {...});` (revolt.js `sendMessage` resolves to the created `Message`). Either register `client.on('messageReactionAdd', ...)` now or remove `interactions.reactions` until the handler ships, so the UI doesn't advertise dead controls.

---

## BUG-10 — resvg WASM init failure permanently poisons the isolate

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/services/svg/renderer.ts:21-61`

**Description.** `initRenderer` caches `wasmInitPromise` and never clears it on failure:

```ts
if (wasmInitPromise) { await wasmInitPromise; return; }
wasmInitPromise = (async () => { ... await initWasm(resvgWasm); wasmInitialized = true; ... throw ... })();
await wasmInitPromise;
```

If the first `initWasm` throws (resource pressure at cold start, or the library's "already initialized" edge if another copy initialized it), the rejected promise is re-awaited by **every subsequent call** — all image-producing commands in that isolate fail until Cloudflare recycles it (potentially hours).

**Reproduction.** Force `initWasm` to throw once (mock); every later `renderSvgToPng` call rejects with the original error despite the underlying cause being transient.

**Why it evades testing.** Tests either mock the renderer or run one init per process; the poisoned-retry path requires a first-call failure followed by more calls in the same isolate.

**Suggested fix.** In the async IIFE's catch (or after the outer await fails): `wasmInitPromise = null;` before rethrowing, so the next request retries initialization. Guard against double-init by keeping the `wasmInitialized` fast path.

---

## BUG-11 — `/preset submit` moderation-channel embeds skip sanitization that the webhook path applies

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/handlers/commands/preset.ts:963-977` (and `:1024-1036` edit-diff variant) vs. `apps/discord-worker/src/index.ts:186-190`

**Description.** The webhook path deliberately sanitizes user content before embedding (`index.ts:187-189`, with a SECURITY comment):

```ts
const safeName = sanitizePresetName(preset.name);
const safeDescription = sanitizePresetDescription(preset.description);
```

The Discord-submission path builds the same moderation embed from **raw** values (`preset.ts:968-969`: `**Name:** ${preset.name}`, `**Description:** ${preset.description}`); `grep sanitize` over `preset.ts` returns nothing, and presets-api does not sanitize on ingest either. Control characters, zalgo, and markdown-injection (e.g. closing bold / fake field labels to spoof the "Author:" line) flow into the moderation channel — exactly the audience you least want spoofed. (Embeds never ping, so `@everyone` is not an issue.)

**Suggested fix.** Apply `sanitizePresetName` / `sanitizePresetDescription` in `notifyModerationChannel`, `notifyEditModerationChannel`, and `notifySubmissionChannel`, mirroring the webhook path.

---

## BUG-12 — `MODERATOR_IDS` parsed differently by the two workers

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/services/preset-api.ts:207-211` vs. `apps/moderation-worker/src/services/preset-api.ts:304-312`

**Description.** discord-worker: `env.MODERATOR_IDS.split(',').map(id => id.trim())` — comma-only. moderation-worker: snowflake-validated `getModerators()` parsing (per its CLAUDE.md, split on `/[\s,]+/`). A newline- or space-separated secret (which the moderation bot documents as supported) works on one bot and silently yields non-matching entries (`"123\n456"` trims to `"123\n456"`... actually the comma-split leaves embedded newlines inside a single token) on the other — moderator checks in discord-worker's `/preset` flows fail closed with no signal. One shared secret value, two grammars.

**Suggested fix.** Extract a single `parseModeratorIds()` (natural home: the shared package proposed in REF-01) using `split(/[\s,]+/).filter(Boolean)` + snowflake validation in both workers.

---

## BUG-13 — Webhook endpoints ignore Discord API outcomes; no `app.onError`; changelog fetch has no timeout

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/index.ts:192, 240` (`await sendMessage(...)`, result discarded), `:341` (`fetch(changelogUrl)` — no `AbortSignal`), and the absence of any `app.onError` in `apps/discord-worker/src/index.ts` (moderation-worker has one at `src/index.ts:515-530`).

**Description.** `/webhooks/preset-submission` returns `{ success: true }` to presets-api even when `sendMessage` came back 403/404 (bad channel ID, missing permission) — the moderation notification is lost with no signal to the caller and no log. Conversely, when `sendMessage` *throws* (its 5 s `AbortSignal.timeout`, discord-api.ts:272), the route has no try/catch and discord-worker has no `app.onError`, so Hono's default 500 handler responds — inconsistent with the hardened sibling worker. `/webhooks/github`'s `fetch(changelogUrl)` (index.ts:341) is the only outbound fetch in the worker without a timeout; a hung GitHub response holds the request open until the platform kills it.

**Suggested fix.** Check `.ok` and return 502 with a logged status on Discord-send failure; add `AbortSignal.timeout(10_000)` to the changelog fetch; add the same `app.onError` used by moderation-worker.

---

## BUG-14 — component-context: interaction token outlives its validity inside the stored context; storage is per-datacenter (latent — module currently unused)

- **Kind:** BUG
- **Severity:** LOW (latent)
- **Location:** `apps/discord-worker/src/services/component-context.ts:30-35` (TTL constants), `:59-72` (stored `interactionToken`), `:187-226` (`storeContext` via `caches.default`)

**Description.** This module (touched in the recent churn window) is production-referenced only by its own test (`component-context.test.ts`) — no handler imports it, so nothing is broken *today* (it is presumably KEEP-status V4 infrastructure; not re-reporting as dead code). Two design flaws will bite the moment it's wired up:

1. **Token lifetime mismatch.** `ComponentContext.interactionToken` is stored "(for edits)" with `CONTEXT_TTL.STANDARD = 3600` s, but Discord interaction tokens are valid for **15 minutes**. For 45 of the 60 minutes, a retrieved context contains a token guaranteed to 404.
2. **Cache API is per-colo.** `caches.default` is not global storage: a button click that Discord happens to deliver through a different Cloudflare datacenter than the original command cannot find the context, and `getContext` returns null → "context expired" UX for perfectly fresh interactions. KV (or Durable Objects) is the correct substrate for cross-request state; the Cache API migration rationale (KV write quota) trades correctness for quota here.

**Suggested fix (when wiring up).** Cap TTL at ≤ 900 s wherever the token will be used for edits (or don't store the token — components receive a fresh token per interaction); back the store with KV + `expirationTtl` rather than `caches.default`. Also note `generateShortHash` truncates SHA-256 to 32 bits (`:112`) — fine at current scale, but collisions swap users' contexts and the read path (`:235-268`) does not verify `context.userId` against the clicking user; add that check.

---

## OPT-01 — Price cache: per-datacenter storage, unimplemented "stale fallback", and N parallel lookups

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/budget/price-cache.ts:27-30, 55-84, 135-152, 190-227`

**Description.**
1. **Per-colo cache.** Like BUG-14, `caches.default` is datacenter-local. Discord's interaction traffic usually lands on a stable set of colos, but every colo change is a full cold miss for all ~15-40 items → full Universalis round-trip. Expected hit rates are materially lower than a KV- or DO-backed cache would deliver; harmless for correctness, real for latency (the 5-min window rarely amortizes).
2. **Dead retention window.** The header comment promises "5-minute freshness window with 15-minute stale fallback"; `CACHE_MAX_AGE_SECONDS = 900` keeps entries 15 min, but `getCachedPrice` (`:72-75`) returns `null` for anything older than 300 s and **no code path ever reads stale data**. The 300-900 s band is pure dead weight and the docblock is misleading. Either implement stale-if-error (serve ≤15-min-old data when `fetchFn` throws — a genuinely nice resilience win for Universalis outages) or set max-age = TTL.
3. **Fan-out.** `getCachedPrices` issues one `cache.match` per item (`:143-150`). Cheap, but a single per-`(world, schema-version)` bucket entry holding a `Record<itemId, entry>` would make the common case (repeat `/budget` for the same world) one read + one write instead of ~30 each — at the cost of losing per-item TTL granularity. Optional.

**Expected improvement.** Implementing stale-if-error turns Universalis blips into degraded-but-working responses; consolidating reads cuts ~60 cache ops per warm command to ~2. **Trade-offs:** stale prices up to 15 min during outages (label them); bucket approach re-fetches all items when any expires.

---

## OPT-02 — Preset-favorites autocomplete: up to 50 service-binding subrequests per keystroke, with no autocomplete rate limit

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/index.ts:871-896` (`getFavoritedPresetsAutocompleteChoices`), `apps/discord-worker/src/services/preset-favorites.ts:26` (`MAX_PRESET_FAVORITES = 50`); contrast: autocomplete rate limiting exists only in moderation-worker (`apps/moderation-worker/src/index.ts:272-295`)

**Description.**

```ts
const ids = await getPresetFavorites(env.KV, userId, logger);
const resolved = await Promise.all(ids.map((id) => presetApi.getPreset(env, id).catch(() => null)));
```

Every keystroke in `/preset favorite remove` triggers 1 KV read + up to **50 parallel `PRESETS_API.fetch` calls** (each a full HMAC sign + D1 query on the far side). Discord fires autocomplete on nearly every keypress. discord-worker applies **no rate limiting to the autocomplete path at all** (`handleAutocomplete`, index.ts:597-725, has no `checkRateLimit`), unlike moderation-worker which caps autocomplete at 60/min. A user with a full favorites list typing a 10-character filter ≈ 500 subrequests — also uncomfortably close to per-request subrequest budgets if anything else fans out.

**Expected improvement.** Add a bulk endpoint (`GET /api/v1/presets?ids=a,b,c`) or store `{id, name}` pairs in the KV favorites value (denormalized at favorite-add time) → 1 subrequest or 0 per keystroke. Add the same lightweight autocomplete rate limit the moderation worker has. **Trade-offs:** denormalized names go stale if a preset is renamed (acceptable for autocomplete; resolve on selection).

---

## OPT-03 — Analytics: ~10-12 KV operations per command; verification-read logic is a no-op

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/analytics.ts:127-171` (`incrementCounter`), `:197-209` (`trackUniqueUser`), `:214-230` (`trackCommandWithKV`)

**Description.** Per successful command, `trackCommandWithKV` runs three `incrementCounter`s (`total`, `cmd:{name}`, `success|failure`) + `trackUniqueUser`. Each `incrementCounter` does `getWithMetadata` → `put` → verification `get` (3 ops); `trackUniqueUser` does `get` (+ `put` first time daily). That's ~9-11 KV ops (3 writes) per command — on the free tier's 1000 writes/day this saturates at ~333 commands/day, after which *all* KV writes in the namespace (favorites! preferences!) start failing for the day.

The verification read is also ineffective as a retry trigger: `kv.get` immediately after your own `kv.put` from the same isolate reads your own write, so `verifiedValue >= newValue` is essentially always true and the retry loop / backoff (`:158-166`) is dead logic that only adds an extra read. Lost increments under cross-colo concurrency remain lost (acknowledged in comments — Analytics Engine is the source of truth anyway).

**Expected improvement.** Drop the verification read (saves 3 reads/command, no behavior change); collapse the three counters into one daily-bucketed JSON key (1 RMW instead of 3 — halves write volume; races already accepted) or rely wholly on Analytics Engine + compute `/stats` from AE's SQL API. **Trade-offs:** AE-only requires an API token and makes `/stats` an external call; daily-bucket key slightly changes `getStats` aggregation code.

---

## OPT-04 — Bundle size: photon (~1.6 MiB) ships and initializes for every request; 21 MiB of unused full-size fonts sit next to the imported subsets

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/discord-worker/src/services/image/photon.ts:15` (top-level static import), `apps/discord-worker/src/fonts/` (on-disk: `NotoSansKR-Variable.ttf` 10 MiB, `NotoSansSC-Regular.ttf` 11 MiB, vs imported `NotoSansKR-Subset.ttf` 228 KiB + `NotoSansSC-Subset.ttf` 476 KiB — `src/services/fonts.ts:28-40` imports only the subsets), `wrangler.toml:40` (`[[rules]]` `**/*.ttf` as Data)

**Description.** Of the ~8 MiB bundle, the two WASM blobs dominate (resvg ~2.4 MiB — needed by nearly every command; photon ~1.6 MiB — needed only by `/match_image` and `/extractor`). Since Workers require statically-imported WASM, photon can't be lazy-loaded in-worker, but it **can** be evicted to a small dedicated image-worker reached over a service binding (pattern already established with universalis-proxy), freeing ~1.6 MiB (~20% of the bundle, and the single biggest lever short of resvg itself). Secondary: the full-size source fonts in `src/fonts/` are *not* bundled today (only imported modules pass through `[[rules]]`), but one accidental import of `NotoSansKR-Variable.ttf` instantly blows the 10 MiB limit — move source fonts out of `src/` (e.g. `fonts-src/` or scripts dir) so the glob can't ever capture them. (KR-subset staleness/bloat itself was already covered by the 2026-05-28 audit; not re-reported.)

**Expected improvement.** ~1.6 MiB bundle headroom; guard-rail against an accidental 10 MiB import. **Trade-offs:** an extra worker to deploy/version; one service-binding hop per image command (negligible vs. multi-second image processing).

---

## OPT-05 — Repeated KV reads of the same preference data within one command

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/handlers/commands/budget.ts:57` (`createUserTranslator` → `resolveUserLocale` reads `prefs:v1:{userId}` + legacy `i18n:user:{userId}`, `services/i18n.ts:126-162`) then `:133` / `:368` (`getUserPreferences` reads `prefs:v1:{userId}` again)

**Description.** A single `/budget find` performs 2-3 KV `get`s against the same two keys before doing any work; the same double-read pattern exists in every handler that pairs `createUserTranslator` with `getUserPreferences`. KV reads are cheap but add serial latency ahead of the 3-second interaction deadline.

**Expected improvement.** Read `UserPreferences` once per interaction (in `handleCommand` or a tiny request-context object) and derive both the locale and the world from it; ~1-2 fewer serial KV round-trips per command. **Trade-off:** small plumbing change through handler signatures.

---

## REF-01 — `preset-api.ts` and `discord-api.ts` are near-duplicates across discord-worker and moderation-worker

- **Kind:** REFACTOR
- **Severity:** MEDIUM (priority)
- **Location:** `apps/discord-worker/src/services/preset-api.ts` (661 lines) vs `apps/moderation-worker/src/services/preset-api.ts` (513 lines) — identical `generateRequestSignature` (discord `:46-69` vs moderation `:65-89`) and identical `request()` core (discord `:89-187` vs moderation `:98-160+`); `apps/discord-worker/src/utils/discord-api.ts` (309 lines) vs `apps/moderation-worker/src/utils/discord-api.ts` (186 lines) — same `sendMessage`/`editMessage` bodies with the same 5 s timeouts.

**Description.** The HMAC request-signing implementation and the service-binding-with-URL-fallback request core exist twice, character-for-character in places. Divergence has already happened at the edges (moderator-ID parsing — BUG-12; moderation's `isModerator` validates snowflakes, discord's doesn't; moderation logs signature generation, discord doesn't). The signature scheme is security-critical: two copies means a future change to the signed message format must be coordinated in three places (both bots + presets-api verifier) with no compiler help. `verify.ts` already proved the pattern — it's a one-line re-export from `@xivdyetools/auth` (`apps/discord-worker/src/utils/verify.ts:9-17`).

**Benefits.** One signing implementation; shared fetch timeouts and `.ok` handling (fixes BUG-06's root enabler in one place); moderator parsing unified (BUG-12).
**Effort.** Medium — extract `request()`/`generateRequestSignature`/`sendMessage`/`editMessage`/`editOriginalResponse` into a package (e.g. `@xivdyetools/discord-client` or a `bot-logic` submodule); both workers keep thin typed wrappers for their endpoint sets. Existing co-located tests move with the code.
**Risk.** Low — pure code motion; behavior pinned by existing tests; publish + two dependency bumps.

---

## REF-02 — Moderation-notification embed builder exists in three copies

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/index.ts:186-260` (webhook path — sanitized, field-based embed), `apps/discord-worker/src/handlers/commands/preset.ts:951-1006` (submit path — unsanitized, description-based embed), `:1011-1076` (edit path)

**Description.** Three hand-rolled builders produce the "pending preset" moderation embed + approve/reject button row with different layouts and inconsistent sanitization (BUG-11). Any fix to BUG-01 (who posts, which buttons) must be applied three times.

**Benefits.** Single place to fix BUG-01/BUG-11; consistent moderator UX. **Effort.** Small — one `buildModerationEmbed(preset, opts)` in a shared module. **Risk.** Minimal.

---

## REF-03 — `handleAutocomplete` in discord-worker is a 130-line per-command if/else monolith

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/index.ts:597-725` (+ helper functions to `:896`)

**Description.** Collection, preset, preferences, and dye autocomplete logic (including three preset-specific KV/service-binding helpers) live in `index.ts`, while `/budget` already demonstrates the right shape — `handleBudgetAutocomplete` co-located with its command (`budget.ts:402-443`, delegated at `index.ts:701-703`). The deep nested-option walking (`index.ts:616-647`) is also duplicated in shallower form in moderation-worker (`index.ts:297-313`).

**Benefits.** Each command owns its autocomplete; `index.ts` shrinks toward pure routing; the option-tree walker becomes one tested utility. Natural place to add the missing autocomplete rate limit (OPT-02). **Effort.** Small-medium, mechanical. **Risk.** Low — autocomplete responses are fail-soft (empty choices).

---

## REF-04 — Bot HMAC signature covers only `timestamp:userId:userName`; moderation-worker docs claim method/path/body are signed

- **Kind:** REFACTOR
- **Severity:** LOW (security hardening + doc drift)
- **Location:** `apps/discord-worker/src/services/preset-api.ts:52` and `apps/moderation-worker/src/services/preset-api.ts:73` (`const message = \`${timestamp}:${userDiscordId || ''}:${userName || ''}\`;`) — vs `apps/moderation-worker/CLAUDE.md` ("HMACs `timestamp:method:path:body`")

**Description.** The signed message binds only the timestamp and user identity. Within the 5-minute replay window, the same signature authorizes *any* method/path/body — e.g. a captured "approve preset X" request is byte-reusable as "reject preset Y" by whoever can reach presets-api with the headers. The service-binding topology makes external interception unrealistic (this is why it's LOW, not a vulnerability report), but the URL-fallback path (`PRESETS_API_URL`, used in dev/misconfig) travels the public internet, and the moderation CLAUDE.md already documents the stronger scheme as if it existed.

**Benefits.** Defense-in-depth on the fallback path; docs and code re-converge. **Effort.** Small once REF-01 lands (one signer + the verifier in presets-api, versioned header for rollout). **Risk.** Coordinated deploy needed (sign v2, verify v1-or-v2, then drop v1).

---

## REF-05 — `preset.ts` at 1328 lines mixes six subcommands, a favorites group, and three notification builders

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/discord-worker/src/handlers/commands/preset.ts` (whole file; routing at `:92-129`)

**Description.** Largest file in the three apps. It contains list/show/random/submit/vote/edit handlers, the favorite add/remove/list group, and the channel-notification builders (REF-02), each with its own defer/process pair. Every finding above that touches presets (BUG-01, BUG-06, BUG-11, REF-02) lands in this file — a strong signal it's carrying too many concerns.

**Benefits.** Reviewable diffs, per-module tests, notification logic extractable per REF-02. **Effort.** Medium (mechanical split into `preset/` directory: `submit.ts`, `vote.ts`, `favorites.ts`, `notifications.ts`, `index.ts` router). **Risk.** Low — no behavior change; existing `preset.test.ts` pins routing.

---

## Notes (verified non-issues in the churn set)

- `utils/error-response.ts` no longer exists — removed in the DEAD-113..120 cleanup (`git 106e94f`); nothing to analyze.
- `services/emoji.ts` is correct as-is: the mapping is keyed by legacy per-dye itemIDs and all callers pass `dye.itemID` (not `getMarketItemID`), so Patch 7.5 consolidation does not affect emoji lookups; Facewear negative IDs simply return `undefined`.
- `utils/response.ts` builders are sound; `ephemeralResponse`'s dual string/data signature ORs flags correctly (`:107-110`).
- Discord Ed25519 verification (`@xivdyetools/auth/discord.ts:58-115`) is solid: Content-Length pre-check, header presence, post-read size check, `verifyKey` in try/catch. (Pedantic note: the post-read check compares UTF-16 `body.length` against a byte limit — multibyte payloads can exceed 100 KB of bytes while passing; Content-Length catches honest clients, and 100 KB is ample margin. Not actionable.)
- `bot-logic/localization.ts` correctly uses a per-locale instance cache — the classic CF-Workers shared-mutable-locale race was already engineered out; module-level `worldsCache`/`dataCentersCache` in `universalis-client.ts:81-82` are safe isolate-level caches of effectively-immutable data.
- Module-level rate-limiter singletons (`discord-worker/src/services/rate-limiter.ts:56-91`, `moderation-worker/src/middleware/rate-limit.ts:83-96`) capture the first request's env bindings. Env bindings are stable per-isolate in practice; flagging only as a convention to avoid extending to I/O-bearing objects.
