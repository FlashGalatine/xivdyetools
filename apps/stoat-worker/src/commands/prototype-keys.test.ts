/**
 * FINDING-027 / STOAT-3 (2026-08-21 security audit): user-supplied tokens are
 * used as keys into plain-object tables (`SHORT_ALIASES`, `COMMAND_ROUTES`,
 * `COMMAND_HELP`). Inherited `Object.prototype` members (`constructor`,
 * `__proto__`, `toString`, …) must NOT satisfy those lookups — they are not
 * commands.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseCommand } from './parser.js';
import { routeCommand, type CommandContext } from '../router.js';
import { handleHelpCommand } from './help.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { ParsedCommand } from './parser.js';
import type { BotConfig } from '../config.js';

const PROTO_KEYS = ['constructor', '__proto__', 'tostring', 'hasownproperty', 'valueof'];

function ctxFor(parsed: Partial<ParsedCommand>): CommandContext {
  const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
  return {
    message: createMockMessage({ content: '!xd x' }) as any,
    parsed: { prefix: '!xd', command: 'ping', subcommand: null, rawArgs: [], ...parsed },
    config,
    messageContextStore: new MessageContextStore(),
  };
}

function sentContent(ctx: CommandContext): unknown {
  const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
  return send.mock.calls[0]?.[0]?.content;
}

describe('parseCommand — prototype keys are not aliases', () => {
  it.each(PROTO_KEYS)('treats "%s" as a plain (unknown) command, not an alias', (key) => {
    const parsed = parseCommand(`!xd ${key} foo`);
    expect(parsed).not.toBeNull();
    // A real alias (`info`) rewrites command/subcommand; a prototype key must
    // fall through to the simple-command shape with the token preserved.
    expect(parsed!.command).toBe(key);
    expect(parsed!.subcommand).toBeNull();
    expect(parsed!.rawArgs).toEqual(['foo']);
  });
});

describe('routeCommand — prototype keys are unknown commands', () => {
  it.each(PROTO_KEYS)('"%s" gets the unknown-command reply instead of a Function handler', async (key) => {
    const ctx = ctxFor({ command: key });
    await routeCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    expect(sentContent(ctx)).toMatch(/Unknown command/);
  });
});

describe('handleHelpCommand — prototype keys are not help topics', () => {
  it.each(PROTO_KEYS)('"%s" falls back to the overview, never a Function body', async (key) => {
    const ctx = ctxFor({ command: 'help', rawArgs: [key] });
    await handleHelpCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    const content = sentContent(ctx);
    expect(typeof content).toBe('string');
    expect(content).toContain('Command Reference');
  });
});
