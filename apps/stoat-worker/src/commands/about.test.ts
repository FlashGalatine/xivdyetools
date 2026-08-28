/**
 * Tests for commands/about.ts
 *
 * FINDING-023 / STOAT-1 (2026-08-21 security audit): the about card must link
 * to the live product hosts, never the unregistered `xivdyetools.com`.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleAboutCommand } from './about.js';
import { createMockMessage } from '../test-utils/revolt-mocks.js';
import { MessageContextStore } from '../services/message-context.js';
import type { CommandContext } from '../router.js';
import type { BotConfig } from '../config.js';

function createAboutContext(): CommandContext {
  const config: BotConfig = { botToken: 'test-token', authorizedUsers: [] };
  return {
    message: createMockMessage({ content: '!xd about' }) as any,
    parsed: { prefix: '!xd', command: 'about', subcommand: null, rawArgs: [] },
    config,
    messageContextStore: new MessageContextStore(),
  };
}

describe('handleAboutCommand', () => {
  it('links to xivdyetools.app and developers.xivdyetools.app only', async () => {
    const ctx = createAboutContext();
    await handleAboutCommand(ctx);

    const send = ctx.message.channel?.sendMessage as unknown as ReturnType<typeof vi.fn>;
    const payload = send.mock.calls[0][0];
    const description: string = payload.embeds[0].description;

    expect(description).toContain('https://xivdyetools.app');
    expect(description).toContain('https://developers.xivdyetools.app');
    expect(description).not.toMatch(/xivdyetools\.com/);
  });
});
