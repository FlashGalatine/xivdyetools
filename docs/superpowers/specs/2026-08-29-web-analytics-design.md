# Web-app analytics — making "Enable Analytics" real

**Date:** 2026-08-29 · **Apps:** `apps/web-app`, `apps/api-worker` · **Status:** approved design,
awaiting implementation plan · **Branch:** `web-analytics` (worktree `.worktrees/xivdyetools-analytics`)

## Problem

The Advanced Options → Behaviour → *Enable Analytics* toggle
(`components/advanced-options-panel.ts`) writes `advanced.analyticsEnabled` to localStorage and
**nothing reads it**. The only "analytics" in the app is `ShareService`'s localStorage ring buffer of
share events (100 max, never leaves the browser, no consumer beyond a dev-console hint in
`main.ts`). Meanwhile `og-worker` and `discord-worker` already write to Cloudflare **Analytics
Engine** (AE), so an established pipeline exists to join.

## Decisions (user, 2026-08-29)

1. **Four questions, no more, for v1:** most popular tool (correcting for Harmony being the
   default tool by also measuring dwell), dye popularity, how many `.chara` files have been
   parsed, and Light vs. Dark theme preference (added 2026-08-29, second round). Everything else
   (feature choices, share funnel, errors, perf) is a later pass.
2. **Dye popularity counts explicit picks only** — a dye the user deliberately chose in a
   picker/grid/drawer. Tool-computed matches (extractor, swatch matcher, mixer results) and
   random-dye picks are excluded.
3. **Storage is Analytics Engine, written by api-worker** via a new `POST /v1/telemetry`.
   Cloudflare Web Analytics (third-party beacon, blocked by `script-src 'self'`, page-view only,
   cannot honour the toggle) and D1 counters (self-owned aggregation/retention) were considered and
   rejected for v1.
4. **Opt-in stays the default** (`analyticsEnabled: false`), and `navigator.globalPrivacyControl`
   is honoured on top of the toggle.
5. **No identifiers of any kind** — no session id, no persistent client id, nothing written to
   storage, no IP/UA copied into a datapoint.

## Non-personal data — what is and is not collected

Collected (v1): tool id, how the tool was entered, visible seconds on it, picked `stainID`, whether a
`.chara` parse succeeded and its declared producer; plus a per-batch envelope of app version,
build environment, locale, theme, viewport bucket.

Never sent: IP addresses (the worker must not copy `cf-connecting-ip` into a blob), raw user-agent,
Discord ids / JWT presence, image or `.chara` file contents, preset text, free-text search input,
world/character names, any id that persists across page loads.

## 1. Events

