/**
 * FINDING-019 / STOAT-4 (2026-08-21 security audit): user text echoed back in
 * bot-authored messages (`No dye found matching "…"`, `Found N dyes matching
 * "…"`, `Unknown command …`) must be sanitised — no mass mentions, no live
 * markdown, no control characters, bounded length.
 */

import { describe, it, expect, vi } from 'vitest';
import { formatDisambiguationList, formatNoMatchReply, sanitizeEcho } from './response-formatter.js';
import { routeCommand, type CommandContext } from '../router.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from './message-context.js';
import type { ParsedCommand } from '../commands/parser.js';
import type { BotConfig } from '../config.js';

const HOSTILE = '@everyone **bold** [link](https://evil.example) `code` ​ <@01ARZ3NDEKTSV4RRFFQ69G5FAV>';

describe('formatNoMatchReply — echoed query is sanitised', () => {
  it('defuses mentions, escapes markdown and strips invisible characters', () => {
    const { content } = formatNoMatchReply('msg-01', HOSTILE, []);
    expect(content).not.toContain('@everyone');
    expect(content).not.toContain('**bold**');
    expect(content).not.toContain('[link](https://evil.example)');
    expect(content).not.toContain('​');
    expect(content).not.toContain('');
    expect(content).not.toContain('<@01ARZ3NDEKTSV4RRFFQ69G5FAV>');
  });

  it('caps the echoed query length', () => {
    const { content } = formatNoMatchReply('msg-01', 'x'.repeat(2000), []);
    expect(content?.length ?? Infinity).toBeLessThan(300);
  });
});

describe('formatDisambiguationList — echoed query is sanitised', () => {
  it('defuses mentions and escapes markdown', () => {
    const { content } = formatDisambiguationList(
      'msg-01',
      HOSTILE,
      [{ name: 'Snow White', itemID: 5729 }],
      1,
    );
    expect(content).not.toContain('@everyone');
    expect(content).not.toContain('**bold**');
    expect(content).not.toContain('[link](https://evil.example)');
    // Database-sourced dye names still render as-is
    expect(content).toContain('Snow White');
  });
});

describe('routeCommand — unknown command echo is sanitised', () => {
  function ctxFor(command: string): CommandContext {
    const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
    const parsed: ParsedCommand = { prefix: '!xd', command, subcommand: null, rawArgs: [] };
    return {
      message: createMockMessage({ content: `!xd ${command}` }) as any,
      parsed,
      config,
      messageContextStore: new MessageContextStore(),
    };
  }

  it('does not reproduce mentions or markdown from the unknown token', async () => {
    const ctx = ctxFor('@everyone`**x**');
    await routeCommand(ctx);
    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const content = send.mock.calls[0][0].content as string;
    expect(content).toMatch(/Unknown command/);
    expect(content).not.toContain('@everyone');
    expect(content).not.toContain('**x**');
  });

  it('caps the echoed token length', async () => {
    const ctx = ctxFor('z'.repeat(1500));
    await routeCommand(ctx);
    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const content = send.mock.calls[0][0].content as string;
    expect(content.length).toBeLessThan(200);
  });
});

/**
 * FINDING-026 (2026-10-03 security audit): Stoat's own mass mention
 * (`@online`, plus `@everyone`) and `<%ULID>` tokens (the form revolt.js 7.2.0
 * emits for servers, `Server#toString`; the presumed role-mention form) must
 * not survive in echoed text. The ZWJ goes right
 * after the `@`.
 */
describe('Stoat mass and role mentions are defused (FINDING-026)', () => {
  const ZWJ = '\u200d';
  const ROLE = '<%01ARZ3NDEKTSV4RRFFQ69G5FAV>';

  it('sanitizeEcho puts a ZWJ after @ for every mass-mention keyword, any case', () => {
    expect(sanitizeEcho('@online')).toBe(`@${ZWJ}online`);
    expect(sanitizeEcho('@ONLINE')).toBe(`@${ZWJ}ONLINE`);
    // No word-boundary condition: a keyword prefix is defused too.
    expect(sanitizeEcho('@onlinefoo')).toBe(`@${ZWJ}onlinefoo`);
    expect(sanitizeEcho('@Online2')).toBe(`@${ZWJ}Online2`);
    expect(sanitizeEcho('hi @OnLiNe and @everyone and @here')).toBe(
      `hi @${ZWJ}OnLiNe and @${ZWJ}everyone and @${ZWJ}here`,
    );
  });

  it('is not bypassed by invisible characters inside the keyword', () => {
    expect(sanitizeEcho('@on\u200bline')).toBe(`@${ZWJ}online`);
  });

  it('neutralises role mentions and user mentions, even with hidden characters', () => {
    expect(sanitizeEcho(ROLE)).not.toContain('<');
    expect(sanitizeEcho('<\u200b%01ARZ3NDEKTSV4RRFFQ69G5FAV>')).not.toContain('<%');
    expect(sanitizeEcho('<\u200b@01ARZ3NDEKTSV4RRFFQ69G5FAV>')).not.toContain('<@');
  });

  it('leaves ordinary text unchanged', () => {
    expect(sanitizeEcho('Snow White')).toBe('Snow White');
  });

  it('no-match reply defuses @online (and @ONLINE) in the echoed query', () => {
    const { content } = formatNoMatchReply('msg-01', 'x @online @ONLINE', []);
    expect(content).toContain(`@${ZWJ}online`);
    expect(content).toContain(`@${ZWJ}ONLINE`);
    expect(content).not.toMatch(/@(online|ONLINE)/);
  });

  it('disambiguation reply defuses @online and role mentions', () => {
    const { content } = formatDisambiguationList(
      'msg-01',
      `@online ${ROLE}`,
      [{ name: 'Snow White', itemID: 5729 }],
      1,
    );
    expect(content).toContain(`@${ZWJ}online`);
    expect(content).not.toMatch(/@online/);
    expect(content).not.toContain('<%');
    expect(content).toContain('Snow White');
  });

  it('normal queries are unchanged by the echo sites', () => {
    expect(formatNoMatchReply('msg-01', 'Snow Whte', []).content).toContain('"Snow Whte"');
    expect(
      formatDisambiguationList('msg-01', 'white', [{ name: 'Snow White', itemID: 5729 }], 1)
        .content,
    ).toContain('"white"');
  });

  it('unknown-command reply defuses @online', async () => {
    const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
    const parsed: ParsedCommand = {
      prefix: '!xd',
      command: '@online',
      subcommand: null,
      rawArgs: [],
    };
    const ctx: CommandContext = {
      message: createMockMessage({ content: '!xd @online' }) as any,
      parsed,
      config,
      messageContextStore: new MessageContextStore(),
    };
    await routeCommand(ctx);
    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const content = send.mock.calls[0][0].content as string;
    expect(content).toContain(`@${ZWJ}online`);
    expect(content).not.toMatch(/@online/);
  });
});
