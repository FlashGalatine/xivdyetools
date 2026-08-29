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
 * alive for it. Every other member of the installed `@cloudflare/workers-types`
 * `ExecutionContext` (exports, props, cache, access, tracing, abort) is
 * forwarded to `real` explicitly rather than widening the cast, so a native
 * method that reads internal state off `this` still sees the real context.
 */
export function tracedExecutionContext(real: ExecutionContext, trace: CommandTrace): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>): void {
      trace.pending.push(promise);
      // Rejections are classified via `trace.pending` in drainAndWrite (which
      // uses Promise.allSettled, so nothing here goes uncaught); the real
      // runtime only needs the promise to keep the isolate alive, not its
      // outcome, so forward a settled-safe view to avoid a second, redundant
      // unhandled-rejection surface on the platform's own ExecutionContext.
      real.waitUntil(promise.catch(() => undefined));
    },
    passThroughOnException(): void {
      real.passThroughOnException();
    },
    get exports(): ExecutionContext['exports'] {
      return real.exports;
    },
    get props(): ExecutionContext['props'] {
      return real.props;
    },
    get cache(): ExecutionContext['cache'] {
      return real.cache;
    },
    set cache(value: ExecutionContext['cache']) {
      real.cache = value;
    },
    get access(): ExecutionContext['access'] {
      return real.access;
    },
    get tracing(): ExecutionContext['tracing'] {
      return real.tracing;
    },
    set tracing(value: ExecutionContext['tracing']) {
      real.tracing = value;
    },
    abort(reason?: unknown): void {
      real.abort(reason);
    },
  };
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
