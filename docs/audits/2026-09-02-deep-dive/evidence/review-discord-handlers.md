# Review — `discord-handlers` (deep-dive 2026-09-02)

Deploy unit: `discord-worker` (CF Worker; `deploy:production` on merge to main; `register-commands` runs
in CI when schemas change). Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02`.

## 1. Map

| Module | Route / command | Response shape | Notes |
|---|---|---|---|
| `commands/schemas.ts` | 17 registered commands, 84 option/subcommand names | — | single source of truth; `PUT` verbatim by `scripts/register-commands.ts` |
| `commands/registry.ts` | 17 `{name, category}` entries | — | roster of record; `/about` + register-script parity gate |
| `commands/localize.ts` | `localizeCommands` / `countLocalizations` | — | build-time only; command `description_localizations` + 5 choice lists |
| `handlers/commands/about.ts` | `/about` | type 4, public | registry-driven roster, SE attribution |
| `handlers/commands/accessibility.ts` | `/accessibility`, `/a11y` | defer → PNG | `dye`,`dye2`,`vision` |
| `handlers/commands/budget.ts` | `/budget find\|set_world\|quick` + autocomplete | defer → PNG / ephemeral | Universalis + consolidated pricing |
| `handlers/commands/changelog.ts` | `/changelog [version]` | type 4, ephemeral | bundled `CHANGELOG-laymans.md` |
| `handlers/commands/comparison.ts` | `/comparison dye1..dye4` | defer → PNG | |
| `handlers/commands/contrast.ts` | `/contrast dye1..dye4` | defer → PNG | |
| `handlers/commands/dye.ts` | `/dye search\|info\|list\|random` | type 4 / defer → PNG | copy buttons on `info` |
| `handlers/commands/extractor.ts` | `/extractor color\|image` | defer → PNG | image-worker binding |
| `handlers/commands/gradient.ts` | `/gradient` | defer → PNG | **no test file** |
| `handlers/commands/harmony.ts` | `/harmony` | defer → PNG | |
| `handlers/commands/manual.ts` | `/manual [topic]` | type 4, ephemeral | 🪙 topic hits Universalis |
| `handlers/commands/mixer-v4.ts` | `/mixer` | defer → PNG | **no test file** |
| `handlers/commands/preferences.ts` | `/preferences show\|set\|reset\|filters *` | type 4, ephemeral | KV `prefs:v1:<userId>` |
| `handlers/commands/preset.ts` | `/preset list\|show\|random\|submit\|vote\|edit\|favorite *` | defer | presets-api binding |
| `handlers/commands/preset-notifications.ts` | shared moderation embed builder | `sendMessage` | **no test file** |
| `handlers/commands/stats.ts` | `/stats summary\|overview\|commands\|preferences\|health` | type 4 | admin gate = `STATS_AUTHORIZED_USERS` |
| `handlers/commands/swatch.ts` | `/swatch file:` | defer → PNG | `.chara` download, host allowlist |
| `handlers/buttons/index.ts` | `copy_hex_*`, `copy_rgb_*`, `copy_hsv_*`, `previewimg_*` | type 4 / type 6 | prefix router |
| `handlers/buttons/copy.ts` | copy buttons | type 4 ephemeral | builder + 3 handlers |
| `handlers/buttons/preview-image.ts` | `previewimg_approve_/reject_<uuid>` | DEFERRED_UPDATE + `waitUntil` | moderator-gated |

## 2. Candidates

---
### discord-handlers-01 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/gradient.ts:158`

**Claim:** every per-step dye emoji on `/gradient` is silently dropped — `step.dyeId` is a legacy **itemID**
but `getDyeEmoji` is keyed by **stainID**.

**Failing input → wrong outcome:** `/gradient start_color:#FF0000 end_color:#0000FF` → bot-logic sets
`dyeId: closestDye?.id` (`packages/bot-logic/src/commands/gradient.ts:296`), and `Dye.id` is documented as
"always equal to `itemID` … an FFXIV item ID such as 5729" (`packages/types/src/dye/dye.ts:50-57`).
`emoji-mapping.json` holds keys **1–125 only** (verified: `min 1 max 125` for both application slots), so
`byStainId["5729"]` is always `undefined`. Result: the step list renders with no swatch emoji, while the
Start/End lines 15 lines below *do* show one because they pass `.stainID`.

