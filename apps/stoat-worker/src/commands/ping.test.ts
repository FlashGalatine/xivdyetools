/**
 * Tests for commands/ping.ts
 *
 * BUG-031 (2026-09-16 deep-dive): !xd ping should measure round-trip latency,
 * not report ~0 ms. The fix sends an initial message, measures after
 * `sendMessage` resolves, then edits with the latency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePingCommand } from './ping.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { CommandContext } from '../router.js';
import type { BotConfig } from '../config.js';

function createPingContext(): CommandContext {
  const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
  return {
    message: createMockMessage({ content: '!xd ping' }) as any,
    parsed: { prefix: '!xd', command: 'ping', subcommand: null, rawArgs: [] },
    config,
    messageContextStore: new MessageContextStore(),
  };
}

describe('handlePingCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends initial pong message and then edits with latency', async () => {
    const ctx = createPingContext();
    await handlePingCommand(ctx);

    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toEqual({
      content: '🏓 Pong!',
      replies: [{ id: ctx.message.id, mention: false }],
    });
  });

  it('edits the sent message with latency when fake timers advance', async () => {
    const ctx = createPingContext();

    // Mock sendMessage to return a message with an edit method
    const mockEdit = vi.fn().mockResolvedValue(undefined);

    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    send.mockImplementation(async () => {
      // Simulate the send taking 40ms of real time
      vi.advanceTimersByTime(40);
      return { id: 'sent-msg-01', edit: mockEdit };
    });

    // Use fake timers
    vi.useFakeTimers();
    try {
      await handlePingCommand(ctx);

      // Check that edit was called with the latency (should be around 40ms)
      expect(mockEdit).toHaveBeenCalledWith({ content: expect.stringMatching(/\d+ms/) });
      const editCall = (mockEdit.mock.calls[0][0] as { content: string }).content;
      expect(editCall).toContain('40ms');
    } finally {
      vi.useRealTimers();
    }
  });
});
