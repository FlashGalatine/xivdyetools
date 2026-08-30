/**
 * XIV Dye Tools Moderation Bot - Cloudflare Workers Edition
 *
 * This worker handles Discord interactions for moderation commands only.
 * It's a separate bot from the main xivdyetools-discord-worker.
 *
 * Commands:
 * - /preset moderate - View pending presets, approve/reject
 * - /preset ban_user - Ban a user from Preset Palettes
 * - /preset unban_user - Unban a user from Preset Palettes
 *
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { Hono } from 'hono';
import type { Env } from './types/env.js';
import { InteractionType, InteractionResponseType } from './types/env.js';
import { verifyDiscordRequest, unauthorizedResponse, badRequestResponse } from './utils/verify.js';
import { pongResponse, ephemeralResponse, rateLimitedResponse } from './utils/response.js';
import { safeParseJSON } from './utils/safe-json.js';
import {
  checkRateLimit,
  incrementRateLimit,
  moderationRateLimitBindings,
  RATE_LIMIT_CONFIGS,
} from './middleware/rate-limit.js';
import { handlePresetCommand } from './handlers/commands/index.js';
import { handleButtonInteraction } from './handlers/buttons/index.js';
import {
  handlePresetRejectionModal,
  isPresetRejectionModal,
  handlePresetRevertModal,
  isPresetRevertModal,
  handleBanReasonModal,
  isBanReasonModal,
} from './handlers/modals/index.js';
import * as banService from './services/ban-service.js';
import * as presetApi from './services/preset-api.js';
import {
  validateEnv,
  logValidationErrors,
  PRODUCTION_ENV_ERROR_PREFIX,
} from './utils/env-validation.js';
import { createUserTranslator } from './services/bot-i18n.js';
import { requestIdMiddleware, loggerMiddleware } from '@xivdyetools/worker-kit';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { MiddlewareVariables } from '@xivdyetools/worker-kit';
import { sanitizeEmbedText } from '@xivdyetools/bot-logic';
import { sanitizeUrl } from './utils/url-sanitizer.js';

// Define context variables type
type Variables = MiddlewareVariables;

// Create Hono app with environment type
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// REFACTOR-001: Shared middleware from @xivdyetools/worker-middleware
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-moderation-worker',
  readEnvironmentFromEnv: false,
  sanitizePath: sanitizeUrl,
}));

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Cache-Control', 'no-store');
  c.header('Content-Security-Policy', "default-src 'none'");
  c.header('Referrer-Policy', 'no-referrer');
});

// Environment validation middleware.
// REFACTOR-001: Added full env validation alongside existing security config check.
// The env is re-validated on EVERY request; only the reporting is once per
// isolate (see FINDING-013 below — a misconfigured worker must not be able to
// serve one 500 and then quietly process the rest of the isolate's traffic).
//
// Registered AFTER requestIdMiddleware / loggerMiddleware / the security
// headers middleware (2026-08-29 audit follow-up): those three are `await
// next()`-then-decorate middleware, so whichever response the REST of the
// chain produces — including this gate's own early 500 — still passes back
// through them and picks up a request id and the hardened headers. Before
// this reorder the gate ran first and returned before any of the three ran,
// so its 500 carried neither (env-validation-gate.test.ts's `nosniff` /
// `X-Request-Id` assertions pin this).
let startupValidationDone = false;
app.use('*', async (c, next) => {
  // REFACTOR-001: Full environment variable validation
  const envResult = validateEnv(c.env);

  if (!startupValidationDone) {
    startupValidationDone = true;

    if (!envResult.valid) {
      logValidationErrors(envResult.errors);
    }

    // Existing: security config validation (signing secrets, API connectivity)
    const validation = presetApi.validateSecurityConfig(c.env);

    if (validation.errors.length > 0) {
      console.error('❌ Security configuration errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️  Security configuration warnings:', validation.warnings);
    }
    if (validation.valid && envResult.valid && validation.warnings.length === 0) {
      console.log('✅ Security configuration validated');
    }
  }

  // FINDING-013 (2026-08-29 audit): the production-only errors are fatal —
  // every request is refused, `/health` included, for as long as one stands.
  // They can only be raised when `ENVIRONMENT === 'production'` (the two
  // `RL_*` rate-limit bindings), so this match cannot touch the dev worker or
  // the tests, and it deliberately does NOT cover the pre-existing non-fatal
  // errors (a malformed MODERATOR_IDS, a short BOT_SIGNING_SECRET), which
  // stay logged-and-served exactly as before. Logging alone is not a signal
  // here: Workers Logs are off on this script, so `logValidationErrors` above
  // reaches nobody, and a production bot that lost a binding would go on
  // serving with per-user limiting silently degraded to the KV fallback. A
  // moderation bot that answers errors is noticed in minutes; the same
  // fail-closed treatment presets-api 2.2.0, oauth 3.0.0 and discord-worker
  // 5.1.0 took under this finding.
  if (envResult.errors.some((e) => e.startsWith(PRODUCTION_ENV_ERROR_PREFIX))) {
    return c.json({ error: 'Service misconfigured' }, 500);
  }

  return next();
});

/**
 * Health check endpoint
 * Returns minimal information to prevent service fingerprinting
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

/**
 * Main Discord interactions endpoint
 *
 * All Discord interactions (slash commands, buttons, etc.) are sent here as POST requests.
 * We must:
 * 1. Verify the request signature (Ed25519)
 * 2. Handle PING requests with PONG (required for endpoint validation)
 * 3. Route to appropriate command handlers
 */