```ts
const emoji = step.dyeId ? getDyeEmoji(step.dyeId, env.DISCORD_CLIENT_ID) : undefined;   // itemID → miss
...
const startEmoji = startColor.id ? getDyeEmoji(startColor.stainID ?? 0, …) : undefined;  // stainID → hit
```

**Why tests miss it:** `gradient.ts` has **no test file**; the only reference is a mocked dispatch entry in
`index.test.ts:2358`. Covered by test: **no**.

**Fix:** have bot-logic's `GradientStep` carry `stainId` (or resolve the dye in the handler) and pass that.

---
### discord-handlers-02 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/harmony.ts:168`

**Claim:** the base-colour emoji on `/harmony` never resolves — same itemID-for-stainID mix-up, on the one
line of the embed that is inconsistent with the rest.

**Failing input → wrong outcome:** `/harmony color:Snow White` → `resolveColorInput` returns
`id: dye.id` (`packages/bot-logic/src/input-resolution.ts:208`) = itemID `5729`; `getDyeEmoji(5729, …)`
misses. Line 161 in the *same function* uses `dye.stainID ?? 0` for the companion rows, so the embed shows
"Base color: **Snow White**" with no chip while every numbered row below it has one.

```ts
const emoji = getDyeEmoji(dye.stainID ?? 0, env.DISCORD_CLIENT_ID);          // 161 — correct
const baseEmoji = baseId ? getDyeEmoji(baseId, env.DISCORD_CLIENT_ID) : undefined;  // 168 — baseId = itemID
```

**Why tests miss it:** see discord-handlers-13. Covered by test: **no** (the mock hides it).

**Fix:** pass `resolved.stainID` (already on `ResolvedColor`) as `baseId`, or rename the parameter to
`baseStainId` so the type stops reading as interchangeable.

---
### discord-handlers-03 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/manual.ts:258` (entered at `:331`)

**Claim:** `/manual topic:🪙` does two **uncached** Universalis round-trips (10 s timeout each) *before*
replying, on a path that never defers — a 3-second-ack violation waiting for a slow upstream.

**Failing input → wrong outcome:** a user with `prefs.world` set runs `/manual topic:spectrum_prices`.
`handleManualCommand` returns `Response.json({type: 4, …})` at line 338, so Discord's 3 s ack window is the
whole budget; `resolveLodestoneRegion` awaits `Promise.all([fetchWorlds(env), fetchDataCenters(env)])`,
each a `request()` with `REQUEST_TIMEOUT = 10000` and **no retry, no cache**
(`services/budget/universalis-client.ts:295-310`). The module-level 1-hour caches exist —
`getCachedWorlds` / `getCachedDataCenters` (`:319-338`) — but are private, and every other caller
(`validateWorld`, `getWorldAutocomplete:389`) uses them. Slow proxy → "The application did not respond".

```ts
const [worlds, dcs] = await Promise.all([fetchWorlds(env), fetchDataCenters(env)]);  // uncached, 10 s cap
```

**Why tests miss it:** `manual.test.ts:127-128` mocks both fetchers with instantly-resolving values;
nothing asserts which variant is called or bounds the wall clock. Covered by test: **no**.

**Fix:** export the cached wrappers and call those (also removes 2 service-binding calls per invocation);
or defer `/manual` when `topic === 'spectrum_prices'`.

---
### discord-handlers-04 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/stats.ts:375-376`

**Claim:** `/stats preferences` treats one `KV.list()` page as the entire namespace — the "Users with
Preferences" figure saturates at 1000 and silently under-reports for ever after.

**Failing input → wrong outcome:** with 4,200 users holding preferences, `env.KV.list({prefix:'prefs:v1:'})`
returns the first 1000 keys plus `list_complete: false` and a `cursor`. Neither is read, so the embed says
"from 1,000 total users" and "**Users with Preferences:** 1,000" — a wrong operational metric that looks
like a plateau in adoption.

```ts
const prefsList = await env.KV.list({ prefix: 'prefs:v1:' });
const totalPrefsUsers = prefsList.keys.length;      // ≤ 1000, forever
```

