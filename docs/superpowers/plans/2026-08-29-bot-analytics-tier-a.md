# Discord bot analytics — Tier A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the discord-worker's existing Analytics Engine datapoint truthful and complete — real success/latency for deferred commands, a coarse outcome class, subcommand, locale bucket and button clicks — without recording any command option value.

**Architecture:** A per-interaction `CommandTrace` (`src/services/command-trace.ts`) is started by the dispatcher, which hands every handler a traced `ExecutionContext` whose `waitUntil` captures the handler's background promises; the dispatcher's `finally` finishes the trace after those promises settle and writes the datapoint through the existing `trackCommandWithKV`. Handlers add one `markCommandOutcome(...)` line in each catch that ends a command with an error embed. Columns are additive (blobs 1–5 unchanged).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Hono, Cloudflare Workers (Analytics Engine, KV), Vitest 4 (node), `@xivdyetools/test-utils/cloudflare` mocks.

**Spec:** `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`

## Global Constraints

- Work in the worktree `C:/dev/XIVProjects/.worktrees/xivdyetools-bot-analytics`, branch `bot-analytics` (cut from `origin/main` d0f601e8). Never touch `C:/dev/XIVProjects/xivdyetools` or the `web-analytics` worktree. Stage only the paths each task names.
- **No option values, ever** (spec Decision 1): no harmony type, mixer mode, dye ids, hex, search text, world, image metadata, guild/channel ids, error messages. The privacy policy sentence "These records never include message content, command option values, server names or channel IDs" must remain true.
- Column layout (spec §1): `index1`/`blob1` command · `blob2` userId · `blob3` `guild|dm` · `blob4` `1|0` · `blob5` outcome class · `blob6` subcommand or button kind · `blob7` locale bucket · `blob8` `command|button` · `double1` success · `double2` latency ms · `double3` `1`. Blobs 1–5 keep their meaning.
- Outcome classes: `ok | rate_limited | upstream_universalis | upstream_presets | image_input | render | unknown`.
- Locale bucket: `discordLocaleToLocaleCode(interaction.locale)` → one of `en ja de fr ko zh`, else `other`.
- Tracked command name keeps the `extractor_image` / `extractor_color` form; KV counter keys are unchanged (`total`, `cmd:<trackedName>`, `success`, `failure`, `usertrack:`); buttons write no KV counters.
- Tracking never affects a command: every tracking path is wrapped, logged at `error` level on failure, and runs in `waitUntil`.
- Relative imports inside the worker carry `.js`; type-only imports use `import type`.
- Commands (from the worktree root): single file `pnpm --filter xivdyetools-discord-worker exec vitest run <file>`; gate `pnpm turbo run lint type-check test --filter=xivdyetools-discord-worker`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## File structure

- `apps/discord-worker/src/services/command-trace.ts` — trace lifecycle, traced ctx, outcome marking, `classifyError`, helpers (`bucketLocale`, `subcommandOf`, `buttonKindOf`). Depends on `analytics.ts`, `i18n.ts`, `types/budget.ts`, `types/preset.ts`.
- `apps/discord-worker/src/services/command-trace.test.ts`
- `apps/discord-worker/src/services/analytics.ts` — `CommandEvent` gains `subcommand`, `locale`, `kind`, `outcome`, `latencyMs`; `errorType` removed; `trackCommandWithKV` skips KV for buttons.
- `apps/discord-worker/src/services/analytics.test.ts` — updated expectations.
- `apps/discord-worker/src/index.ts` — dispatcher + button path wiring.
- `apps/discord-worker/src/index.test.ts` — dispatcher tests.
- 10 handler files — one line per terminal catch.
- `apps/discord-worker/PRIVACY_POLICY.md`, `apps/discord-worker/CLAUDE.md`, `docs/operations/ANALYTICS_QUERIES.md`.

---

### Task 1: `analytics.ts` — extended `CommandEvent` and column layout

**Files:**
- Modify: `apps/discord-worker/src/services/analytics.ts` (the `CommandEvent` interface ~L17–27, `trackCommand` ~L43–78, `trackCommandWithKV` ~L214–232)
- Test: `apps/discord-worker/src/services/analytics.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OutcomeClass = 'ok' | 'rate_limited' | 'upstream_universalis' | 'upstream_presets' | 'image_input' | 'render' | 'unknown';
  export interface CommandEvent {
    commandName: string; userId: string; guildId?: string; success: boolean;
    outcome?: OutcomeClass;           // blob5; defaults to success ? 'ok' : 'unknown'
    subcommand?: string;              // blob6 ('' default); button kind for kind='button'
    locale?: string;                  // blob7 ('other' default)
    kind?: 'command' | 'button';      // blob8 ('command' default)
    latencyMs?: number;               // double2 (0 default)
  }
  ```
  `trackCommand(env, event, logger?)` and `trackCommandWithKV(env, event)` keep their signatures; `trackCommandWithKV` returns after `trackCommand` alone when `event.kind === 'button'`.

- [ ] **Step 1: Write the failing tests**

