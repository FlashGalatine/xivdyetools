/**
 * XIV Dye Tools Discord Bot - Cloudflare Workers Edition
 *
 * This worker handles Discord interactions via HTTP instead of the Gateway WebSocket.
 * Discord sends POST requests to this endpoint for all slash commands, buttons, etc.
 *
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { Env, DiscordInteraction } from './types/env.js';
import { InteractionType, InteractionResponseType } from './types/env.js';
import {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  timingSafeEqual,
} from '@xivdyetools/auth';
import { pongResponse, ephemeralResponse } from './utils/response.js';
import { BRAND_ACCENT } from './utils/brand.js';
import {
  handleAboutCommand,
  handleHarmonyCommand,
  handleDyeCommand,
  // V4 Commands
  handleExtractorCommand,
  handleGradientCommand,
  handlePreferencesCommand,
  handleMixerV4Command,
  handleSwatchCommand,
  handleAccessibilityCommand,
  handleContrastCommand,
  handleManualCommand,
  handleComparisonCommand,
  handlePresetCommand,
  handleStatsCommand,
  handleBudgetCommand,
  handleBudgetAutocomplete,
  handleChangelogCommand,
} from './handlers/commands/index.js';
import {
  checkRateLimit,
  formatRateLimitMessage,
  resolveRateLimitScope,
} from './services/rate-limiter.js';
import { trackCommandWithKV } from './services/analytics.js';
import {
  getPresetFavoriteEntries,
  savePresetFavoriteEntries,
} from './services/preset-favorites.js';
import { handleButtonInteraction } from './handlers/buttons/index.js';
import { dyeService, searchDyesByName, type LocaleCode } from '@xivdyetools/bot-logic';
import * as presetApi from './services/preset-api.js';
import { sendMessage, sendFollowUp } from './utils/discord-api.js';
import { STATUS_DISPLAY, type PresetNotificationPayload } from './types/preset.js';
import {
  getLocalizedDyeName,
  discordLocaleToLocaleCode,
  resolveUserLocale,
  initializeLocale,
} from './services/i18n.js';
import { createTranslator, createUserTranslator, type Translator } from './services/bot-i18n.js';
import { sendModerationNotification } from './handlers/commands/preset-notifications.js';
import { validateEnv, logValidationErrors } from './utils/env-validation.js';
import { requestIdMiddleware, loggerMiddleware } from '@xivdyetools/worker-kit';
import type { MiddlewareVariables } from '@xivdyetools/worker-kit';
import { sanitizePresetName, sanitizePresetDescription } from './utils/sanitize.js';
import { CLANS_BY_RACE } from './types/preferences.js';
import { getWorldAutocomplete } from './services/budget/index.js';

/**
 * Upper bound for a GitHub push payload on `/webhooks/github` (BUG-005:
 * bounded buffering before the HMAC check). GitHub's push event carries the
 * full `repository` object plus up to 2048 commits, so real payloads are far
 * larger than the 10 KB the internal preset-submission webhook uses — a
 * two-commit merge push measured 18,196 bytes on 2026-08-29 and was refused
 * with 413 for as long as this shared the 10 KB cap. 1 MiB keeps the guard
 * meaningful while leaving room for a release merge.
 */
const GITHUB_WEBHOOK_MAX_BYTES = 1_048_576;

type PushCommit = import('./types/github.js').GitHubCommit;

function formatDyesForEmbed(dyeIds: number[]): string {
  return dyeIds
    .map((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      if (!dye) return dyeId.toString();
      return getLocalizedDyeName(dye.itemID, dye.name);
    })
    .join(', ');
}

// Define context variables type
type Variables = MiddlewareVariables;

// Create Hono app with environment type
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// BUG-017 (2026-07-18 audit): validation runs on every request (it's cheap
// string checks) so the critical-secret check applies to every request. Only
// the error logging is once-per-isolate.
let envErrorsLogged = false;

