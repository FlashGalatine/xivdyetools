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
 * only `markCommandOutcome` where a command ends with an error embed; the
 * dispatcher marks its own two failure paths the same way, so the trace has
 * exactly one writer (`markCommandOutcome`) and one finisher.
 *
 * Privacy: the trace carries the command identity, the pseudonymous user id,
 * the guild/dm context, a locale bucket and an outcome CLASS. Never an option
 * value, hex, search text, world, image name, guild/channel id or message
 * (the full list lives on `CommandEvent` in analytics.ts, the only place a
 * value can actually be written).
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DiscordInteraction, Env } from '../types/env.js';
import { UniversalisError } from '../types/budget.js';
import { PresetAPIError } from '../types/preset.js';
import { OptionType } from '../commands/schemas.js';
import { COPY_BUTTON_KINDS, type CopyButtonKind } from '../handlers/buttons/copy.js';
import { discordLocaleToLocaleCode } from './i18n.js';
import { trackCommandWithKV, type OutcomeClass } from './analytics.js';
import { isImageInputError } from './image-input-errors.js';

/**
 * How long `finishCommandTrace` waits for a handler's captured background
 * work before writing the datapoint anyway. The two service-binding calls
 * (image-worker, presets-api) carry their own 10 s `AbortSignal.timeout`, the
 * CDN / Universalis / Discord fetches 5–10 s, so a healthy command settles
 * well inside this; a stalled one is recorded as `unknown` instead of being
 * lost when the runtime ends the post-response `waitUntil` window.
 */
export const DRAIN_DEADLINE_MS = 20_000;

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
      // Forward the RAW promise: `drainAndWrite`'s Promise.allSettled over
      // `trace.pending` already attaches a handler, so this isn't for
      // unhandled-rejection safety — it's so the real Workers runtime still
      // sees (and logs) a rejection from a handler with no catch of its own
      // (spec §2 "Handlers"), same as an untraced `ctx.waitUntil` would.
      real.waitUntil(promise);
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

/**
 * Record the command's outcome class. First mark wins; no trace → no-op;
 * never throws. Handlers call this where a command ends with an error embed;
 * the dispatcher calls it for a rate-limited request and for a handler throw.
 * Marking `ok` (a 4xx user condition from an upstream, see `classifyError`)
 * pins the trace to success the same way.
 */
export function markCommandOutcome(interaction: DiscordInteraction, outcome: OutcomeClass): void {
  const trace = traces.get(interaction);
  if (trace && trace.outcome === null) trace.outcome = outcome;
}

/**
 * Finish the trace: drain the captured promises (looping while the drain
 * itself added more, bounded by `DRAIN_DEADLINE_MS`), then write the datapoint
 * + KV counters. Idempotent; everything runs inside `realCtx.waitUntil` so the
 * response is never delayed.
 */
export function finishCommandTrace(
  env: Env,
  interaction: DiscordInteraction,
  realCtx: ExecutionContext,
  logger: ExtendedLogger,
): void {
  const trace = traces.get(interaction);
  if (!trace || trace.finished) return;
  trace.finished = true;
  enqueueWrite(realCtx, logger, drainAndWrite(env, trace));
}

/**
 * A copy-button click: one AE-only `kind=button` row (no KV counters — those
 * feed /stats' per-command panel). Written unconditionally, before the button
 * handler runs — a click is a click even if the copy itself fails.
 */
export function trackButtonClick(
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger,
  interaction: DiscordInteraction,
  kind: CopyButtonKind,
): void {
  const { userId, guildId, locale } = interactionIdentity(interaction);
  if (!userId) return;
  enqueueWrite(
    ctx,
    logger,
    trackCommandWithKV(env, {
      commandName: 'button',
      userId,
      guildId,
      success: true,
      outcome: 'ok',
      subcommand: kind,
      locale,
      kind: 'button',
      latencyMs: 0,
    }),
  );
}

/** The identity columns every datapoint carries, derived one way for commands and buttons. */
export function interactionIdentity(interaction: DiscordInteraction): {
  userId: string | undefined;
  guildId: string | undefined;
  locale: string;
} {
  return {
    userId: interaction.member?.user?.id ?? interaction.user?.id,
    guildId: interaction.guild_id,
    locale: bucketLocale(interaction.locale),
  };
}