In `analytics.test.ts`, find the existing `describe('trackCommand', …)` block and add these cases (keep the file's `createMockEnv`/`createMockKV` helpers):

```ts
  it('writes the Tier A column layout with defaults for the new fields', () => {
    const env = createMockEnv();
    trackCommand(env, { commandName: 'harmony', userId: 'u1', guildId: 'g1', success: true });
    const analytics = env.ANALYTICS as unknown as { writeDataPoint: ReturnType<typeof vi.fn> };
    expect(analytics.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['harmony'],
      blobs: ['harmony', 'u1', 'guild', '1', 'ok', '', 'other', 'command'],
      doubles: [1, 0, 1],
    });
  });

  it('writes subcommand, locale, outcome, kind and latency when provided', () => {
    const env = createMockEnv();
    trackCommand(env, {
      commandName: 'dye', userId: 'u1', success: false,
      outcome: 'upstream_presets', subcommand: 'info', locale: 'ja', kind: 'command', latencyMs: 1234,
    });
    const analytics = env.ANALYTICS as unknown as { writeDataPoint: ReturnType<typeof vi.fn> };
    expect(analytics.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['dye'],
      blobs: ['dye', 'u1', 'dm', '0', 'upstream_presets', 'info', 'ja', 'command'],
      doubles: [0, 1234, 1],
    });
  });

  it('defaults outcome to unknown for a failure without a class', () => {
    const env = createMockEnv();
    trackCommand(env, { commandName: 'dye', userId: 'u1', success: false });
    const analytics = env.ANALYTICS as unknown as { writeDataPoint: ReturnType<typeof vi.fn> };
    expect(analytics.writeDataPoint.mock.calls[0][0].blobs[4]).toBe('unknown');
  });
```

And in the `describe('trackCommandWithKV', …)` block:

```ts
  it('writes a button datapoint without touching KV counters', async () => {
    const env = createMockEnv();
    await trackCommandWithKV(env, {
      commandName: 'button', userId: 'u1', success: true, kind: 'button', subcommand: 'copy_hex',
    });
    const analytics = env.ANALYTICS as unknown as { writeDataPoint: ReturnType<typeof vi.fn> };
    expect(analytics.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['button'],
      blobs: ['button', 'u1', 'dm', '1', 'ok', 'copy_hex', 'other', 'button'],
      doubles: [1, 0, 1],
    });
    expect((env.KV as unknown as { put: ReturnType<typeof vi.fn> }).put).not.toHaveBeenCalled();
  });
```

If the file's `createMockEnv` differs from `src/test-utils.ts`'s (it defines its own KV mock at the top), use whichever it already uses; the assertions are the contract. Any existing assertion on the old 5-blob layout (`blobs: [name, userId, ctx, success, errorType]`) must be updated to the 8-blob layout — `errorType` no longer exists.

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/analytics.test.ts`
Expected: the new cases FAIL (5-blob layout; `kind`/`outcome` unknown to TypeScript).

- [ ] **Step 2: Implement**

Replace the `CommandEvent` interface and `trackCommand` body in `analytics.ts`:

```ts
/** Coarse, message-free reason a command did not serve (spec §1). */
export type OutcomeClass =
  | 'ok'
  | 'rate_limited'
  | 'upstream_universalis'
  | 'upstream_presets'
  | 'image_input'
  | 'render'
  | 'unknown';

/**
 * Data point structure for Analytics Engine.
 *
 * Tier A (2026-08-29, docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md):
 * columns are additive — blobs 1–5 keep their pre-Tier-A meaning so existing
 * queries keep working. NEVER put a command option value, hex, search text,
 * world, image name, guild/channel id or error message in here — the privacy
 * policy promises none of those are recorded.
 */
export interface CommandEvent {
  commandName: string;
  userId: string;
  /**
   * Guild the command ran in — used ONLY to derive the 'guild' | 'dm'
   * context blob (FINDING-022); the id itself is never written anywhere.
   */
  guildId?: string;
  success: boolean;
  /** blob5 — defaults to 'ok' on success, 'unknown' on failure */
  outcome?: OutcomeClass;
  /** blob6 — subcommand name ('' when none); the button kind for kind='button' */
  subcommand?: string;
  /** blob7 — Discord client locale bucket (en|ja|de|fr|ko|zh|other) */
  locale?: string;
  /** blob8 — what produced the datapoint */
  kind?: 'command' | 'button';
  /** double2 — dispatcher start → trace finish (deferred work included) */
  latencyMs?: number;
}

export function trackCommand(env: Env, event: CommandEvent, logger?: ExtendedLogger): void {
  if (!env.ANALYTICS) {
    return;
  }

  try {
    env.ANALYTICS.writeDataPoint({
      indexes: [event.commandName],
      blobs: [
        event.commandName,                                   // blob1: command name
        event.userId,                                        // blob2: user ID (pseudonymous; unique-user counting)
        // blob3: FINDING-022 — the CONTEXT, never the guild id
        event.guildId ? 'guild' : 'dm',
        event.success ? '1' : '0',                           // blob4: success flag
        event.outcome ?? (event.success ? 'ok' : 'unknown'), // blob5: outcome class
        event.subcommand ?? '',                              // blob6: subcommand / button kind
        event.locale ?? 'other',                             // blob7: locale bucket
        event.kind ?? 'command',                             // blob8: command | button
      ],
      doubles: [
        event.success ? 1 : 0,                               // double1: success count
        event.latencyMs ?? 0,                                // double2: latency in ms
        1,                                                   // double3: total count
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error('Analytics tracking error', error instanceof Error ? error : undefined);
    }
  }
}
```

In `trackCommandWithKV`, after `trackCommand(env, event);` add:

```ts
  // Buttons are AE-only: the KV counters feed /stats' per-command panel.
  if (event.kind === 'button') return;
```

Update the doc comment on `trackCommandWithKV` accordingly. Remove every reference to `errorType` in the file.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/analytics.test.ts`
Expected: PASS. Then `pnpm --filter xivdyetools-discord-worker run type-check` — expect errors only where `errorType` was referenced (fix them; `index.ts` does not use it).

- [ ] **Step 4: Commit**

```bash
git add apps/discord-worker/src/services/analytics.ts apps/discord-worker/src/services/analytics.test.ts
git commit -m "feat(discord-worker): Tier A analytics columns — outcome class, subcommand, locale, kind, latency

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `command-trace.ts` — trace lifecycle, traced ctx, outcome marking, classifier

**Files:**
- Create: `apps/discord-worker/src/services/command-trace.ts`
- Test: `apps/discord-worker/src/services/command-trace.test.ts`

**Interfaces:**
- Consumes: `trackCommandWithKV`, `OutcomeClass` (Task 1); `discordLocaleToLocaleCode` from `./i18n.js`; `UniversalisError` from `../types/budget.js`; `PresetAPIError` from `../types/preset.js`; `DiscordInteraction`, `Env` from `../types/env.js`.
- Produces (used by Tasks 3–4):
  ```ts
  export interface CommandTrace { command: string; subcommand: string; userId: string; guildId?: string; locale: string; startedAt: number; outcome: OutcomeClass | null; pending: Promise<unknown>[]; finished: boolean }
  export function startCommandTrace(interaction: DiscordInteraction, fields: { command: string; subcommand: string; userId: string; guildId?: string; locale: string }): CommandTrace;
  export function getCommandTrace(interaction: DiscordInteraction): CommandTrace | undefined;
  export function tracedExecutionContext(real: ExecutionContext, trace: CommandTrace): ExecutionContext;
  export function markCommandOutcome(interaction: DiscordInteraction, outcome: OutcomeClass): void;
  export function finishCommandTrace(env: Env, interaction: DiscordInteraction, realCtx: ExecutionContext, logger: ExtendedLogger, outcome?: OutcomeClass): void;
  export function classifyError(error: unknown, fallback?: OutcomeClass): OutcomeClass;
  export function bucketLocale(locale: string | undefined): string;
  export function subcommandOf(interaction: DiscordInteraction): string;
  export function trackedCommandName(interaction: DiscordInteraction): string | undefined;
  export function buttonKindOf(customId: string): 'copy_hex' | 'copy_rgb' | 'copy_hsv' | null;
  ```

- [ ] **Step 1: Write the failing tests**

`apps/discord-worker/src/services/command-trace.test.ts`:

```ts
/**
 * CommandTrace — the dispatcher-owned lifecycle behind every Tier A datapoint.
 * Spec: docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startCommandTrace,
  getCommandTrace,
  tracedExecutionContext,
  markCommandOutcome,
  finishCommandTrace,
  classifyError,
  bucketLocale,
  subcommandOf,
  trackedCommandName,
  buttonKindOf,
} from './command-trace.js';
import { createMockEnv } from '../test-utils.js';
import type { DiscordInteraction } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { UniversalisError } from '../types/budget.js';
import { PresetAPIError } from '../types/preset.js';

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./analytics.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./analytics.js')>()),
  trackCommandWithKV: trackMock,
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ExtendedLogger;

function interaction(overrides: Partial<DiscordInteraction> = {}): DiscordInteraction {
  return {
    id: 'i1',
    application_id: 'app',
    token: 'tok',
    type: 2,
    data: { name: 'harmony' },
    user: { id: 'u1' },
    ...overrides,
  } as DiscordInteraction;
}

function realCtx() {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((p: Promise<unknown>) => { promises.push(p); }),
    passThroughOnException: vi.fn(),
    _all: () => Promise.all(promises),
  } as unknown as ExecutionContext & { _all: () => Promise<unknown[]> };
}

const fields = { command: 'harmony', subcommand: '', userId: 'u1', locale: 'en' };

beforeEach(() => {
  vi.useFakeTimers();
  trackMock.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('lifecycle', () => {
  it('finishing an immediate command writes one datapoint with latency and ok', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    vi.advanceTimersByTime(40);
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(env, {
      commandName: 'harmony', userId: 'u1', guildId: undefined, success: true,
      outcome: 'ok', subcommand: '', locale: 'en', kind: 'command', latencyMs: 40,
    });
  });

  it('is idempotent', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(getCommandTrace(ix)?.finished).toBe(true);
  });

  it('waits for promises captured through the traced ctx before writing, and measures latency to their settlement', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    let release!: () => void;
    const work = new Promise<void>((r) => { release = r; });
    traced.waitUntil(work);
    expect(ctx.waitUntil).toHaveBeenCalledWith(work); // forwarded to the real ctx

    finishCommandTrace(env, ix, ctx, logger);
    await Promise.resolve();
    expect(trackMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    release();
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: true, outcome: 'ok', latencyMs: 250 });
  });

  it('also awaits promises added while draining', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    let releaseSecond!: () => void;
    const second = new Promise<void>((r) => { releaseSecond = r; });
    traced.waitUntil(Promise.resolve().then(() => { traced.waitUntil(second); }));
    finishCommandTrace(env, ix, ctx, logger);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(trackMock).not.toHaveBeenCalled();
    releaseSecond();
    await ctx._all();
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it('a rejected captured promise classifies as the failure, unless an outcome was marked first', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    const trace = startCommandTrace(ix, fields);
    const traced = tracedExecutionContext(ctx, trace);
    traced.waitUntil(Promise.reject(new UniversalisError(503, 'down')));
    finishCommandTrace(env, ix, ctx, logger);
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'upstream_universalis' });

    trackMock.mockClear();
    const ix2 = interaction({ id: 'i2' });
    const ctx2 = realCtx();
    const trace2 = startCommandTrace(ix2, fields);
    const traced2 = tracedExecutionContext(ctx2, trace2);
    markCommandOutcome(ix2, 'render');
    traced2.waitUntil(Promise.reject(new Error('later')));
    finishCommandTrace(env, ix2, ctx2, logger);
    await ctx2._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'render' });
  });

  it('markCommandOutcome: first mark wins, no-op without a trace, never throws', () => {
    const ix = interaction();
    expect(() => markCommandOutcome(ix, 'render')).not.toThrow();
    startCommandTrace(ix, fields);
    markCommandOutcome(ix, 'upstream_presets');
    markCommandOutcome(ix, 'render');
    expect(getCommandTrace(ix)?.outcome).toBe('upstream_presets');
  });

  it('an explicit outcome on finish (rate_limited / unknown) is a failure', async () => {
    const env = createMockEnv();
    const ix = interaction();
    const ctx = realCtx();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger, 'rate_limited');
    await ctx._all();
    expect(trackMock.mock.calls[0][1]).toMatchObject({ success: false, outcome: 'rate_limited' });
  });

  it('finish without a trace is a no-op; a tracking failure is logged, never thrown', async () => {
    const env = createMockEnv();
    const ctx = realCtx();
    finishCommandTrace(env, interaction(), ctx, logger);
    expect(trackMock).not.toHaveBeenCalled();

    trackMock.mockRejectedValueOnce(new Error('AE down'));
    const ix = interaction();
    startCommandTrace(ix, fields);
    finishCommandTrace(env, ix, ctx, logger);
    await expect(ctx._all()).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it.each([
    [undefined, 'other'], ['en-US', 'en'], ['en-GB', 'en'], ['ja', 'ja'], ['zh-TW', 'zh'], ['pt-BR', 'other'],
  ])('bucketLocale(%j) → %s', (input, expected) => {
    expect(bucketLocale(input)).toBe(expected);
  });

  it('subcommandOf reads a subcommand option and ignores plain options', () => {
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', type: 1, options: [] }] } }))).toBe('info');
    expect(subcommandOf(interaction({ data: { name: 'dye', options: [{ name: 'info', options: [] }] } }))).toBe('info');
    expect(subcommandOf(interaction({ data: { name: 'harmony', options: [{ name: 'color', type: 3, value: 'x' }] } }))).toBe('');
    expect(subcommandOf(interaction({ data: { name: 'about' } }))).toBe('');
  });

  it('trackedCommandName keeps the extractor split and passes everything else through', () => {
    expect(trackedCommandName(interaction({ data: { name: 'extractor', options: [{ name: 'image', type: 1 }] } }))).toBe('extractor_image');
    expect(trackedCommandName(interaction({ data: { name: 'dye', options: [{ name: 'info', type: 1 }] } }))).toBe('dye');
    expect(trackedCommandName(interaction({ data: undefined }))).toBeUndefined();
  });

  it.each([
    ['copy_hex_FF0000', 'copy_hex'], ['copy_rgb_1', 'copy_rgb'], ['copy_hsv_x', 'copy_hsv'], ['preview_approve_1', null], ['', null],
  ])('buttonKindOf(%j) → %j', (id, expected) => {
    expect(buttonKindOf(id)).toBe(expected);
  });

  it.each([
    [new UniversalisError(503, 'x'), undefined, 'upstream_universalis'],
    [new PresetAPIError(500, 'x'), undefined, 'upstream_presets'],
    [new Error('SSRF blocked'), undefined, 'image_input'],
    [new Error('Only Discord CDN attachments'), undefined, 'image_input'],
    [new Error('Image too large'), undefined, 'image_input'],
    [new Error('Unsupported format'), undefined, 'image_input'],
    [new Error('fetch timeout'), undefined, 'image_input'],
    [new Error('boom'), 'render', 'render'],
    [new Error('boom'), undefined, 'unknown'],
    ['not an error', undefined, 'unknown'],
  ] as const)('classifyError(%o, %s) → %s', (error, fallback, expected) => {
    expect(classifyError(error, fallback)).toBe(expected);
  });
});
```

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/command-trace.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

`apps/discord-worker/src/services/command-trace.ts`:

```ts
/**
 * CommandTrace — the dispatcher-owned lifecycle behind every Tier A datapoint.
 *
 * Spec: docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md
 *
 * Why this exists: eleven handlers defer (`deferredResponse()` then
 * `ctx.waitUntil(process…)`), so a datapoint written in the dispatcher's
 * `finally` recorded "success" before the work ran. The dispatcher now hands
 * each handler a traced ExecutionContext whose `waitUntil` also records the
 * promise here; `finishCommandTrace` drains those promises first, so latency
 * and outcome describe the real work. Handlers never finish a trace — they
 * only `markCommandOutcome` in a catch that ends the command with an error.
 *
 * Privacy: the trace carries the command identity, the pseudonymous user id,
 * the guild/dm context, a locale bucket and an outcome CLASS. Never an option
 * value, hex, search text, world, image name, guild/channel id or message.
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DiscordInteraction, Env } from '../types/env.js';
import { UniversalisError } from '../types/budget.js';
import { PresetAPIError } from '../types/preset.js';
import { discordLocaleToLocaleCode } from './i18n.js';
import { trackCommandWithKV, type OutcomeClass } from './analytics.js';

export type { OutcomeClass };

export interface CommandTrace {
  command: string;
  subcommand: string;
  userId: string;
  guildId?: string;
  locale: string;
  startedAt: number;
  outcome: OutcomeClass | null;
  pending: Promise<unknown>[];
  finished: boolean;
}

const traces = new WeakMap<DiscordInteraction, CommandTrace>();

export function startCommandTrace(
  interaction: DiscordInteraction,
  fields: { command: string; subcommand: string; userId: string; guildId?: string; locale: string },
): CommandTrace {
  const trace: CommandTrace = {
    ...fields,
    startedAt: Date.now(),
    outcome: null,
    pending: [],
    finished: false,
  };
  traces.set(interaction, trace);
  return trace;
}

export function getCommandTrace(interaction: DiscordInteraction): CommandTrace | undefined {
  return traces.get(interaction);
}

/**
 * An ExecutionContext for handlers: every `waitUntil` is recorded on the trace
 * AND forwarded to the real context, so the runtime still keeps the isolate
 * alive for it.
 */
export function tracedExecutionContext(real: ExecutionContext, trace: CommandTrace): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>): void {
      trace.pending.push(promise);
      real.waitUntil(promise);
    },
    passThroughOnException(): void {
      real.passThroughOnException();
    },
  } as ExecutionContext;
}

