# Discord bot analytics — Tier A (schema gap-filling, no option values)

**Date:** 2026-08-29 · **App:** `apps/discord-worker` · **Status:** approved design, awaiting
implementation plan · **Branch:** `bot-analytics` (worktree `.worktrees/xivdyetools-bot-analytics`,
cut from `origin/main` d0f601e8; independent of the `web-analytics` PR #149)

## Problem

The bot already writes one Analytics Engine (AE) datapoint per slash command
(`src/services/analytics.ts` → dataset `xivdyetools_bot_analytics`, `_beta` on the dev worker) plus
KV counters for `/stats`. The datapoint carries command name (only `/extractor` gets its
subcommand), pseudonymous user id, `guild`/`dm`, and a success flag. Three things make it much less
useful than it looks:

1. **`success` is recorded before the work runs.** 11 handlers defer (`deferredResponse()` and then
   `ctx.waitUntil(process…)`); the dispatcher's `finally` in `src/index.ts` tracks immediately, so
   for every heavy command `success` means "the handler returned a deferred ack without throwing".
   Real failures are caught inside the handlers' own `catch` blocks (22 sites) and never reach the
   datapoint.
2. **`errorType` and `latencyMs` exist in `CommandEvent` but are never populated** at the single call
   site.
3. **Subcommands, button clicks and the interaction locale are invisible.** `/dye`, `/preset`,
   `/budget`, `/preferences` are opaque; the `copy_hex/rgb/hsv` buttons are untracked.

## Decisions (user, 2026-08-29)

1. **Tier A only.** Everything recorded stays within what `PRIVACY_POLICY.md` §2 already describes:
   command identity, outcome, context, pseudonymous user id — **no command option values** (no
   harmony type, mixer mode, dye ids, hex, search text, world). Tier B (option choices + resolved
   dye ids) is a separate decision that requires amending the policy first.
2. Subcommand is treated as part of the command's identity (the existing `/extractor`
   `extractor_image` / `extractor_color` precedent), not as an option value.
3. The privacy policy's *Usage Analytics* table is updated in the same change to list the new
   fields; announcing per §11 is the maintainer's call.

## 1. What is recorded

One datapoint per **command run** and one per **button click**. Columns are additive: blobs 1–5
keep their meaning so nothing that reads the existing series breaks.

| Column | Content | Change |
|---|---|---|
| `index1` | command name (or `button`) | unchanged |
| `blob1` | command name (`extractor_image` / `extractor_color` kept as today) | unchanged |
| `blob2` | Discord user id (pseudonymous; unique-user counting — already in the policy) | unchanged |
| `blob3` | `guild` \| `dm` | unchanged |
| `blob4` | `1` \| `0` success | unchanged, **now true** for deferred commands |
| `blob5` | **outcome class** (below); `ok` on success | was `errorType`, never set |
| `blob6` | **subcommand** (`info`, `search`, `list`, `random`, `browse`, `find`, `quick`, `set-world`, `show`, `set`, `reset`, …) or `''`; for buttons the button kind (`copy_hex` \| `copy_rgb` \| `copy_hsv`) | new |
| `blob7` | **locale bucket** — `discordLocaleToLocaleCode(interaction.locale)` → `en\|ja\|de\|fr\|ko\|zh`, else `other` | new |
| `blob8` | **kind** — `command` \| `button` | new |
| `double1` | success `1`/`0` | unchanged |
| `double2` | **latency ms** — dispatcher start → `finishCommandTrace`, so deferred work is included; `0` for buttons | was always `0` |
| `double3` | `1` | unchanged |

**Outcome classes** (`blob5`): `ok`, `rate_limited`, `upstream_universalis`, `upstream_presets`,
`image_input`, `render`, `unknown`. Derived by one `classifyError(error): OutcomeClass` helper:
`UniversalisError` → `upstream_universalis`; `PresetAPIError` → `upstream_presets`; the extractor's
existing message checks (`SSRF`/`Discord CDN`/`too large`/`format`/`timeout`) → `image_input`;
anything thrown from a render/SVG path (`Harmony render error`-style catches) → `render`; else
`unknown`. **Never** the error message.

**Known gap, deliberate:** handler validation early-returns (52 `t('errors.*')` sites) still count
as `ok`. Routing them through a helper is a v2 item.

**Not recorded** (unchanged promises): option values, hex/search text, image metadata, world,
guild/channel ids, message content.