**Why tests miss it:** every list mock in `stats.test.ts` (lines 41, 682, 705, 733) hardcodes
`list_complete: true, cursor: ''` with ≤ 3 keys. Covered by test: **no**.

**Fix:** loop on `cursor` until `list_complete` for the count (keys only, cheap), or state "1000+" honestly.

---
### discord-handlers-05 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/stats.ts:390-407`

**Claim:** the same subcommand issues up to **100 sequential `KV.get()`** calls on a non-deferred
interaction — 3-second ack against 100 serialized round-trips.

**Failing input → wrong outcome:** `/stats preferences` with ≥ 100 stored users. The `for` loop awaits each
`KV.get` in turn; at a realistic 20–50 ms per uncached KV read that is 2–5 s **after** the `list`, and the
handler answers with `messageResponse` (type 4), never `deferredResponse`. The admin sees "The application
did not respond" and the work is thrown away.

```ts
for (let i = 0; i < sampleSize; i++) {          // sampleSize = min(100, keys.length)
  const prefsJson = await env.KV.get(key.name); // serialized
```

**Why tests miss it:** the mocks resolve synchronously and the largest fixture is 3 keys; no test asserts a
deferred response or bounds the call count. Covered by test: **no**.

**Fix:** defer first (`deferredResponse(true)` + `waitUntil`), and/or fan the reads out with
`Promise.all` over a smaller sample.

---
### discord-handlers-06 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/stats.ts:40`

**Claim:** the bot reports version **4.0.0** on a public command while the deployed worker is **5.1.1**.

**Failing input → wrong outcome:** `/stats summary` (no admin gate) footers "… v4.0.0" (line 202) and
`/stats health` prints "**Version:** 4.0.0" (line 531), whereas `/about` reads
`packageJson.version` (`about.ts:100`) and prints 5.1.1 — the same bot contradicts itself in two commands.
`apps/discord-worker/package.json:3` is `"version": "5.1.1"`.

```ts
/** Bot version */
const BOT_VERSION = '4.0.0';
```

**Why tests miss it:** the tests *pin the wrong value* — `stats.test.ts:400`
`expect(...).toContain('Version 4.0.0')` and `:886` `expect(configField!.value).toContain('4.0.0')`.
Bumping the package version can never turn them red. Covered by test: **no** (see discord-handlers-14).

**Fix:** import `packageJson.version` as `about.ts` does; assert against the imported value in the test.

---
### discord-handlers-07 — BUG — MEDIUM — `apps/discord-worker/src/handlers/commands/preferences.ts:305-343`

**Claim:** a multi-option `/preferences set` performs N sequential KV **read-modify-write** cycles on one
key, so all but the last write can be lost — while the embed reports every one as saved.