/** Record why a command failed. First mark wins; no trace → no-op. Never throws. */
export function markCommandOutcome(interaction: DiscordInteraction, outcome: OutcomeClass): void {
  const trace = traces.get(interaction);
  if (trace && trace.outcome === null) trace.outcome = outcome;
}

/**
 * Finish the trace: drain the captured promises (looping while the drain
 * itself added more), then write the datapoint + KV counters. Idempotent;
 * everything runs inside `realCtx.waitUntil` so the response is never delayed.
 */
export function finishCommandTrace(
  env: Env,
  interaction: DiscordInteraction,
  realCtx: ExecutionContext,
  logger: ExtendedLogger,
  outcome?: OutcomeClass,
): void {
  const trace = traces.get(interaction);
  if (!trace || trace.finished) return;
  trace.finished = true;
  if (outcome && trace.outcome === null) trace.outcome = outcome;

  realCtx.waitUntil(
    drainAndWrite(env, trace).catch((error: unknown) => {
      logger.error('Analytics tracking failed', error instanceof Error ? error : undefined, {
        error: String(error),
      });
    }),
  );
}

async function drainAndWrite(env: Env, trace: CommandTrace): Promise<void> {
  let seen = 0;
  while (seen < trace.pending.length) {
    const batch = trace.pending.slice(seen);
    seen = trace.pending.length;
    const results = await Promise.allSettled(batch);
    for (const result of results) {
      if (result.status === 'rejected' && trace.outcome === null) {
        trace.outcome = classifyError(result.reason);
      }
    }
  }
  const failed = trace.outcome !== null && trace.outcome !== 'ok';
  await trackCommandWithKV(env, {
    commandName: trace.command,
    userId: trace.userId,
    guildId: trace.guildId,
    success: !failed,
    outcome: failed ? (trace.outcome as OutcomeClass) : 'ok',
    subcommand: trace.subcommand,
    locale: trace.locale,
    kind: 'command',
    latencyMs: Date.now() - trace.startedAt,
  });
}

