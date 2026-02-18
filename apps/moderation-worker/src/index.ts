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
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { Env } from './types/env.js';
import { InteractionType, InteractionResponseType } from './types/env.js';
import { verifyDiscordRequest, unauthorizedResponse, badRequestResponse } from './utils/verify.js';
import { pongResponse, ephemeralResponse, rateLimitedResponse } from './utils/response.js';
import { safeParseJSON } from './utils/safe-json.js';
import {
  checkRateLimit,
  incrementRateLimit,
  RATE_LIMIT_CONFIGS,
  type RateLimitType,
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
import { createUserTranslator } from './services/bot-i18n.js';
import { requestIdMiddleware, type RequestIdVariables } from './middleware/request-id.js';
import { loggerMiddleware } from './middleware/logger.js';

// Define context variables type
type Variables = RequestIdVariables & {
  logger: ExtendedLogger;
};

// Create Hono app with environment type
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Startup validation middleware - validates security config on first request
let startupValidationDone = false;
app.use('*', (c, next) => {
  if (!startupValidationDone) {
    startupValidationDone = true;
    const validation = presetApi.validateSecurityConfig(c.env);

    if (validation.errors.length > 0) {
      console.error('❌ Security configuration errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️  Security configuration warnings:', validation.warnings);
    }
    if (validation.valid && validation.warnings.length === 0) {
      console.log('✅ Security configuration validated');
    }
  }
  return next();
});

// Request ID middleware (must be early for tracing)
app.use('*', requestIdMiddleware);

// Structured request logger (after request ID for correlation)
app.use('*', loggerMiddleware);

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

  // Handle PING (required for Discord endpoint verification)
  if (interaction.type === InteractionType.PING) {
    logger.info('Received PING, responding with PONG');
    return pongResponse();
  }

  // Handle Application Commands (slash commands)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(interaction, env, c.executionCtx, logger);
  }

  // Handle Autocomplete
  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    return handleAutocomplete(interaction, env, logger);
  }

  // Handle Message Components (buttons, select menus)
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return handleComponent(interaction, env, c.executionCtx, logger);
  }

  // Handle Modal Submissions
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return handleModal(interaction, env, c.executionCtx, logger);
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

  // Check rate limit for commands
  const rateLimitCheck = await checkRateLimit(
    env.KV,
    userId,
    'command',
    RATE_LIMIT_CONFIGS.command
  );

  if (!rateLimitCheck.allowed) {
    logger.warn('Rate limit exceeded', {
      userId,
      commandName,
      type: 'command',
      retryAfter: rateLimitCheck.retryAfter,
    });
    return rateLimitedResponse(rateLimitCheck.resetTime);
  }

  // Increment rate limit counter
  ctx.waitUntil(
    incrementRateLimit(env.KV, userId, 'command').catch((err) => {
      logger.error('Failed to increment command rate limit', err instanceof Error ? err : undefined);
    })
  );

  logger.info('Handling command', { command: commandName, userId });

  // Create translator for the user
  const t = await createUserTranslator(env.KV, userId, interaction.locale, logger);

  try {
    // Route to specific command handlers
    switch (commandName) {
      case 'preset':
        return await handlePresetCommand(interaction, env, ctx, t, logger);

      default:
        // Command not supported by this moderation bot
        return ephemeralResponse(
          `The \`/${commandName}\` command is not supported by this moderation bot.`
        );
    }
  } catch (error) {
    logger.error('Command execution failed', error instanceof Error ? error : undefined, { command: commandName });
    return ephemeralResponse('An error occurred while processing your command.');
  }
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(
  interaction: DiscordInteraction,
  env: Env,
  logger: ExtendedLogger
): Promise<Response> {
  const commandName = interaction.data?.name;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const options = interaction.data?.options || [];

  if (!userId) {
    logger.error('Unable to identify user from autocomplete interaction', { commandName });
    return Response.json({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  }

  // Check rate limit for autocomplete (higher limit due to typing)
  const rateLimitCheck = await checkRateLimit(
    env.KV,
    userId,
    'autocomplete',
    RATE_LIMIT_CONFIGS.autocomplete
  );

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

  // Increment rate limit counter (non-blocking)
  incrementRateLimit(env.KV, userId, 'autocomplete').catch((err) => {
    logger.error('Failed to increment autocomplete rate limit', err instanceof Error ? err : undefined);
  });

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
        choices = await presetApi.searchPresetsForAutocomplete(env, query, { status: 'pending' });
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
      name: `${user.username} (discord:${user.discordId}) - ${user.presetCount} presets`,
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

    return users.map((user) => {
      const idSuffix = user.discordId
        ? `discord:${user.discordId}`
        : `xivauth:${user.xivAuthId}`;
      return {
        name: `${user.username} (${idSuffix})`,
        value: user.discordId || user.xivAuthId || '',
      };
    });
  } catch (error) {
    logger.error('Failed to get unban user autocomplete', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Handle button/select menu interactions
 */
async function handleComponent(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id;
  const componentType = interaction.data?.component_type;

  logger.info('Handling component', { customId, componentType });

  // Buttons have component_type 2
  if (componentType === 2) {
    return handleButtonInteraction(interaction, env, ctx, logger);
  }

  // Select menus and other components
  return ephemeralResponse('This component type is not yet supported.');
}

/**
 * Handle modal submissions
 */
async function handleModal(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  logger.info('Handling modal', { customId });

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
  type: number;
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

// Export the Hono app as the default export for Cloudflare Workers
export default app;
