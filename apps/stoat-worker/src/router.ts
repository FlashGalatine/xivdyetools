/**
 * Command router — dispatches parsed commands to their handlers.
 *
 * Defines the shared CommandContext type that all command handlers receive,
 * and routes parsed commands to the appropriate handler function.
 */

import type { Message } from 'revolt.js';
import type { ParsedCommand } from './commands/parser.js';
import type { BotConfig } from './config.js';
import type { MessageContextStore } from './services/message-context.js';

import { handlePingCommand } from './commands/ping.js';
import { handleHelpCommand } from './commands/help.js';
import { handleAboutCommand } from './commands/about.js';
import { handleInfoCommand } from './commands/info.js';

/**
 * Context passed to every command handler.
 * Contains the revolt.js message, parsed command, bot config,
 * and shared services needed by handlers.
 */
export interface CommandContext {
  /** The revolt.js message that triggered this command */
  message: Message;
  /** The parsed command from the message content */
  parsed: ParsedCommand;
  /** Bot configuration (admin list, feature flags, etc.) */
  config: BotConfig;
  /** Per-message context store for reaction-based interactions */
  messageContextStore: MessageContextStore;
}

/** Handler function signature for all commands */
export type CommandHandler = (ctx: CommandContext) => Promise<void>;

/**
 * Route a parsed command to its handler and execute it.
 *
 * Commands are matched by `command` and optional `subcommand`:
 * - `ping` → handlePingCommand
 * - `help` → handleHelpCommand
 * - `about` → handleAboutCommand
 * - `dye.info` → handleInfoCommand
 *
 * Unknown commands receive a brief error reply.
 */
export async function routeCommand(ctx: CommandContext): Promise<void> {
  const { command, subcommand } = ctx.parsed;

  // Build a compound key for subcommand routing
  const routeKey = subcommand ? `${command}.${subcommand}` : command;

  const handler = COMMAND_ROUTES[routeKey];

  if (handler) {
    await handler(ctx);
    return;
  }

  // Fallback: unknown command
  await ctx.message.channel?.sendMessage({
    content: `Unknown command \`${routeKey}\`. Try \`!xd help\` for a list of commands.`,
    replies: [{ id: ctx.message.id, mention: false }],
  });
}

/**
 * Command routing table.
 *
 * Keys are either a single command name ("ping") or a compound
 * "command.subcommand" key ("dye.info").
 *
 * New commands are registered here as they are implemented.
 */
const COMMAND_ROUTES: Record<string, CommandHandler> = {
  // Utility commands
  ping: handlePingCommand,
  help: handleHelpCommand,
  about: handleAboutCommand,

  // Dye lookup commands
  'dye.info': handleInfoCommand,

  // TODO: Phase 2 commands
  // 'dye.search': handleSearchCommand,
  // 'dye.list': handleListCommand,
  // 'dye.random': handleRandomCommand,
  // harmony: handleHarmonyCommand,
  // gradient: handleGradientCommand,
  // mixer: handleMixerCommand,
  // comparison: handleComparisonCommand,
  // match: handleMatchCommand,
  // a11y: handleAccessibilityCommand,
};