// ============================================================================
// Classification and extraction helpers
// ============================================================================

const IMAGE_INPUT_MARKERS = ['SSRF', 'Discord CDN', 'too large', 'format', 'timeout'];

/**
 * Map a thrown value onto an outcome class. `fallback` is what an
 * unrecognised Error means at the call site (a render catch passes 'render').
 * The message is inspected only for the extractor's known markers — it is
 * never recorded.
 */
export function classifyError(error: unknown, fallback: OutcomeClass = 'unknown'): OutcomeClass {
  if (error instanceof UniversalisError) return 'upstream_universalis';
  if (error instanceof PresetAPIError) return 'upstream_presets';
  if (error instanceof Error && IMAGE_INPUT_MARKERS.some((m) => error.message.includes(m))) {
    return 'image_input';
  }
  return error instanceof Error ? fallback : 'unknown';
}

/** Discord client locale → one of the six supported codes, else 'other'. */
export function bucketLocale(locale: string | undefined): string {
  return (locale && discordLocaleToLocaleCode(locale)) || 'other';
}

/** The subcommand name when the first option is a subcommand (type 1, or untyped without a value). */
export function subcommandOf(interaction: DiscordInteraction): string {
  const first = interaction.data?.options?.[0];
  if (!first) return '';
  const isSubcommand = first.type === 1 || (first.type === undefined && first.value === undefined);
  return isSubcommand ? first.name : '';
}