app.post('/', async (c) => {
  const env = c.env;

  // Verify the request signature
  const { isValid, body, error } = await verifyDiscordRequest(
    c.req.raw,
    env.DISCORD_PUBLIC_KEY
  );

  const logger = c.get('logger');

  if (!isValid) {
    logger.error('Signature verification failed', undefined, { error: error || 'Unknown error' });
    return unauthorizedResponse(error);
  }

  // Parse the interaction with safety checks
  const parseResult = safeParseJSON<DiscordInteraction>(body, {
    maxDepth: 10, // Discord interactions are shallow
    validateStructure: true,
    freezeResult: true,
  });

  if (!parseResult.success) {
    logger.warn('JSON parse failed', { error: parseResult.error });
    return badRequestResponse(parseResult.error || 'Invalid JSON body');
  }

  if (parseResult.warnings && parseResult.warnings.length > 0) {
    logger.info('JSON parse warnings', { warnings: parseResult.warnings });
  }

  const interaction = parseResult.data!

  const interactionType = interaction.type;

  // Handle PING (required for Discord endpoint verification)
  if (interactionType === InteractionType.PING) {
    logger.info('Received PING, responding with PONG');
    return pongResponse();
  }

  // Hono types c.executionCtx with its own ExecutionContext interface, which lacks the
  // `tracing` field added in @cloudflare/workers-types 4.20260621. The runtime value is the
  // full Workers ExecutionContext, so assert it for the handler signatures below.
  // Handle Application Commands (slash commands)
  if (interactionType === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(interaction, env, c.executionCtx as ExecutionContext, logger);
  }

  // Handle Autocomplete
  if (interactionType === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    return handleAutocomplete(interaction, env, c.executionCtx as ExecutionContext, logger);
  }

  // Handle Message Components (buttons, select menus)
  if (interactionType === InteractionType.MESSAGE_COMPONENT) {
    return handleComponent(interaction, env, c.executionCtx as ExecutionContext, logger);
  }

  // Handle Modal Submissions
  if (interactionType === InteractionType.MODAL_SUBMIT) {
    return handleModal(interaction, env, c.executionCtx as ExecutionContext, logger);
  }

  // Unknown interaction type
  logger.warn('Unknown interaction type', { interactionType: interaction.type });
  return badRequestResponse(`Unknown interaction type: ${interaction.type}`);
});

/**
 * Handle slash commands
 */
