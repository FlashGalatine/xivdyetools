# Discord bot analytics — Tier A (schema gap-filling, no option values)

**Date:** 2026-08-29 · **App:** `apps/discord-worker` · **Status:** implemented (PR #150), amended
2026-08-29 by the pre-merge review — see *Amendments* at the end · **Branch:** `bot-analytics`
(worktree `.worktrees/xivdyetools-bot-analytics`, cut from `origin/main` d0f601e8; independent of
the `web-analytics` PR #149)

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
| `blob6` | **subcommand** (`info`, `search`, `list`, `random`, `browse`, `find`, `quick`, `set-world`, `show`, `set`, `reset`, …) or `''`; subcommand **groups** are recorded as `<group>_<sub>` (`favorite_add`); for buttons the button kind (`copy_hex` \| `copy_rgb` \| `copy_hsv`) | new |
| `blob7` | **locale bucket** — `discordLocaleToLocaleCode(interaction.locale)` → `en\|ja\|de\|fr\|ko\|zh`, else `other` | new |
| `blob8` | **kind** — `command` \| `button` | new |
| `double1` | success `1`/`0` | unchanged |
| `double2` | **latency ms** — dispatcher start → `finishCommandTrace`, so deferred work is included; `0` for buttons | was always `0` |
| `double3` | `1` | unchanged |

**Outcome classes** (`blob5`): `ok`, `rate_limited`, `upstream_universalis`, `upstream_presets`,
`image_input`, `render`, `unknown`. Derived by one
`classifyError(error, fallback = 'unknown', { imageInput? }): OutcomeClass` helper:
`UniversalisError` / `PresetAPIError` → `upstream_*` for 429, 5xx and network (status 0), but
**`ok` for any other 4xx** — a user condition (not the owner, duplicate vote, unknown world) the
handler already answers with a friendly message; image-worker's input rejections (the one marker
table in `services/image-input-errors.ts`: URL, size, format, timed-out fetch), only when the
caller passes `imageInput: true` → `image_input`; anything else thrown from a render/SVG path
(callers pass `fallback = 'render'`) → `render`; else `unknown`. **Never** the error message.

**Known gap, deliberate:** handler validation early-returns (52 `t('errors.*')` sites) still count
as `ok`. Routing them through a helper is a v2 item. Non-throwing branches that mean *we* failed
are marked, though: bot-logic's `GENERATION_FAILED` → `render` (including `/dye`'s text
fallbacks, which still answer the user), an unreadable image / `.chara` → `image_input`.

**Not recorded** (unchanged promises): option values, hex/search text, image metadata, world,
guild/channel ids, message content.

## 2. Command trace — `src/services/command-trace.ts`

The one new mechanism. The dispatcher owns the whole lifecycle: it starts the trace, hands the
handler a **traced `ExecutionContext`** whose `waitUntil` captures every background promise the
handler schedules, and finishes the trace once those promises have settled. Handlers never call
"finish"; they only *mark* a failure class where a command ends with an error embed — and the
dispatcher marks its own two failure paths (rate-limited, handler throw) through the same
`markCommandOutcome`, so the trace's outcome has exactly one writer.

