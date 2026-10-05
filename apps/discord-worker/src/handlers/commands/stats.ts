/**
 * /stats Command Handler (V4)
 *
 * Displays bot usage statistics with 4 subcommands:
 * - summary: Public - basic bot information for anyone
 * - overview: Admin - usage metrics and trends
 * - commands: Admin - per-command breakdown and rankings
 * - health: Admin - system health and infrastructure status
 *
 * Admin subcommands restricted to users in STATS_AUTHORIZED_USERS env var.
 *
 * @module handlers/commands/stats
 */

import type { Env, DiscordInteraction } from '../../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { getStats } from '../../services/analytics.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import { messageResponse, errorEmbed } from '../../utils/response.js';
import { grp, num } from '@xivdyetools/svg';
import { PRODUCT_LINKS, SOCIAL_LINKS, XIVDYETOOLS_DOCS_URL } from '@xivdyetools/core';
import { BRAND_ACCENT, STATE } from '../../utils/brand.js';
import { isUniversalisEnabled } from '../../services/budget/index.js';

// ============================================================================
// Constants
// ============================================================================

/** State signals only — the product accent is BRAND_ACCENT. */
const COLORS = {
  green: STATE.success,
  yellow: STATE.warning,
  red: STATE.error,
  purple: 0x9b59b6,
} as const;

/**
 * Bot version, read from the manifest the deploy actually ships.
 *
 * BUG-037: this was the literal '4.0.0' while `package.json` said 5.1.1, so
 * public `/stats summary` and `/stats health` contradicted `/about` — which has
 * always read the manifest — in the same bot. Worse, the tests pinned the stale
 * literal (`toContain('Version 4.0.0')`), so bumping the package could never
 * turn them red and the drift was invisible from inside the suite.
 */
import packageJson from '../../../package.json' with { type: 'json' };

const BOT_VERSION = packageJson.version;

/**
 * FINDING-023 (2026-08-21 security audit): the summary used to link
 * `xivdyetools.com` / `docs.xivdyetools.com` / `discord.gg/xivdyetools`,
 * none of which resolve (a registrable third-party phishing target behind
 * bot-authored "official" links). Source the three from core, like /about.
 */
const SUMMARY_LINKS = {
  webApp: PRODUCT_LINKS.webApp.url,
  docs: XIVDYETOOLS_DOCS_URL,
  supportServer:
    SOCIAL_LINKS.find((link) => link.label === 'Discord')?.url ?? PRODUCT_LINKS.webApp.url,
} as const;

// ============================================================================
// Authorization
// ============================================================================

/**
 * Check if user is authorized to view admin stats
 */
function isAuthorized(env: Env, userId: string): boolean {
  if (!env.STATS_AUTHORIZED_USERS) {
    return false;
  }

  const authorizedUsers = env.STATS_AUTHORIZED_USERS.split(',').map((id) => id.trim());
  return authorizedUsers.includes(userId);
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /stats command
 *
 * Routes to appropriate subcommand handler based on interaction data.
 */
export async function handleStatsCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Get subcommand from options
  const options = interaction.data?.options || [];
  const subcommandOption = options[0];

  // Default to summary if no subcommand specified
  const subcommand = subcommandOption?.name ?? 'summary';

  // Check authorization for admin subcommands
  const adminSubcommands = ['overview', 'commands', 'health'];
  if (adminSubcommands.includes(subcommand) && !isAuthorized(env, userId)) {
    return messageResponse({
      embeds: [
        {
          title: `⛔ ${t.t('stats.accessDeniedTitle')}`,
          description: t.t('stats.accessDenied'),
          color: COLORS.red,
        },
      ],
      flags: 64,
    });
  }

  try {
    switch (subcommand) {
      // `return await`, not `return`: a bare `return promise` inside a try
      // hands the rejection straight past the catch below (KV list() errors
      // then surfaced as the dispatcher's generic "command failed").
      case 'summary':
        return await handleSummarySubcommand(env, t, logger);

      case 'overview':
        return await handleOverviewSubcommand(env, logger);

      case 'commands':
        return await handleCommandsSubcommand(env, logger);

      case 'health':
        return await handleHealthSubcommand(env, logger);

      default:
        return messageResponse({
          embeds: [errorEmbed(t.t('common.error'), t.t('errors.unknownSubcommand', { name: subcommand }))],
          flags: 64,
        });
    }
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Error in stats command', error instanceof Error ? error : undefined);
    }

    return messageResponse({
      embeds: [
        {
          title: `❌ ${t.t('common.error')}`,
          description: t.t('stats.fetchFailed'),
          color: COLORS.red,
        },
      ],
      flags: 64,
    });
  }
}

