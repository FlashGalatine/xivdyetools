/**
 * Tests for commands/help.ts
 *
 * Covers handleHelpCommand for overview and per-command help.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleHelpCommand } from './help.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { CommandContext } from '../router.js';
import type { ParsedCommand } from './parser.js';
import type { BotConfig } from '../config.js';

function createHelpContext(rawArgs: string[] = []): CommandContext {
  const config: BotConfig = {
    botToken: 'test-token',
    authorizedUsers: [],
  };
  const parsed: ParsedCommand = {
    prefix: '!xd',
    command: 'help',
    subcommand: null,
    rawArgs,
  };
  const message = createMockMessage({ content: '!xd help' });
  return {
    message: message as any,
    parsed,
    config,
    messageContextStore: new MessageContextStore(),
  };
}

describe('handleHelpCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the overview when no topic is provided', async () => {
    const ctx = createHelpContext();
    await handleHelpCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('XIV Dye Tools');
    expect(call.content).toContain('Command Reference');
    expect(call.replies).toEqual([{ id: ctx.message.id, mention: false }]);
  });

  it('sends command-specific help for "info"', async () => {
    const ctx = createHelpContext(['info']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('!xd info');
  });

  it('sends command-specific help for "harmony"', async () => {
    const ctx = createHelpContext(['harmony']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('harmony');
  });

  it('sends command-specific help for "match"', async () => {
    const ctx = createHelpContext(['match']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('match');
  });

  it('sends command-specific help for "gradient"', async () => {
    const ctx = createHelpContext(['gradient']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('gradient');
  });

  it('sends command-specific help for "mixer"', async () => {
    const ctx = createHelpContext(['mixer']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('mixer');
  });

  it('sends command-specific help for "comparison"', async () => {
    const ctx = createHelpContext(['comparison']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('comparison');
  });

  it('sends command-specific help for "ping"', async () => {
    const ctx = createHelpContext(['ping']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('ping');
  });

  it('sends command-specific help for "about"', async () => {
    const ctx = createHelpContext(['about']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('about');
  });

  it('falls back to overview for unknown topic', async () => {
    const ctx = createHelpContext(['nonexistent']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('Command Reference');
  });

  it('is case-insensitive for topic matching', async () => {
    const ctx = createHelpContext(['INFO']);
    await handleHelpCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('!xd info');
  });
});