/** Command name as tracked: /extractor keeps its 5.0 subcommand split (extractor_image / extractor_color). */
export function trackedCommandName(interaction: DiscordInteraction): string | undefined {
  const name = interaction.data?.name;
  if (!name) return undefined;
  if (name === 'extractor') {
    const sub = subcommandOf(interaction);
    if (sub) return `extractor_${sub}`;
  }
  return name;
}

const BUTTON_KINDS = ['copy_hex', 'copy_rgb', 'copy_hsv'] as const;

/** Tracked button kinds only; moderation/preview buttons and unknown ids return null. */
export function buttonKindOf(customId: string): (typeof BUTTON_KINDS)[number] | null {
  return BUTTON_KINDS.find((kind) => customId.startsWith(`${kind}_`)) ?? null;
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/command-trace.test.ts && pnpm --filter xivdyetools-discord-worker run type-check && pnpm --filter xivdyetools-discord-worker run lint`
Expected: PASS / clean. (If lint objects to the `as ExecutionContext` cast because `ExecutionContext` has more members in the installed `@cloudflare/workers-types`, implement the missing members as forwarding calls rather than widening the cast.)

- [ ] **Step 4: Commit**

```bash
git add apps/discord-worker/src/services/command-trace.ts apps/discord-worker/src/services/command-trace.test.ts
git commit -m "feat(discord-worker): CommandTrace — traced ExecutionContext, outcome marking, error classifier

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Dispatcher wiring (`index.ts`) + button datapoints

**Files:**
- Modify: `apps/discord-worker/src/index.ts` (`handleCommand` ~L632–800, `handleComponent` ~L1099–1120, imports ~L48)
- Test: `apps/discord-worker/src/index.test.ts`

**Interfaces:**
- Consumes: everything Task 2 produces; `trackCommandWithKV` (Task 1).
- Produces: every command handler now receives `tracedExecutionContext(ctx, trace)`; `handleCommand` no longer calls `trackCommandWithKV` directly.

- [ ] **Step 1: Write the failing dispatcher tests**

`index.test.ts` mocks `./services/analytics.js` (`trackCommandWithKV: vi.fn()`); `command-trace.ts` imports `trackCommandWithKV` from that module, so the existing mock captures Tier A writes — do NOT mock `./services/command-trace.js`. Add a `describe('Tier A command trace', …)` next to the existing "Analytics error handling" block, reusing the file's `verifyDiscordRequest` / `checkRateLimit` mocking pattern and `mockEnv` / `mockCtx`. For `mockCtx`, make sure the test's `waitUntil` collects promises so you can `await Promise.all(collected)`; if the file's `mockCtx` is `{ waitUntil: vi.fn() }`, add a local helper `ctxWithCollector()` returning `{ waitUntil: vi.fn((p) => collected.push(p)), passThroughOnException: vi.fn() }`.

```ts
    describe('Tier A command trace', () => {
      function post(body: unknown) {
        return new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body) });
      }
      async function allowRateLimit() {
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
      }
      async function verified(body: unknown) {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        vi.mocked(verifyDiscordRequest).mockResolvedValue({ isValid: true, body: JSON.stringify(body), error: '' });
      }

      it('writes one datapoint for an immediate command with subcommand and locale bucket', async () => {
        const body = {
          type: InteractionType.APPLICATION_COMMAND,
          data: { name: 'dye', options: [{ name: 'info', type: 1, options: [] }] },
          member: { user: { id: 'user-123' } },
          guild_id: 'g1',
          locale: 'ja',
        };
        await verified(body);
        await allowRateLimit();
        const { handleDyeCommand } = await import('./handlers/commands/index.js');
        vi.mocked(handleDyeCommand).mockResolvedValue(new Response());
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const collected: Promise<unknown>[] = [];
        const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);

        expect(trackCommandWithKV).toHaveBeenCalledTimes(1);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'dye', subcommand: 'info', userId: 'user-123', guildId: 'g1', locale: 'ja',
          success: true, outcome: 'ok', kind: 'command', latencyMs: expect.any(Number),
        }));
      });

      it('waits for a deferring handler\'s work and records its marked outcome', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        await allowRateLimit();
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');
        const { markCommandOutcome } = await import('./services/command-trace.js');
        let release!: () => void;
        const work = new Promise<void>((r) => { release = r; });
        vi.mocked(handleHarmonyCommand).mockImplementation(async (interaction, _env, handlerCtx) => {
          handlerCtx.waitUntil(work.then(() => { markCommandOutcome(interaction, 'render'); }));
          return new Response(JSON.stringify({ type: 5 }));
        });
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const collected: Promise<unknown>[] = [];
        const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

        await app.fetch(post(body), mockEnv, ctx);
        expect(trackCommandWithKV).not.toHaveBeenCalled();
        release();
        await Promise.all(collected);

        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'harmony', success: false, outcome: 'render', kind: 'command',
        }));
      });

      it('records a rate-limited request as rate_limited', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const collected: Promise<unknown>[] = [];
        const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'harmony', success: false, outcome: 'rate_limited',
        }));
      });

      it('records a handler throw as unknown', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        await allowRateLimit();
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');
        vi.mocked(handleHarmonyCommand).mockRejectedValue(new Error('boom'));
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const collected: Promise<unknown>[] = [];
        const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({ success: false, outcome: 'unknown' }));
      });

      it('writes a button datapoint for copy buttons and nothing for other buttons', async () => {
        const { handleButtonInteraction } = await import('./handlers/buttons/index.js');
        vi.mocked(handleButtonInteraction).mockResolvedValue(new Response());
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const collected: Promise<unknown>[] = [];
        const ctx = { waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

        const copy = { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: 'copy_hex_FF0000', component_type: 2 }, user: { id: 'user-123' }, locale: 'de' };
        await verified(copy);
        await app.fetch(post(copy), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, {
          commandName: 'button', userId: 'user-123', guildId: undefined, success: true,
          outcome: 'ok', subcommand: 'copy_hex', locale: 'de', kind: 'button', latencyMs: 0,
        });

        vi.mocked(trackCommandWithKV).mockClear();
        const other = { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: 'preview_approve_1', component_type: 2 }, user: { id: 'user-123' } };
        await verified(other);
        await app.fetch(post(other), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).not.toHaveBeenCalled();
      });
    });
```

Adapt the `verified`/`post` helpers to whatever the file already uses for signing and body construction (it mocks `verifyDiscordRequest` to return the body). Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/index.test.ts` — the new block FAILS.

- [ ] **Step 2: Wire the dispatcher**

In `index.ts`:

Replace `import { trackCommandWithKV } from './services/analytics.js';` with:

```ts
import { trackCommandWithKV } from './services/analytics.js';
import {
  startCommandTrace,
  tracedExecutionContext,
  finishCommandTrace,
  trackedCommandName,
  subcommandOf,
  bucketLocale,
  buttonKindOf,
} from './services/command-trace.js';
```

In `handleCommand`, right after the `if (!userId) {...}` guard and the `logger.info('Handling command', …)` line, add:

```ts
  // Tier A telemetry: the trace is started before the rate-limit check so a
  // limited request is still counted, and finished in the finally below once
  // the handler's background work (captured through `handlerCtx`) settles.
  const trace = startCommandTrace(interaction, {
    command: trackedCommandName(interaction) ?? 'unknown',
    subcommand: subcommandOf(interaction),
    userId,
    guildId: interaction.guild_id,
    locale: bucketLocale(interaction.locale),
  });
  const handlerCtx = tracedExecutionContext(ctx, trace);
```

In the rate-limit branch, before `return ephemeralResponse(formatRateLimitMessage(rateLimitResult, t));` add:

```ts
      finishCommandTrace(env, interaction, ctx, logger, 'rate_limited');
```

In the `switch`, replace every `ctx` argument passed to a handler (`handleAboutCommand(interaction, env, ctx)`, `handleHarmonyCommand(interaction, env, ctx, logger)`, … all cases) with `handlerCtx`. The first-run notice `ctx.waitUntil(...)` above the switch keeps the real `ctx`.

Replace the whole `finally { … }` block with:

```ts
  } finally {
    // Tier A: one datapoint per command, written after the handler's captured
    // background work settles (see services/command-trace.ts).
    finishCommandTrace(env, interaction, ctx, logger, success ? undefined : 'unknown');
  }