```ts
export type OutcomeClass = 'ok' | 'rate_limited' | 'upstream_universalis' | 'upstream_presets'
  | 'image_input' | 'render' | 'unknown';

export const DRAIN_DEADLINE_MS = 20_000;

export interface CommandTrace {
  command: string;        // tracked name (extractor_image etc.)
  subcommand: string;     // '' when none
  userId: string;
  guildId?: string;       // reduced to 'guild' | 'dm' by analytics.ts; the id is never written
  locale: string;         // bucket
  startedAt: number;      // Date.now()
  outcome: OutcomeClass | null;   // set by markCommandOutcome; null = ok so far
  pending: Promise<unknown>[];    // promises captured from the traced ctx
  finished: boolean;
}

/** Create and remember the trace (WeakMap<DiscordInteraction, CommandTrace>). */
export function startCommandTrace(interaction: DiscordInteraction, fields: { command; subcommand; userId; guildId?; locale }): CommandTrace;
/** An ExecutionContext whose waitUntil records the promise on the trace AND forwards to the real ctx. */
export function tracedExecutionContext(real: ExecutionContext, trace: CommandTrace): ExecutionContext;
/** The ONE writer: record why the command failed (or `ok` for an upstream 4xx). First mark wins; no-op without a trace. Never throws. */
export function markCommandOutcome(interaction: DiscordInteraction, outcome: OutcomeClass): void;
/** Dispatcher: idempotent. Drains `pending` (allSettled, looping while new promises were added, bounded by DRAIN_DEADLINE_MS — on expiry the row is written as `unknown` rather than lost), then writes AE + KV via analytics.ts. A rejected pending promise → classifyError(reason) unless an outcome was already marked. */
export function finishCommandTrace(env: Env, interaction: DiscordInteraction, realCtx: ExecutionContext, logger: ExtendedLogger): void;
/** Copy-button click: one AE-only `kind=button` row, same identity columns as a command. */
export function trackButtonClick(env: Env, ctx: ExecutionContext, logger: ExtendedLogger, interaction: DiscordInteraction, kind: CopyButtonKind): void;
export function classifyError(error: unknown, fallback?: OutcomeClass, options?: { imageInput?: boolean }): OutcomeClass;
```

- `finishCommandTrace` is idempotent (second call is a no-op). The drain + write run inside
  `realCtx.waitUntil`, so the response is never delayed.
- The two service-binding calls the drain can wait on (`IMAGE_WORKER`, `PRESETS_API`) carry a
  10 s `AbortSignal.timeout`, so a stalled upstream surfaces as a classified failure well inside
  the 20 s drain deadline.
- AE write + KV counters go through the existing `trackCommandWithKV` (extended to take
  `subcommand`, `locale`, `kind`, `outcome`, `latencyMs`).
- KV counters are **unchanged in shape**: `total`, `cmd:<trackedName>`, `success`/`failure`,
  `usertrack:` — subcommands go to AE only, so `/stats` needs no change. A rate-limited request is
  **AE-only** (`rate_limited` in `blob5`; no KV counter moves) — see *Amendments*.

### Dispatcher (`src/index.ts`)

- `startCommandTrace` right after `userId` is resolved (before the rate-limit check) so
  rate-limited requests are traced; the rate-limit early return does
  `markCommandOutcome(interaction, 'rate_limited')` then `finishCommandTrace(…)`.
- Every handler in the `switch` receives `tracedExecutionContext(ctx, trace)` instead of `ctx`
  (the dispatcher's own `waitUntil`s — first-run notice, tracking — keep using the real `ctx`).
- The dispatcher's `catch` does `markCommandOutcome(interaction, classifyError(error))` (an
  upstream error thrown before a handler deferred keeps its class); the `finally` does
  `finishCommandTrace(env, interaction, ctx, logger)`. For an immediate handler `pending` is empty
  and the datapoint is written at once; for a deferring handler the drain waits for its `process*`
  promise, so latency and outcome reflect the real work. No deferred-response detection is needed.
- Subcommand for the trace: `interaction.data?.options?.[0]` when its `type` is
  `OptionType.SUB_COMMAND` (Discord always types its options; nothing is guessed from an untyped
  option). The rate-limit scope reads the raw first-option name — a different expression, which
  only matters for `/extractor`, whose first option is always its subcommand. The tracked command
  name keeps the `extractor_<sub>` form so KV and existing queries are stable. A subcommand GROUP
  (`OptionType.SUB_COMMAND_GROUP`, e.g. `/preset favorite add|remove|list`, `/preferences
  filters …`) is recorded as `<group>_<sub>` (`favorite_add`) instead of flattening to `''`.
- The button path (`handleComponent` → `handleButtonInteraction`): `trackButtonClick` writes a
  `kind=button` datapoint with `blob6 = copy_hex | copy_rgb | copy_hsv` (the `COPY_BUTTON_KINDS`
  list owned by `handlers/buttons/copy.ts`) and `blob1 = index1 = 'button'`; unknown `custom_id`s
  and the preview-image moderation buttons are not tracked. No KV counters for buttons.

### Handlers — one line per terminal catch

