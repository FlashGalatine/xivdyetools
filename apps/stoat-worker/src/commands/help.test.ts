/**
 * Tests for commands/help.ts
 *
 * Covers handleHelpCommand for overview and per-command help.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleHelpCommand, HELP_TOPICS } from './help.js';
import { isRegisteredCommand } from '../router.js';
import { parseCommand } from './parser.js';
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

  // Topics the router does not serve have no command page; they get the overview.
  it.each(['harmony', 'match', 'gradient', 'mixer', 'comparison'])(
    'unknown topic "%s" falls back to the overview, not a command page',
    async (topic) => {
      const ctx = createHelpContext([topic]);
      await handleHelpCommand(ctx);

      const call = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.content).toContain('Command Reference');
    },
  );

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

  // BUG-072: names are matched in English (info.ts has no per-user locale), so
  // help must not promise localized names or show a Japanese example.
  it('does not promise localized-name lookup', async () => {
    for (const args of [[], ['info']]) {
      const ctx = createHelpContext(args);
      await handleHelpCommand(ctx);
      const content = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0].content as string;
      expect(content.toLowerCase()).not.toContain('localized');
      expect(content).not.toContain('スノウホワイト');
    }
  });

  // BUG-103: the overview advertised THIRTEEN commands while COMMAND_ROUTES has
  // four. `!xd random` was listed here as though it worked and answered
  // `Unknown command "dye.random"`. Nothing tied the help text to the router,
  // so the two drifted silently -- this is that gate.
  describe('help never advertises a command the router does not serve', () => {
    it.each(HELP_TOPICS)('`!xd help %s` names a routed command', (topic) => {
      const parsed = parseCommand(`!xd ${topic}`);
      expect(parsed, `\`!xd ${topic}\` did not parse`).not.toBeNull();
      expect(
        isRegisteredCommand(parsed!.command, parsed!.subcommand),
        `help offers "${topic}" but the router has no route for it`
      ).toBe(true);
    });

    it('every `!xd <command>` shown in the overview actually routes', async () => {
      const ctx = createHelpContext();
      await handleHelpCommand(ctx);
      const content = (ctx.message.channel?.sendMessage as ReturnType<typeof vi.fn>).mock
        .calls[0][0].content as string;

      // Only the command table uses the `\`!xd <name>` backtick form; the
      // closing paragraph names unavailable commands in prose, deliberately.
      const table = content.split('More commands')[0];
      const advertised = [...table.matchAll(/`!xd (\w+)/g)].map((m) => m[1]);

      expect(advertised.length).toBeGreaterThan(0);
      for (const name of advertised) {
        const parsed = parseCommand(`!xd ${name}`);
        expect(parsed, `\`!xd ${name}\` did not parse`).not.toBeNull();
        expect(
          isRegisteredCommand(parsed!.command, parsed!.subcommand),
          `the overview advertises "${name}" but the router has no route for it`
        ).toBe(true);
      }
    });
  });
});