```

Delete the now-unused `trackedName` logic and the `let success = true;` stays (the catch still sets it).

In `handleComponent`, inside `if (componentType === 2) {` before `return handleButtonInteraction(...)`:

```ts
    // Tier A: copy-button clicks are counted (kind=button, no KV counters);
    // moderation/preview buttons and unknown ids are not.
    const kind = buttonKindOf(customId ?? '');
    const buttonUserId = interaction.member?.user?.id ?? interaction.user?.id;
    if (kind && buttonUserId) {
      ctx.waitUntil(
        trackCommandWithKV(env, {
          commandName: 'button',
          userId: buttonUserId,
          guildId: interaction.guild_id,
          success: true,
          outcome: 'ok',
          subcommand: kind,
          locale: bucketLocale(interaction.locale),
          kind: 'button',
          latencyMs: 0,
        }).catch((error) => {
          logger.error('Analytics tracking failed', error instanceof Error ? error : undefined, {
            error: String(error),
          });
        }),
      );
    }
```

- [ ] **Step 3: Run the dispatcher suite + type-check**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/index.test.ts && pnpm --filter xivdyetools-discord-worker run type-check`
Expected: PASS. Existing tests that asserted `trackCommandWithKV` was called with `{ commandName, userId, guildId, success }` exactly must be updated to `expect.objectContaining({...})` (the payload gained fields) and, where they awaited nothing, to `await Promise.all(collected)` — the write now happens inside `waitUntil` after a drain. The existing "should handle analytics tracking failure gracefully" test must still pass (the trace logs and swallows).

- [ ] **Step 4: Commit**

```bash
git add apps/discord-worker/src/index.ts apps/discord-worker/src/index.test.ts
git commit -m "feat(discord-worker): dispatcher owns the command trace; count copy-button clicks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Handler outcome marks (batched, mechanical)

**Files:**
- Modify (one import + one line per terminal catch): `apps/discord-worker/src/handlers/commands/{accessibility,budget,comparison,contrast,extractor,gradient,harmony,mixer-v4,preset,swatch}.ts`
- Test: the handlers' existing suites must stay green; add ONE assertion per file where a suite already exercises the catch path (see Step 3).

**Interfaces:**
- Consumes: `markCommandOutcome`, `classifyError` from `../../services/command-trace.js`.

- [ ] **Step 1: Add the import to each of the 10 files**

```ts
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
```

- [ ] **Step 2: Mark every terminal catch**

A terminal catch is a `catch (error)` whose body ends the command with an error embed (`safeEditOriginalResponse(…, { embeds: [errorEmbed(…)] })`) or an error response, and does not continue to a normal result. Insert as the FIRST statement of the catch body:

| File | Catch sites (approx. line) | Fallback class |
|---|---|---|
| `accessibility.ts` | 153 | `'render'` |
| `budget.ts` | 382 | default (`UniversalisError` → `upstream_universalis`) |
| `comparison.ts` | 120 | `'render'` |
| `contrast.ts` | 114 | `'render'` |
| `extractor.ts` | 588 | default (message markers → `image_input`) |
| `gradient.ts` | 210 | `'render'` |
| `harmony.ts` | 181 | `'render'` |
| `mixer-v4.ts` | 116 | `'render'` |
| `preset.ts` | 263, 328, 389, 573, 666, 919 — **not** 1091 (`Failed to notify submission channel` is a side effect after the command already succeeded) | default (`PresetAPIError` → `upstream_presets`) |
| `swatch.ts` | 216, 253 | `'render'` |

The line, e.g. in `harmony.ts`:

```ts
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error, 'render'));
    if (logger) logger.error('Harmony render error', error instanceof Error ? error : undefined);
