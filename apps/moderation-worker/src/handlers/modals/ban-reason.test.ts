import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleBanReasonModal, isBanReasonModal } from './ban-reason.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { createMockD1Database } from '@xivdyetools/test-utils';
import { encodeBase64Url } from '../../utils/response.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import * as discordApi from '../../utils/discord-api.js';

// Mock modules
vi.mock('../../utils/discord-api.js', () => {
  const sendMessage = vi.fn();
  // BUG-035: handlers call the safe wrappers; alias to the same mocks
  return { sendMessage, safeSendMessage: sendMessage };
});

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
  };
});

vi.mock('../../services/ban-service.js', () => ({
  banUser: vi.fn(),
  // FINDING-007: the modal custom_id carries only the id; the username is
  // resolved from D1 at submit time
  getPresetAuthorName: vi.fn(),
}));

describe('handleBanReasonModal', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let db: ReturnType<typeof createMockD1Database>;

  beforeEach(() => {
    db = createMockD1Database();
    vi.clearAllMocks();
    vi.useFakeTimers();

    env = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1,mod-2',
      MODERATION_CHANNEL_ID: 'channel-mod',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: db as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };

    // Mock ctx.waitUntil to immediately execute the promise
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return error when moderator ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'User violated community guidelines repeatedly',
              },
            ],
          },
        ],
      },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(json.data.embeds[0].description).toContain('Invalid modal submission');
    expect(json.data.flags).toBe(64);
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'User violated community guidelines repeatedly',
              },
            ],
          },
        ],
      },
      member: { user: { id: '123456789012345678', username: 'NormalUser' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('do not have permission');
  });

  it('should return error for invalid custom_id format', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_invalidformat',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid reason here that is long enough',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('Invalid modal data');
  });

  it('should return error when target user ID is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal__TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason here',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('Invalid target user');
  });

  it('should return error when reason is too short', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Too short',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('at least 10 characters');
  });

  it('should return error when reason is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('valid ban reason');
  });

  it('FINDING-007: resolves the target username from D1 when the custom_id carries only the id', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    // Once — vi.clearAllMocks() keeps implementations, so a sticky value would
    // leak into the legacy-suffix tests below
    vi.mocked(banService.getPresetAuthorName).mockResolvedValueOnce('ResolvedFromDb');
    vi.mocked(banService.banUser).mockResolvedValue({ success: true, presetsHidden: 2 });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678',
        components: [
          {
            type: 1,
            components: [{ type: 4, custom_id: 'ban_reason', value: 'Repeatedly posted inappropriate content' }],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.embeds[0].description).toContain('ResolvedFromDb');
    expect(banService.getPresetAuthorName).toHaveBeenCalledWith(env.DB, '123456789012345678');
    expect(banService.banUser).toHaveBeenCalledWith(
      env.DB,
      '123456789012345678',
      'ResolvedFromDb',
      'mod-1',
      'Repeatedly posted inappropriate content',
    );
  });

  it('should return processing message and ban user', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 5,
    });

    const encodedUsername = encodeBase64Url('BadUser');
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: `ban_reason_modal_123456789012345678_${encodedUsername}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Repeatedly posted inappropriate content',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanReasonModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.embeds[0]).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Processing Ban'),
        description: expect.stringContaining('BadUser'),
        color: 0xfee75c,
      }),
    );
    expect(json.data.components).toEqual([]);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('should ban user and send success message', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 7,
    });

    const encodedUsername = encodeBase64Url('SpamUser');
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: `ban_reason_modal_123456789012345679_${encodedUsername}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Spamming inappropriate presets',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'ModUser' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(banService.banUser).toHaveBeenCalledWith(
      db,
      '123456789012345679',
      'SpamUser',
      'mod-1',
      'Spamming inappropriate presets',
    );
    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('User Banned'),
            description: expect.stringContaining('SpamUser'),
            color: 0xed4245,
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'User ID', value: '123456789012345679' }),
              expect.objectContaining({ name: 'Presets Hidden', value: '7' }),
              expect.objectContaining({ name: 'Banned By', value: 'ModUser' }),
              expect.objectContaining({ name: 'Reason', value: 'Spamming inappropriate presets' }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('should not send message when moderation channel is not configured', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 3,
    });

    env.MODERATION_CHANNEL_ID = undefined as unknown as string;

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason here',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle ban failure', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: false,
      presetsHidden: 0,
      error: 'User is already banned',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Attempted to ban already banned user',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith('test-bot-token', 'channel-mod', {
      embeds: [
        {
          color: 16711680,
          description: 'User is already banned',
          title: '❌ Ban Failed',
        },
      ],
    });
  });

  it('should handle unexpected errors during ban', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockRejectedValue(new Error('Database connection lost'));

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason here',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Failed'),
            description: expect.stringContaining('Database connection lost'),
          }),
        ]),
      }),
    );
  });

  it('should parse custom_id with underscores in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 2,
    });

    const encodedUsername = encodeBase64Url('Test_User_Name');
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: `ban_reason_modal_123456789012345680_${encodedUsername}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(banService.banUser).toHaveBeenCalledWith(
      db,
      '123456789012345680',
      'Test_User_Name',
      'mod-1',
      'Valid ban reason',
    );
  });

  it('should use fallback moderator name when username is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 1,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason',
              },
            ],
          },
        ],
      },
      user: { id: 'mod-1', username: 'Moderator' },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Banned By', value: 'Moderator' }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('should handle special characters in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 0,
    });

    const encodedUsername = encodeBase64Url('User.Name-123');
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: `ban_reason_modal_123456789012345678_${encodedUsername}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason here',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(banService.banUser).toHaveBeenCalledWith(
      db,
      '123456789012345678',
      'User.Name-123',
      'mod-1',
      'Valid ban reason here',
    );
  });

  it('should display timestamp in success message', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 4,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            timestamp: '2025-01-15T12:00:00.000Z',
          }),
        ]),
      }),
    );
  });

  it('should include footer with instructions', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.banUser).mockResolvedValue({
      success: true,
      presetsHidden: 2,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'ban_reason_modal_123456789012345678_TestUser',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'ban_reason',
                value: 'Valid ban reason',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handleBanReasonModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            footer: expect.objectContaining({
              text: expect.stringContaining('/preset unban_user'),
            }),
          }),
        ]),
      }),
    );
  });
});

