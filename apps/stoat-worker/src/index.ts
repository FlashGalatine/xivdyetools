/**
 * XIV Dye Tools — Stoat Bot
 *
 * Main entry point. Creates the revolt.js WebSocket client,
 * connects to Stoat, and routes incoming messages to command handlers.
 *
 * @module stoat-worker
 */

import { Client } from 'revolt.js';
import { createLibraryLogger } from '@xivdyetools/logger';
import { loadConfig } from './config.js';
import { parseCommand } from './commands/parser.js';
import { routeCommand } from './router.js';
import { MessageContextStore } from './services/message-context.js';

const logger = createLibraryLogger('stoat');

/**
 * Bootstrap the Stoat bot:
 * 1. Load config from environment variables
 * 2. Initialize shared services
 * 3. Connect to Stoat's WebSocket gateway
 * 4. Route incoming messages to command handlers
 */
async function main(): Promise<void> {
  // ── Configuration ──────────────────────────────────────────────────
  const config = loadConfig();
  logger.info('Configuration loaded');

  // ── Shared services ────────────────────────────────────────────────
  const messageContextStore = new MessageContextStore();

  // ── Client setup ───────────────────────────────────────────────────
  const client = new Client();

  // ── Ready event ────────────────────────────────────────────────────
  client.on('ready', () => {
    logger.info(`Logged in as ${client.user?.username ?? 'unknown'}`);
    logger.info(
      `Authorized admins: ${config.authorizedUsers.length > 0 ? config.authorizedUsers.join(', ') : '(none)'}`,
    );
  });

  // ── Message handler ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  client.on('messageCreate', async (message) => {
    // Ignore bot's own messages
    if (message.authorId === client.user?.id) return;

    // Ignore system messages (no content)
    if (!message.content) return;

    // Parse the message for a command
    const parsed = parseCommand(message.content);
    if (!parsed) return;

    logger.debug(`Command: ${parsed.command}${parsed.subcommand ? `.${parsed.subcommand}` : ''}`, {
      userId: message.authorId,
      channelId: message.channelId,
      args: parsed.rawArgs,
    });

    try {
      await routeCommand({
        message,
        parsed,
        config,
        messageContextStore,
      });
    } catch (error) {
      logger.error('Unhandled error in command handler', {
        command: parsed.command,
        subcommand: parsed.subcommand,
        error: error instanceof Error ? error.message : String(error),
      });

      // Best-effort error reply to the user
      try {
        await message.channel?.sendMessage({
          content: 'An unexpected error occurred. Please try again later.',
          replies: [{ id: message.id, mention: false }],
        });
      } catch {
        // If we can't even send the error message, just log it
        logger.error('Failed to send error reply to user');
      }
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = (): void => {
    logger.info('Shutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ── Connect ────────────────────────────────────────────────────────
  logger.info('Connecting to Stoat...');
  await client.loginBot(config.botToken);
}

// ── Entry point ────────────────────────────────────────────────────────
main().catch((error) => {
  logger.error('Fatal error during startup', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