```

and in `budget.ts` / `preset.ts` / `extractor.ts`:

```ts
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
```

Where a catch is inside a nested function that does not have `interaction` in scope (check `mixer-v4.ts`'s IIFE and `preset.ts`'s helpers), the enclosing handler does — pass it through or mark in the nearest scope that has it. Do not add marks to catches that recover (fall back to a text card, retry, or ignore a notification failure). Do not touch `dye.ts` (no catches — a rejection surfaces through the trace drain).

- [ ] **Step 3: Assertions in existing suites**

For each handler whose test file already has a test that drives the catch path (search `src/handlers/commands/*.test.ts` / `src/handlers/commands/__tests__/` for `generationFailed`, `loadFailed`, `apiError`, `processingFailed`), add to that test:

```ts
const { getCommandTrace, startCommandTrace } = await import('../../services/command-trace.js');
// before invoking the handler:
startCommandTrace(interaction, { command: 'harmony', subcommand: '', userId: 'u1', locale: 'en' });
// after the work settles:
expect(getCommandTrace(interaction)?.outcome).toBe('render'); // or the class that path produces
```

If a handler has no such test, add nothing — the class table is covered by Task 2 and the wiring by Task 3.

- [ ] **Step 4: Run the full worker gate**

Run: `pnpm turbo run lint type-check test --filter=xivdyetools-discord-worker`
Expected: green. Also run `pnpm --filter xivdyetools-discord-worker run check-bundle-size` if that script exists (`grep check-bundle-size apps/discord-worker/package.json`) — the change is a few KB.

- [ ] **Step 5: Commit**

```bash
git add apps/discord-worker/src/handlers/commands/accessibility.ts apps/discord-worker/src/handlers/commands/budget.ts apps/discord-worker/src/handlers/commands/comparison.ts apps/discord-worker/src/handlers/commands/contrast.ts apps/discord-worker/src/handlers/commands/extractor.ts apps/discord-worker/src/handlers/commands/gradient.ts apps/discord-worker/src/handlers/commands/harmony.ts apps/discord-worker/src/handlers/commands/mixer-v4.ts apps/discord-worker/src/handlers/commands/preset.ts apps/discord-worker/src/handlers/commands/swatch.ts
# plus any test files you touched
git commit -m "feat(discord-worker): mark outcome classes in every terminal handler catch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Privacy policy, CLAUDE.md, query cookbook

**Files:**
- Modify: `apps/discord-worker/PRIVACY_POLICY.md` (§2 *Usage Analytics* table, "Last Updated"), `apps/discord-worker/CLAUDE.md` ("Analytics Tracking" section ~L198–200; tree line for `analytics.ts` ~L107), `docs/operations/ANALYTICS_QUERIES.md` (append a section; the file exists on `main` only if PR #149 has merged — if it does not exist on this branch, create it with just the Discord section and a one-line header pointing at the web-app section that PR #149 adds)

- [ ] **Step 1: Privacy policy**

In the *Usage Analytics* table, replace the first row's Data cell with:

> Command name and subcommand, whether it succeeded and — if not — a coarse failure class (rate-limited, market data unavailable, preset service unavailable, image could not be read, rendering failed, unknown; never an error message), how long it took, whether it ran in a server or a DM (`guild` / `dm` — never the server's ID), your Discord client language (one of the six the Bot supports, or "other"), which copy button you pressed (hex / RGB / HSV), and your Discord User ID (used only to count unique users)

Keep the sentence "These records never include message content, command option values, server names or channel IDs." Set **Last Updated** to `August 29, 2026`.

- [ ] **Step 2: CLAUDE.md**

Replace the "Analytics Tracking" section body with:

```markdown
Tier A (2026-08-29, spec `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`): `handleCommand()` starts a `CommandTrace` (`services/command-trace.ts`) before the rate-limit check and hands every handler a **traced `ExecutionContext`** whose `waitUntil` also records the promise on the trace; the `finally` calls `finishCommandTrace()`, which drains those promises and then writes the datapoint through `trackCommandWithKV()` — so `success`/latency describe the deferred work, not the deferred ack. Handlers never finish a trace; a catch that ends the command with an error embed calls `markCommandOutcome(interaction, classifyError(error[, 'render']))`. Columns: blobs 1–5 unchanged (command, userId, guild/dm, success, **outcome class**), blob6 subcommand/button kind, blob7 locale bucket, blob8 `command|button`, double2 real latency. Copy-button clicks are AE-only `kind=button` rows. **Never record an option value, hex, search text, world, image name, guild/channel id or error message** — `PRIVACY_POLICY.md` §2 promises it. Queries: `docs/operations/ANALYTICS_QUERIES.md` (Discord section).
```

Update the tree line: `│   ├── analytics.ts               # KV counters + Analytics Engine writes (Tier A column layout)` and add `│   ├── command-trace.ts           # Per-interaction trace: traced ctx, outcome marks, classifier`.

- [ ] **Step 3: Query cookbook — Discord section**

Append to `docs/operations/ANALYTICS_QUERIES.md`:

```markdown
# Discord bot analytics — reading the data

Dataset: `xivdyetools_bot_analytics` (production); `xivdyetools_bot_analytics_beta` is the dev
worker and can be ignored. Written by `apps/discord-worker/src/services/analytics.ts`; lifecycle in
`services/command-trace.ts`. Spec: `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`.
Retention ~3 months. Always aggregate with `sum(_sample_interval)`.

Rows written before 2026-08-29 have `blob5 = ''`, `blob6..8 = ''` and `double2 = 0`; filter
`blob8 = 'command'` (or `'button'`) to restrict to Tier A rows.

## Column layout

| Column | Content |
|---|---|
| `index1` / `blob1` | command name (`extractor_image` / `extractor_color` split kept) or `button` |
| `blob2` | Discord user id (pseudonymous; use only for `uniq()`) |
| `blob3` | `guild` \| `dm` |
| `blob4` | `1` \| `0` success |
| `blob5` | outcome class: `ok`, `rate_limited`, `upstream_universalis`, `upstream_presets`, `image_input`, `render`, `unknown` |
| `blob6` | subcommand (`info`, `browse`, `find`, …) or button kind (`copy_hex`, `copy_rgb`, `copy_hsv`) |
| `blob7` | locale bucket `en ja de fr ko zh other` |
| `blob8` | `command` \| `button` |
| `double1` | success 1/0 · `double2` latency ms (deferred work included) · `double3` 1 |

## 1. Commands and subcommands, last 30 days

```sql
SELECT blob1 AS command, blob6 AS subcommand, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command, subcommand ORDER BY runs DESC
```

## 2. Latency p50 / p95 per command

```sql
SELECT blob1 AS command,
       quantileExactWeighted(0.5)(double2, _sample_interval) AS p50_ms,
       quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_ms
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND blob4 = '1' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command ORDER BY p95_ms DESC
```

## 3. Failure share by outcome class

```sql
SELECT blob1 AS command, blob5 AS outcome, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND blob4 = '0' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command, outcome ORDER BY runs DESC
```

Known gap: handler validation replies and non-exception error embeds (e.g. "no matches") still
count as `ok` — only thrown errors and rate limits are classified.

## 4. Locale mix (Discord client language, not the stored preference)

```sql
SELECT blob7 AS locale, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY locale ORDER BY runs DESC
```

## 5. Copy-button usage

```sql
SELECT blob6 AS button, sum(_sample_interval) AS clicks
FROM xivdyetools_bot_analytics
WHERE blob8 = 'button' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY button
```

## 6. Daily unique users

```sql
SELECT toStartOfDay(timestamp) AS day, uniq(blob2) AS users
FROM xivdyetools_bot_analytics
WHERE timestamp > now() - INTERVAL '30' DAY
GROUP BY day ORDER BY day
```
```

- [ ] **Step 4: Gate + commit**

Run: `pnpm turbo run lint type-check test --filter=xivdyetools-discord-worker` (doc-only change, but the gate is the merge bar).

```bash
git add apps/discord-worker/PRIVACY_POLICY.md apps/discord-worker/CLAUDE.md docs/operations/ANALYTICS_QUERIES.md
git commit -m "docs(discord-worker): Tier A analytics — privacy policy fields, CLAUDE.md, query cookbook

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Deploy notes (after merge — user-run)

1. discord-worker deploys via its workflow on merge (`--env production`); no new bindings, the dataset already exists.
2. Announce the privacy-policy update in Discord if you consider it significant (policy §11).
3. Check query 1 and 3 after a day; the `extractor_*` split and pre-existing `/stats` KV panels are unchanged.