async function handleCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const commandName = interaction.data?.name;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    logger.error('Unable to identify user from interaction', { commandName });
    return ephemeralResponse('Unable to identify user. Please try again.');
  }

  // Check rate limit for commands (FINDING-003: native bindings when bound, KV fallback)
  const limited = await enforceCommandRateLimit(env, ctx, userId, logger, { commandName });
  if (limited) return limited;

  logger.info('Handling command', { command: commandName, userId });

  // Create translator for the user
  const t = await createUserTranslator(env.KV, userId, interaction.locale, logger);

  try {
    // Route to specific command handlers
    switch (commandName) {
      case 'preset':
        return await handlePresetCommand(interaction, env, ctx, t, logger);

      default:
        // Command not supported by this moderation bot (FINDING-019: the name
        // is client-supplied text echoed into `content`)
        return ephemeralResponse(
          `The \`/${sanitizeEmbedText(commandName ?? 'unknown', 32)}\` command is not supported by this moderation bot.`
        );
    }
  } catch (error) {
    logger.error('Command execution failed', error instanceof Error ? error : undefined, { command: commandName });
    return ephemeralResponse('An error occurred while processing your command.');
  }
}

/**
 * FINDING-012 (2026-08-29 security audit): `CloudflareRateLimiter` allows the
 * request when the native binding errors — an accepted trade-off, on the
 * condition that fail-open events are visible. They were not: the limiter is a
 * per-isolate singleton (middleware/rate-limit.ts) built without a logger, so a
 * broken `RL_COMMAND` / `RL_AUTOCOMPLETE` binding silently disabled per-user
 * limiting. `checkRateLimit` now surfaces `backendError` and both call sites
 * log it here, once per request, on the request's own logger. Nothing but the
 * interaction type goes in the context, and nothing goes back to the client:
 * a header would tell an abuser exactly when the limiter is off.
 */
const RATE_LIMIT_FAIL_OPEN_WARNING = 'Rate limiter backend error — request allowed (fail-open)';

/**
 * Per-user `command` rate limit (FINDING-003: native bindings when bound, KV
 * fallback). MOD-12 (FINDING-034, 2026-08-21 audit): button clicks and modal
 * submits now share it with slash commands — they were the only interaction
 * types with no throttle at all.
 *
 * @returns the rate-limited reply to send, or null when the request may proceed
 */
async function enforceCommandRateLimit(
  env: Env,
  ctx: ExecutionContext,
  userId: string,
  logger: ExtendedLogger,
  context: Record<string, unknown>
): Promise<Response | null> {
  const rateLimitCheck = await checkRateLimit(
    env.KV,
    userId,
    'command',
    RATE_LIMIT_CONFIGS.command,
    moderationRateLimitBindings(env)
  );

  // FINDING-012: the limiter failed open — say so (see the constant above)
  if (rateLimitCheck.backendError) {
    logger.warn(RATE_LIMIT_FAIL_OPEN_WARNING, { type: 'command' });
  }

  if (!rateLimitCheck.allowed) {
    logger.warn('Rate limit exceeded', {
      userId,
      ...context,
      type: 'command',
      retryAfter: rateLimitCheck.retryAfter,
    });
    return rateLimitedResponse(rateLimitCheck.resetTime);
  }

  // Increment rate limit counter (kept alive past the response)
  ctx.waitUntil(
    incrementRateLimit(env.KV, userId, 'command', 3, moderationRateLimitBindings(env)).catch((err) => {
      logger.error('Failed to increment command rate limit', err instanceof Error ? err : undefined);
    })
  );

  return null;
}

/**
 * Discord caps autocomplete choice names at 100 characters and rejects the
 * whole response otherwise — one long author name must not blank the list.
 */
function clampChoiceName(name: string): string {
  const chars = [...name];
  return chars.length <= 100 ? name : `${chars.slice(0, 99).join('')}\u2026`;
}

/**
 * Handle autocomplete interactions
 *
 * Exported for tests (the interactions route is Ed25519-signed).
 */