// FINDING-004: Restrict CORS to known web app origins instead of wildcard.
// Discord interactions and webhooks are server-to-server; only /health is browser-hit.
//
// allowMethods is pinned rather than left to hono's default: 4.13.0 added QUERY
// to that default, so preflights began advertising a verb this Worker has no
// route for. The live surface is GET /health plus three POSTs (/, /webhooks/*).
// Matches the explicit pinning in api-worker, oauth and presets-api.
app.use(
  '*',
  cors({
    origin: ['https://xivdyetools.app', 'https://www.xivdyetools.app'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

// REFACTOR-001: Shared middleware from @xivdyetools/worker-middleware
app.use('*', requestIdMiddleware());
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-discord-worker',
    readEnvironmentFromEnv: false,
  }),
);

// Environment validation middleware
// Validates required env vars once per isolate and caches result
// Note: Discord worker doesn't have an ENVIRONMENT var, so validation always logs warnings
app.use('*', async (c, next) => {
  const result = validateEnv(c.env);
  if (!result.valid) {
    if (!envErrorsLogged) {
      envErrorsLogged = true;
      logValidationErrors(result.errors);
    }
    // Discord worker should still try to handle requests even with missing optional vars
    // Only fail hard if critical secrets (DISCORD_TOKEN, DISCORD_PUBLIC_KEY) are missing.
    // BUG-017 (2026-07-18 audit): checked on every request, not just the first
    // one in the isolate, so a misconfigured worker can't serve one 500 and
    // then silently process later traffic.
    if (
      result.errors.some((e) => e.includes('DISCORD_TOKEN') || e.includes('DISCORD_PUBLIC_KEY'))
    ) {
      return c.json({ error: 'Service misconfigured' }, 500);
    }
  }
  return next();
});

// Security headers middleware
// Applies to all responses (after handler execution)
app.use('*', async (c, next) => {
  await next();
  // Prevent MIME-type sniffing attacks
  c.header('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking by denying iframe embedding
  c.header('X-Frame-Options', 'DENY');
  // Enforce HTTPS (Discord bots always use HTTPS endpoints)
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'xivdyetools-discord-worker',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Webhook endpoint for preset submissions from web app
 *
 * Receives notifications when presets are submitted via the web app.
 * Posts to moderation channel (if pending) and submission log channel.
 *
 * @see PresetNotificationPayload for expected body format
 */
app.post('/webhooks/preset-submission', async (c) => {
  const env = c.env;

  // Verify webhook secret using constant-time comparison to prevent timing attacks
  const authHeader = c.req.header('Authorization') || '';
  const expectedAuth = `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`;
  const logger = c.get('logger');

  // DISCORD-CRITICAL-003: Separate checks to prevent timing oracle attack
  // Check if secret is configured first (this is a configuration error, not an auth attempt)
  if (!env.INTERNAL_WEBHOOK_SECRET) {
    logger.error('Webhook secret not configured');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Always use timing-safe comparison for auth verification
  if (!(await timingSafeEqual(authHeader, expectedAuth))) {
    logger.error('Webhook authentication failed');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // DISCORD-HIGH-001: Validate request body size to prevent OOM attacks
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > 10240) {
    // 10KB limit
    logger.warn('Webhook payload too large', { contentLength });
    return c.json({ error: 'Payload too large' }, 413);
  }

  // Parse payload
  let payload: PresetNotificationPayload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (payload.type !== 'submission' && payload.type !== 'preview_image') {
    return c.json({ error: 'Invalid payload' }, 400);
  }
  if (!payload.preset) {
    return c.json({ error: 'Invalid payload' }, 400);
  }

  if (payload.type === 'preview_image') {
    // The moderation channel, not the submission log: a pending image is work
    // for a moderator, and the submission log is where *published* presets are
    // announced. Posting an unapproved image there would both misfile the task
    // and show the picture to the wrong audience.
    // No moderation channel configured: nothing to post to, so this is a
    // silent no-op rather than an error.
    if (!env.MODERATION_CHANNEL_ID) {
      return c.json({ success: true });
    }
    const adminT = createTranslator('en');
    const safeName = sanitizePresetName(payload.preset.name);
    // Posted with discord-worker's own token (not MODERATION_BOT_TOKEN): the
    // approve/reject buttons below are handled by THIS app (Task 9), and
    // Discord routes component clicks to whichever application's bot posted
    // the message.
    const imageRes = await sendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
      embeds: [
        {
          title: `🖼️ ${adminT.t('webhook.previewImagePending')}`,
          description: `**${safeName}**`,
          color: STATUS_DISPLAY.pending.color,
          // Built here rather than read from the API: for a pending image the
          // API withholds preview_image_url by design, and this embed is
          // exactly where an unapproved image is meant to be seen.
          ...(payload.preview_image_key
            ? { image: { url: `https://shots.xivdyetools.app/${payload.preview_image_key}` } }
            : {}),
          footer: { text: `ID: ${payload.preset.id}` },
        },
      ],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 3, // Success (green)
              label: adminT.t('webhook.buttons.approve'),
              custom_id: `previewimg_approve_${payload.preset.id}`,
              emoji: { name: '✅' },
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              label: adminT.t('webhook.buttons.reject'),
              custom_id: `previewimg_reject_${payload.preset.id}`,
              emoji: { name: '❌' },
            },
          ],
        },
      ],
    });
    if (!imageRes.ok) {
      logger.error('Preview-image notification rejected by Discord', undefined, {
        status: imageRes.status,
      });
      // Same contract as the submission branch (BUG-074): surface the failure
      // so presets-api's retry/dead-letter machinery takes over instead of
      // silently losing a moderation-queue entry.
      return c.json({ error: 'Failed to deliver preview-image notification' }, 502);
    }
    return c.json({ success: true });
  }

  const { preset } = payload;
  logger.info('Received preset webhook', {
    presetName: preset.name,
    presetId: preset.id,
    source: preset.source,
  });

  // Pending presets go to the moderation channel via the shared sanitized
  // builder (REFACTOR-025/BUG-009/BUG-072); Discord outcome checked (BUG-074)
  if (preset.status === 'pending' && env.MODERATION_CHANNEL_ID) {
    const adminT = createTranslator('en');
    const sent = await sendModerationNotification(
      env,
      {
        kind: 'new',
        preset,
        extraFields: [
          {
            name: adminT.t('webhook.fields.source'),
            value:
              preset.source === 'web'
                ? adminT.t('webhook.sources.web')
                : adminT.t('webhook.sources.discord'),
            inline: true,
          },
          {
            name: adminT.t('webhook.fields.dyes'),
            value: formatDyesForEmbed(preset.dyes),
            inline: false,
          },
          ...(preset.tags.length > 0
            ? [
                {
                  name: adminT.t('webhook.fields.tags'),
                  // FINDING-019: tags are user content too
                  value: preset.tags.map((tag) => sanitizePresetName(tag)).join(', '),
                  inline: false,
                },
              ]
            : []),
        ],
      },
      logger,
    );
    if (!sent) {
      // BUG-074: surface the failure so presets-api's retry/dead-letter
      // machinery can take over instead of silently losing the notification
      return c.json({ error: 'Failed to deliver moderation notification' }, 502);
    }
  }

  // Auto-approved presets go directly to submission log channel
  if (preset.status === 'approved' && env.SUBMISSION_LOG_CHANNEL_ID) {
    // SECURITY: Sanitize user-provided content before display
    // FINDING-019 (2026-08-21 audit): author name and tags included — they
    // were the two user-sourced strings this embed still carried raw
    const safeName = sanitizePresetName(preset.name);
    const safeDescription = sanitizePresetDescription(preset.description);
    const safeAuthor = sanitizePresetName(preset.author_name || 'Unknown');
    const safeTags = preset.tags.map((tag) => sanitizePresetName(tag));
    // Use English translator for admin notifications (no user context)
    const adminT = createTranslator('en');
    const logRes = await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: `🟢 ${adminT.t('webhook.newPresetPublished')}`,
          description: `**${safeName}**\n\n${safeDescription}`,
          color: STATUS_DISPLAY.approved.color,
          fields: [
            { name: adminT.t('webhook.fields.category'), value: preset.category_id, inline: true },
            {
              name: adminT.t('webhook.fields.author'),
              value: safeAuthor,
              inline: true,
            },
            {
              name: adminT.t('webhook.fields.source'),
              value:
                preset.source === 'web'
                  ? adminT.t('webhook.sources.web')
                  : adminT.t('webhook.sources.discord'),
              inline: true,
            },
            {
              name: adminT.t('webhook.fields.dyes'),
              value: formatDyesForEmbed(preset.dyes),
              inline: false,
            },
            ...(safeTags.length > 0
              ? [
                  {
                    name: adminT.t('webhook.fields.tags'),
                    value: safeTags.join(', '),
                    inline: false,
                  },
                ]
              : []),
          ],
          footer: { text: `ID: ${preset.id} • ${adminT.t('webhook.autoApproved')}` },
          timestamp: preset.created_at,
        },
      ],
    });
    if (!logRes.ok) {
      // BUG-074: log-only (the submission log is informational) but no longer silent
      logger.error('Submission-log notification rejected by Discord', undefined, {
        status: logRes.status,
        body: await logRes.text().catch(() => ''),
      });
    }
  }

  return c.json({ success: true });
});

