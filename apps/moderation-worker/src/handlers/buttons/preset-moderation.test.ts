import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  handlePresetApproveButton,
  handlePresetRejectButton,
  handlePresetRevertButton,
  isPresetModerationButton,
} from './preset-moderation.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as discordApi from '../../utils/discord-api.js';

// Valid UUID v4 for testing (implementation requires valid UUID format)
const VALID_PRESET_ID = '12345678-1234-4123-8123-123456789abc';

// Mock modules
vi.mock('../../utils/discord-api.js', () => ({
  editMessage: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    approvePreset: vi.fn(),
    rejectPreset: vi.fn(),
    revertPreset: vi.fn(),
  };
});

describe('handlePresetApproveButton', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
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
      BOT_SIGNING_SECRET: 'test-signing-secret',
      DB: undefined as unknown as D1Database,
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

  it('should return error for invalid button data', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'preset_approve_' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetApproveButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button interaction');
    expect(json.data.flags).toBe(64);
  });

  it('should return error when user ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
    };

    const response = await handlePresetApproveButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button interaction');
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handlePresetApproveButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('do not have permission');
  });

  it('should return deferred update response', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Preset Submission',
            description: 'Test preset description',
            fields: [{ name: 'Author', value: 'Author', inline: true }],
            footer: { text: `ID: ${VALID_PRESET_ID}` },
            timestamp: '2025-01-15T10:00:00Z',
          },
        ],
      },
    };

    const response = await handlePresetApproveButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('should approve preset and update message', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Preset Submission',
            description: 'Test preset description',
            fields: [{ name: 'Author', value: 'Author', inline: true }],
            footer: { text: `ID: ${VALID_PRESET_ID}` },
            timestamp: '2025-01-15T10:00:00Z',
          },
        ],
      },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(presetApi.approvePreset).toHaveBeenCalledWith(env, VALID_PRESET_ID, 'mod-1');
    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'msg-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Approved'),
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Action',
                value: 'Approved by Moderator',
              }),
            ]),
          }),
        ]),
        components: [],
      })
    );
  });

  it('should send log message to submission log channel', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Amazing Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset', description: 'Test' }],
      },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-log',
      {
        embeds: [
          {
            color: 5763719,
            description: 'Preset approved by Moderator',
            footer: {
              text: `ID: ${VALID_PRESET_ID}`,
            },
            title: '✅ Amazing Preset - Approved',
          },
        ],
      }
    );
  });

  it('should not send log message when log channel is not configured', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    env.SUBMISSION_LOG_CHANNEL_ID = undefined;

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset' }],
      },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle approval errors gracefully', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockRejectedValue(new Error('API connection failed'));

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Original Title',
            description: 'Original Description',
            color: 0xfee75c,
            fields: [{ name: 'Field', value: 'Value' }],
          },
        ],
      },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'msg-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: 'Original Title',
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Error',
                value: expect.stringContaining('Failed to approve'),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should handle missing channel_id gracefully', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.editMessage).not.toHaveBeenCalled();
  });

  it('should use fallback username when username is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.approvePreset).mockResolvedValue({
      id: VALID_PRESET_ID,
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'approved',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_approve_${VALID_PRESET_ID}` },
      user: { id: 'mod-1', username: 'Moderator' },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset' }],
      },
    };

    await handlePresetApproveButton(interaction, env, ctx);
    // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.editMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                value: 'Approved by Moderator',
              }),
            ]),
          }),
        ]),
      })
    );
  });
});

describe('handlePresetRejectButton', () => {
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

    // Mock ctx.waitUntil to immediately execute the promise
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should return error for invalid button data', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'preset_reject_' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRejectButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button interaction');
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_reject_${VALID_PRESET_ID}` },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handlePresetRejectButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('do not have permission');
  });

  it('should return modal for rejection reason', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_reject_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRejectButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe(`preset_reject_modal_${VALID_PRESET_ID}`);
    expect(json.data.title).toBe('Reject Preset');
    expect(json.data.components[0].components[0].custom_id).toBe('rejection_reason');
    expect(json.data.components[0].components[0].min_length).toBe(10);
    expect(json.data.components[0].components[0].max_length).toBe(500);
    expect(json.data.components[0].components[0].required).toBe(true);
  });
});

describe('handlePresetRevertButton', () => {
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

    // Mock ctx.waitUntil to immediately execute the promise
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should return error for invalid button data', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: 'preset_revert_' },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRevertButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('Invalid button interaction');
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_revert_${VALID_PRESET_ID}` },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handlePresetRevertButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.data.content).toContain('do not have permission');
  });

  it('should return modal for revert reason', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: { custom_id: `preset_revert_${VALID_PRESET_ID}` },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRevertButton(interaction, env, ctx);
    const json = await response.json() as any;

    expect(json.type).toBe(InteractionResponseType.MODAL);
    expect(json.data.custom_id).toBe(`preset_revert_modal_${VALID_PRESET_ID}`);
    expect(json.data.title).toBe('Revert Preset Edit');
    expect(json.data.components[0].components[0].custom_id).toBe('revert_reason');
    expect(json.data.components[0].components[0].min_length).toBe(10);
    expect(json.data.components[0].components[0].max_length).toBe(200);
    expect(json.data.components[0].components[0].required).toBe(true);
  });
});

describe('isPresetModerationButton', () => {
  it('should return true for approve button', () => {
    expect(isPresetModerationButton('preset_approve_123')).toBe(true);
  });

  it('should return true for reject button', () => {
    expect(isPresetModerationButton('preset_reject_456')).toBe(true);
  });

  it('should return true for revert button', () => {
    expect(isPresetModerationButton('preset_revert_789')).toBe(true);
  });

  it('should return false for non-moderation buttons', () => {
    expect(isPresetModerationButton('ban_confirm_user')).toBe(false);
    expect(isPresetModerationButton('other_button')).toBe(false);
    expect(isPresetModerationButton('preset_invalid')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isPresetModerationButton('')).toBe(false);
  });
});