describe('isBanReasonModal', () => {
  it('should return true for ban reason modals', () => {
    expect(isBanReasonModal('ban_reason_modal_123456789012345678_TestUser')).toBe(true);
    expect(isBanReasonModal('ban_reason_modal_456_AnotherUser')).toBe(true);
  });

  it('should return false for other modals', () => {
    expect(isBanReasonModal('preset_reject_modal_123')).toBe(false);
    expect(isBanReasonModal('preset_revert_modal_456')).toBe(false);
    expect(isBanReasonModal('other_modal')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBanReasonModal('')).toBe(false);
  });

  it('should return false for partial match', () => {
    expect(isBanReasonModal('ban_reason_modal')).toBe(false);
  });
});

// ============================================================================
// 2026-08-21 security audit — FINDING-019 / FINDING-034 (MOD-8)
// ============================================================================
describe('ban reason modal — security audit remediations', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let db: ReturnType<typeof createMockD1Database>;
  const TARGET = '123456789012345678';

  const modal = (reason: string, username = 'Moderator') => ({
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    data: {
      custom_id: `ban_reason_modal_${TARGET}`,
      components: [{ type: 1, components: [{ type: 4, custom_id: 'ban_reason', value: reason }] }],
    },
    member: { user: { id: 'mod-1', username } },
  });

  const flushWaitUntil = async () => {
    const calls = vi.mocked(ctx.waitUntil).mock.calls;
    const p = calls[calls.length - 1]?.[0];
    if (p) await p;
  };

  beforeEach(() => {
    db = createMockD1Database();
    vi.clearAllMocks();
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    env = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1,mod-2',
      MODERATION_CHANNEL_ID: 'channel-mod',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: db as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('FINDING-019: the D1-sourced username, moderator name and reason are sanitised everywhere they render', async () => {
    vi.mocked(banService.getPresetAuthorName).mockResolvedValueOnce('[Bad](https://evil.example) @everyone');
    vi.mocked(banService.banUser).mockResolvedValueOnce({ success: true, presetsHidden: 2 });

    const response = await handleBanReasonModal(
      modal('**spam** <@&123456789012345678>\nline two', '@here Mod'),
      env,
      ctx,
    );
    const json = (await response.json()) as any;

    // the immediate UPDATE_MESSAGE
    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.embeds[0].description).not.toMatch(/\[Bad\]\(https:\/\/evil\.example\)/);
    expect(json.data.embeds[0].description).not.toContain('@everyone');

    await flushWaitUntil();

    // the channel post
    const post = vi.mocked(discordApi.sendMessage).mock.calls.at(-1)?.[2] as any;
    const embed = post.embeds[0];
    expect(embed.description).not.toMatch(/\[Bad\]\(https:\/\/evil\.example\)/);
    expect(embed.description).not.toContain('@everyone');
    const fields: Array<{ name: string; value: string }> = embed.fields;
    expect(fields.find((f) => f.name === 'Banned By')!.value).not.toContain('@here');
    expect(fields.find((f) => f.name === 'Reason')!.value).toBe(
      '\\*\\*spam\\*\\* @123456789012345678\nline two',
    );
    // the stored reason is the moderator's raw text (sanitising is a render concern)
    expect(banService.banUser).toHaveBeenCalledWith(
      env.DB,
      TARGET,
      '[Bad](https://evil.example) @everyone',
      'mod-1',
      '**spam** <@&123456789012345678>\nline two',
    );
  });

  it('MOD-8: a failed ban posts only the service message and logs the cause', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
    vi.mocked(banService.getPresetAuthorName).mockResolvedValueOnce('Someone');
    const cause = new Error('D1_ERROR: disk I/O error: SQLITE_IOERR');
    vi.mocked(banService.banUser).mockResolvedValueOnce({
      success: false,
      presetsHidden: 0,
      error: 'Failed to ban user.',
      cause,
    });

    await handleBanReasonModal(modal('A valid reason for the ban'), env, ctx, logger);
    await flushWaitUntil();

    const post = vi.mocked(discordApi.sendMessage).mock.calls.at(-1)?.[2] as any;
    expect(post.embeds[0].description).toBe('Failed to ban user.');
    expect(post.embeds[0].description).not.toContain('SQLITE');
    expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Ban failed'), cause);
  });

  it('MOD-8: a thrown D1 error is not echoed into the channel', async () => {
    vi.mocked(banService.getPresetAuthorName).mockResolvedValueOnce('Someone');
    vi.mocked(banService.banUser).mockRejectedValueOnce(
      new Error('D1_ERROR: UNIQUE constraint failed: banned_users.discord_id: SQLITE_CONSTRAINT'),
    );

    await handleBanReasonModal(modal('A valid reason for the ban'), env, ctx);
    await flushWaitUntil();

    const post = vi.mocked(discordApi.sendMessage).mock.calls.at(-1)?.[2] as any;
    expect(post.embeds[0].description).not.toContain('banned_users');
    expect(post.embeds[0].description).not.toContain('SQLITE');
    expect(post.embeds[0].description).toContain('An unexpected error occurred');
  });
});