## 2. Command trace — `src/services/command-trace.ts`

The one new mechanism. The dispatcher owns the whole lifecycle: it starts the trace, hands the
handler a **traced `ExecutionContext`** whose `waitUntil` captures every background promise the
handler schedules, and finishes the trace once those promises have settled. Handlers never call
"finish"; they only *mark* a failure class in the catches that end a command with an error embed.

```ts
export type OutcomeClass = 'ok' | 'rate_limited' | 'upstream_universalis' | 'upstream_presets'
  | 'image_input' | 'render' | 'unknown';

export interface CommandTrace {
  command: string;        // tracked name (extractor_image etc.)
  subcommand: string;     // '' when none
  userId: string;
  context: 'guild' | 'dm';
  locale: string;         // bucket
  startedAt: number;      // Date.now()
  outcome: OutcomeClass | null;   // set by markCommandOutcome; null = ok so far
  pending: Promise<unknown>[];    // promises captured from the traced ctx
  finished: boolean;
}

/** Create and remember the trace (WeakMap<DiscordInteraction, CommandTrace>). */
export function startCommandTrace(interaction: DiscordInteraction, fields: { command; subcommand; userId; context; locale }): CommandTrace;
/** An ExecutionContext whose waitUntil records the promise on the trace AND forwards to the real ctx. */
export function tracedExecutionContext(real: ExecutionContext, trace: CommandTrace): ExecutionContext;
/** Handlers: record why the command failed. First mark wins; no-op without a trace. Never throws. */
export function markCommandOutcome(interaction: DiscordInteraction, outcome: OutcomeClass): void;
/** Dispatcher: idempotent. Drains `pending` (allSettled, looping while new promises were added), then writes AE + KV via analytics.ts. A rejected pending promise → classifyError(reason) unless an outcome was already marked. */
export function finishCommandTrace(env: Env, interaction: DiscordInteraction, realCtx: ExecutionContext, logger: ExtendedLogger, outcome?: OutcomeClass): void;
export function classifyError(error: unknown): OutcomeClass;
```

- `finishCommandTrace` is idempotent (second call is a no-op). The drain + write run inside
  `realCtx.waitUntil`, so the response is never delayed.
- AE write + KV counters go through the existing `trackCommandWithKV` (extended to take
  `subcommand`, `locale`, `kind`, `outcome`, `latencyMs`).
- KV counters are **unchanged in shape**: `total`, `cmd:<trackedName>`, `success`/`failure`,
  `usertrack:` — subcommands go to AE only, so `/stats` needs no change. A rate-limited request
  counts as a `failure` in KV and `rate_limited` in AE (it is a command the user ran that did not
  serve).

### Dispatcher (`src/index.ts`)

- `startCommandTrace` right after `userId` is resolved (before the rate-limit check) so
  rate-limited requests are traced; the rate-limit early return calls
  `finishCommandTrace(…, 'rate_limited')`.
