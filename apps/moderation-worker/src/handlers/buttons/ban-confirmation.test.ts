import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleBanConfirmButton,
  handleBanCancelButton,
  isBanConfirmButton,
  isBanCancelButton,
} from './ban-confirmation.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { encodeBase64Url } from '../../utils/response.js';
import * as presetApi from '../../services/preset-api.js';

// Mock modules
vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
  };
});

describe('handleBanConfirmButton', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    env = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1,mod-2',
      MODERATION_CHANNEL_ID: 'channel-mod',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret',
      DB: undefined as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };

    ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should return error when user ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm_user-123_TestUser' },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button interaction');
    expect(json.data.flags).toBe(64);
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm_user-123_TestUser' },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('do not have permission');
  });

  it('should return error for invalid custom_id format', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm_invalidformat' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button data');
  });

  it('should return error when target user ID is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm__TestUser' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid target user');
  });

  it('should open ban reason modal with correct data', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = encodeBase64Url('TestUser');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_user-123_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe(`ban_reason_modal_user-123_${encodedUsername}`);
    expect(json.data.title).toBe('Ban Reason');
    expect(json.data.components[0].components[0]).toEqual(
      expect.objectContaining({
        type: 4,
        custom_id: 'ban_reason',
        label: 'Reason for banning this user',
        style: 2,
        min_length: 10,
        max_length: 500,
        required: true,
        placeholder: expect.stringContaining('Explain why'),
      })
    );
  });

  it('should parse custom_id with underscore in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = encodeBase64Url('Test_User_Name');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_user-456_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe(`ban_reason_modal_user-456_${encodedUsername}`);
  });

  it('should handle user object instead of member', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = encodeBase64Url('TestUser');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_user-123_${encodedUsername}` },
      user: { id: 'mod-1', username: 'Moderator' },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
  });

  it('should extract user ID correctly from beginning of custom_id', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = encodeBase64Url('Username');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.custom_id).toBe(`ban_reason_modal_123456789012345678_${encodedUsername}`);
  });

  it('should handle special characters in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = encodeBase64Url('User.Name-123');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_user-123_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.custom_id).toBe(`ban_reason_modal_user-123_${encodedUsername}`);
  });
});

describe('handleBanCancelButton', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    env = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1,mod-2',
      MODERATION_CHANNEL_ID: 'channel-mod',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret',
      DB: undefined as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };

    ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should update message with cancellation', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_cancel_user-123' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanCancelButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.embeds[0]).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Cancelled'),
        description: 'The ban action was cancelled.',
        color: 0x5865f2,
      })
    );
    expect(json.data.components).toEqual([]);
  });

  it('should remove all components from message', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_cancel_user-456' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanCancelButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.components).toHaveLength(0);
  });

  it('should work without requiring moderator check', async () => {
    // Ban cancel doesn't check moderator status - any user who had access to the button can cancel
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_cancel_user-123' },
      user: { id: 'any-user', username: 'AnyUser' },
    };

    const response = await handleBanCancelButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
  });
});

describe('isBanConfirmButton', () => {
  it('should return true for ban confirm buttons', () => {
    expect(isBanConfirmButton('ban_confirm_user-123_TestUser')).toBe(true);
    expect(isBanConfirmButton('ban_confirm_456_AnotherUser')).toBe(true);
  });

  it('should return false for other buttons', () => {
    expect(isBanConfirmButton('ban_cancel_user-123')).toBe(false);
    expect(isBanConfirmButton('preset_approve_123')).toBe(false);
    expect(isBanConfirmButton('other_button')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBanConfirmButton('')).toBe(false);
  });

  it('should return false for partial match', () => {
    expect(isBanConfirmButton('ban_confirm')).toBe(false);
  });
});

describe('isBanCancelButton', () => {
  it('should return true for ban cancel buttons', () => {
    expect(isBanCancelButton('ban_cancel_user-123')).toBe(true);
    expect(isBanCancelButton('ban_cancel_456')).toBe(true);
  });

  it('should return false for other buttons', () => {
    expect(isBanCancelButton('ban_confirm_user-123_TestUser')).toBe(false);
    expect(isBanCancelButton('preset_reject_123')).toBe(false);
    expect(isBanCancelButton('other_button')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBanCancelButton('')).toBe(false);
  });

  it('should return false for partial match', () => {
    expect(isBanCancelButton('ban_cancel')).toBe(false);
  });
});