| Event | Dimensions | Value (`double1`) | Hook point |
|---|---|---|---|
| `tool_view` | `tool` (ToolId), `entry` = `initial` \| `share` \| `nav` | — | end of `loadToolContent()` in `components/v4-layout.ts` (after the tool's `init()` succeeds; a superseded navigation does not fire; re-navigating to the tool already showing is a remount and fires nothing) |
| `tool_leave` | `tool`, `entry` | `active_s` — whole seconds the tab was **visible** on that tool; capped at 1800 | on tool switch (before the next `tool_view`) and on `pagehide` |
| `dye_pick` | `stainID` (1–125 range validated against core's DB), `tool` (current route), `via` = `drawer` \| `grid` | — | **accepted** picks only. The `dye-selected` listener in `v4-layout.ts` tracks a palette-drawer swatch once a tool's `selectDye`/`addDye` took it (`via: 'drawer'`); `DyeSelector.handleDyeSelection` tracks a grid or Favorites-strip pick it kept (`via: 'grid'`, covers the inline pickers of harmony / comparison / gradient / mixer / accessibility) — a click that removes an already-selected dye or is dropped at `maxSelections` is not a pick. Random-dye paths (drawer dice, selector random) are **not** tracked. |
| `chara_parse` | `ok` (`true` \| `false`), `producer` — the parsed `TypeName`, allowlisted (`anamnesis`, `ktisis`, `brio`; anything else → `other`, `null` → `none`) | — | `loadFile()` in `components/chara-import.ts`: `ok:true` after `resolveCharaColors` succeeds, `ok:false` in the catch. The size-cap early return is not a parse and is not tracked. |
| `theme_change` | `to` (`standard-light` \| `standard-dark`) | — | `services/theme-switch.ts` (`switchTheme` / `toggleThemeVariant`) — the one path the theme modal and the Shift+T shortcut use. **Not** hooked into `ThemeService` itself, so boot, legacy-name migration and settings-import do not count as a choice. Tracked before the switch is applied: `TelemetryService.track('theme_change')` flushes the pending batch first, so its envelope carries the outgoing theme. |

Theme preference is read two ways: the envelope's `theme` (below) gives the theme in use on every
batch, and `theme_change` gives deliberate switches. Because the default is a fixed
`standard-dark` (no OS `prefers-color-scheme` check), the envelope share alone over-counts Dark;
the share of batches on `standard-light` is a floor for "chose Light", and `theme_change` shows
how often people leave the default in either direction.

`entry` semantics: `initial` = the tool the app booted into (whatever it was — usually Harmony via
the default route), `share` = the app booted from a share link — `ShareService.isShareUrl()` (the
`v=` marker every generated share URL carries) or a preset deep link (`/presets/<id>`), `nav` = the
user switched to it after boot. A preserved param or in-app hand-off left in the address bar
(`?dye=`, `?dc=`, `?add=`) and a reload of it are `initial`, not `share`. Only the first `tool_view`
per page load can be `initial` or `share`; every later one is `nav` — the entry is resolved at the
top of the first `loadToolContent()`, before any await, so a superseded or failed boot load cannot
leak it onto the next navigation.

Answering the Harmony-default problem: popularity queries filter `entry != 'initial'`, and
`tool_leave.active_s` gives median dwell per tool as the second signal. Caveat: `tool_leave` fires
only on navigation or `pagehide`, and a mobile browser can discard a hidden tab without firing
`pagehide`, so dwell is biased toward desktop sessions.

## 2. Wire format

One batch = one `POST /v1/telemetry`, body is JSON sent as **`text/plain`** (a CORS-safelisted type,
so `sendBeacon` needs no preflight; the server parses the text as JSON regardless of declared type).

```jsonc
{
  "v": 1,
  "ver": "5.0.3",           // APP_VERSION
  "env": "production",      // "production" | "beta" (APP_ENV); beta shares the production worker
  "locale": "en",           // one of the six LocaleCodes
  "theme": "standard-dark", // ThemeName
  "vp": "d",                // "m" (<768px) | "t" (<1024px) | "d"
  "events": [
    { "n": "tool_view",  "p": { "tool": "harmony", "entry": "initial" } },
    { "n": "dye_pick",   "p": { "tool": "harmony", "stainID": 102, "via": "grid" } },
    { "n": "tool_leave", "p": { "tool": "harmony", "entry": "initial" }, "d": 42 }
  ]
}
```

Limits: ≤ 25 events per batch (AE allows 25 `writeDataPoint` calls per invocation), ≤ 16 KB body.
Event order inside a batch is preserved by array order; the server does not use client timestamps —
AE stamps each datapoint at write time (batching skews times by ≤ 15 s, which is fine for these
questions).

## 3. Client — `apps/web-app/src/services/telemetry-service.ts`

Static class in the style of the other services (no DI).

- `TelemetryService.initialize()` (called from `main.ts` after `initializeServices()`): reads
  `advanced.analyticsEnabled` from `ConfigController`, subscribes to `advanced` config changes, and
  attaches `visibilitychange` / `pagehide` listeners. Toggling **off** drops the in-memory queue
  and stops the dwell clock; toggling **on** starts fresh (nothing retroactive).
- `TelemetryService.isEnabled()` = `analyticsEnabled && navigator.globalPrivacyControl !== true`.
  Add `globalPrivacyControl?: boolean` to `shared/browser-api-types.ts`.
- `TelemetryService.track(name, props, value?)`: no-op when disabled; otherwise push to the queue.
  Flush when the queue reaches **20** events, on a **15 s** timer after the first queued event, on
  `visibilitychange → hidden`, and on `pagehide`.
- Transport: `navigator.sendBeacon(url, body)` with a `string` body (→ `text/plain`); fall back to
  `fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })`
  when `sendBeacon` is missing or returns `false`. Failures are logged at `debug` and the batch is
  dropped — telemetry never retries and never blocks.
- Dwell: `startTool(tool, entry)` records the tool and a visible-time accumulator; `endTool()`
  emits `tool_leave` with the accumulated seconds and clears it. The accumulator only advances
  while `document.visibilityState === 'visible'`. `pagehide` calls `endTool()` then flushes.
- Endpoint: `${getApiWorkerBase()}/v1/telemetry`. `getApiWorkerBase()` moves from
  `chara-resolve-service.ts` into a new `services/api-worker-origin.ts` and is re-exported from its
  old location so existing imports and tests keep working.
- Vite dev (`import.meta.env.DEV`) posts to the local worker like chara-resolve does; nothing is
  special-cased for dev beyond the origin.

Hook-point changes:

- `v4-layout.ts`: `loadToolContent()` calls `TelemetryService.endTool()` before destroying the
  previous tool and `TelemetryService.startTool(toolId, entry)` + `track('tool_view', …)` after
  the new tool's `init()`; `entry` is computed once at boot (`share` if `ShareService.isShareUrl()`
  or a `/presets/<id>` sub-path, else `initial`) and `nav` thereafter, and resolved at the top of
  `loadToolContent()` before its first await. A navigation to the tool already mounted is a remount:
  no `endTool`, no `tool_view`, the dwell clock keeps running. The existing `dye-selected` listener
  adds `trackDyePick(dye.stainID, 'drawer')` once a tool's `selectDye`/`addDye` took the pick — and
  only for the swatch-click path: the drawer's random-dye emit must be distinguishable. The drawer
  already has two emit sites (`dye-palette-drawer.ts` swatch click vs. random); the random path adds
  `random: true` to its event detail and the listener skips tracking when it is set.
- `dye-selector.ts`: `handleDyeSelection()` tracks `dye_pick` (`via: 'grid'`) only when it
  accepted the pick — grid click, keyboard, or the Favorites strip — and never for its random
  button. `DyeGrid` itself only emits; its per-card click guard ignores the favorite and
  add-to-collection buttons so the delegated handlers get them.
- `chara-import.ts`: `track('chara_parse', { ok: true, producer })` after `resolveCharaColors`
  resolves; `track('chara_parse', { ok: false, producer: 'none' })` in the catch. Producer mapping
  lives in `telemetry-service.ts` (`normalizeProducer(typeName: string | null)`).
- `v4/theme-modal.ts`: `track('theme_change', { to: theme.name })` next to the user-pick
  `ThemeService.setTheme(theme.name)` call, only when `theme.name` differs from the theme in use.

## 4. Server — `apps/api-worker/src/telemetry/`

- `router.ts` — Hono router mounted at `/v1/telemetry` in `src/index.ts` (after the existing
  `/v1/*` rate-limit and CORS middleware; CORS already allows `POST` with `Content-Type`). Only
  `POST /` exists; everything else falls through to the app's 404.
- `schema.ts` — hand-rolled validation (no new dependency, matching the chara router's style):
  - Body: read as text, cap at 16 KB (413 beyond), `JSON.parse` (400 on failure).
  - Envelope: `v === 1`; `env ∈ {production, beta}`; `locale` ∈ core's `SUPPORTED_LOCALES`;
    `theme ∈ {standard-light, standard-dark}`; `vp ∈ {m, t, d}`; `ver` matches `/^\d+\.\d+\.\d+/`
    and is clamped to 16 chars. An invalid envelope field is replaced by `'invalid'`, never rejects
    the batch.
  - Events: array, first 25 kept, rest dropped. Each event is checked against a table
    `EVENT_SCHEMAS: Record<EventName, { dims: Record<string, Validator>; value?: Validator }>`;
    an event with an unknown `n`, a missing/invalid required dim, or an out-of-range value is
    **silently dropped** (a counter of dropped events is logged at `debug` with the request id).
    `tool` ∈ the nine ToolIds (string list kept in `schema.ts` — api-worker does not depend on
    web-app); `stainID` must return a dye from `DyeDatabase` (core is already a dependency);
    `active_s` is an integer 0–1800; `to` ∈ the two ThemeNames (`theme_change` has no `tool`).
  - Response: `204` when the batch parsed (even if every event was dropped); `400` / `413` only for
    unparseable or oversized bodies. No response body.
- Write: `c.executionCtx.waitUntil(Promise.resolve().then(() => events.forEach(write)))` with the
  fixed column layout below. `env.ANALYTICS` absent → no-op (dev without the binding).
- The endpoint is **not** part of the public API: it is excluded from the VitePress docs and gets a
  one-line "internal, undocumented, may change" note in `apps/api-worker/CLAUDE.md`.

### AE column layout (fixed across event types)

| Column | Content |
|---|---|
| `index1` | event name |
| `blob1` | event name |
| `blob2` | `tool` (or `''`) |
| `blob3` | dim A — `entry` / `via` / `ok` / `to` |
| `blob4` | dim B — `stainID` as string / `producer` / `''` |
| `blob5` | `locale` |
| `blob6` | `theme` |
| `blob7` | `vp` |
| `blob8` | `ver` |
| `blob9` | `env` |
| `double1` | `active_s` for `tool_leave`, `0` otherwise |

### Bindings (`apps/api-worker/wrangler.toml`)

```toml
# top-level (routeless dev worker)
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_web_analytics_dev"

[[env.production.analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_web_analytics"
```

`src/types.ts` gains `ANALYTICS?: AnalyticsEngineDataset`. `tests/wrangler-config.test.ts` gains a
case asserting both blocks exist with those dataset names (production must never point at `_dev`).
Beta web-app traffic reaches the production worker (by design — see `xiv-beta-worker-deploy-gap`),
so beta vs. production is separated by the `env` blob, not by dataset.

## 5. Reading the data — `docs/operations/ANALYTICS_QUERIES.md`

Canned SQL-API queries (`POST https://api.cloudflare.com/client/v4/accounts/<id>/analytics_engine/sql`),
all using `sum(_sample_interval)` rather than `count()` because AE samples under load:

1. Tool popularity, deliberate opens only — `index1='tool_view' AND blob3<>'initial' AND blob9='production'`, grouped by `blob2`, last 30 days.
2. Median dwell per tool — `quantiles(0.5)(double1)` where `index1='tool_leave'`, grouped by `blob2`.
3. Top 20 dyes overall and per tool — `index1='dye_pick'`, grouped by `blob4` (and `blob2`).
4. `.chara` parses per ISO week, split by `blob3` (`ok`) and `blob4` (producer).
5. Theme preference — (a) share of `tool_view` datapoints by `blob6` (theme in use, Light share
   is the floor for "chose Light"), (b) `index1='theme_change'` grouped by `blob3` (`to`) for
   deliberate switches per week.

Also documents: retention (~3 months on AE — a rollup into KV/D1 is explicitly out of scope until
history is wanted), and that dev-worker writes land in `_dev` and are ignorable.

## 6. UI, privacy, cleanup

- Toggle stays where it is, default **off**. `config.analyticsDesc` is rewritten in all six locales
  to say what is sent: EN — *"Share anonymous usage data — which tools and dyes are used, and
  .chara imports. No identifiers, no images."* The `config.enableAnalytics` label is unchanged.
  `tool-config-types.ts`'s "(placeholder for future)" comment is replaced with a pointer to this
  spec.
- `ShareService`: delete the localStorage analytics block (`ANALYTICS_STORAGE_KEY`,
  `MAX_STORED_EVENTS`, `initializeAnalytics`, `storeAnalyticsEvent`, `getStoredAnalyticsEvents`,
  `getAnalyticsStats`, `clearAnalyticsData`), the `analyticsListeners` set, `subscribeToAnalytics`,
  `trackAnalytics` and its three call sites, and the `ShareAnalyticsEvent` type; remove the
  `initializeAnalytics()` call and the `getAnalyticsStats()` dev hint from `main.ts`. Their tests
  go with them. (Share funnel events are a v2 candidate — they would be re-added through
  `TelemetryService`, not this buffer.)
- `apps/web-app/CLAUDE.md` "No PII in analytics" line under Security Patterns is updated to point
  at `telemetry-service.ts`, and the services table gains the new file.
- CSP: no change — `connect-src` already includes `https://*.xivdyetools.app`, and `sendBeacon`
  is governed by `connect-src`.

## 7. Error handling

Telemetry is fire-and-forget on both sides: the client never throws out of `track()`/flush (all
paths wrapped, logged at `debug`), a rejected beacon is dropped, and the worker returns 204 for any
parseable batch so a schema drift between deploys never surfaces as user-visible errors. The worker
never lets a `writeDataPoint` failure escape `waitUntil` (caught and logged, as og-worker does).

## 8. Testing

- **web-app (Vitest):** `telemetry-service.test.ts` — disabled by default sends nothing; enabling
  via `ConfigController` starts tracking; GPC set → nothing even when enabled; batching at 20 and
  at 15 s (fake timers); `visibilitychange` and `pagehide` flush via a stubbed `sendBeacon`;
  `fetch` keepalive fallback when `sendBeacon` returns `false`; dwell accumulates only while
  visible and caps at 1800; toggling off clears the queue; `normalizeProducer` mapping. Hook-point
  assertions added to the existing `v4-layout`, `dye-grid`, `dye-palette-drawer`, `chara-import`
  and `theme-modal` suites (spy on `TelemetryService.track`; random-dye path must not track;
  re-picking the current theme must not track; `ThemeService.initialize()` must not track). The
  i18n parity/order gates cover the six-locale copy change.
- **api-worker (Vitest):** `telemetry/router.test.ts` — 204 with datapoints for a valid batch;
  column layout asserted against a mock `writeDataPoint`; 26th event dropped; unknown event /
  unknown dim / bad `stainID` / `active_s` out of range dropped without failing the batch; invalid
  envelope field → `'invalid'`; 400 for non-JSON, 413 over 16 KB; no binding → 204 and no writes;
  `text/plain` body accepted. `wrangler-config.test.ts` dataset assertion.
- **Playwright:** one spec — toggle off (default) → navigate between two tools → zero requests to
  `/v1/telemetry`; toggle on → navigate → exactly one beacon whose body contains a `tool_leave`
  and a `tool_view` (intercept the route, no live worker).
- Gates unchanged: `pnpm lint && pnpm test && pnpm type-check && pnpm build:check` in web-app,
  `pnpm turbo run lint test type-check --filter=xivdyetools-api-worker`, knip (`telemetry-service.ts`
  has consumers; the removed ShareService symbols cannot leave orphans).

## 9. Out of scope (deliberately)

Feature-choice events, share funnel, error/perf events, any rollup or dashboard, Cloudflare Web
Analytics, a "view my data" UI, and the discord-worker/og-worker datasets (untouched).

## Files touched

**web-app:** `services/telemetry-service.ts` (+test), `services/api-worker-origin.ts`,
`services/chara-resolve-service.ts` (re-export), `services/share-service.ts` (+test cleanup),
`components/v4-layout.ts`, `components/dye-grid.ts`, `components/v4/dye-palette-drawer.ts`,
`components/chara-import.ts`, `components/v4/theme-modal.ts`, `main.ts`, `shared/browser-api-types.ts`,
`shared/tool-config-types.ts`, `locales/{en,ja,de,fr,ko,zh}.json`, `e2e/telemetry.spec.ts`,
`CLAUDE.md`.
**api-worker:** `src/telemetry/{router,schema}.ts` (+tests), `src/index.ts`, `src/types.ts`,
`wrangler.toml`, `tests/wrangler-config.test.ts`, `CLAUDE.md`.
**docs:** this spec, `docs/operations/ANALYTICS_QUERIES.md`.
