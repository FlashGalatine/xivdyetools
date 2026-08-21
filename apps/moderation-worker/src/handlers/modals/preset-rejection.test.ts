import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  handlePresetRejectionModal,
  handlePresetRevertModal,
  isPresetRejectionModal,
  isPresetRevertModal,
} from './preset-rejection.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as discordApi from '../../utils/discord-api.js';

// Mock modules
vi.mock('../../utils/discord-api.js', () => {
  const editMessage = vi.fn();
  const sendMessage = vi.fn();
  // BUG-035: handlers call the safe wrappers; alias to the same mocks
  return { editMessage, sendMessage, safeEditMessage: editMessage, safeSendMessage: sendMessage };
});

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    rejectPreset: vi.fn(),
    revertPreset: vi.fn(),
  };
});

describe('handlePresetRejectionModal', () => {
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
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
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

  it('should return error when preset ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'This preset violates guidelines',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(json.data.embeds[0].description).toContain('Invalid modal submission');
    expect(json.data.flags).toBe(64);
  });

  it('should return error when user ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'This preset violates guidelines',
              },
            ],
          },
        ],
      },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('Invalid modal submission');
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'This preset violates guidelines',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('do not have permission');
  });

  it('should return error when reason is too short', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Too short',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
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
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('valid rejection reason');
  });

  it('should return deferred update response', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'rejected',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'This preset contains inappropriate content',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Original' }],
      },
    };

    const response = await handlePresetRejectionModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('should reject preset and update message', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'rejected',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Contains inappropriate imagery',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Preset Submission',
            description: 'A preset submission',
            fields: [{ name: 'Author', value: 'Author' }],
            footer: { text: 'ID: a0000000-0000-4000-8000-000000000001' },
            timestamp: '2025-01-15T10:00:00Z',
          },
        ],
      },
    };

    await handlePresetRejectionModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(presetApi.rejectPreset).toHaveBeenCalledWith(
      env,
      'a0000000-0000-4000-8000-000000000001',
      'mod-1',
      'Contains inappropriate imagery',
    );
    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'msg-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Rejected'),
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Action', value: 'Rejected by Moderator' }),
              expect.objectContaining({ name: 'Reason', value: 'Contains inappropriate imagery' }),
            ]),
          }),
        ]),
        components: [],
      }),
    );
  });

  it('should send log message to submission log channel', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Bad Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'rejected',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Violates community guidelines',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'ModUser' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset' }],
      },
    };

    await handlePresetRejectionModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith('test-bot-token', 'channel-log', {
      embeds: [
        {
          color: 15548997,
          description: 'Preset rejected by ModUser',
          fields: [
            {
              name: 'Reason',
              value: 'Violates community guidelines',
            },
          ],
          footer: {
            text: 'ID: a0000000-0000-4000-8000-000000000001',
          },
          title: '❌ Bad Preset - Rejected',
        },
      ],
    });
  });

  it('should not send log message when log channel is not configured', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'rejected',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
    });

    env.SUBMISSION_LOG_CHANNEL_ID = undefined;

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Inappropriate content',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset' }],
      },
    };

    await handlePresetRejectionModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle rejection errors gracefully', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockRejectedValue(new Error('Database error'));

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Valid rejection reason here',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Original Title',
            description: 'Original Description',
            color: 0xfee75c,
          },
        ],
      },
    };

    await handlePresetRejectionModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
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
                value: expect.stringContaining('Failed to reject'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('should use fallback username when username is missing', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.rejectPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Test Preset',
      description: 'Description',
      author_discord_id: 'author-1',
      author_name: 'Author',
      status: 'rejected',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T12:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_reject_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'rejection_reason',
                value: 'Invalid preset submission',
              },
            ],
          },
        ],
      },
      user: { id: 'mod-1', username: 'Moderator' },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Preset' }],
      },
    };

    await handlePresetRejectionModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
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
                value: 'Rejected by Moderator',
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});

