import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockD1Database, createMockKV } from '@xivdyetools/test-utils';
import { handlePresetCommand } from './preset.js';
import { Translator } from '../../services/bot-i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import * as discordApi from '../../utils/discord-api.js';
import { encodeBase64Url } from '../../utils/response.js';

// Mock modules
vi.mock('../../utils/discord-api.js', () => ({
  editOriginalResponse: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    getPendingPresets: vi.fn(),
    approvePreset: vi.fn(),
    rejectPreset: vi.fn(),
    getModerationStats: vi.fn(),
  };
});

vi.mock('../../services/ban-service.js', () => ({
  getUserForBanConfirmation: vi.fn(),
  getActiveBan: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
}));

describe('handlePresetCommand', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let t: Translator;
  let db: ReturnType<typeof createMockD1Database>;
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    db = createMockD1Database();
    kv = createMockKV();
    vi.clearAllMocks();

    env = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1,mod-2,mod-3',
      MODERATION_CHANNEL_ID: 'channel-moderation',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-api-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret',
      DB: db as unknown as D1Database,
      KV: kv as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };

    // Mock ctx.waitUntil to immediately execute the promise
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    t = new Translator('en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('main handler', () => {
    it('should return error when user ID is not found', async () => {
      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        data: {
          name: 'preset',
          options: [{ name: 'moderate', type: 1 }],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('Could not identify user');
      expect(json.data.flags).toBe(64); // Ephemeral
    });

    it('should return error when no subcommand is provided', async () => {
      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        member: { user: { id: 'user-123', username: 'TestUser' } },
        data: {
          name: 'preset',
          options: [],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('Please specify a subcommand');
    });

    it('should return error for unknown subcommand', async () => {
      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        member: { user: { id: 'user-123', username: 'TestUser' } },
        data: {
          name: 'preset',
          options: [{ name: 'invalid_subcommand', type: 1 }],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('Unknown subcommand');
      expect(json.data.content).toContain('invalid_subcommand');
    });

    it('should route to moderate subcommand', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockResolvedValue([]);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'pending' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    });

    it('should route to ban_user subcommand', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: 'target-user',
          username: 'TargetUser',
          presetCount: 5,
        },
        recentPresets: [],
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(json.data.embeds[0].title).toContain('Confirm');
    });

    it('should route to unban_user subcommand', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: 'target-user',
        xivAuthId: null,
        username: 'TargetUser',
        reason: 'Ban reason',
        bannedAt: '2025-01-15T12:00:00Z',
        moderatorDiscordId: 'mod-1',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      vi.mocked(banService.unbanUser).mockResolvedValue({
        success: true,
        presetsRestored: 3,
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
      expect(json.data.flags).toBe(64); // Ephemeral
    });
  });

  describe('/preset moderate', () => {
    it('should deny access for non-moderators', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'user-123', username: 'NormalUser' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'pending' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.embeds[0].description).toContain("don't have permission");
      expect(json.data.flags).toBe(64);
    });

    it('should return error when action is missing', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [{ name: 'moderate', type: 1, options: [] }],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('Missing action');
    });

    it('should process pending action with no presets', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockResolvedValue([]);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'pending' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);

      // Wait for ctx.waitUntil to execute
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(ctx.waitUntil).toHaveBeenCalled();
      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('No presets'),
            }),
          ]),
        })
      );
    });

    it('should process pending action with presets', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockResolvedValue([
        {
          id: 'preset-1',
          name: 'Test Preset 1',
          description: 'Description 1',
          author_discord_id: 'author-1',
          author_name: 'Author One',
          status: 'pending',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
          category_id: 'jobs',
          dyes: [],
          tags: [],
          vote_count: 0,
          is_curated: false,
        },
        {
          id: 'preset-2',
          name: 'Test Preset 2',
          description: 'Description 2',
          author_discord_id: 'author-2',
          author_name: 'Author Two',
          status: 'pending',
          created_at: '2025-01-15T11:00:00Z',
          updated_at: '2025-01-15T11:00:00Z',
          category_id: 'aesthetics',
          dyes: [],
          tags: [],
          vote_count: 0,
          is_curated: false,
        },
      ]);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'pending' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('2 preset(s) pending'),
            }),
          ]),
        })
      );
    });

    it('should process approve action successfully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.approvePreset).mockResolvedValue({
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
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [
                { name: 'action', type: 3, value: 'approve' },
                { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(presetApi.approvePreset).toHaveBeenCalledWith(env, 'a0000000-0000-4000-8000-000000000001', 'mod-1', undefined);
      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Approved'),
            }),
          ]),
        })
      );
    });

    it('should send log message for approved preset', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.approvePreset).mockResolvedValue({
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
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [
                { name: 'action', type: 3, value: 'approve' },
                { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.sendMessage).toHaveBeenCalledWith(
        'test-bot-token',
        'channel-log',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Test Preset'),
              color: expect.any(Number),
            }),
          ]),
        })
      );
    });

    it('should return error when approve is missing preset_id', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'approve' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('specify a preset ID'),
            }),
          ]),
        })
      );
    });

    it('should process reject action successfully', async () => {
      vi.useFakeTimers();
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
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [
                { name: 'action', type: 3, value: 'reject' },
                { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
                { name: 'reason', type: 3, value: 'Contains inappropriate content' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(presetApi.rejectPreset).toHaveBeenCalledWith(
        env,
        'a0000000-0000-4000-8000-000000000001',
        'mod-1',
        'Contains inappropriate content'
      );
      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Rejected'),
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Reason',
                  value: 'Contains inappropriate content',
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should return error when reject is missing reason', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [
                { name: 'action', type: 3, value: 'reject' },
                { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('reason'),
            }),
          ]),
        })
      );
    });

    it('should process stats action successfully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationStats).mockResolvedValue({
        pending_count: 12,
        approved_count: 543,
        rejected_count: 87,
        flagged_count: 3,
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'stats' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Statistics'),
              fields: expect.arrayContaining([
                expect.objectContaining({ name: expect.stringContaining('Pending'), value: '12' }),
                expect.objectContaining({ name: expect.stringContaining('Approved'), value: '543' }),
                expect.objectContaining({ name: expect.stringContaining('Rejected'), value: '87' }),
                expect.objectContaining({ name: expect.stringContaining('Flagged'), value: '3' }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockRejectedValue(new Error('API connection failed'));

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'pending' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Error'),
            }),
          ]),
        })
      );
    });

    it('should handle unknown moderation action', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'moderate',
              type: 1,
              options: [{ name: 'action', type: 3, value: 'unknown_action' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Unknown action'),
            }),
          ]),
        })
      );
    });
  });

  describe('/preset ban_user', () => {
    it('should deny access outside moderation channel', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'wrong-channel',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('can only be used in the moderation channel');
    });

    it('should deny access for non-moderators', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'user-123', username: 'NormalUser' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('do not have permission');
    });

    it('should return error when user parameter is missing', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [{ name: 'ban_user', type: 1, options: [] }],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('specify a user');
    });

    it('should return error when user not found', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue(null);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'nonexistent-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('not found');
    });

    it('should show ban confirmation with user details', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: 'target-user',
          username: 'TargetUser',
          presetCount: 5,
        },
        recentPresets: [
          { id: 'preset-1', name: 'Preset 1', shareUrl: 'https://xivdyetools.com/presets/1' },
          { id: 'preset-2', name: 'Preset 2', shareUrl: 'https://xivdyetools.com/presets/2' },
        ],
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(json.data.embeds[0].title).toContain('Confirm');
      expect(json.data.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: expect.stringContaining('Username'), value: 'TargetUser' }),
          expect.objectContaining({ name: expect.stringContaining('Discord ID'), value: 'target-user' }),
          expect.objectContaining({ name: expect.stringContaining('Total Presets'), value: '5' }),
        ])
      );
      expect(json.data.components[0].components).toHaveLength(2);
      expect(json.data.components[0].components[0].custom_id).toBe(`ban_confirm_target-user_${encodeBase64Url('TargetUser')}`);
      expect(json.data.flags).toBe(64); // Ephemeral
    });

    it('should show "No presets found" when user has no recent presets', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: 'target-user',
          username: 'TargetUser',
          presetCount: 0,
        },
        recentPresets: [],
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      const recentPresetsField = json.data.embeds[0].fields.find((f: any) =>
        f.name.includes('Recent Presets')
      );
      expect(recentPresetsField.value).toBe('_No presets found_');
    });
  });

  describe('/preset unban_user', () => {
    it('should deny access outside moderation channel', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'wrong-channel',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('can only be used in the moderation channel');
    });

    it('should deny access for non-moderators', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'user-123', username: 'NormalUser' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('do not have permission');
    });

    it('should return error when user parameter is missing', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [{ name: 'unban_user', type: 1, options: [] }],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = await response.json() as any;

      expect(json.data.content).toContain('specify a user');
    });

    it('should return error when user is not banned', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue(null);

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('not currently banned'),
            }),
          ]),
        })
      );
    });

    it('should successfully unban user', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: 'target-user',
        xivAuthId: null,
        username: 'BannedUser',
        reason: 'Ban reason',
        bannedAt: '2025-01-14T12:00:00Z',
        moderatorDiscordId: 'mod-2',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      vi.mocked(banService.unbanUser).mockResolvedValue({
        success: true,
        presetsRestored: 3,
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(banService.unbanUser).toHaveBeenCalledWith(db, 'target-user', 'mod-1');
      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Unbanned'),
              description: expect.stringContaining('BannedUser'),
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'User ID', value: 'target-user' }),
                expect.objectContaining({ value: '3' }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should handle unban failure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: 'target-user',
        xivAuthId: null,
        username: 'BannedUser',
        reason: 'Ban reason',
        bannedAt: '2025-01-14T12:00:00Z',
        moderatorDiscordId: 'mod-2',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      vi.mocked(banService.unbanUser).mockResolvedValue({
        success: false,
        presetsRestored: 0,
        error: 'Database error',
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Database error'),
            }),
          ]),
        })
      );
    });

    it('should handle unexpected errors during unban', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockRejectedValue(new Error('Database connection lost'));

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        type: 2,
        channel_id: 'channel-moderation',
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        data: {
          name: 'preset',
          options: [
            {
              name: 'unban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: 'target-user' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[vi.mocked(ctx.waitUntil).mock.calls.length - 1]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.editOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('unexpected error'),
            }),
          ]),
        })
      );
    });
  });
});
