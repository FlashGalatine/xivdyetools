/**
 * Tests for message-handler.ts — the `messageCreate` gate that sits between
 * revolt.js and the command router.
 *
 * FINDING-035 / STOAT-2, STOAT-6 (2026-08-21 security audit): messages from
 * other bots are ignored (no bot-to-bot loops) and each user is throttled.
 */

import { describe, it, expect, vi } from 'vitest';
import { createMessageHandler } from './message-handler.js';
import { createMockMessage } from './test-utils/revolt-mocks.js';
import { MessageContextStore } from './services/message-context.js';
import { CommandThrottle } from './services/command-throttle.js';
import type { BotConfig } from './config.js';

const BOT_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

function setup(options: { throttle?: CommandThrottle; route?: () => Promise<void> } = {}) {
  const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
  const handler = createMessageHandler({
    client: { user: { id: BOT_ID } },
    config,
    messageContextStore: new MessageContextStore(),
    throttle: options.throttle ?? new CommandThrottle({ limit: 100, windowMs: 10_000 }),
    route: options.route,
  });
  return { handler };
}

describe('createMessageHandler', () => {
  it('routes a command from a human author', async () => {
    const { handler } = setup();
    const message = createMockMessage({ content: '!xd ping', authorId: 'user-01' });
    await handler(message as any);
    expect(message.channel.sendMessage).toHaveBeenCalledOnce();
  });

  it('ignores its own messages', async () => {
    const { handler } = setup();
    const message = createMockMessage({ content: '!xd ping', authorId: BOT_ID });
    await handler(message as any);
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores messages authored by other bots', async () => {
    const { handler } = setup();
    const message = createMockMessage({
      content: '!xd ping',
      authorId: 'other-bot',
      author: { bot: { owner: 'someone' } },
    });
    await handler(message as any);
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores non-command content', async () => {
    const { handler } = setup();
    const message = createMockMessage({ content: 'hello there', authorId: 'user-01' });
    await handler(message as any);
    expect(message.channel.sendMessage).not.toHaveBeenCalled();
  });

  it('silently drops commands beyond the per-user throttle', async () => {
    const { handler } = setup({ throttle: new CommandThrottle({ limit: 2, windowMs: 10_000 }) });
    const first = createMockMessage({ content: '!xd ping', authorId: 'spammer' });
    const second = createMockMessage({ content: '!xd ping', authorId: 'spammer' });
    const third = createMockMessage({ content: '!xd ping', authorId: 'spammer' });
    const other = createMockMessage({ content: '!xd ping', authorId: 'someone-else' });

    await handler(first as any);
    await handler(second as any);
    await handler(third as any);
    await handler(other as any);

    expect(first.channel.sendMessage).toHaveBeenCalledOnce();
    expect(second.channel.sendMessage).toHaveBeenCalledOnce();
    expect(third.channel.sendMessage).not.toHaveBeenCalled();
    expect(other.channel.sendMessage).toHaveBeenCalledOnce();
  });

  it('replies with a fixed error message when the router throws', async () => {
    const { handler } = setup({
      route: async () => {
        throw new Error('boom: secret details');
      },
    });
    const message = createMockMessage({ content: '!xd ping', authorId: 'user-01' });
    await handler(message as any);

    const send = message.channel.sendMessage as unknown as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledOnce();
    const content: string = send.mock.calls[0][0].content;
    expect(content).toMatch(/unexpected error/i);
    expect(content).not.toContain('secret details');
  });
});