export async function handleAutocomplete(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const commandName = interaction.data?.name;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const options = interaction.data?.options || [];

  const noChoices = (): Response =>
    Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });

  if (!userId) {
    logger.error('Unable to identify user from autocomplete interaction', { commandName });
    return noChoices();
  }

  // FINDING-006 (2026-08-21 security audit): every command, button and modal
  // enforces the MODERATOR_IDS allowlist — autocomplete must too. The
  // ban_user / unban_user branches query production D1 directly and would
  // otherwise hand the banned-user list and author name → Discord-ID pairs to
  // anyone who can see the command. Non-moderators get an empty list, silently.
  if (!presetApi.isModerator(env, userId)) {
    logger.warn('Autocomplete from non-moderator ignored', { userId, commandName });
    return noChoices();
  }

  // Check rate limit for autocomplete (higher limit due to typing)
  const rateLimitCheck = await checkRateLimit(
    env.KV,
    userId,
    'autocomplete',
    RATE_LIMIT_CONFIGS.autocomplete,
    moderationRateLimitBindings(env)
  );

  // FINDING-012: the limiter failed open — say so (see the constant above)
  if (rateLimitCheck.backendError) {
    logger.warn(RATE_LIMIT_FAIL_OPEN_WARNING, { type: 'autocomplete' });
  }

  if (!rateLimitCheck.allowed) {
    logger.warn('Autocomplete rate limit exceeded', {
      userId,
      commandName,
      type: 'autocomplete',
    });
    // Return empty choices for autocomplete rate limiting
    return Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  // Increment rate limit counter (non-blocking, but kept alive past the
  // response — MOD-3: a fire-and-forget promise could be cancelled with the
  // isolate, silently dropping the increment)
  ctx.waitUntil(
    incrementRateLimit(env.KV, userId, 'autocomplete', 3, moderationRateLimitBindings(env)).catch(
      (err) => {
        logger.error(
          'Failed to increment autocomplete rate limit',
          err instanceof Error ? err : undefined
        );
      }
    )
  );

  // Find the focused option (the one the user is currently typing in)
  let focusedOption: { name: string; value?: string | number | boolean; focused?: boolean } | undefined;
  let subcommandName: string | undefined;

  // Check top-level options first
  focusedOption = options.find((opt) => opt.focused);

  // If not found, check nested options (for subcommands)
  if (!focusedOption) {
    for (const opt of options) {
      if (opt.options) {
        subcommandName = opt.name;
        focusedOption = opt.options.find((subOpt) => subOpt.focused);
        if (focusedOption) break;
      }
    }
  }

  const query = (focusedOption?.value as string) || '';
  let choices: Array<{ name: string; value: string }> = [];

  // Handle preset command autocomplete
  if (commandName === 'preset') {
    const focusedName = focusedOption?.name;

    // Preset name autocomplete for moderate subcommand
    if (focusedName === 'preset_id') {
      if (subcommandName === 'moderate') {
        // MOD-13 (FINDING-034): presets-api 403s `status=pending` without a
        // moderator identity — this list was always empty before
        choices = await presetApi.searchPresetsForAutocomplete(env, query, {
          status: 'pending',
          userDiscordId: userId,
        });
      }
    }
    // User autocomplete for ban_user/unban_user subcommands
    else if (focusedName === 'user') {
      if (subcommandName === 'ban_user') {
        choices = await getBanUserAutocompleteChoices(env, query, logger);
      } else if (subcommandName === 'unban_user') {
        choices = await getUnbanUserAutocompleteChoices(env, query, logger);
      }
    }
  }

  return Response.json({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices },
  });
}

/**
 * Get users for ban_user autocomplete (search preset authors)
 */