**Failing input → wrong outcome:** `/preferences set language:ja matching:oklab theme:light` (the exact
usage the handler's own docstring advertises at line 283). Each iteration calls
`setPreference(env.KV, userId, key, value)`, which does `getUserPreferences` → mutate → `kv.put`
(`services/preferences.ts:186` and `:243`) on `prefs:v1:<userId>`. Workers KV is eventually consistent: a
`get` issued right after a `put` on the same key is not guaranteed to observe it, so iteration 2 can read
the pre-`language` object, add `matching`, and write it back — dropping `language`. The reply still says
"✅ 3 preferences updated". Intermittent, silent, and exactly the read-modify-write class fixed for
favorites/collections in a previous audit.

```ts
for (const opt of options) {
  ...
  const result = await setPreference(env.KV, userId, key, value, logger);  // get + put, per option
  updates.push({ key, value, success: result.success, reason: result.reason });
}
```

**Why tests miss it:** `preferences.test.ts:32` mocks `setPreference` as
`vi.fn(() => Promise.resolve({success:true}))`, so no KV round-trip and no shared document exist in the
test at all. Covered by test: **no**.

**Fix:** add a `setPreferences(kv, userId, Partial<UserPreferences>)` that reads once, applies every
validated option, and writes once (also cuts 2N round-trips to 2).

---
### discord-handlers-08 — BUG — MEDIUM — `apps/discord-worker/src/handlers/buttons/preview-image.ts:211-214`

**Claim:** the failure path's follow-up neither checks `.ok` nor is protected — a moderator whose action
failed can get no feedback at all, and the `waitUntil` promise rejects unhandled.

**Failing input → wrong outcome:** a moderator clicks Approve, `presetApi.setPreviewImageStatus` throws, the
`catch` calls `sendFollowUp(...)`. `sendFollowUp` returns the raw `Response` and carries
`AbortSignal.timeout(DISCORD_WEBHOOK_TIMEOUT)` (`utils/discord-api.ts:71-97`) — a 4xx/5xx is discarded
(no `.ok` read), and a timeout/network error **throws out of the `catch` block itself**, since nothing wraps
it. The interaction was answered with `DEFERRED_UPDATE_MESSAGE`, so the original message is untouched: the
moderator sees the buttons still live and no error. `utils/discord-api.ts:254` documents this exact hazard
("…reject the waitUntil promise unhandled. Use this for BOTH success and error-path edits").

```ts
} catch (error) {
  logger?.error('Preview-image moderation action failed', …);
  await sendFollowUp(env.DISCORD_CLIENT_ID, interaction.token, {   // no .ok, no try
    content: adminT.t('previewImage.actionFailed'), ephemeral: true,
  });
}
```

**Why tests miss it:** `preview-image.test.ts:262` mocks `sendFollowUp` to always resolve
`new Response(null, {status: 200})`; the rejected and non-ok branches are never exercised.
Covered by test: **no**.

**Fix:** add a `safeSendFollowUp` mirroring `safeEditOriginalResponse` (log `.ok`, swallow throws) and use it
here — the success path at `:178` already checks `res.ok`.

---
### discord-handlers-09 — BUG — LOW — `apps/discord-worker/src/handlers/commands/changelog.ts:92`

**Claim:** `/changelog version:<old>` labels *newer* releases as "Earlier releases".

**Failing input → wrong outcome:** with entries `[5.1.1, 5.1.0, 5.0.0, 4.9.0, …]`, `/changelog version:4.9.0`
expands 4.9.0 and then builds `rest = entries.filter(e => e !== expanded).slice(0, 5)` — the five *newest*
entries — under the field name `t.t('changelog.earlier')`. The user asked for an old release and is shown
newer ones described as earlier.

```ts
const rest = entries.filter((e) => e !== expanded).slice(0, COLLAPSED_COUNT);
```

**Why tests miss it:** `changelog.test.ts:128-136` only covers the default (newest-expanded) path, where the
list happens to be correct; the `version:` + earlier-field combination is untested. Covered by test: **no**.

**Fix:** slice from the entries *after* `expanded`'s index (`entries.slice(idx+1, idx+1+COLLAPSED_COUNT)`).

---
### discord-handlers-10 — BUG — LOW — `apps/discord-worker/src/handlers/commands/preset.ts:812-826`

**Claim:** `/preset edit` positional dye replacement collapses gaps — naming a slot beyond the preset's
current length writes to a *different* slot than the user named.

**Failing input → wrong outcome:** a 3-dye preset, `/preset edit preset:<x> dye5:Jet Black`. `i = 4`,
`newDyeIds.length = 3`, so the `else` branch **pushes** and the dye lands at index 3 (slot 4). Supplying
`dye5` and `dye6` on the same preset lands them at slots 4 and 5. The command reports success with the
wrong palette order, and the 3–6 count check at `:843` passes either way.

```ts
if (i < newDyeIds.length) { newDyeIds[i] = stainId; }
else { newDyeIds.push(stainId); }          // dye5 on a 3-dye preset → slot 4
```

**Why tests miss it:** `preset.test.ts` exercises replacement of existing positions only; there is no case
with a slot index beyond `existingPreset.dyes.length`. Covered by test: **no**.

**Fix:** reject a slot index > `existingPreset.dyes.length` with an explicit message, or require contiguity.

---
### discord-handlers-11 — BUG — LOW — `apps/discord-worker/src/handlers/commands/stats.ts:229-230`

**Claim:** "Avg Cmds/User" divides an **all-time** total by **today's** unique users.

**Failing input → wrong outcome:** `stats.totalCommands` is the lifetime counter while `uniqueUsersToday` is
a daily one, so `/stats overview` shows a number that grows without bound (e.g. 250,000 / 40 = "6250.0 avg
commands per user"). Admin-only, but it is a decision-support panel.

```ts
const avgCommandsPerUser =
  stats.uniqueUsersToday > 0 ? (stats.totalCommands / stats.uniqueUsersToday).toFixed(1) : '0';
```

**Why tests miss it:** the tests assert the field renders, never that the arithmetic is meaningful.
Covered by test: **no**.

**Fix:** divide today's command count by today's uniques, or relabel the field.

---
### discord-handlers-12 — BUG — LOW — `apps/discord-worker/src/handlers/commands/contrast.ts:36-40` (and `accessibility.ts:41-45`)

**Claim:** `/contrast` and `/accessibility` take their dyes in Discord's option order (which follows the
order the *user typed* them), not in `dye1…dye4` schema order — unlike `/comparison`, which reads each
option by name.

**Failing input → wrong outcome:** `/contrast dye3:Ink Blue dye1:Pure White` yields "Ink Blue" as the first
dye and drives the pair layout / the 13A-C frame choice from that order, while the identical option order on
`/comparison` (`comparison.ts:35-38`) yields "Pure White" first. Cosmetic but inconsistent between two
sibling commands.

```ts
for (const opt of options) {
  if (opt.name.startsWith('dye') && opt.value) dyeInputs.push(opt.value as string);
}
```

**Why tests miss it:** the fixtures always supply options in `dye1..dyeN` order. Covered by test: **no**.

**Fix:** read `dye1`…`dye4` by name (as `/comparison` does) and compact the gaps.

---
### discord-handlers-13 — UNTESTED — `apps/discord-worker/src/handlers/commands/harmony.test.ts:57`

**Behaviour that should have been caught:** that the value passed to `getDyeEmoji` is a **stainID**
(discord-handlers-02). The mock returns a constant for *any* truthy number:

```ts
getDyeEmoji: (id: number) => (id ? '🎨' : undefined),
```

So `getDyeEmoji(5729)` yields `'🎨'` in the suite and `undefined` in production. Every assertion about the
base-colour line passes regardless of which id shape the handler hands over.

**Fix:** make the mock model the real keyspace — `(id) => (id >= 1 && id <= 125 ? '🎨' : undefined)` — and
assert the base line carries an emoji.

---
### discord-handlers-14 — UNTESTED — `apps/discord-worker/src/handlers/commands/stats.test.ts:400` and `:886`

**Behaviour that should have been caught:** that `/stats` reports the *deployed* version
(discord-handlers-06). The tests assert the stale literal instead:

```ts
expect(data.data!.embeds![0].footer!.text).toContain('Version 4.0.0');
...
expect(configField!.value).toContain('4.0.0');
```

Both are pinned to a constant the source also hardcodes, so they can only fail if someone fixes the bug.

**Fix:** assert against `packageJson.version` imported in the test.

---
### discord-handlers-15 — UNTESTED — `apps/discord-worker/src/handlers/commands/{gradient,mixer-v4}.ts`, `preset-notifications.ts`

**Behaviour that should have been caught:** everything in these three modules. They are the only non-test
sources under `handlers/` with no sibling `*.test.ts`; the sole references are mocked dispatch entries
(`index.test.ts:33,35,2358,2360`) that assert the router calls a `vi.fn()`. `/gradient` alone carries the
option parsing, the `|| 6` step default, the ΔE-quality mapping, the emoji lines (discord-handlers-01) and
the whole background render path.

**Fix:** add handler-level suites mirroring `comparison.test.ts`; a `gradient.test.ts` that asserts a step
line contains an emoji is the single test that would have caught discord-handlers-01.

---
### discord-handlers-16 — UNTESTED — `apps/discord-worker/src/handlers/commands/index.test.ts:31-60`

**Behaviour that should have been caught:** nothing that TypeScript does not already enforce. The file is
20+ pairs of `expect(commands.handleX).toBeDefined()` / `expect(typeof commands.handleX).toBe('function')`
over a barrel of re-exports — the canonical shape that cannot fail for any change the compiler admits.

**Fix:** replace with one assertion that the barrel's export names cover every `COMMAND_REGISTRY` entry that
has a handler — that is the drift this file was presumably meant to catch.

---
### discord-handlers-17 — REFACTOR — MEDIUM — `apps/discord-worker/src/handlers/commands/preferences.ts:680` and `:744`

**Claim:** the filters subcommands bypass the preferences service and hand-write its KV key, so the key
format now lives in two places and the handler owns a read-modify-write the service was built to own.

```ts
const key = `prefs:v1:${userId}`;
await env.KV.put(key, JSON.stringify(prefs));
```

`services/preferences.ts` keeps `PREFS_KEY_PREFIX` (`:56`) and `buildPrefsKey` (`:98`) **module-private**;
a `prefs:v2:` migration would update the service and leave these two handler lines writing v1. The same
lines also widen the lost-update window of discord-handlers-07 (a concurrent `/preferences set` and
`/preferences filters set` clobber each other).

**Fix:** export `setDyeFilters` / `clearDyeFilters` from the service and delete both raw KV calls.

---
### discord-handlers-18 — REFACTOR — LOW — every `safeEditOriginalResponse(...)` call site in `handlers/commands/*`

**Claim:** all ~30 call sites pass three arguments and omit the optional `logger`, so a rejected Discord
follow-up (`utils/discord-api.ts:267-273`) reports through `console.error` rather than the structured
`ExtendedLogger` with its request id and redaction — the one signal that tells "the card rendered but
Discord refused the edit" apart from "the render failed".

**Fix:** pass the `logger` the handlers already hold (contrast/accessibility/harmony/gradient/mixer/swatch/
budget/preset all receive one).

---

## 3. POSITIVE — do not re-file

- `safeEditOriginalResponse` checks `.ok`, logs the body, and swallows throws (`utils/discord-api.ts:259-285`);
  every background processor in every command handler uses it on both success and error paths.
- `getLocalizedDyeName(dye.itemID, …)` is correct everywhere it appears: the locale files are keyed by legacy
  item id (`packages/core/src/data/locales/ja.json` → `"dyeNames": {"5729": "スノウホワイト"}`).
- `/preset` is fully stainID-native — `sendPresetEmbed` resolves via `dyeService.getByStainId`
  (`preset.ts:971`) and both submit and edit send `dye.stainID`, never `dye.id`. The "deferred to 5.1"
  stainID fix has landed; a stainID-only preset renders.
- `commands/localize.ts` degrades correctly: `buildLocalizations` drops a locale when the Translator returns
  the raw key or the string exceeds Discord's 100 chars. Every key it uses actually resolves in all five
  non-English locales (harmony types, vision lenses, preference keys, theme, gender, dye categories —
  verified against `packages/bot-logic/src/i18n/locales/*.json`), and no command description exceeds 100.
- Schema ↔ handler parity is clean: all 84 registered option/subcommand names are read by a handler, and no
  handler reads an option the schema does not define. `registry.test.ts` and `schemas.test.ts` gate the
  roster, the `PresetCategory` choice list (no `community`), the `/budget quick` ≤ 25 choices, and the
  `world` `max_length: 32`.
- Autocomplete is capped at 25 on both paths (`getDyeAutocomplete(query, 25, …)`,
  `getWorldAutocomplete` `.slice(0, 25)`), and both handle a typed non-choice value.
- FINDING-019/020/033 hardening is intact: every echoed user string goes through `sanitizeEmbedText` /
  `sanitizePresetName`, preset ids are UUID-checked before becoming a path segment
  (`preview-image.ts:129`, `lookupPreset`), and `/swatch` enforces an https Discord-CDN allowlist with
  `redirect: 'manual'`, a 10 s abort and a streamed byte cap that does not trust the declared length.
- `cutOnLineBoundary` budgets its own tail, so `/changelog` can never exceed the 4096 description limit
  (`utils/text.ts:19-27`), and the largest `/dye list` category is 27 rows — nowhere near it.

## 4. REJECTED

- *`/budget find` passes an itemID while `/budget quick` passes a stainID into the same `processFindCommand`.*
  `resolveTargetDye` accepts both ranges (`budget-calculator.ts:311-315`, `id <= 254` → stainID); no dye has
  an itemID ≤ 254. Deliberate.
- *`budget.ts:365` `groups[0].rows[0]` could be undefined.* A group is only created when its first row is
  accepted (`budget-calculator.ts:250-265`), so a materialised group always has ≥ 1 row.
- *`extractor.ts:449` `Number(colorsOption.value)` could be NaN.* The `colors` option is `OptionType.INTEGER`
  with `min_value: 3 / max_value: 10` (`schemas.ts:305-310`); Discord enforces it client- and server-side.
- *`gradient.ts:38` `|| 6` swallows `steps:0`.* `min_value: 2` on the schema (`:361`).
- *`manual.ts:327` `topic in TOPIC_KEYS` also matches `Object.prototype` keys* (`'constructor'` → an embed
  built from `manual5.topics.undefined.*`). The `topic` option is a fixed `choices` list and interactions are
  Ed25519-verified, so only Discord can produce the payload. Latent only.
- *`extractor.ts:61` module-scope `new PaletteService()` shared across requests.* `PaletteService` holds only
  a logger (`packages/core/src/services/PaletteService.ts:304-321`) — no per-call state.
- *`initializeLocale(locale)` awaited before deferring in `mixer-v4.ts:72` / `dye.ts:61`.* It memoises a
  bundled JSON per locale (`packages/bot-logic/src/localization.ts:61-68`); no network, no measurable cost.
- *`copy.ts:70,104` `parts.map(Number)` can yield NaN.* Only `createCopyButtons` mints these ids and the
  length guard catches malformed ones; the worst case is a cosmetic `rgb(NaN, …)` in an ephemeral reply.
- *Pagination buttons with an out-of-range page index.* This bot registers no pagination components; the
  only buttons are the three `copy_*` and the two `previewimg_*`, all ≤ 55 chars with no delimiter ambiguity.
- *`PRODUCT_LINKS.inviteBot` hardcodes the production `client_id`, so the beta bot advertises the production
  invite.* Real, but the constant lives in `packages/core/src/config/product-links.ts:47-50` — **owned by the
  core reviewer**.
- *`getDyeEmoji` returns markup for the wrong application.* Correctly keyed per `DISCORD_CLIENT_ID`
  (`services/emoji.ts:59-61`) — **owned by discord-core**; the handlers pass `env.DISCORD_CLIENT_ID` everywhere.
- *`services/budget/universalis-client.ts` `request()` has no retry and a module-level cache.* Behaviour is
  correct for its callers — **owned by discord-core**; only manual.ts's choice of entry point is filed here.
- *`services/preferences.ts` `setPreference` read-modify-write.* The single-key write is the service's
  contract — **owned by discord-core**; the defect filed above is the handler calling it in a loop.

## 5. COVERED — 24 non-test source files read in full

`apps/discord-worker/src/commands/`: `schemas.ts`, `registry.ts`, `localize.ts`
`apps/discord-worker/src/handlers/commands/`: `index.ts`, `about.ts`, `accessibility.ts`, `budget.ts`,
`changelog.ts`, `comparison.ts`, `contrast.ts`, `dye.ts`, `extractor.ts`, `gradient.ts`, `harmony.ts`,
`manual.ts`, `mixer-v4.ts`, `preferences.ts`, `preset.ts`, `preset-notifications.ts`, `stats.ts`, `swatch.ts`
`apps/discord-worker/src/handlers/buttons/`: `index.ts`, `copy.ts`, `preview-image.ts`
`apps/discord-worker/scripts/register-commands.ts`

Tests skimmed: `commands/{schemas,registry,localize}.test.ts`; `handlers/commands/{index,about,changelog,
harmony,manual,preferences,preset,stats,budget,extractor,comparison,contrast,accessibility,swatch,dye}.test.ts`;
`handlers/buttons/{index,copy,preview-image}.test.ts`.

Callee excerpts read to confirm claims (not reviewed, not filed): `utils/{response,discord-api,text}.ts`,
`services/{emoji,i18n,preferences}.ts`, `services/budget/{index,universalis-client,budget-calculator,
quick-picks}.ts`, `packages/bot-logic/src/{input-resolution,localization}.ts`,
`packages/bot-logic/src/commands/{gradient,swatch,contrast}.ts`, `packages/types/src/dye/dye.ts`,
`packages/core/src/{data/dyes.json,data/locales/ja.json,config/product-links.ts,services/PaletteService.ts}`,
`apps/discord-worker/src/{index.ts (autocomplete + dispatch only),data/emoji-mapping.json}`.