describe('handlePresetRevertModal', () => {
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
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
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

  it('should return error when preset ID is missing', async () => {
    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'Edit was incorrect',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRevertModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('Invalid modal submission');
  });

  it('should deny access for non-moderators', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(false);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'Edit was incorrect',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'user-123', username: 'NormalUser' } },
    };

    const response = await handlePresetRevertModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('do not have permission');
  });

  it('should return error when reason is too short', async () => {
    vi.mocked(presetApi.isModerator).mockReturnValue(true);

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'Bad',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
    };

    const response = await handlePresetRevertModal(interaction, env, ctx);
    const json = (await response.json()) as any;

    expect(json.data.embeds[0].description).toContain('at least 10 characters');
  });

  it('should revert preset and update message', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.revertPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Reverted Preset',
      description: 'Original description',
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
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'The edit introduced errors in dye names',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Edit Review' }],
      },
    };

    await handlePresetRevertModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(presetApi.revertPreset).toHaveBeenCalledWith(
      env,
      'a0000000-0000-4000-8000-000000000001',
      'The edit introduced errors in dye names',
      'mod-1',
    );
    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'msg-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Reverted'),
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Preset', value: 'Reverted Preset' }),
              expect.objectContaining({ name: 'Action', value: 'Reverted by Moderator' }),
              expect.objectContaining({
                name: 'Reason',
                value: 'The edit introduced errors in dye names',
              }),
            ]),
          }),
        ]),
        components: [],
      }),
    );
  });

  it('should send log message to submission log channel', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.revertPreset).mockResolvedValue({
      id: 'a0000000-0000-4000-8000-000000000001',
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
      secondary_categories: [],
      preview_image_status: 'none',
    });

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'Edit was vandalism',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'ModUser' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [{ title: 'Edit' }],
      },
    };

    await handlePresetRevertModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.sendMessage).toHaveBeenCalledWith('test-bot-token', 'channel-log', {
      embeds: [
        {
          color: 5793266,
          description: 'Preset edit reverted by ModUser',
          fields: [
            {
              name: 'Reason',
              value: 'Edit was vandalism',
            },
          ],
          footer: {
            text: 'ID: a0000000-0000-4000-8000-000000000001',
          },
          title: '↩️ Test Preset - Edit Reverted',
        },
      ],
    });
  });

  it('should handle revert errors gracefully', async () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(presetApi.revertPreset).mockRejectedValue(new Error('No previous version'));

    const interaction = {
      id: 'int-1',
      token: 'token-1',
      application_id: 'app-123',
      data: {
        custom_id: 'preset_revert_modal_a0000000-0000-4000-8000-000000000001',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'revert_reason',
                value: 'Reverting this edit',
              },
            ],
          },
        ],
      },
      member: { user: { id: 'mod-1', username: 'Moderator' } },
      channel_id: 'channel-mod',
      message: {
        id: 'msg-1',
        embeds: [
          {
            title: 'Original',
            description: 'Description',
            color: 0x5865f2,
          },
        ],
      },
    };

    await handlePresetRevertModal(interaction, env, ctx);
    // Wait for waitUntil callback
    const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
      vi.mocked(ctx.waitUntil).mock.calls.length - 1
    ]?.[0];
    if (waitUntilPromise) await waitUntilPromise;

    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'msg-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Error',
                value: expect.stringContaining('Failed to revert'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});

describe('isPresetRejectionModal', () => {
  it('should return true for rejection modal', () => {
    expect(isPresetRejectionModal('preset_reject_modal_123')).toBe(true);
    expect(isPresetRejectionModal('preset_reject_modal_preset-456')).toBe(true);
  });

  it('should return false for other modals', () => {
    expect(isPresetRejectionModal('preset_revert_modal_123')).toBe(false);
    expect(isPresetRejectionModal('ban_reason_modal_user')).toBe(false);
    expect(isPresetRejectionModal('other_modal')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isPresetRejectionModal('')).toBe(false);
  });
});

describe('isPresetRevertModal', () => {
  it('should return true for revert modal', () => {
    expect(isPresetRevertModal('preset_revert_modal_123')).toBe(true);
    expect(isPresetRevertModal('preset_revert_modal_preset-456')).toBe(true);
  });

  it('should return false for other modals', () => {
    expect(isPresetRevertModal('preset_reject_modal_123')).toBe(false);
    expect(isPresetRevertModal('ban_reason_modal_user')).toBe(false);
    expect(isPresetRevertModal('other_modal')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isPresetRevertModal('')).toBe(false);
  });
});

