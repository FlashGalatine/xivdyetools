/**
 * revolt.js mock utilities for Stoat bot tests.
 *
 * Provides mock factories for Client, Message, and Channel objects
 * that mirror the revolt.js API surface used by the bot.
 */

import { vi } from 'vitest';

// ── Mock Channel ───────────────────────────────────────────────────────

export interface MockChannel {
  id: string;
  serverId: string | null;
  sendMessage: ReturnType<typeof vi.fn>;
}

export function createMockChannel(overrides?: Partial<MockChannel>): MockChannel {
  return {
    id: 'channel-01',
    serverId: 'server-01',
    sendMessage: vi.fn().mockResolvedValue({ id: 'sent-msg-01' }),
    ...overrides,
  };
}

// ── Mock Message ───────────────────────────────────────────────────────

export interface MockMessage {
  id: string;
  content: string | null;
  authorId: string;
  channelId: string;
  channel: MockChannel;
  attachments: unknown[];
  react: ReturnType<typeof vi.fn>;
  unreact: ReturnType<typeof vi.fn>;
  reply: ReturnType<typeof vi.fn>;
}

export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  const channel = overrides?.channel ?? createMockChannel();
  return {
    id: 'msg-01',
    content: '!xd info Snow White',
    authorId: 'user-01',
    channelId: channel.id,
    channel,
    attachments: [],
    react: vi.fn().mockResolvedValue(undefined),
    unreact: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ id: 'reply-01' }),
    ...overrides,
  };
}

// ── Mock Client ────────────────────────────────────────────────────────

export interface MockClientResult {
  /** The mock client object (pass to code under test) */
  client: {
    user: { id: string; username: string } | null;
    channels: { get: ReturnType<typeof vi.fn> };
    websocket: { connected: boolean; ready: boolean };
    api: {
      post: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    on: ReturnType<typeof vi.fn>;
    loginBot: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  /** Emit a fake event to trigger registered handlers */
  emit: (event: string, ...args: unknown[]) => void;
}

export function createMockClient(): MockClientResult {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  const client: MockClientResult['client'] = {
    user: { id: 'bot-user-01', username: 'XIV Dye Tools' },
    channels: { get: vi.fn() },
    websocket: { connected: true, ready: true },
    api: {
      post: vi.fn().mockResolvedValue(undefined),
      patch: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    loginBot: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
  };

  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of handlers.get(event) ?? []) {
      handler(...args);
    }
  };

  return { client, emit };
}