- Every handler in the `switch` receives `tracedExecutionContext(ctx, trace)` instead of `ctx`
  (the dispatcher's own `waitUntil`s — first-run notice, tracking — keep using the real `ctx`).
- In the existing `finally`: `finishCommandTrace(env, interaction, ctx, logger, success ? undefined : 'unknown')`.
  For an immediate handler `pending` is empty and the datapoint is written at once; for a deferring
  handler the drain waits for its `process*` promise, so latency and outcome reflect the real work.
  No deferred-response detection is needed.
- Subcommand for the trace: `interaction.data?.options?.[0]?.name` when that option is a
  subcommand (`type === 1`) — the same expression the rate-limit scope already uses; the tracked
  command name keeps the `extractor_<sub>` form so KV and existing queries are stable.
- The button path (`handleComponent` → `handleButtonInteraction`): write a `kind=button` datapoint
  with `blob6 = copy_hex | copy_rgb | copy_hsv` and `blob1 = index1 = 'button'`; unknown
  `custom_id`s and the preview-image moderation buttons are not tracked. No KV counters for
  buttons.

### Handlers — one line per terminal catch

In every `catch` that ends the command with an error embed (`safeEditOriginalResponse(…,
errorEmbed(…))` as the final response — the 22 catch sites across `accessibility, budget,
comparison, contrast, extractor, gradient, harmony, mixer-v4, preset, swatch`), add
`markCommandOutcome(interaction, classifyError(error));` before the edit. Catches that recover
and continue (a fallback path that still produces a normal card) are **not** marked. `dye.ts`
has no catches: an unhandled rejection from its `process*` surfaces through the drain as
`classifyError(reason)`. No success-path edits anywhere.

Handler-level non-exception failures that today render an error embed without throwing
(`result.ok === false` branches such as harmony's `NO_MATCHES`) stay `ok` in v1 — same class of
gap as validation returns.

## 3. Privacy policy

`apps/discord-worker/PRIVACY_POLICY.md` → *Usage Analytics* table, first row becomes:
"Command name **and subcommand**, whether it succeeded **and, if not, a coarse failure class
(e.g. rate-limited, market-data unavailable — never an error message)**, **how long it took**,
whether it ran in a server or a DM, **your Discord client language (one of the six the Bot
supports, or "other")**, **which copy button you pressed**, and your Discord User ID (used only to
count unique users)". "Last Updated" bumped. The "never include" sentence stays and remains true.

## 4. Reading it — `docs/operations/ANALYTICS_QUERIES.md`, new "Discord bot" section

Dataset `xivdyetools_bot_analytics` (`_beta` = dev worker). Queries, all with
`sum(_sample_interval)`:

1. Commands + subcommands, last 30 d — `GROUP BY blob1, blob6`.
2. p50 / p95 latency per command — `quantileExactWeighted(0.5)(double2, _sample_interval)` /
   `(0.95)`, `WHERE blob8 = 'command'`.
3. Failure share by outcome class — `WHERE blob4 = '0' GROUP BY blob1, blob5`.
4. Locale mix — `GROUP BY blob7` (note: this is the Discord client language, not the stored
   preference).
5. Button usage — `WHERE blob8 = 'button' GROUP BY blob6`.
6. Daily unique users — `uniq(blob2)` per day (already possible; documented for completeness).

Note that `double2` for datapoints written before this change is `0` and `blob5` is `''` — filter
`blob8 = 'command'` (new rows only) for latency and outcome queries.

## 5. Docs

- `apps/discord-worker/CLAUDE.md` — "Analytics Tracking" section rewritten around the trace
  (start in dispatcher, finish in handlers, idempotent, gate test); `analytics.ts` line in the tree.
- `docs/architecture/service-bindings.md` — no change (binding unchanged).

## 6. Error handling

Tracking never affects a command: `finishCommandTrace` swallows and `logger.error`s any failure
in the AE/KV write (as today), and is itself wrapped so a bug in classification cannot throw into
a handler's `catch`.

## 7. Testing

- `command-trace.test.ts`: start/finish writes exactly one datapoint with the column layout above
  (mock `writeDataPoint`); second finish is a no-op; latency = finish − start **after the captured
  promises settle** (fake timers + a deferred promise captured through `tracedExecutionContext`);
  the traced ctx forwards `waitUntil` to the real ctx; a promise added during the drain is also
  awaited; a rejected captured promise → `classifyError(reason)`; a marked outcome wins over a
  later rejection; `markCommandOutcome` first-mark-wins and is a no-op without a trace;
  rate-limited path; button datapoint shape; locale bucketing (`en-US` → `en`, `pt-BR` → `other`,
  missing → `other`); subcommand extraction (`/dye info` → `info`, `/harmony` → `''`,
  `/extractor image` → command `extractor_image`, subcommand `image`).
- `classifyError` table test for the seven classes.
- Dispatcher tests (`src/index.test.ts`): immediate command → one datapoint with `double2 ≥ 0`;
  deferred command (handler schedules work on the ctx it was given) → datapoint written only after
  that work settles, with the marked outcome; rate-limited request → `rate_limited`; button click
  → `button` datapoint; handler throw → `unknown`.
- Existing handler suites: where a handler test asserts `writeDataPoint` calls or `trackCommand`
  mocks, adjust to the new signature; no handler behaviour changes.
- `analytics.test.ts`: extended for the new `CommandEvent` fields.
- Gates: `pnpm turbo run lint type-check test --filter=xivdyetools-discord-worker`; the worker's
  size gate (`check-bundle-size`, if present) — the change is a few KB.

## 8. Out of scope

Tier B (option choices, dye ids), autocomplete tracking, validation-return classification, `/stats`
changes, KV schema changes, moderation-worker, stoat-worker.