// ============================================================================
// 2026-08-21 security audit — FINDING-019 / 020 (MOD-5)
// ============================================================================
describe('rejection / revert modals — security audit remediations', () => {
  let env: Env;
  let ctx: ExecutionContext;
  const PRESET_ID = 'a0000000-0000-4000-8000-000000000001';

  const modal = (
    customId: string,
    field: 'rejection_reason' | 'revert_reason',
    value: string,
    username = 'Moderator',
  ) => ({
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    data: {
      custom_id: customId,
      components: [{ type: 1, components: [{ type: 4, custom_id: field, value }] }],
    },
    member: { user: { id: 'mod-1', username } },
    channel_id: 'channel-mod',
    message: {
      id: 'msg-1',
      embeds: [{ title: 'Preset Submission', description: 'A preset submission', fields: [] }],
    },
  });

  const flushWaitUntil = async () => {
    const calls = vi.mocked(ctx.waitUntil).mock.calls;
    const p = calls[calls.length - 1]?.[0];
    if (p) await p;
  };

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
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('MOD-5 — modal preset ids must be UUID v4 (FINDING-020)', () => {
    it('rejection modal refuses a non-UUID id and never calls presets-api', async () => {
      const response = await handlePresetRejectionModal(
        modal('preset_reject_modal_../../presets/abc', 'rejection_reason', 'A perfectly valid reason'),
        env,
        ctx,
      );
      const json = (await response.json()) as any;

      expect(json.data.flags).toBe(64);
      expect(json.data.embeds[0].description).toContain('Invalid preset ID');
      expect(json.data.allowed_mentions).toEqual({ parse: [] });
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    it('revert modal refuses a non-UUID id and never calls presets-api', async () => {
      const response = await handlePresetRevertModal(
        modal('preset_revert_modal_not-a-uuid', 'revert_reason', 'A perfectly valid reason'),
        env,
        ctx,
      );
      const json = (await response.json()) as any;

      expect(json.data.embeds[0].description).toContain('Invalid preset ID');
      expect(presetApi.revertPreset).not.toHaveBeenCalled();
    });
  });

  describe('FINDING-019 — moderator name, reason and preset name are sanitised', () => {
    it('rejection: escapes markdown / mentions in the edited embed and the log message', async () => {
      vi.mocked(presetApi.rejectPreset).mockResolvedValueOnce({
        id: PRESET_ID,
        name: '[Evil](https://evil.example) preset',
      } as any);

      await handlePresetRejectionModal(
        modal(`preset_reject_modal_${PRESET_ID}`, 'rejection_reason', '**too loud** @everyone\nsecond line', '@here Mod'),
        env,
        ctx,
      );
      await flushWaitUntil();

      const edit = vi.mocked(discordApi.editMessage).mock.calls[0][3] as any;
      const fields: Array<{ name: string; value: string }> = edit.embeds[0].fields;
      const action = fields.find((f) => f.name === 'Action')!.value;
      const reason = fields.find((f) => f.name === 'Reason')!.value;
      expect(action).not.toContain('@here');
      expect(reason).toBe('\\*\\*too loud\\*\\* @‍everyone\nsecond line');

      const log = vi.mocked(discordApi.sendMessage).mock.calls[0][2] as any;
      expect(log.embeds[0].title).not.toMatch(/\[Evil\]\(https:\/\/evil\.example\)/);
      expect(log.embeds[0].description).not.toContain('@here');
    });

    it('revert: escapes the preset name and moderator name in the edited embed', async () => {
      vi.mocked(presetApi.revertPreset).mockResolvedValueOnce({
        id: PRESET_ID,
        name: '||spoiler|| `code`',
      } as any);

      await handlePresetRevertModal(
        modal(`preset_revert_modal_${PRESET_ID}`, 'revert_reason', 'Reverting a bad edit here', '_Mod_'),
        env,
        ctx,
      );
      await flushWaitUntil();

      const edit = vi.mocked(discordApi.editMessage).mock.calls[0][3] as any;
      const fields: Array<{ name: string; value: string }> = edit.embeds[0].fields;
      expect(fields.find((f) => f.name === 'Preset')!.value).toBe('\\|\\|spoiler\\|\\| \\`code\\`');
      expect(fields.find((f) => f.name === 'Action')!.value).toBe('Reverted by \\_Mod\\_');
    });
  });
});
