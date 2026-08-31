/**
 * Tests for message-handler.ts — the `messageCreate` gate that sits between
 * revolt.js and the command router.
 *
 * FINDING-035 / STOAT-2, STOAT-6 (2026-08-21 security audit): messages from
 * other bots are ignored (no bot-to-bot loops) and each user is throttled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Captured so FINDING-031 tests can assert on exactly what reached the
// logger — `createLibraryLogger('stoat')` is a module-level singleton in
// message-handler.ts, so this factory is only ever called once; every test
// below reads/clears the same mock instance.
vi.mock('@xivdyetools/logger', () => ({
  createLibraryLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { createLibraryLogger } from '@xivdyetools/logger';
import { createMessageHandler } from './message-handler.js';
import { createMockMessage, createMockChannel } from './test-utils/revolt-mocks.js';
import { MessageContextStore } from './services/message-context.js';
import { CommandThrottle } from './services/command-throttle.js';
import type { BotConfig } from './config.js';

const BOT_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const mockLogger = vi.mocked(createLibraryLogger).mock.results[0]!.value as {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

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
  beforeEach(() => {
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

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

  // FINDING-031 (2026-08-29 security audit): stoat shipped the author id,
  // channel id, and raw message text to stdout on every command, at a level
  // that is on by default. These pin the fixed shape — reverting either
  // source line (putting `userId`/`channelId`/`args` back) turns the
  // matching test red.
  describe('command logging omits user/channel identifiers (FINDING-031)', () => {
    it('logs the command, not the author id, when a command is throttled', async () => {
      const { handler } = setup({ throttle: new CommandThrottle({ limit: 1, windowMs: 10_000 }) });
      const first = createMockMessage({ content: '!xd ping', authorId: 'spammer-01' });
      const second = createMockMessage({ content: '!xd ping', authorId: 'spammer-01' });

      await handler(first as any);
      await handler(second as any);

      // The throttled (second) call logs the command, not who sent it.
      expect(mockLogger.debug).toHaveBeenCalledWith('Command dropped by per-user throttle', {
        command: 'ping',
        subcommand: null,
      });

      const dropCall = mockLogger.debug.mock.calls.find(
        ([msg]) => msg === 'Command dropped by per-user throttle',
      );
      expect(dropCall).toBeDefined();
      // Belt-and-braces: the author id must not appear anywhere in the call,
      // even under a renamed key.
      expect(JSON.stringify(dropCall)).not.toContain('spammer-01');
    });

    it('logs only the command for an accepted command — no channel id, no raw args', async () => {
      const { handler } = setup();
      const message = createMockMessage({
        content: '!xd info Snow White',
        authorId: 'user-01',
        channelId: 'channel-secret-99',
      });

      await handler(message as any);

      // Exact-arity match: a second (context) argument reappearing — even an
      // empty object — fails this, same as the message text changing.
      expect(mockLogger.debug).toHaveBeenCalledWith('Command: dye.info');

      const allDebugCalls = JSON.stringify(mockLogger.debug.mock.calls);
      expect(allDebugCalls).not.toContain('channel-secret-99');
      expect(allDebugCalls).not.toContain('Snow White');
      expect(allDebugCalls).not.toContain('user-01');
    });

    // S13-R5 (fix round 1): `parsed.command` is not a validated vocabulary —
    // parser.ts returns whatever token the user typed when it doesn't match
    // a registered route. router.ts already treats that same value as
    // untrusted user text one function away (`sanitizeEcho`, FINDING-019);
    // these prove the log lines go through `isRegisteredCommand` too, not
    // just around a fixed set of field names. Reverting either call site to
    // log `parsed.command`/`parsed.subcommand` directly (skipping
    // `loggableCommand`) turns the matching test red.
    it('logs a placeholder, not the user-typed token, when an unregistered command is throttled', async () => {
      const { handler } = setup({ throttle: new CommandThrottle({ limit: 1, windowMs: 10_000 }) });
      const first = createMockMessage({ content: '!xd blahblah', authorId: 'spammer-02' });
      const second = createMockMessage({ content: '!xd blahblah', authorId: 'spammer-02' });

      await handler(first as any);
      await handler(second as any);

      expect(mockLogger.debug).toHaveBeenCalledWith('Command dropped by per-user throttle', {
        command: '(unregistered)',
        subcommand: null,
      });

      const allDebugCalls = JSON.stringify(mockLogger.debug.mock.calls);
      expect(allDebugCalls).not.toContain('blahblah');
    });

    it('logs a placeholder, not the user-typed token, for an unregistered command', async () => {
      const { handler } = setup();
      const message = createMockMessage({ content: '!xd blahblah', authorId: 'user-02' });

      await handler(message as any);

      expect(mockLogger.debug).toHaveBeenCalledWith('Command: (unregistered)');

      const allDebugCalls = JSON.stringify(mockLogger.debug.mock.calls);
      expect(allDebugCalls).not.toContain('blahblah');
    });

    // S13-R6 (fix round 2): the error-handler log line looked safe because an
    // unregistered command doesn't throw *by itself* — but router.ts's own
    // "unknown command" fallback still does a live, unguarded `sendMessage`
    // (FINDING-019 sanitises what it *echoes*, not what a log line records),
    // and that call can reject on every mistype (permission error, rate
    // limit, network blip), not just on a registered handler's bug. Uses the
    // real `routeCommand` (no `route` override) so the fallback branch's
    // `sendMessage` actually runs and actually rejects.
    it('logs a placeholder, not the user-typed token, when the fallback reply to an unregistered command fails', async () => {
      const rejectingChannel = createMockChannel({
        sendMessage: vi.fn().mockRejectedValue(new Error('403: Missing Permission')),
      });
      const { handler } = setup();
      const message = createMockMessage({
        content: '!xd blahblah',
        authorId: 'user-03',
        channel: rejectingChannel,
      });

      await handler(message as any);

      // Confirms the real fallback branch actually ran (and rejected) rather
      // than this test silently exercising a different path.
      expect(rejectingChannel.sendMessage).toHaveBeenCalled();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled error in command handler',
        expect.objectContaining({ command: '(unregistered)', subcommand: null }),
      );

      const allErrorCalls = JSON.stringify(mockLogger.error.mock.calls);
      expect(allErrorCalls).not.toContain('blahblah');
    });
  });
});