async function getBanUserAutocompleteChoices(
  env: Env,
  query: string,
  logger: ExtendedLogger
): Promise<Array<{ name: string; value: string }>> {
  try {
    const users = await banService.searchPresetAuthors(env.DB, query);

    return users.map((user) => ({
      // Format: "Username (discord:123456789) - 5 presets"
      name: clampChoiceName(
        `${user.username} (discord:${user.discordId}) - ${user.presetCount} presets`
      ),
      value: user.discordId,
    }));
  } catch (error) {
    logger.error('Failed to get ban user autocomplete', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Get banned users for unban_user autocomplete
 */
async function getUnbanUserAutocompleteChoices(
  env: Env,
  query: string,
  logger: ExtendedLogger
): Promise<Array<{ name: string; value: string }>> {
  try {
    const users = await banService.searchBannedUsers(env.DB, query);

    // MOD-14 (FINDING-034, 2026-08-21 audit): unbanUser / getActiveBan key on
    // discord_id, so an xivauth-only ban cannot be lifted from this bot — do
    // not offer a value the command would then reject.
    return users
      .filter((user): user is typeof user & { discordId: string } => Boolean(user.discordId))
      .map((user) => ({
        name: clampChoiceName(`${user.username} (discord:${user.discordId})`),
        value: user.discordId,
      }));
  } catch (error) {
    logger.error('Failed to get unban user autocomplete', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Handle button/select menu interactions
 *
 * Exported for tests (the interactions route is Ed25519-signed).
 */
export async function handleComponent(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id;
  const componentType = interaction.data?.component_type;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  logger.info('Handling component', { customId, componentType });

  if (!userId) {
    logger.error('Unable to identify user from component interaction', { customId });
    return ephemeralResponse('Unable to identify user. Please try again.');
  }

  // MOD-12 (FINDING-034): same per-user limiter as slash commands
  const limited = await enforceCommandRateLimit(env, ctx, userId, logger, { customId });
  if (limited) return limited;

  // Buttons have component_type 2
  if (componentType === 2) {
    return handleButtonInteraction(interaction, env, ctx, logger);
  }

  // Select menus and other components
  return ephemeralResponse('This component type is not yet supported.');
}

/**
 * Handle modal submissions
 *
 * Exported for tests (the interactions route is Ed25519-signed).
 */
export async function handleModal(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  logger.info('Handling modal', { customId });

  if (!userId) {
    logger.error('Unable to identify user from modal interaction', { customId });
    return ephemeralResponse('Unable to identify user. Please try again.');
  }

  // MOD-12 (FINDING-034): same per-user limiter as slash commands
  const limited = await enforceCommandRateLimit(env, ctx, userId, logger, { customId });
  if (limited) return limited;

  // Route preset rejection modal
  if (isPresetRejectionModal(customId)) {
    return handlePresetRejectionModal(interaction, env, ctx, logger);
  }

  // Route preset revert modal
  if (isPresetRevertModal(customId)) {
    return handlePresetRevertModal(interaction, env, ctx, logger);
  }

  // Route ban reason modal
  if (isBanReasonModal(customId)) {
    return handleBanReasonModal(interaction, env, ctx, logger);
  }

  // Unknown modal
  return ephemeralResponse('Unknown modal submission.');
}

/**
 * Discord Interaction type (simplified)
 */
interface DiscordInteraction {
  id: string;
  type: InteractionType;
  application_id: string;
  token: string;
  locale?: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
    };
  };
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  data?: {
    id: string;
    name: string;
    type?: number;
    options?: Array<{
      name: string;
      type: number;
      value?: string | number | boolean;
      focused?: boolean;
      options?: Array<{
        name: string;
        type: number;
        value?: string | number | boolean;
        focused?: boolean;
      }>;
    }>;
    custom_id?: string;
    component_type?: number;
    values?: string[];
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        custom_id: string;
        value: string;
      }>;
    }>;
  };
  message?: {
    id: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text?: string };
      timestamp?: string;
    }>;
  };
}

// SEC-001: Global error handler — prevents stack trace leakage in production.
// Without this, Hono's default error response may include internal file paths and
// stack traces that aid attackers in crafting targeted exploits.
app.onError((err, c) => {
  const isDev = c.env.ENVIRONMENT === 'development';
  const logger = c.get('logger');
  if (logger) {
    logger.error('Unhandled error', err instanceof Error ? err : undefined);
  } else {
    console.error('Unhandled error:', isDev ? err.stack : err.message);
  }
  return c.json(
    {
      error: 'Internal Server Error',
      ...(isDev && { message: err.message, stack: err.stack }),
    },
    500
  );
});

// Export the Hono app as the default export for Cloudflare Workers
export default app;