In every `catch` that ends the command with an error embed (`safeEditOriginalResponse(…,
errorEmbed(…))` as the final response — the 22 catch sites across `accessibility, budget,
comparison, contrast, extractor, gradient, harmony, mixer-v4, preset, swatch`), add
`markCommandOutcome(interaction, classifyError(error));` before the edit. Catches that recover
and continue with a normal card are **not** marked. `dye.ts` DOES have catches — two bare ones
around `processInfoCard` / `processRandomGrid` that fall back to a text embed — and they are
marked `render` (the card was lost even though the user got an answer; without this a resvg
outage on the busiest command would be invisible). No success-path edits anywhere.

Handler-level non-exception failures that render an error embed without throwing are split:
`result.error === 'GENERATION_FAILED'` (bot-logic's card generator threw) is marked `render`;
`/extractor image`'s "no colours" / "no matches" and `/swatch`'s unreadable download / parse
failure are `image_input`; user conditions (`NO_MATCHES`, `NO_LIVE_SLOTS`, `SLOT_MISSING`, a
missing option) stay `ok` — the same class of gap as validation returns. `/extractor image`'s
single catch is phase-aware: `unknown` (or `image_input` by marker) during the image-worker round
trip, `render` once the pixels are back. `/swatch`'s download catch classifies with no fallback
(a CDN network failure is neither our renderer nor the user's file). `/stats` `return await`s its
subcommands so its catch (and mark) is reachable.

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
6. Daily unique users — `count(DISTINCT blob2)` per day (already possible; documented for
   completeness — Analytics Engine's SQL has no `uniq()`).

Note that `double2` for datapoints written before this change is `0` and `blob5` is `''` — filter
`blob8 = 'command'` (new rows only) for latency and outcome queries.

## 5. Docs

- `apps/discord-worker/CLAUDE.md` — "Analytics Tracking" section rewritten around the trace
  (started and finished in the dispatcher, handlers only mark; idempotent; one writer);
  `analytics.ts` line in the tree.
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

## Amendments — 2026-08-29 pre-merge review (PR #150)

Three decisions in the approved text above were changed while resolving the review; each is
reversible in one line and is called out on the PR so the maintainer can veto it:

1. **Rate-limited requests no longer touch the KV counters** (§2 said "counts as a `failure` in
   KV"). Every KV counter is a read-modify-write on a shared hot key capped at one write per
   second; routing rejected bursts through them 429s the writes, burns the daily write budget,
   and lets one user's rejected spam drive the PUBLIC `/stats` success rate and top-10. Pre-Tier-A
   the early return touched KV zero times; that is preserved. The AE row still carries
   `rate_limited`. Revert: delete the `outcome === 'rate_limited'` clause in `trackCommandWithKV`.
2. **A 4xx other than 429 from presets-api / Universalis classifies as `ok`** (§1 said every
   `PresetAPIError` → `upstream_presets`). `preset-api.ts` wraps every non-2xx in
   `PresetAPIError`, including the API's own 403 not-owner / 409 duplicate-vote / 404 replies that
   the handlers answer with friendly messages — counting those as upstream outages would blame
   the upstream for user input. Revert: drop `isUserCondition` in `classifyError`.
3. **`/dye`'s text fallbacks count as `render`** (§2 said dye.ts has no catches — it has two).
   The user still gets an answer, but the card was lost; this is the only way a renderer outage on
   the busiest command is visible in the outcome column. Revert: remove the two marks in `dye.ts`.

Also resolved by the review, within the approved design: a 20 s drain deadline
(`DRAIN_DEADLINE_MS`; a stalled upstream is written as `unknown` rather than lost) plus 10 s
`AbortSignal.timeout`s on the image-worker and presets-api binding calls; `GENERATION_FAILED`
branches marked `render`; `image_input` widened to "the uploaded image or `.chara` file could not
be read" with one marker table (`services/image-input-errors.ts`) shared by the classifier and the
extractor's user message (whose `timeout` marker never matched image-worker's "timed out");
`/stats` `return await`; the dispatcher marks through `markCommandOutcome` like everyone else
(no second write path); `trackButtonClick`; `subcommandOf` keyed on `OptionType`. Deferred: a
`deferWork` helper that marks structurally, a typed `ImageInputError` at the throw site, an
`identityBySubcommand` flag on `COMMAND_REGISTRY`, named `AE_BLOBS` columns, and marking a failed
Discord edit (`safeEditOriginalResponse` → `false`), which stays `ok`.