// ============================================================================
// Summary Subcommand (Public)
// ============================================================================

/**
 * Handles /stats summary - Public basic bot information
 */
async function handleSummarySubcommand(
  env: Env,
  t: Translator,
  _logger?: ExtendedLogger,
): Promise<Response> {
  const stats = await getStats(env.KV);
  const lang = t.getLocale();

  return messageResponse({
    embeds: [
      {
        title: `📊 ${t.t('about.title')}`,
        description: t.t('about.description'),
        color: BRAND_ACCENT,
        fields: [
          {
            name: `🎨 ${t.t('stats.summary.features')}`,
            value: t.t('stats.summary.featureList'),
            inline: true,
          },
          {
            name: `📈 ${t.t('stats.summary.stats')}`,
            value: [
              `**${t.t('stats.summary.commandsUsed')}:** ${grp(stats.totalCommands, lang)}`,
              `**${t.t('stats.summary.successRate')}:** ${num(stats.successRate, lang, 1)}%`,
            ].join('\n'),
            inline: true,
          },
          {
            name: `🔗 ${t.t('about.links')}`,
            value: [
              `[${t.t('stats.summary.webApp')}](${SUMMARY_LINKS.webApp})`,
              `[${t.t('stats.summary.documentation')}](${SUMMARY_LINKS.docs})`,
              `[${t.t('stats.summary.supportServer')}](${SUMMARY_LINKS.supportServer})`,
            ].join(' • '),
            inline: false,
          },
        ],
        footer: {
          text: t.t('stats.summary.footer', { version: BOT_VERSION }),
        },
      },
    ],
  });
}

// ============================================================================
// Overview Subcommand (Admin)
// ============================================================================
//
// The three admin panels below (overview / commands / health) are
// operator dashboards gated by STATS_AUTHORIZED_USERS. They are deliberately
// English-only (2026-08-20 i18n audit, F-05): the public /stats summary and
// every error reply are localized above, the dashboards take no Translator.
// ============================================================================

/**
 * Handles /stats overview - Admin usage metrics
 */