/**
 * Webhook endpoint for GitHub push events
 *
 * Listens for pushes to main that modify CHANGELOG-laymans.md,
 * parses the latest version, and posts a Discord announcement embed.
 *
 * @see Phase 7 of v4.0.0 migration plan
 */
app.post('/webhooks/github', async (c) => {
  const env = c.env;
  const logger = c.get('logger');

  // Ensure webhook secret is configured
  if (!env.GITHUB_WEBHOOK_SECRET) {
    logger.error('GitHub webhook secret not configured');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!env.ANNOUNCEMENT_CHANNEL_ID) {
    logger.error('Announcement channel ID not configured');
    return c.json({ error: 'Not configured' }, 500);
  }

  // BUG-005: Check Content-Length before reading body to avoid buffering oversized payloads
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > GITHUB_WEBHOOK_MAX_BYTES) {
    logger.warn('GitHub webhook payload too large', { contentLength });
    return c.json({ error: 'Payload too large' }, 413);
  }

  // Read raw body for signature verification
  const rawBody = await c.req.text();

  // Defense-in-depth: verify actual body size (Content-Length can be missing or spoofed)
  if (rawBody.length > GITHUB_WEBHOOK_MAX_BYTES) {
    logger.warn('GitHub webhook body exceeds limit despite Content-Length', {
      size: rawBody.length,
    });
    return c.json({ error: 'Payload too large' }, 413);
  }

  // Verify GitHub signature (HMAC-SHA256)
  const signature = c.req.header('X-Hub-Signature-256') || '';
  const { verifyGitHubSignature } = await import('./utils/github-verify.js');

  if (!(await verifyGitHubSignature(env.GITHUB_WEBHOOK_SECRET, rawBody, signature))) {
    logger.error('GitHub webhook signature verification failed');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Parse payload
  let payload: import('./types/github.js').GitHubPushPayload;
  try {
    payload = JSON.parse(rawBody) as import('./types/github.js').GitHubPushPayload;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Only process pushes to main branch
  if (payload.ref !== 'refs/heads/main') {
    return c.json({ success: true, message: 'Not main branch, skipping' });
  }

  // Check if any commit modified CHANGELOG-laymans.md. `head_commit` is checked
  // as well: GitHub truncates `commits` on very large pushes (a release merge
  // can carry hundreds of commits), but the head commit — for a merge, the
  // merge commit with its first-parent file list — is always present.
  const touchesChangelog = (commit: PushCommit | null): boolean =>
    commit !== null &&
    (commit.added.includes('CHANGELOG-laymans.md') ||
      commit.modified.includes('CHANGELOG-laymans.md'));
  const changelogModified =
    payload.commits.some(touchesChangelog) || touchesChangelog(payload.head_commit);

  if (!changelogModified) {
    return c.json({ success: true, message: 'Changelog not modified, skipping' });
  }

  logger.info('Changelog update detected, fetching latest version', {
    repo: payload.repository.full_name,
  });

  // Fetch the raw changelog from GitHub
  const changelogUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/main/CHANGELOG-laymans.md`;
  // BUG-074: bounded — a hung GitHub response must not hold the request open
  const changelogResponse = await fetch(changelogUrl, { signal: AbortSignal.timeout(10_000) });

  if (!changelogResponse.ok) {
    logger.error('Failed to fetch changelog', { status: changelogResponse.status });
    return c.json({ error: 'Failed to fetch changelog' }, 502);
  }

  const changelogContent = await changelogResponse.text();

  // Parse the latest version
  const { parseLatestVersion } = await import('./services/changelog-parser.js');
  const latestEntry = parseLatestVersion(changelogContent);

  if (!latestEntry) {
    logger.warn('No version entry found in changelog');
    return c.json({ success: true, message: 'No version entry found' });
  }

  // Send announcement to Discord
  const { sendAnnouncement } = await import('./services/announcements.js');
  await sendAnnouncement(
    env.DISCORD_TOKEN,
    env.ANNOUNCEMENT_CHANNEL_ID,
    latestEntry,
    payload.repository.html_url,
  );

  logger.info('Changelog announcement sent', { version: latestEntry.version });
  return c.json({ success: true, version: latestEntry.version });
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
  const { isValid, body, error } = await verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY);

  const logger = c.get('logger');

  if (!isValid) {
    logger.error('Signature verification failed', undefined, { error: error || 'Unknown error' });
    return unauthorizedResponse(error);
  }

  // Parse the interaction
  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

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
    return handleAutocomplete(interaction, env, logger);
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
 * 5.0 first-run notice: one ephemeral follow-up naming what changed, gated
 * by a permanent KV flag. Existing users (stored preferences) are flagged
 * silently — the redesign notice is for people meeting the bot fresh.
 */
async function maybeSendFirstRunNotice(
  env: Env,
  interaction: DiscordInteraction,
  userId: string,
  logger: ExtendedLogger,
): Promise<void> {
  const flagKey = `firstrun:v5:${userId}`;
  const seen = await env.KV.get(flagKey);
  if (seen) return;
  // Flag before sending — a failed send must never become a repeat notice
  await env.KV.put(flagKey, '1');

  const prefs = await env.KV.get(`prefs:v1:${userId}`);
  if (prefs) return; // existing user — suppressed by decision

  const t = createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');
  const response = await sendFollowUp(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [
      {
        title: t.t('firstRun.title'),
        description: t.t('firstRun.body'),
        color: BRAND_ACCENT,
      },
    ],
    ephemeral: true,
  });
  if (!response.ok) {
    logger.warn('First-run follow-up rejected', { status: response.status });
  }
}

/**
 * Handle slash commands
 */
async function handleCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger: ExtendedLogger,
): Promise<Response> {
  const commandName = interaction.data?.name;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  // DISCORD-HIGH-003: Guard against missing userId to prevent rate limit bypass
  if (!userId) {
    logger.error('Unable to identify user from interaction', { commandName });
    return ephemeralResponse(
      (await routerTranslator(env, interaction, logger)).t('errors.unknownUser'),
    );
  }

  logger.info('Handling command', { command: commandName, userId });

  // Check rate limit (skip for utility commands). Aliases (/a11y) share the
  // canonical command's bucket; /extractor tiers its image subcommand
  // separately (Photon path, 5/min) from the plain color lookup.
  // FINDING-033 (2026-08-21 audit): /stats is NOT exempt — its public summary
  // runs paginated KV list() scans, so it takes the default per-user tier.
  if (commandName && !['about', 'manual', 'changelog'].includes(commandName)) {
    const scope = resolveRateLimitScope(commandName, interaction.data?.options?.[0]?.name);
    const rateLimitResult = await checkRateLimit(
      {
        upstashUrl: env.UPSTASH_REDIS_REST_URL,
        upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
        kv: env.KV, // fallback if Upstash not configured
      },
      userId,
      scope.command,
      undefined,
      scope.subcommand,
    );
    if (!rateLimitResult.allowed) {
      logger.info('User rate limited', { userId, command: commandName });
      const t = await createUserTranslator(env.KV, userId, interaction.locale, logger);
      return ephemeralResponse(formatRateLimitMessage(rateLimitResult, t));
    }
  }

  // 5.0 first-run: a one-time ephemeral follow-up naming what changed.
  // KV-flagged; suppressed (but still flagged) when the user already has
  // stored preferences — an existing user is not "first-run".
  ctx.waitUntil(
    maybeSendFirstRunNotice(env, interaction, userId, logger).catch((error) => {
      logger.warn('First-run notice failed', { error: String(error) });
    }),
  );

  // DISCORD-CRITICAL-001: Track analytics AFTER command execution with actual success status
  let success = true;
  let response: Response;

  try {
    // Route to specific command handlers
    switch (commandName) {
      case 'about':
        response = await handleAboutCommand(interaction, env, ctx);
        break;

      case 'harmony':
        response = await handleHarmonyCommand(interaction, env, ctx, logger);
        break;

      case 'dye':
        response = await handleDyeCommand(interaction, env, ctx);
        break;

      // V4 Commands
      case 'extractor':
        response = await handleExtractorCommand(interaction, env, ctx, logger);
        break;

      case 'gradient':
        response = await handleGradientCommand(interaction, env, ctx, logger);
        break;

      case 'preferences':
        response = await handlePreferencesCommand(interaction, env, ctx, logger);
        break;

      case 'mixer':
        // V4: New /mixer command for dye blending (old /mixer gradient is now /gradient)
        response = await handleMixerV4Command(interaction, env, ctx, logger);
        break;

      case 'swatch':
        response = await handleSwatchCommand(interaction, env, ctx, logger);
        break;

      // v5: /match, /match_image, /favorites, /collection and /language are
      // deleted outright (register decision); /about carries a Removed-in-v5
      // field for one release and /preferences owns language.
      // /a11y is a second registration sharing this handler — Discord has no
      // alias mechanism; the chip prints the command the user actually typed
      case 'accessibility':
      case 'a11y':
        response = await handleAccessibilityCommand(interaction, env, ctx, logger);
        break;

      case 'contrast':
        response = await handleContrastCommand(interaction, env, ctx, logger);
        break;

      case 'manual':
        response = await handleManualCommand(interaction, env, ctx);
        break;

      case 'changelog':
        response = await handleChangelogCommand(interaction, env, ctx);
        break;

      case 'comparison':
        response = await handleComparisonCommand(interaction, env, ctx, logger);
        break;

      case 'preset':
        response = await handlePresetCommand(interaction, env, ctx, logger);
        break;

      case 'stats':
        response = await handleStatsCommand(interaction, env, ctx, logger);
        break;

      case 'budget':
        response = await handleBudgetCommand(interaction, env, ctx, logger);
        break;

      default:
        // Command not yet implemented
        response = ephemeralResponse(
          (await routerTranslator(env, interaction, logger)).t('errors.notImplemented', {
            command: commandName ?? '',
          }),
        );
        break;
    }
  } catch (error) {
    success = false;
    logger.error('Command execution failed', error instanceof Error ? error : undefined, {
      command: commandName,
    });
    response = ephemeralResponse(
      (await routerTranslator(env, interaction, logger)).t('errors.commandFailed'),
    );
  } finally {
    // Track command usage with actual success status (fire-and-forget).
    // 5.0 telemetry: /extractor records its subcommand (extractor_image /
    // extractor_color) so the /stats adoption panel can tell them apart.
    let trackedName = commandName;
    if (commandName === 'extractor') {
      const sub = interaction.data?.options?.[0]?.name;
      if (sub) trackedName = `extractor_${sub}`;
    }
    if (userId && trackedName) {
      ctx.waitUntil(
        trackCommandWithKV(env, {
          commandName: trackedName,
          userId,
          guildId: interaction.guild_id,
          success,
        }).catch((error) => {
          logger.error('Analytics tracking failed', error instanceof Error ? error : undefined, {
            error: String(error),
          });
        }),
      );
    }
  }

  return response;
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(
  interaction: DiscordInteraction,
  env: Env,
  logger: ExtendedLogger,
): Promise<Response> {
  const commandName = interaction.data?.name;
  const options = interaction.data?.options || [];

  // OPT-007 (2026-07-18 audit): rate-limit autocomplete (60/min + burst),
  // mirroring moderation-worker. Fail-soft — a limited user just gets no
  // suggestions, never a broken command.
  const acUserId = interaction.member?.user?.id ?? interaction.user?.id;
  if (acUserId) {
    const acLimit = await checkRateLimit(
      {
        upstashUrl: env.UPSTASH_REDIS_REST_URL,
        upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
        kv: env.KV,
      },
      acUserId,
      'autocomplete',
    );
    if (!acLimit.allowed) {
      return Response.json({
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: { choices: [] },
      });
    }
  }

  // Find the focused option (the one the user is currently typing in)
  let focusedOption:
    { name: string; value?: string | number | boolean; focused?: boolean } | undefined;
  let subcommandName: string | undefined;
  let subcommandGroupName: string | undefined;

  // Check top-level options first
  focusedOption = options.find((opt) => opt.focused);

  // If not found, check nested options (for subcommands and subcommand groups).
  // Discord nesting goes up to 3 levels: SUB_COMMAND_GROUP > SUB_COMMAND > option.
  // The Env type narrows leaf shapes to drop `options`, so we walk via a relaxed shape.
  type AnyOpt = {
    name: string;
    type?: number;
    value?: string | number | boolean;
    focused?: boolean;
    options?: AnyOpt[];
  };
  if (!focusedOption) {
    const outerOpts = options as AnyOpt[];
    outer: for (const opt of outerOpts) {
      if (!opt.options) continue;
      // Try direct sub_command match
      const direct = opt.options.find((subOpt) => subOpt.focused);
      if (direct) {
        subcommandName = opt.name;
        focusedOption = direct;
        break;
      }
      // Otherwise, this might be a sub_command_group — descend one more level
      for (const inner of opt.options) {
        if (inner.options) {
          const deep = inner.options.find((subOpt) => subOpt.focused);
          if (deep) {
            subcommandGroupName = opt.name;
            subcommandName = inner.name;
            focusedOption = deep;
            break outer;
          }
        }
      }
    }
  }

  const query = (focusedOption?.value as string) || '';
  let choices: Array<{ name: string; value: string }> = [];

  // F-02 (2026-08-20 i18n audit): dye suggestions match and display the
  // user's locale (stored preference → Discord client locale → en).
  const locale = await resolveUserLocale(env.KV, acUserId ?? '', interaction.locale);
  await initializeLocale(locale);

  // Handle preset command autocomplete
  if (commandName === 'preset') {
    const focusedName = focusedOption?.name;

    // Preset name autocomplete (for show, vote, moderate, edit, favorite subcommands)
    if (
      focusedName === 'name' ||
      focusedName === 'preset' ||
      focusedName === 'preset_id' ||
      focusedName === 'preset_name'
    ) {
      // For edit subcommand, show only user's own presets
      if (subcommandName === 'edit') {
        const userId = interaction.member?.user?.id ?? interaction.user?.id;
        if (userId) {
          choices = await getMyPresetsAutocompleteChoices(env, userId, query, logger);
        }
      }
      // For favorite remove, show only the user's currently favorited presets
      else if (subcommandGroupName === 'favorite' && subcommandName === 'remove') {
        const userId = interaction.member?.user?.id ?? interaction.user?.id;
        if (userId) {
          choices = await getFavoritedPresetsAutocompleteChoices(env, userId, query, logger);
        }
      }
      // For other subcommands (show, vote, favorite add), search approved presets
      else {
        choices = await presetApi.searchPresetsForAutocomplete(env, query, { status: 'approved' });
      }
    }
    // Dye autocomplete (for submit and edit subcommands)
    else if (focusedName?.startsWith('dye')) {
      choices = getDyeAutocompleteChoices(query, locale);
    }
  }
  // Handle budget command autocomplete (returns its own Response)
  else if (commandName === 'budget') {
    return handleBudgetAutocomplete(interaction, env, locale, logger);
  }
  // Handle preferences command autocomplete
  else if (commandName === 'preferences') {
    const focusedName = focusedOption?.name;

    if (focusedName === 'clan') {
      // Clan autocomplete - show race-grouped clan suggestions
      choices = getClanAutocompleteChoices(query);
    } else if (focusedName === 'world') {
      // World/datacenter autocomplete - reuse budget world autocomplete
      choices = await getWorldAutocomplete(env, query, logger, locale);
    }
  }
  // Default: Dye autocomplete for other commands
  else {
    choices = getDyeAutocompleteChoices(query, locale);
  }

  return Response.json({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices },
  });
}

/**
 * Get dye autocomplete choices for the given query.
 *
 * F-02 (2026-08-20 i18n audit): matches English OR the locale's dye name and
 * labels each choice with the localized name. The query may also be a bare
 * stainID or legacy item id — `searchDyesByName` resolves those to the one dye.
 *
 * 2026-08-29: the `value` is the **stainID** (it used to be the English name,
 * which Discord echoed verbatim under every locale — `name: Carmine Red`).
 * Every downstream resolver (`resolveColorInput`, `resolveDyeInput`,
 * `searchDyesByName`, `findDyeByName`) accepts a stainID, a legacy item id, or
 * a name in any supported locale, so a typed value keeps working too.
 */
function getDyeAutocompleteChoices(
  query: string,
  locale: LocaleCode = 'en',
): Array<{ name: string; value: string }> {
  // Empty query: show the first dyes in database order (excluding Facewear)
  const matchingDyes = query.length >= 1 ? searchDyesByName(query, locale) : dyeService.getAllDyes();

  // Filter out Facewear dyes and limit to 25 (Discord's maximum)
  return matchingDyes
    .filter((dye) => dye.category !== 'Facewear' && dye.stainID != null)
    .slice(0, 25)
    .map((dye) => ({
      name: `${getLocalizedDyeName(dye.itemID, dye.name, locale)} (${dye.hex.toUpperCase()})`,
      value: String(dye.stainID),
    }));
}

/**
 * Get clan autocomplete choices for the given query
 *
 * Shows clans grouped by race, filtered by query.
 * When no query, shows all clans organized by race.
 */
function getClanAutocompleteChoices(query: string): Array<{ name: string; value: string }> {
  const lowerQuery = query.toLowerCase().trim();
  const choices: Array<{ name: string; value: string }> = [];

  for (const [race, clans] of Object.entries(CLANS_BY_RACE)) {
    for (const clan of clans) {
      // Match against clan name or race name
      if (
        lowerQuery.length === 0 ||
        clan.toLowerCase().includes(lowerQuery) ||
        race.toLowerCase().includes(lowerQuery)
      ) {
        choices.push({
          name: `${clan} (${race})`,
          value: clan,
        });
      }
    }
  }

  // Limit to 25 for Discord autocomplete
  return choices.slice(0, 25);
}

/**
 * Get user's own presets for autocomplete (for edit subcommand)
 */
async function getMyPresetsAutocompleteChoices(
  env: Env,
  userId: string,
  query: string,
  logger: ExtendedLogger,
): Promise<Array<{ name: string; value: string }>> {
  try {
    const presets = await presetApi.getMyPresets(env, userId);

    if (presets.length === 0) {
      return [];
    }

    // Filter by query (case-insensitive)
    const lowerQuery = query.toLowerCase();
    const filtered =
      query.length > 0 ? presets.filter((p) => p.name.toLowerCase().includes(lowerQuery)) : presets;

    // Return up to 25 choices (Discord's maximum)
    return filtered.slice(0, 25).map((preset) => ({
      // Format: "Name (status)" to help user identify pending edits
      name: preset.status === 'approved' ? preset.name : `${preset.name} (${preset.status})`,
      value: preset.id,
    }));
  } catch (error) {
    logger.error(
      'Failed to get user presets for autocomplete',
      error instanceof Error ? error : undefined,
    );
    return [];
  }
}

/**
 * Get user's favorited presets for autocomplete (used by /preset favorite remove).
 * Returns a list of preset { name, value: id } pairs the user has favorited.
 */
async function getFavoritedPresetsAutocompleteChoices(
  env: Env,
  userId: string,
  query: string,
  logger: ExtendedLogger,
): Promise<Array<{ name: string; value: string }>> {
  try {
    const entries = await getPresetFavoriteEntries(env.KV, userId, logger);
    if (entries.length === 0) return [];

    // OPT-007 (2026-07-18 audit): names are denormalized into the favorites
    // entries, so the former per-keystroke fan-out (up to 50 service-binding
    // fetches) is gone. Legacy v1 entries without names are resolved once and
    // written back (one-time lazy migration per user).
    const missing = entries.filter((e) => !e.name);
    if (missing.length > 0) {
      const resolved = await Promise.all(
        missing.map((e) => presetApi.getPreset(env, e.id).catch(() => null)),
      );
      for (let i = 0; i < missing.length; i++) {
        missing[i].name = resolved[i]?.name ?? missing[i].id;
      }
      await savePresetFavoriteEntries(env.KV, userId, entries, logger);
    }

    const lowerQuery = query.toLowerCase();
    const filtered =
      query.length > 0 ? entries.filter((e) => e.name.toLowerCase().includes(lowerQuery)) : entries;

    return filtered.slice(0, 25).map((e) => ({ name: e.name, value: e.id }));
  } catch (error) {
    logger.error(
      'Failed to get favorited presets autocomplete',
      error instanceof Error ? error : undefined,
    );
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
  logger: ExtendedLogger,
): Promise<Response> {
  const customId = interaction.data?.custom_id;
  const componentType = interaction.data?.component_type;

  logger.info('Handling component', { customId, componentType });

  // Buttons have component_type 2
  if (componentType === 2) {
    return handleButtonInteraction(interaction, env, ctx, logger);
  }

  // Select menus and other components
  return ephemeralResponse(
    (await routerTranslator(env, interaction, logger)).t('errors.unsupportedComponent'),
  );
}

/**
 * Translator for router-level replies (2026-08-20 i18n audit, F-05): the
 * user's stored preference when a user id is present, else the Discord
 * client locale, else English. Only built on the rare paths that need it.
 */
async function routerTranslator(
  env: Env,
  interaction: DiscordInteraction,
  logger: ExtendedLogger,
): Promise<Translator> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  if (userId) return createUserTranslator(env.KV, userId, interaction.locale, logger);
  return createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');
}

/**
 * Handle modal submissions
 */
async function handleModal(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext,
  logger: ExtendedLogger,
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  logger.info('Handling modal', { customId });

  // No modals are currently supported in the main worker
  // Moderation modals are handled by xivdyetools-moderation-worker
  return ephemeralResponse((await routerTranslator(env, interaction, logger)).t('errors.unknownModal'));
}

// Export the Hono app as the default export for Cloudflare Workers
/**
 * BUG-074 (2026-07-18 audit): shaped global error handler — previously a
 * thrown error (e.g. a Discord API timeout on a webhook route) fell through
 * to Hono's default unshaped 500, unlike moderation-worker's hardened
 * sibling. Interaction routes still shape their own errors; this is the
 * backstop.
 */
app.onError((err, c) => {
  const logger = c.get('logger');
  if (logger) {
    logger.error('Unhandled error', err, { path: c.req.path });
  } else {
    console.error('Unhandled error', err);
  }
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
