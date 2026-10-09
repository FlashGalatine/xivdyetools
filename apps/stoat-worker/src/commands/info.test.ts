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
    // BUG-042: assert actual embed content, not just presence
    const embed = lastCall.embeds?.[0];
    expect(embed).toBeDefined();
    expect(embed?.title).toBe('Snow White');
    // colour is the hex string; Snow White is #e4dfd0
    expect(embed?.colour).toBe('#e4dfd0');
    // description is the share URL with the stainID (1 for Snow White)
    expect(embed?.description).toContain('xivdyetools.app/comparison?dyes=1');
  });

  it('stores message context keyed by the BOT REPLY id, not the user message', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    // image-stoat-13: this used to assert
    // `expect(size).toBeGreaterThanOrEqual(0)` -- a Map's size is never
    // negative, so it held whether anything was stored or not, and its comment
    // described the PRE-BUG-038 behaviour ("keyed by the original message ID").
    // Reactions land on the bot's reply, so the reply's id is the only key a
    // reaction handler could ever look up.
    expect(ctx.messageContextStore.size).toBe(1);
    expect(ctx.messageContextStore.get('sent-msg-01')).toMatchObject({
      command: 'dye-info',
    });
    expect(ctx.messageContextStore.get('msg-01')).toBeUndefined();
  });

  it('a hex code answers with exactly one dye card', async () => {
    const ctx = createInfoContext(['#ABCDEF']);
    await handleInfoCommand(ctx);

    const calls = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].embeds).toHaveLength(1);
    expect(calls[0][0].embeds[0].title).toBeTruthy();
  });

  it('handles disambiguation result by sending a list', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    mock.mockResolvedValueOnce({
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
    mock.mockResolvedValueOnce({
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

  // BUG-073, end to end through the real resolver: a name that fits several
  // dyes now answers with all of them (or the list), not just the first hit.
  it('"white" (real resolver) sends one card per White dye', async () => {
    const ctx = createInfoContext(['white']);
    await handleInfoCommand(ctx);

    const calls = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(4);
    const titles = calls.map((c) => JSON.stringify(c[0].embeds?.[0]));
    for (const name of ['Snow White', 'Bone White', 'Pearl White', 'Pure White']) {
      expect(titles.some((t) => t.includes(name)), name).toBe(true);
    }
  });

  it('"Blue" (real resolver) sends the disambiguation list', async () => {
    const ctx = createInfoContext(['Blue']);
    await handleInfoCommand(ctx);

    const calls = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].content).toContain('Found 25 dyes');
  });

  it('handles single result with a valid dye → sends embed', async () => {
    const ctx = createInfoContext(['Snow', 'White']);
    await handleInfoCommand(ctx);

    const calls = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls[0][0].embeds)).toContain('Snow White');
  });

  it('handles single result without dye object → error message', async () => {
    const mock = vi.mocked(resolveDyeInputMulti);
    mock.mockResolvedValueOnce({
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
    mock.mockResolvedValueOnce({
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

    expect(ctx.messageContextStore.size).toBe(1);
  });
});
