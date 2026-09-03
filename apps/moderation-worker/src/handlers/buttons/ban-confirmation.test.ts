import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleBanConfirmButton,
  handleBanCancelButton,
  isBanConfirmButton,
  isBanCancelButton,
} from './ban-confirmation.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { base64UrlEncode } from '@xivdyetools/auth/encoding';
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
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
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
      data: { custom_id: 'ban_confirm_123456789012345678_TestUser' },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.content).toContain('Invalid button interaction');
    expect(json.data.flags).toBe(64);
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm_123456789012345678_TestUser' },
      member: { user: { id: '123456789012345678', username: 'NormalUser' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

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
    const json = (await response.json()) as any;

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
    const json = (await response.json()) as any;

    expect(json.data.content).toContain('Invalid target user');
  });

  it('should open ban reason modal with correct data', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = base64UrlEncode('TestUser');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345678');
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
      }),
    );
  });

  it('should parse custom_id with underscore in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = base64UrlEncode('Test_User_Name');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345679_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345679');
  });

  it('should handle user object instead of member', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = base64UrlEncode('TestUser');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      user: { id: 'mod-1', username: 'Moderator' },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
  });

  it('should extract user ID correctly from beginning of custom_id', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = base64UrlEncode('Username');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345678');
  });

  it('should handle special characters in username', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    const encodedUsername = base64UrlEncode('User.Name-123');

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345678');
  });
});

describe('handleBanConfirmButton — FINDING-007 (custom_id carries only the id)', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
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
      DB: undefined as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
  });

  it('opens the reason modal for a bare ban_confirm_<id> and keeps the modal custom_id id-only', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_confirm_123456789012345678' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345678');
    expect((json.data.custom_id as string).length).toBeLessThanOrEqual(100);
  });

  it('still accepts a legacy custom_id that carries a username but never echoes it into the modal id', async () => {
    const encodedUsername = base64UrlEncode('彩'.repeat(32));
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `ban_confirm_123456789012345678_${encodedUsername}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanConfirmButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe('ban_reason_modal_123456789012345678');
  });
});

describe('handleBanCancelButton', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // MOD-12 (FINDING-034): cancel is moderator-gated like every other button
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
      data: { custom_id: 'ban_cancel_123456789012345678' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanCancelButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.embeds[0]).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Cancelled'),
        description: 'The ban action was cancelled.',
        color: 0x5865f2,
      }),
    );
    expect(json.data.components).toEqual([]);
  });

  it('should remove all components from message', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'ban_cancel_123456789012345679' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handleBanCancelButton(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.components).toHaveLength(0);
  });

});

describe('isBanConfirmButton', () => {
  it('should return true for ban confirm buttons', () => {
    expect(isBanConfirmButton('ban_confirm_123456789012345678_TestUser')).toBe(true);
    expect(isBanConfirmButton('ban_confirm_456_AnotherUser')).toBe(true);
  });

  it('should return false for other buttons', () => {
    expect(isBanConfirmButton('ban_cancel_123456789012345678')).toBe(false);
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
    expect(isBanCancelButton('ban_cancel_123456789012345678')).toBe(true);
    expect(isBanCancelButton('ban_cancel_456')).toBe(true);
  });

  it('should return false for other buttons', () => {
    expect(isBanCancelButton('ban_confirm_123456789012345678_TestUser')).toBe(false);
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

// ============================================================================
// 2026-08-21 security audit — FINDING-034 (MOD-12) / FINDING-019
// ============================================================================
describe('handleBanCancelButton — MOD-12 moderator gate', () => {
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
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: undefined as unknown as D1Database,
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
  });

  it('denies a non-moderator (uniform with every other button)', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const response = await handleBanCancelButton(
      {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        data: { custom_id: 'ban_cancel_123456789012345678' },
        user: { id: '999999999999999999', username: 'AnyUser' },
      },
      env,
      ctx,
    );
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(json.data.flags).toBe(64);
    expect(json.data.content).toContain('do not have permission');
  });

  it('denies when the user cannot be identified', async () => {
    const response = await handleBanCancelButton(
      { id: 'int-1', token: 'token-1', application_id: 'app-123', data: { custom_id: 'ban_cancel_1' } },
      env,
      ctx,
    );
    const json = (await response.json()) as any;
    expect(json.data.flags).toBe(64);
  });

  it('a moderator still gets the UPDATE_MESSAGE with allowed_mentions (FINDING-019)', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const response = await handleBanCancelButton(
      {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        data: { custom_id: 'ban_cancel_123456789012345678' },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
      },
      env,
      ctx,
    );
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.components).toEqual([]);
  });
});
