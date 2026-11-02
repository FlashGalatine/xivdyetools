import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockMessage } from './test-utils/revolt-mocks.js';
import { CommandThrottle } from './services/command-throttle.js';
import { MessageContextStore } from './services/message-context.js';

const runtime = vi.hoisted(() => ({
  events: new Map<string, (...args: unknown[]) => unknown>(),
  login: vi.fn().mockResolvedValue(undefined),
  errors: vi.fn(),
  configs: vi.fn(),
}));
vi.mock('revolt.js', () => ({
  Client: class {
    on(event: string, callback: (...args: unknown[]) => unknown) {
      runtime.events.set(event, callback);
    }
    loginBot = runtime.login;
  },
}));
vi.mock('./config.js', () => ({
  loadConfig: () => ({ botToken: 'synthetic-login-token', authorizedUsers: [] }),
}));
vi.mock('@xivdyetools/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/logger')>();
  return {
    ...actual,
    createLibraryLogger: (...args: Parameters<typeof actual.createLibraryLogger>) => {
      runtime.configs(...args);
      const logger = actual.createLibraryLogger(...args);
      const error = logger.error.bind(logger);
      logger.error = (...params) => {
        runtime.errors(...params);
        error(...params);
      };
      return logger;
    },
  };
});

const details = [
  'diagnostic',
  'Bearer synthetic-bearer',
  'https://discord.com/api/webhooks/123/synthetic-webhook',
  'https://discord.com/api/interactions/456/synthetic-interaction/callback',
];
let lines: string[];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  runtime.events.clear();
  runtime.login.mockResolvedValue(undefined);
  lines = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) =>
    lines.push(JSON.stringify(args)),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  // Import the actual bootstrap safely: no network client or process listeners.
  vi.spyOn(process, 'on').mockReturnValue(process);
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});
afterEach(() => vi.restoreAllMocks());

function expectSafeOutput(message: string, context: Record<string, unknown>) {
  expect(runtime.errors).toHaveBeenCalledExactlyOnceWith(message, undefined, context);
  expect(lines).toHaveLength(1);
  const args = JSON.parse(lines[0]) as unknown[];
  // Pretty output carries context inline; a synthetic error would be a second console argument.
  expect(args).toHaveLength(1);
  expect(args[0]).toContain(message);
  const line = String(args[0]);
  const outputContext = JSON.parse(line.slice(line.indexOf('{')));
  expect(outputContext).toEqual({
    ...context,
    error: context.error === 'diagnostic' ? 'diagnostic' : '[REDACTED]',
  });
  for (const secret of [
    'synthetic-bearer',
    'synthetic-webhook',
    'synthetic-interaction',
    'synthetic-login-token',
  ]) {
    expect(lines.join('\n')).not.toContain(secret);
  }
}

describe('H-STOAT context-only errors', () => {
  it.each(details.flatMap((value) => [new Error(value), value]))(
    'retains and redacts gateway details (%s)',
    async (failure) => {
      await import('./index.js');
      runtime.events.get('error')!(failure);
      expect(runtime.login).toHaveBeenCalledExactlyOnceWith('synthetic-login-token');
      expectSafeOutput('Gateway error', {
        error: failure instanceof Error ? failure.message : failure,
      });
      expect(runtime.configs).toHaveBeenCalledWith('stoat', { level: 'info' });
      expect(process.exit).not.toHaveBeenCalled();
    },
  );

  it.each(details.flatMap((value) => [new Error(value), value]))(
    'retains and redacts startup failure details (%s)',
    async (failure) => {
      runtime.login.mockRejectedValue(failure);
      await import('./index.js');
      await vi.waitFor(() => expect(process.exit).toHaveBeenCalledExactlyOnceWith(1));
      expectSafeOutput('Fatal error during startup', {
        error: failure instanceof Error ? failure.message : failure,
      });
    },
  );

  it.each(details)(
    'retains registered command context and redacts handler failure details (%s)',
    async (detail) => {
      const { createMessageHandler } = await import('./message-handler.js');
      const handler = createMessageHandler({
        client: { user: { id: 'bot-id' } },
        config: { botToken: 'synthetic-login-token', authorizedUsers: [] },
        throttle: new CommandThrottle(),
        messageContextStore: new MessageContextStore(),
        route: async () => {
          throw new Error(detail);
        },
      });
      const message = createMockMessage({ content: '!xd info Snow White', authorId: 'human-id' });
      await handler(message as never);
      expectSafeOutput('Unhandled error in command handler', {
        command: 'dye',
        subcommand: 'info',
        error: detail,
      });
      expect(runtime.configs).toHaveBeenCalledExactlyOnceWith('stoat');
      expect(message.channel.sendMessage).toHaveBeenCalledWith({
        content: 'An unexpected error occurred. Please try again later.',
        replies: [{ id: message.id, mention: false }],
      });
      expect(lines.join('\n')).not.toContain('human-id');
      expect(lines.join('\n')).not.toContain('Snow White');
    },
  );
});
