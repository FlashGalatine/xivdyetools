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

// SECURITY (2026-08-29 audit, FINDING-031): `createLibraryLogger` defaults to
// `level: 'debug'` (packages/logger/src/presets/library.ts) — a sane default
// for a library consumer who has to opt in to seeing output at all, but wrong
// for this file, which only ever calls `.info()`/`.error()` today. Pinning
// `info` here removes the latent "debug on by default" surface for whatever
// gets added to this file next, without touching the shared preset (other
// consumers still get its debug default). message-handler.ts keeps its own
// `createLibraryLogger('stoat')` instance — a separate object, unaffected by
// this — at the preset default, so its (now identifier-free) per-command
// debug lines stay visible to an operator without the config below needing
// to be at 'debug' for it.
const logger = createLibraryLogger('stoat', { level: 'info' });

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
    // SECURITY (2026-08-29 audit, FINDING-031 / ruling S13-R2 — not in the
    // original finding): this used to `.join(', ')` the full roster, printing
    // every privileged account id at `info`, on every boot — the level change
    // above would not have hidden it, since this call was already at `info`.
    // The count is the operationally useful part (an operator can tell the
    // roster loaded and isn't empty); the ids themselves add nothing that's
    // worth shipping to stdout.
    logger.info(
      `Authorized admins: ${config.authorizedUsers.length > 0 ? config.authorizedUsers.length : '(none)'}`,
    );
  });

  // ── Gateway errors ─────────────────────────────────────────────────
  // BUG-101: Node's EventEmitter THROWS an unhandled 'error' event, so a
  // transient socket failure took the whole process down -- pre-empting the
  // very auto-reconnect revolt.js would have performed on `disconnect()`.
  // A listener is all it takes to restore the backoff path.
  client.on('error', (error: unknown) => {
    logger.error('Gateway error', {
      error: error instanceof Error ? error.message : String(error),
    });
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
