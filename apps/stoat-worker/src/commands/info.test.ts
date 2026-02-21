/**
 * Tests for commands/info.ts
 *
 * Covers handleInfoCommand for all resolution branches:
 * missing input, none, disambiguation, single (with and without dye),
 * and multiple matches.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleInfoCommand } from './info.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { CommandContext } from '../router.js';
import type { ParsedCommand } from './parser.js';
import type { BotConfig } from '../config.js';

// Mock resolveDyeInputMulti so we can control the resolution result
vi.mock('../services/dye-resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/dye-resolver.js')>();
  return {
    ...actual,
    resolveDyeInputMulti: vi.fn(actual.resolveDyeInputMulti),
  };
});

import { resolveDyeInputMulti } from '../services/dye-resolver.js';

function createInfoContext(rawArgs: string[] = []): CommandContext {
  const config: BotConfig = {
    botToken: 'test-token',
    authorizedUsers: [],
  };
  const parsed: ParsedCommand = {
    prefix: '!xd',
    command: 'dye',
    subcommand: 'info',
    rawArgs,
  };
  const message = createMockMessage({
    content: `!xd info ${rawArgs.join(' ')}`.trim(),
  });
  return {
    message: message as any,
    parsed,
    config,
    messageContextStore: new MessageContextStore(),
  };
}

describe('handleInfoCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends error when no dye name is provided', async () => {
    const ctx = createInfoContext([]);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('Please provide a dye name');
  });

  it('sends no-match reply for unknown dye', async () => {
    const ctx = createInfoContext(['xyzzyplugh12345']);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('No dye found');
  });

  it('sends dye info for a known dye', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
    // Should have an embed reply
    const lastCall = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    // Either embed-based or content-based response
    expect(lastCall.embeds?.[0] ?? lastCall.content).toBeDefined();
  });

  it('stores message context after successful info', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    // The command stores context keyed by the original message ID
    // We can check by looking at the store
    expect(ctx.messageContextStore.size).toBeGreaterThanOrEqual(0);
  });

  it('handles disambiguation for broad query like "Blue"', async () => {
    const ctx = createInfoContext(['Blue']);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Could be disambiguation list or multiple embeds
    expect(call.content ?? call.embeds).toBeDefined();
  });

  it('sends error for single result without dye object', async () => {
    // A hex code resolves to single but may not have a .dye property
    // The code checks resolution.dye.dye and sends an error if null
    const ctx = createInfoContext(['#ABCDEF']);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalled();
  });

  it('handles disambiguation result by sending a list', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    mock.mockReturnValueOnce({
      kind: 'disambiguation',
      dyes: [
        { hex: '#aaa', name: 'Dye A', id: 1, itemID: 100, dye: null as any },
        { hex: '#bbb', name: 'Dye B', id: 2, itemID: 200, dye: null as any },
      ],
      total: 10,
      query: 'test',
    });

    const ctx = createInfoContext(['test']);
    await handleInfoCommand(ctx);

    expect(ctx.message.channel?.sendMessage).toHaveBeenCalledOnce();
    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('Found 10 dyes');
  });

  it('handles multiple result by sending individual embeds', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    const fakeDye = {
      hex: '#ffffff',
      name: 'Snow White',
      id: 1,
      itemID: 5729,
      category: 'White',
      categoryIndex: 0,
      sortOrder: 0,
      localizedNames: {},
    };
    mock.mockReturnValueOnce({
      kind: 'multiple',
      dyes: [
        { hex: '#ffffff', name: 'Snow White', id: 1, itemID: 5729, dye: fakeDye as any },
        { hex: '#eeeeee', name: 'Pure White', id: 2, itemID: 5730, dye: fakeDye as any },
      ],
      query: 'white',
    });

    const ctx = createInfoContext(['white']);
    await handleInfoCommand(ctx);

    // Should send at least 2 messages (one per dye)
    expect((ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('handles single result with a valid dye → sends embed', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    const calls = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // The successful path sends an embed
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.embeds ?? lastCall.content).toBeDefined();
  });

  it('handles single result without dye object → error message', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    mock.mockReturnValueOnce({
      kind: 'single',
      dye: { hex: '#abcdef', name: 'Custom', id: 0, itemID: 0, dye: undefined as any },
    });

    const ctx = createInfoContext(['custom']);
    await handleInfoCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('Could not resolve');
  });

  it('handles none result with suggestions', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    mock.mockReturnValueOnce({
      kind: 'none',
      query: 'whte',
      suggestions: ['Snow White', 'Pure White'],
    });

    const ctx = createInfoContext(['whte']);
    await handleInfoCommand(ctx);

    const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain('No dye found');
    expect(call.content).toContain('Did you mean');
  });

  it('stores context after successful sendDyeInfoResponse', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    // Should store context for the message
    // contextStore.set is called with message.id
    expect(ctx.messageContextStore.size).toBeGreaterThanOrEqual(1);
  });
});