/** Fire-and-forget an analytics write: a tracking failure is logged, never thrown into a handler. */
function enqueueWrite(ctx: ExecutionContext, logger: ExtendedLogger, write: Promise<void>): void {
  ctx.waitUntil(
    write.catch((error: unknown) => {
      logger.error('Analytics tracking failed', error);
    }),
  );
}

async function drainAndWrite(env: Env, trace: CommandTrace): Promise<void> {
  const drained = await withDeadline(drain(trace), DRAIN_DEADLINE_MS);
  if (!drained && trace.outcome === null) trace.outcome = 'unknown';
  const outcome = trace.outcome ?? 'ok';
  await trackCommandWithKV(env, {
    commandName: trace.command,
    userId: trace.userId,
    guildId: trace.guildId,
    success: outcome === 'ok',
    outcome,
    subcommand: trace.subcommand,
    locale: trace.locale,
    kind: 'command',
    latencyMs: Date.now() - trace.startedAt,
  });
}

/** Await every captured promise, including ones a draining promise adds. */
async function drain(trace: CommandTrace): Promise<void> {
  while (trace.pending.length > 0) {
    const results = await Promise.allSettled(trace.pending.splice(0));
    for (const result of results) {
      if (result.status === 'rejected' && trace.outcome === null) {
        trace.outcome = classifyError(result.reason);
      }
    }
  }
}

/** Resolves `true` when `work` settles first, `false` when the deadline fires first. */
function withDeadline(work: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([work.then(() => true, () => true), deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

// ============================================================================
// Classification and extraction helpers
// ============================================================================

/**
 * Map a thrown value onto an outcome class. `fallback` is what an
 * unrecognised Error means at the call site (a render catch passes 'render').
 *
 * Upstream errors: a 4xx other than 429 from presets-api or Universalis is a
 * USER condition (not the owner, duplicate vote, unknown world, …) that the
 * handler already answers with a friendly message, so it classifies as `ok` —
 * the same rule as a validation reply; 429, 5xx and status 0/undefined
 * (network, binding) are the upstream's fault.
 *
 * The message is inspected for image-worker's input rejections
 * (`isImageInputError`) only when `options.imageInput` is set — those markers
 * ("format", "timed out", …) are generic enough to misclassify a render/API
 * error from a command that never touched an image. The message itself is
 * never recorded.
 */
export function classifyError(
  error: unknown,
  fallback: OutcomeClass = 'unknown',
  options: { imageInput?: boolean } = {},
): OutcomeClass {
  if (error instanceof UniversalisError) {
    return isUserCondition(error.status) ? 'ok' : 'upstream_universalis';
  }
  if (error instanceof PresetAPIError) {
    return isUserCondition(error.statusCode) ? 'ok' : 'upstream_presets';
  }
  if (options.imageInput && isImageInputError(error)) return 'image_input';
  return error instanceof Error ? fallback : 'unknown';
}

function isUserCondition(status: number | undefined): boolean {
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
}

/** Discord client locale → one of the six supported codes, else 'other'. */
export function bucketLocale(locale: string | undefined): string {
  return (locale && discordLocaleToLocaleCode(locale)) || 'other';
}

/**
 * The subcommand name when the first option is a subcommand. A subcommand
 * GROUP (`/preset favorite add`, `/preferences filters …`) is recorded as
 * `<group>_<sub>` so it isn't flattened to `''`. Discord always types its
 * options, so a plain option (a value) is never mistaken for a subcommand.
 */
export function subcommandOf(interaction: DiscordInteraction): string {
  const first = interaction.data?.options?.[0];
  if (!first) return '';
  if (first.type === OptionType.SUB_COMMAND_GROUP) {
    return `${first.name}_${first.options?.[0]?.name ?? ''}`;
  }
  return first.type === OptionType.SUB_COMMAND ? first.name : '';
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

/** Tracked button kinds only; moderation/preview buttons and unknown ids return null. */
export function buttonKindOf(customId: string): CopyButtonKind | null {
  return COPY_BUTTON_KINDS.find((kind) => customId.startsWith(`${kind}_`)) ?? null;
}
