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
import { createMessageHandler } from './message-handler.js';
import { MessageContextStore } from './services/message-context.js';
import { CommandThrottle } from './services/command-throttle.js';

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
  const throttle = new CommandThrottle();

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
  // Bot/self filtering, per-user throttle and error handling live in
  // message-handler.ts (unit-tested; FINDING-035, 2026-08-21 security audit).
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  client.on('messageCreate', createMessageHandler({ client, config, messageContextStore, throttle }));

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
