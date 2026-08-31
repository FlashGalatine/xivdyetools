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
import { sanitizeEcho } from './services/response-formatter.js';

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
 * Compound routing key for a parsed command: `command` alone, or
 * `command.subcommand` when a subcommand is present. The one place this is
 * computed — `routeCommand` and `isRegisteredCommand` both go through it, so
 * the two can't drift apart into different notions of "the route key".
 */
function routeKeyFor(command: string, subcommand: string | null): string {
  return subcommand ? `${command}.${subcommand}` : command;
}

/**
 * Whether `command`/`subcommand` resolve to a registered route in
 * `COMMAND_ROUTES` — the exact lookup `routeCommand` performs (it calls this
 * too, so there is exactly one `Object.hasOwn` check on this table in the
 * whole file). Exported so other modules can ask "is this a known command?"
 * without re-deriving the check — `message-handler.ts`'s logging does,
 * FINDING-031 / S13-R5 (2026-08-29 security audit, fix round 1): an
 * unrecognized token is the user's own text, and this predicate is what
 * lets the logger tell the difference from a real command name.
 *
 * Own-property check: `constructor` / `__proto__` must not read as known
 * (FINDING-027, 2026-08-21 security audit) — same reasoning as the inline
 * check this replaced in `routeCommand`.
 */
export function isRegisteredCommand(command: string, subcommand: string | null): boolean {
  return Object.hasOwn(COMMAND_ROUTES, routeKeyFor(command, subcommand));
}

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

  if (isRegisteredCommand(command, subcommand)) {
    await COMMAND_ROUTES[routeKeyFor(command, subcommand)](ctx);
    return;
  }

  // Fallback: unknown command. The token is user text — sanitise and cap it
  // before echoing it under the bot's identity (FINDING-019 / STOAT-4).
  await ctx.message.channel?.sendMessage({
    content: `Unknown command "${sanitizeEcho(routeKeyFor(command, subcommand), 32)}". Try \`!xd help\` for a list of commands.`,
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
};
