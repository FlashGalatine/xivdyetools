/**
 * Tests for the main entry point (index.ts).
 *
 * Because index.ts calls main() at import time, we test the
 * individual pieces (config, client lifecycle, message handler)
 * by mocking revolt.js and process.
 *
 * The actual module is the top-level main() → Client → loginBot flow.
 * We mock revolt.js Client and verify the event wiring.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockClient, createMockMessage } from '../test-utils/revolt-mocks.js';
import { createMessageHandler } from '../message-handler.js';
import { MessageContextStore } from '../services/message-context.js';
import type { BotConfig } from '../config.js';

// image-stoat-13: these tests used to re-implement the messageCreate gate
// INLINE rather than importing it, and the copy left out two of the real
// handler's checks -- the other-bot filter (`message.author?.bot`) and the
// per-user throttle. Deleting either from message-handler.ts left every test
// here green. index.ts cannot be imported (it auto-runs main()), but the thing
// index.ts actually installs can be, so drive that.

function createConfig(): BotConfig {
  return { botToken: 'test-token', authorizedUsers: [] };
}

describe('messageCreate handler logic', () => {
  let messageContextStore: MessageContextStore;
  let config: BotConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    messageContextStore = new MessageContextStore();
    config = createConfig();
  });

  /** The handler index.ts registers on `messageCreate`, not a copy of it. */
  async function handleMessage(
    message: { id: string; content: string | null; authorId: string; channelId: string; channel?: any },
    botUserId: string,
  ): Promise<void> {
    const { client } = createMockClient();
    (client as { user?: { id: string } }).user = { id: botUserId };

    const handler = createMessageHandler({
      client: client as never,
      config,
      messageContextStore,
    });

    await handler(message as never);
  }

  it('ignores messages from OTHER bots', async () => {
    // The inline copy this file used to carry had no such check, so removing
    // it from message-handler.ts changed nothing here.
    const message = createMockMessage({
      content: '!xd ping',
      author: { bot: {} },
    } as never);
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('throttles a user who floods commands', async () => {
    const message = createMockMessage({ content: '!xd ping' });

    // Far more than any sane per-user allowance.
    for (let i = 0; i < 25; i++) {
      await handleMessage(message, 'bot-01');
    }

    // The throttle is per handler instance, so drive one directly.
    const { client } = createMockClient();
    (client as { user?: { id: string } }).user = { id: 'bot-01' };
    const handler = createMessageHandler({
      client: client as never,
      config,
      messageContextStore,
    });

    const flooded = createMockMessage({ content: '!xd ping' });
    for (let i = 0; i < 25; i++) {
      await handler(flooded as never);
    }
    expect(flooded.channel.sendMessage.mock.calls.length).toBeLessThan(25);
  });

  it('ignores messages from the bot itself', async () => {
    const message = createMockMessage({ authorId: 'bot-01', content: '!xd ping' });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores messages with null content', async () => {
    const message = createMockMessage({ content: null });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores messages without a command prefix', async () => {
    const message = createMockMessage({ content: 'Hello world!' });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('routes a valid ping command', async () => {
    const message = createMockMessage({ content: '!xd ping' });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).toHaveBeenCalled();
  });

  it('routes a valid help command', async () => {
    const message = createMockMessage({ content: '!xd help' });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).toHaveBeenCalled();
  });

  it('sends error for unknown commands', async () => {
    const message = createMockMessage({ content: '!xd nonexistent' });
    await handleMessage(message, 'bot-01');
    expect(message.channel.sendMessage).toHaveBeenCalled();
    const call = message.channel.sendMessage.mock.calls[0][0];
    expect(call.content).toContain('Unknown command');
  });
});

// image-stoat-13: two describes lived here and asserted nothing about product
// code -- `expect(typeof process.exit).toBe('function')` under the name
// "shutdown handler", and two cases confirming that this file's OWN
// createMockClient registers a handler and resolves a promise. Removed; the
// gateway wiring index.ts performs is covered by message-handler.test.ts and
// by the handler tests above.
