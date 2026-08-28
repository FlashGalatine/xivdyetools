/**
 * `messageCreate` gate — everything between revolt.js and the command router.
 *
 * Kept out of `index.ts` so it is unit-testable. Order of checks:
 * 1. ignore our own messages and messages from any other bot (no loops —
 *    FINDING-035 / STOAT-6, 2026-08-21 security audit)
 * 2. ignore non-command content
 * 3. per-user throttle (FINDING-035 / STOAT-2) — throttled commands are
 *    dropped silently so the throttle cannot itself be used to amplify
 * 4. route, with a fixed-text error reply (no internals leak)
 *
 * @module message-handler
 */

import type { Message } from 'revolt.js';
import { createLibraryLogger } from '@xivdyetools/logger';
import { parseCommand } from './commands/parser.js';
import { routeCommand, type CommandContext } from './router.js';
import type { BotConfig } from './config.js';
import type { MessageContextStore } from './services/message-context.js';
import { CommandThrottle } from './services/command-throttle.js';

const logger = createLibraryLogger('stoat');

export interface MessageHandlerDeps {
  /** The revolt.js client (only `user.id` is read) */
  client: { user?: { id: string } | null };
  config: BotConfig;
  messageContextStore: MessageContextStore;
  /** Per-user throttle; defaults to 5 commands / 10 s */
  throttle?: CommandThrottle;
  /** Router override (tests); defaults to `routeCommand` */
  route?: (ctx: CommandContext) => Promise<void>;
}

export function createMessageHandler(
  deps: MessageHandlerDeps,
): (message: Message) => Promise<void> {
  const throttle = deps.throttle ?? new CommandThrottle();
  const route = deps.route ?? routeCommand;

  return async (message: Message): Promise<void> => {
    // Ignore bot's own messages and any other bot's messages
    if (message.authorId === deps.client.user?.id) return;
    if (message.author?.bot) return;

    // Ignore system messages (no content)
    if (!message.content) return;

    // Parse the message for a command
    const parsed = parseCommand(message.content);
    if (!parsed) return;

    const authorId = message.authorId ?? 'unknown';
    if (!throttle.tryAcquire(authorId)) {
      logger.debug('Command dropped by per-user throttle', { userId: authorId });
      return;
    }

    logger.debug(`Command: ${parsed.command}${parsed.subcommand ? `.${parsed.subcommand}` : ''}`, {
      userId: authorId,
      channelId: message.channelId,
      args: parsed.rawArgs,
    });

    try {
      await route({
        message,
        parsed,
        config: deps.config,
        messageContextStore: deps.messageContextStore,
      });
    } catch (error) {
      logger.error('Unhandled error in command handler', {
        command: parsed.command,
        subcommand: parsed.subcommand,
        error: error instanceof Error ? error.message : String(error),
      });

      // Best-effort error reply to the user — fixed text, never the error
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
  };
}