async function handleOverviewSubcommand(
  env: Env,
  _logger?: ExtendedLogger,
): Promise<Response> {
  const stats = await getStats(env.KV);

  // Calculate some derived metrics
  const avgCommandsPerUser =
    stats.uniqueUsersToday > 0 ? (stats.totalCommands / stats.uniqueUsersToday).toFixed(1) : '0';

  return messageResponse({
    embeds: [
      {
        title: '📈 Usage Overview',
        color: BRAND_ACCENT,
        fields: [
          {
            name: '📊 Volume',
            value: [
              `**Total Commands:** ${stats.totalCommands.toLocaleString()}`,
              `**Successful:** ${stats.successCount.toLocaleString()}`,
              `**Failed:** ${stats.failureCount.toLocaleString()}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '👥 Users',
            value: [
              `**Unique Today:** ${stats.uniqueUsersToday.toLocaleString()}`,
              `**Avg Cmds/User:** ${avgCommandsPerUser}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '✅ Quality',
            value: [
              `**Success Rate:** ${stats.successRate.toFixed(2)}%`,
              `**Error Rate:** ${(100 - stats.successRate).toFixed(2)}%`,
            ].join('\n'),
            inline: true,
          },
        ],
        footer: {
          text: 'Stats stored in Cloudflare KV with 30-day retention',
        },
      },
    ],
    flags: 64, // Ephemeral for admin data
  });
}

// ============================================================================
// Commands Subcommand (Admin)
// ============================================================================

/**
 * Handles /stats commands - Admin per-command breakdown
 */
async function handleCommandsSubcommand(
  env: Env,
  _logger?: ExtendedLogger,
): Promise<Response> {
  const stats = await getStats(env.KV);

  // Sort commands by usage
  const sortedCommands = Object.entries(stats.commandBreakdown).sort(([, a], [, b]) => b - a);

  // Top 10 commands
  const topCommands = sortedCommands.slice(0, 10);
  const topCommandsText =
    topCommands.length > 0
      ? topCommands
          .map(([cmd, count], index) => {
            const percentage =
              stats.totalCommands > 0 ? ((count / stats.totalCommands) * 100).toFixed(1) : '0.0';
            const medal =
              index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} \`/${cmd}\` - ${count.toLocaleString()} (${percentage}%)`;
          })
          .join('\n')
      : 'No commands executed yet';

  // Bottom 5 commands (least used)
  const bottomCommands = sortedCommands.slice(-5).reverse();
  const bottomCommandsText =
    bottomCommands.length > 0
      ? bottomCommands.map(([cmd, count]) => `• \`/${cmd}\` - ${count.toLocaleString()}`).join('\n')
      : 'N/A';

  // 5.0 adoption: the commands the redesign introduced (the legacy set was
  // deleted with Phase 1 — its counters only drain now). Extractor telemetry
  // arrives split by subcommand (extractor_image / extractor_color).
  const v5NewCommands = ['contrast', 'a11y', 'changelog', 'swatch'];
  const extractorSubs = ['extractor_image', 'extractor_color'];

  const v5NewUsage = v5NewCommands.reduce(
    (sum, cmd) => sum + (stats.commandBreakdown[cmd] || 0),
    0,
  );
  const extractorSplit = extractorSubs
    .map(
      (cmd) =>
        `\`${cmd.replace('extractor_', '')}\` ${(stats.commandBreakdown[cmd] || 0).toLocaleString()}`,
    )
    .join(' · ');

  return messageResponse({
    embeds: [
      {
        title: '⭐ Command Usage Breakdown',
        color: COLORS.purple,
        fields: [
          {
            name: '🏆 Top 10 Commands',
            value: topCommandsText,
            inline: false,
          },
          {
            name: '📉 Least Used',
            value: bottomCommandsText,
            inline: true,
          },
          {
            name: '🆕 5.0 Adoption',
            value: [
              `**New in 5.0:** ${v5NewUsage.toLocaleString()} (${v5NewCommands.map((c) => `\`/${c}\``).join(' ')})`,
              `**Extractor:** ${extractorSplit}`,
            ].join('\n'),
            inline: true,
          },
        ],
        footer: {
          text: `Total unique commands: ${sortedCommands.length}`,
        },
      },
    ],
    flags: 64,
  });
}

// ============================================================================
// Health Subcommand (Admin)
// ============================================================================

/**
 * Handles /stats health - Admin system health status
 */
async function handleHealthSubcommand(
  env: Env,
  _logger?: ExtendedLogger,
): Promise<Response> {
  // Check KV health
  let kvStatus = '🟢 Healthy';
  let kvLatency = 0;
  try {
    const start = Date.now();
    await env.KV.get('health:check');
    kvLatency = Date.now() - start;
    if (kvLatency > 500) {
      kvStatus = '🟡 Slow';
    }
  } catch {
    kvStatus = '🔴 Error';
  }

  // Check Analytics Engine status
  const analyticsStatus = env.ANALYTICS ? '🟢 Enabled' : '⚪ Disabled';

  // Check external services configuration
  const universalisStatus = isUniversalisEnabled(env) ? '🟢 Configured' : '⚪ Not configured';
  const presetApiStatus = env.PRESETS_API_URL ? '🟢 Configured' : '⚪ Not configured';

  // BUG-012: this hard-coded 'production' even on the -dev worker, where
  // wrangler.toml sets ENVIRONMENT to 'development'.
  const workerEnv = env.ENVIRONMENT ?? 'unknown';

  return messageResponse({
    embeds: [
      {
        title: '🏥 System Health',
        color: kvStatus.includes('🔴')
          ? COLORS.red
          : kvStatus.includes('🟡')
            ? COLORS.yellow
            : COLORS.green,
        fields: [
          {
            name: '💾 Storage',
            value: [`**KV Namespace:** ${kvStatus}`, `**KV Latency:** ${kvLatency}ms`].join('\n'),
            inline: true,
          },
          {
            name: '📊 Analytics',
            value: [`**Analytics Engine:** ${analyticsStatus}`].join('\n'),
            inline: true,
          },
          {
            name: '🌐 External Services',
            value: [
              `**Universalis API:** ${universalisStatus}`,
              `**Preset API:** ${presetApiStatus}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚙️ Configuration',
            value: [
              `**Environment:** ${workerEnv}`,
              `**Version:** ${BOT_VERSION}`,
              `**Platform:** Cloudflare Workers`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🔐 Security',
            value: [
              `**Webhook Secret:** ${env.INTERNAL_WEBHOOK_SECRET ? '🟢 Set' : '⚪ Not set'}`,
              `**Mod Channel:** ${env.MODERATION_CHANNEL_ID ? '🟢 Set' : '⚪ Not set'}`,
            ].join('\n'),
            inline: true,
          },
        ],
        footer: {
          text: 'Health check performed at request time',
        },
      },
    ],
    flags: 64,
  });
}
