/**
 * Tests for the command router.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { routeCommand, isRegisteredCommand, type CommandContext } from '../router.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { ParsedCommand } from './parser.js';
import type { BotConfig } from '../config.js';

function createTestContext(overrides?: {
  parsed?: Partial<ParsedCommand>;
  messageContent?: string;
}): CommandContext {
  const config: BotConfig = {
    botToken: 'test-token',
    authorizedUsers: [],
  };

  const parsed: ParsedCommand = {
    prefix: '!xd',
    command: 'ping',
    subcommand: null,
    rawArgs: [],
    ...overrides?.parsed,
  };

  const message = createMockMessage({
    content: overrides?.messageContent ?? '!xd ping',
  });

  return {
    message: message as any,
    parsed,
    config,
    messageContextStore: new MessageContextStore(),
  };
}

describe('routeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes ping command', async () => {
    const ctx = createTestContext({ parsed: { command: 'ping' } });
    await routeCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
  });

  it('routes help command', async () => {
    const ctx = createTestContext({ parsed: { command: 'help' } });
    await routeCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
  });

  it('routes about command', async () => {
    const ctx = createTestContext({ parsed: { command: 'about' } });
    await routeCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
  });

  it('sends error for unknown command', async () => {
    const ctx = createTestContext({ parsed: { command: 'nonexistent' } });
    await routeCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Unknown command'),
      }),
    );
  });

  it('routes compound command keys (dye.info)', async () => {
    const ctx = createTestContext({
      parsed: { command: 'dye', subcommand: 'info', rawArgs: ['Snow', 'White'] },
    });
    // This will call handleInfoCommand which tries to resolve a dye.
    // We're not mocking bot-logic here, so just confirm it doesn't throw
    // and sends some message.
    await routeCommand(ctx);
    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
  });
});

// FINDING-031 / S13-R5 (2026-08-29 security audit, fix round 1): exported so
// message-handler.ts's logging can ask "is this a real command?" without
// re-deriving routeCommand's own COMMAND_ROUTES lookup.
describe('isRegisteredCommand', () => {
  it('is true for registered single-word commands', () => {
    expect(isRegisteredCommand('ping', null)).toBe(true);
    expect(isRegisteredCommand('help', null)).toBe(true);
    expect(isRegisteredCommand('about', null)).toBe(true);
  });

  it('is true for a registered command.subcommand pair', () => {
    expect(isRegisteredCommand('dye', 'info')).toBe(true);
  });

  it('is false for an unregistered single-word command', () => {
    expect(isRegisteredCommand('blahblah', null)).toBe(false);
  });

  it('is false for a real command name paired with an unregistered subcommand', () => {
    expect(isRegisteredCommand('dye', 'nonsense')).toBe(false);
  });

  it('is false for a registered subcommand key used as a bare command', () => {
    // "dye.info" is a route key, but "dye" alone (no subcommand) is not.
    expect(isRegisteredCommand('dye', null)).toBe(false);
  });
});
