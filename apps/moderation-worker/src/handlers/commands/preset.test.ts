import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockD1Database, createMockFetcher, createMockKV } from '@xivdyetools/test-utils';
import { handlePresetCommand } from './preset.js';
import { Translator } from '../../services/bot-i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import * as discordApi from '../../utils/discord-api.js';
import { base64UrlEncode } from '@xivdyetools/auth/encoding';
import { PresetAPIError } from '../../types/preset.js';

const CURRENT_PRESET = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Current Name',
  description: 'Current description',
  author_name: 'Author',
  author_discord_id: '12345678901234567',
  status: 'pending',
  dyes: [1],
  moderation_status: 'unknown',
};

// Mock modules
vi.mock('../../utils/discord-api.js', () => {
  const editOriginalResponse = vi.fn();
  const sendMessage = vi.fn();
  // BUG-035: handlers call the safe wrappers; alias to the same mocks
  return {
    editOriginalResponse,
    // BUG-040: the handlers now call the throw-safe, outcome-checked wrapper.
    safeEditOriginalResponse: editOriginalResponse,
    sendMessage,
    safeSendMessage: sendMessage,
  };
});

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    getPendingPresets: vi.fn(),
    approvePreset: vi.fn(),
    rejectPreset: vi.fn(),
    getModerationStats: vi.fn(),
    getModerationPreset: vi.fn(),
  };
});

vi.mock('../../services/ban-service.js', () => ({
  getUserForBanConfirmation: vi.fn(),
  getActiveBan: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  // MOD-4 (FINDING-034): approve paths consult the author's ban status
  isPresetAuthorBanned: vi.fn(),
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
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
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
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    });

    it('should route to ban_user subcommand', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: '123456789012345678',
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(json.data.embeds[0].title).toContain('Confirm');
    });

    it('should route to unban_user subcommand', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: '123456789012345678',
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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

      await handlePresetCommand(interaction, env, ctx, t);

      // Wait for ctx.waitUntil to execute
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(ctx.waitUntil).toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('No presets'),
            }),
          ]),
        }),
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
          secondary_categories: [],
          preview_image_status: 'none',
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
          secondary_categories: [],
          preview_image_status: 'none',
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('2 preset(s) pending'),
              footer: { text: 'Use /preset moderate approve <id> or reject <id>' },
            }),
          ]),
        }),
      );
    });

    // FINDING-001 (2026-08-11 fix wave): the widened queue includes approved
    // presets whose picture alone is pending. Those must render distinctly
    // and the footer must stop advertising approve/reject for them.
    it('should mark image-only entries and switch the footer when the queue mixes both kinds', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockResolvedValue([
        {
          id: 'preset-1',
          name: 'Text Pending Preset',
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
          secondary_categories: [],
          preview_image_status: 'none',
        },
        {
          id: 'preset-2',
          name: 'Image Only Preset',
          description: 'Description 2',
          author_discord_id: 'author-2',
          author_name: 'Author Two',
          // Text needs nothing — only the picture is under review.
          status: 'approved',
          created_at: '2025-01-15T11:00:00Z',
          updated_at: '2025-01-15T11:00:00Z',
          category_id: 'aesthetics',
          dyes: [],
          tags: [],
          vote_count: 0,
          is_curated: false,
          secondary_categories: [],
          preview_image_status: 'pending',
          pending_preview_image_url: 'https://shots.xivdyetools.app/preset-2/abc.png',
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining(
                'Picture pending review: https://shots.xivdyetools.app/preset-2/abc.png',
              ),
              footer: {
                text: 'approve/reject apply to the text entries only — 🖼 entries are reviewed on the moderation embed in Discord',
              },
            }),
          ]),
        }),
      );

      // The text-pending entry keeps today's plain rendering — no 🖼 marker.
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('**1.** Text Pending Preset by Author One'),
            }),
          ]),
        }),
      );
      expect(discordApi.safeEditOriginalResponse).not.toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('🖼 **1.**'),
            }),
          ]),
        }),
      );

      // The image-only entry IS marked.
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('🖼 **2.** Image Only Preset by Author Two'),
            }),
          ]),
        }),
      );
    });

    // FINDING-017: a typed id has no reviewed revision, so approve shows the
    // CURRENT preset with a confirm button bound to the revision just fetched
    it('approve: shows the current preset with a revision-bound confirm button and does not approve', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValue(false);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: {
          id: 'a0000000-0000-4000-8000-000000000001',
          name: 'Current Name',
          description: 'Current description',
          author_name: 'Author',
          author_discord_id: '12345678901234567',
          status: 'pending',
          dyes: [1, 2],
          moderation_status: 'unknown',
        },
        revision: 7,
      } as never);
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
        secondary_categories: [],
        preview_image_status: 'none',
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(presetApi.getModerationPreset).toHaveBeenCalledWith(
        env,
        'a0000000-0000-4000-8000-000000000001',
        'mod-1',
      );
      // the command never approves on its own
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              description: expect.stringContaining('Current Name'),
              footer: { text: 'ID: a0000000-0000-4000-8000-000000000001 • Revision 7' },
            }),
          ],
          components: [
            {
              type: 1,
              components: [
                expect.objectContaining({
                  label: 'Approve',
                  custom_id: 'preset_approve_a0000000-0000-4000-8000-000000000001:7:pending',
                }),
              ],
            },
          ],
        }),
      );
    });

    it('approve: nothing is logged until the confirm click acts', async () => {
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
        secondary_categories: [],
        preview_image_status: 'none',
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.sendMessage).not.toHaveBeenCalled();
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('specify a preset ID'),
            }),
          ]),
        }),
      );
    });

    it('reject: shows the current preset with a revision-bound confirm button and does not reject', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: {
          id: 'a0000000-0000-4000-8000-000000000001',
          name: 'Current Name',
          description: 'Current description',
          author_name: 'Author',
          author_discord_id: null,
          status: 'flagged',
          dyes: [1],
          moderation_status: 'flagged',
        },
        revision: 2,
      } as never);
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              description: expect.stringContaining('Current Name'),
              footer: { text: 'ID: a0000000-0000-4000-8000-000000000001 • Revision 2' },
            }),
          ],
          // the confirm button opens the reason modal bound to this revision and status
          components: [
            {
              type: 1,
              components: [
                expect.objectContaining({
                  label: 'Reject',
                  custom_id: 'preset_reject_a0000000-0000-4000-8000-000000000001:2:flagged',
                }),
              ],
            },
          ],
        }),
      );
    });

    it('approve and reject answer ephemerally; pending and stats stay public', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getPendingPresets).mockResolvedValue([]);

      const run = async (action: string) => {
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
                  { name: 'action', type: 3, value: action },
                  { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
                ],
              },
            ],
          },
        };
        const response = await handlePresetCommand(interaction, env, ctx, t);
        return (await response.json()) as any;
      };

      expect((await run('approve')).data?.flags).toBe(64);
      expect((await run('reject')).data?.flags).toBe(64);
      expect((await run('pending')).data?.flags).toBeUndefined();
    });

    it('approve/reject: answers "not found" for a preset that does not exist', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValue(false);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue(null);

      for (const action of ['approve', 'reject']) {
        vi.mocked(discordApi.safeEditOriginalResponse).mockClear();
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
                  { name: 'action', type: 3, value: action },
                  { name: 'preset_id', type: 3, value: 'a0000000-0000-4000-8000-000000000001' },
                ],
              },
            ],
          },
        };
        await handlePresetCommand(interaction, env, ctx, t);
        await vi.mocked(ctx.waitUntil).mock.calls.at(-1)?.[0];

        expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
          'app-123',
          'token-1',
          expect.objectContaining({
            embeds: [expect.objectContaining({ description: 'Preset not found.' })],
          }),
        );
      }
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    it('reject: a missing reason is no longer an error - the modal asks for it', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: { ...CURRENT_PRESET },
        revision: 3,
      } as never);

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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          components: [
            {
              type: 1,
              components: [
                expect.objectContaining({
                  custom_id: expect.stringMatching(/^preset_reject_a0000000-[0-9a-f-]+:\d+:\w+$/),
                }),
              ],
            },
          ],
        }),
      );
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    /**
     * moderation-worker-06: the rejection-reason floor depended on which
     * surface the moderator used. The MODAL demands ten characters; this path
     * accepted one, and presets-api applies `validateModerationReason` to
     * `/revert` only — so `reason:x` was stored as the `moderation_log.reason`
     * for a rejection. The old suite only ever covered a MISSING reason.
     */
    it('reject: a typed reason is not used - rejecting needs the modal, which enforces the floor', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: { ...CURRENT_PRESET },
        revision: 3,
      } as never);

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
                { name: 'reason', type: 3, value: 'x' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls.at(-1)?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      // The preset is never touched, whatever reason was typed on the command…
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
      // …the moderator gets the confirm button that opens the modal (10-character floor)
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          components: [
            {
              type: 1,
              components: [
                expect.objectContaining({
                  custom_id: 'preset_reject_a0000000-0000-4000-8000-000000000001:3:pending',
                }),
              ],
            },
          ],
        }),
      );
    });

    /**
     * moderation-worker-05: rejection was the ONLY moderation action that
     * never reached SUBMISSION_LOG_CHANNEL_ID — approve does, and so do the
     * modal rejection, the button approval and the revert. The suite asserted
     * the approve path posted and simply never asked about reject.
     */
    it('reject: nothing is logged until the modal submit acts (the log post lives there)', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: { ...CURRENT_PRESET },
        revision: 3,
      } as never);

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
                { name: 'reason', type: 3, value: 'Duplicate of an existing palette' },
              ],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls.at(-1)?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeSendMessage).not.toHaveBeenCalled();
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    it('should process stats action successfully', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      // BUG-010: this mock used to carry `pending_count` & co — the names the
      // HANDLER read, not the ones presets-api sends. Mock and client agreed
      // with each other and both disagreed with the server, so all four embed
      // fields rendered `String(undefined)` in production while this passed.
      // `moderation-stats-contract.test.ts` now pins these names against
      // presets-api's own SQL aliases.
      vi.mocked(presetApi.getModerationStats).mockResolvedValue({
        pending: 12,
        approved: 543,
        rejected: 87,
        flagged: 3,
        actions_last_week: 21,
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Statistics'),
              fields: expect.arrayContaining([
                expect.objectContaining({ name: expect.stringContaining('Pending'), value: '12' }),
                expect.objectContaining({
                  name: expect.stringContaining('Approved'),
                  value: '543',
                }),
                expect.objectContaining({ name: expect.stringContaining('Rejected'), value: '87' }),
                expect.objectContaining({ name: expect.stringContaining('Flagged'), value: '3' }),
                expect.objectContaining({ name: expect.stringContaining('Actions'), value: '21' }),
              ]),
            }),
          ]),
        }),
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Error'),
            }),
          ]),
        }),
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
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Unknown action'),
            }),
          ]),
        }),
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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
              options: [{ name: 'user', type: 3, value: '123456789012345699' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.data.content).toContain('not found');
    });

    it('should show ban confirmation with user details', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: '123456789012345678',
          username: 'TargetUser',
          presetCount: 5,
        },
        recentPresets: [
          { id: 'preset-1', name: 'Preset 1', shareUrl: 'https://xivdyetools.app/presets/1' },
          { id: 'preset-2', name: 'Preset 2', shareUrl: 'https://xivdyetools.app/presets/2' },
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(json.data.embeds[0].title).toContain('Confirm');
      expect(json.data.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('Username'),
            value: 'TargetUser',
          }),
          expect.objectContaining({
            name: expect.stringContaining('Discord ID'),
            value: '123456789012345678',
          }),
          expect.objectContaining({ name: expect.stringContaining('Total Presets'), value: '5' }),
        ]),
      );
      expect(json.data.components[0].components).toHaveLength(2);
      // FINDING-007: the confirm button carries ONLY the target id — the
      // username used to ride along base64url-encoded and overflowed
      // Discord's 100-char custom_id cap for long CJK/emoji names
      expect(json.data.components[0].components[0].custom_id).toBe('ban_confirm_123456789012345678');
      expect(json.data.flags).toBe(64); // Ephemeral
    });

    it('FINDING-007: confirm custom_id stays within 100 chars for a 32-character CJK username', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: '123456789012345678',
          username: '彩'.repeat(32),
          presetCount: 1,
        },
        recentPresets: [],
      });

      const interaction: DiscordInteraction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-moderation',
        data: {
          name: 'preset',
          options: [
            {
              name: 'ban_user',
              type: 1,
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

      const customId = json.data.components[0].components[0].custom_id as string;
      expect(customId).toBe('ban_confirm_123456789012345678');
      expect(customId.length).toBeLessThanOrEqual(100);
      expect(customId).not.toContain(base64UrlEncode('彩'.repeat(32)));
    });

    it('should show "No presets found" when user has no recent presets', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValue({
        user: {
          discordId: '123456789012345678',
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

      const recentPresetsField = json.data.embeds[0].fields.find((f: any) =>
        f.name.includes('Recent Presets'),
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      const response = await handlePresetCommand(interaction, env, ctx, t);
      const json = (await response.json()) as any;

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
      const json = (await response.json()) as any;

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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('not currently banned'),
            }),
          ]),
        }),
      );
    });

    it('should successfully unban user', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: '123456789012345678',
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(banService.unbanUser).toHaveBeenCalledWith(db, '123456789012345678', 'mod-1');
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Unbanned'),
              description: expect.stringContaining('BannedUser'),
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'User ID', value: '123456789012345678' }),
                expect.objectContaining({ value: '3' }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('FINDING-021: tells the moderator how many presets stayed hidden and why', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: '123456789012345678',
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
        presetsRestored: 2,
        presetsStillHidden: 1,
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Presets Still Hidden',
                  value: expect.stringMatching(/^1 — .*same dye combination/),
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should handle unban failure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(banService.getActiveBan).mockResolvedValue({
        id: 'ban-1',
        discordId: '123456789012345678',
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Database error'),
            }),
          ]),
        }),
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
              options: [{ name: 'user', type: 3, value: '123456789012345678' }],
            },
          ],
        },
      };

      await handlePresetCommand(interaction, env, ctx, t);
      // Wait for waitUntil callback
      const waitUntilPromise = vi.mocked(ctx.waitUntil).mock.calls[
        vi.mocked(ctx.waitUntil).mock.calls.length - 1
      ]?.[0];
      if (waitUntilPromise) await waitUntilPromise;

      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('unexpected error'),
            }),
          ]),
        }),
      );
    });
  });
});

// ============================================================================
// 2026-08-21 security audit — FINDING-019 / 020 / 023 / 034
// ============================================================================
describe('handlePresetCommand — security audit remediations', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let t: Translator;

  const PRESET_ID = 'a0000000-0000-4000-8000-000000000001';
  const MOD = '111111111111111111';
  const TARGET = '222222222222222222';

  const presetFixture = (overrides: Record<string, unknown> = {}) =>
    ({
      id: PRESET_ID,
      name: 'Plain Name',
      description: 'd',
      author_discord_id: TARGET,
      author_name: 'Author',
      status: 'pending',
      created_at: '2026-08-21T10:00:00Z',
      updated_at: '2026-08-21T10:00:00Z',
      category_id: 'jobs',
      dyes: [],
      tags: [],
      vote_count: 0,
      is_curated: false,
      secondary_categories: [],
      preview_image_status: 'none',
      ...overrides,
    }) as any;

  const moderate = (options: Array<{ name: string; type: number; value: string }>): DiscordInteraction => ({
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    type: 2,
    channel_id: 'channel-moderation',
    member: { user: { id: MOD, username: 'Moderator' } },
    data: { name: 'preset', options: [{ name: 'moderate', type: 1, options }] },
  });

  const subcommand = (name: 'ban_user' | 'unban_user', user: string): DiscordInteraction => ({
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    type: 2,
    channel_id: 'channel-moderation',
    member: { user: { id: MOD, username: 'Moderator' } },
    data: { name: 'preset', options: [{ name, type: 1, options: [{ name: 'user', type: 3, value: user }] }] },
  });

  const flushWaitUntil = async () => {
    const calls = vi.mocked(ctx.waitUntil).mock.calls;
    const p = calls[calls.length - 1]?.[0];
    if (p) await p;
  };

  const lastEdit = (): any => vi.mocked(discordApi.editOriginalResponse).mock.calls.at(-1)?.[2];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    env = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: MOD,
      MODERATION_CHANNEL_ID: 'channel-moderation',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
      BOT_API_SECRET: 'test-api-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: createMockD1Database() as unknown as D1Database,
      KV: createMockKV() as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    t = new Translator('en');
  });

  describe('FINDING-019 — user text is sanitised before it reaches an embed', () => {
    it('pending list: escapes masked links in preset names and defuses @everyone in author names', async () => {
      vi.mocked(presetApi.getPendingPresets).mockResolvedValueOnce([
        presetFixture({ name: '[evil](https://evil.example)', author_name: '@everyone **Bob**' }),
      ]);

      await handlePresetCommand(moderate([{ name: 'action', type: 3, value: 'pending' }]), env, ctx, t);
      await flushWaitUntil();

      const description: string = lastEdit().embeds[0].description;
      expect(description).not.toMatch(/\[evil\]\(https:\/\/evil\.example\)/);
      expect(description).toContain('\\[evil\\]');
      expect(description).not.toContain('@everyone');
      expect(description).not.toContain('**Bob**');
    });

    it.each(['approve', 'reject'])(
      '%s: the preset text in the confirmation is escaped (name, description, author)',
      async (action) => {
        vi.mocked(presetApi.getModerationPreset).mockResolvedValueOnce({
          preset: presetFixture({
            name: '**Loud** [x](https://evil.example)',
            description: '@everyone **bold**',
            author_name: '@here Bob',
            status: 'pending',
          }),
          revision: 1,
        } as never);

        await handlePresetCommand(
          moderate([
            { name: 'action', type: 3, value: action },
            { name: 'preset_id', type: 3, value: PRESET_ID },
          ]),
          env,
          ctx,
          t,
        );
        await flushWaitUntil();

        const description: string = lastEdit().embeds[0].description;
        expect(description).not.toContain('**Loud**');
        expect(description).toContain('\\*\\*Loud\\*\\*');
        expect(description).not.toMatch(/\[x\]\(https:\/\/evil\.example\)/);
        expect(description).not.toContain('@everyone');
        expect(description).not.toContain('@here');
      },
    );

    it('unknown action: the echoed action text is sanitised', async () => {
      await handlePresetCommand(moderate([{ name: 'action', type: 3, value: '@everyone **x**' }]), env, ctx, t);
      await flushWaitUntil();

      const description: string = lastEdit().embeds[0].description;
      expect(description).toContain('Unknown action');
      expect(description).not.toContain('@everyone');
      expect(description).not.toContain('**x**');
    });

    it('ban confirmation: username is escaped and preset links cannot be broken out of', async () => {
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValueOnce({
        user: { discordId: TARGET, username: '[Nice](https://evil.example) @everyone', presetCount: 1 },
        recentPresets: [
          {
            id: PRESET_ID,
            name: 'Nice palette](https://evil.example/login) [x',
            shareUrl: `https://xivdyetools.app/presets/${PRESET_ID}`,
          },
        ],
      });

      const response = await handlePresetCommand(subcommand('ban_user', TARGET), env, ctx, t);
      const json = (await response.json()) as any;
      const fields: Array<{ name: string; value: string }> = json.data.embeds[0].fields;

      const username = fields.find((f) => f.name === 'Username')!.value;
      expect(username).not.toMatch(/\[Nice\]\(https:\/\/evil\.example\)/);
      expect(username).not.toContain('@everyone');

      const links = fields.find((f) => f.name === 'Recent Presets')!.value;
      expect(links).not.toMatch(/\]\(https:\/\/evil\.example/);
      expect(links).toContain(`https://xivdyetools.app/presets/${PRESET_ID}`);
      // interaction responses carry allowed_mentions too
      expect(json.data.allowed_mentions).toEqual({ parse: [] });
    });

    it('unban: the stored username is escaped in the success embed', async () => {
      vi.mocked(banService.getActiveBan).mockResolvedValueOnce({
        id: 'ban-1',
        discordId: TARGET,
        xivAuthId: null,
        username: '**Bold** <@&123456789012345678>',
        moderatorDiscordId: MOD,
        reason: 'r',
        bannedAt: '2026-08-21T00:00:00Z',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      vi.mocked(banService.unbanUser).mockResolvedValueOnce({ success: true, presetsRestored: 1 });

      await handlePresetCommand(subcommand('unban_user', TARGET), env, ctx, t);
      await flushWaitUntil();

      const description: string = lastEdit().embeds[0].description;
      expect(description).not.toContain('**Bold**');
      expect(description).not.toContain('<@&');
    });
  });

  describe('FINDING-020 — ban targets must be a Discord snowflake or XIVAuth UUID', () => {
    it('ban_user rejects a malformed target before touching D1', async () => {
      const response = await handlePresetCommand(subcommand('ban_user', '../not-an-id'), env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.data.flags).toBe(64);
      expect(json.data.content).toContain('Invalid user ID');
      expect(banService.getUserForBanConfirmation).not.toHaveBeenCalled();
    });

    it('unban_user rejects a malformed target before touching D1', async () => {
      const response = await handlePresetCommand(subcommand('unban_user', 'xivauth-uuid-ish'), env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.data.flags).toBe(64);
      expect(json.data.content).toContain('Invalid user ID');
      expect(banService.getActiveBan).not.toHaveBeenCalled();
      expect(banService.unbanUser).not.toHaveBeenCalled();
    });

    // BUG-001 path (a): XIVAuth-only preset authors have no Discord snowflake —
    // presets-api stores their JWT `sub` (a UUID) as `author_discord_id`, so a
    // ban target with that shape must reach the same confirmation step a
    // snowflake target does, not the "Invalid user ID" refusal.
    const XIVAUTH_UUID = 'a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890';

    it('ban_user accepts a UUID target and reaches the confirmation step', async () => {
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValueOnce({
        user: { discordId: XIVAUTH_UUID, username: 'XivauthOnlyAuthor', presetCount: 2 },
        recentPresets: [],
      });

      const response = await handlePresetCommand(subcommand('ban_user', XIVAUTH_UUID), env, ctx, t);
      const json = (await response.json()) as any;

      expect(json.data.content).toBeUndefined();
      expect(banService.getUserForBanConfirmation).toHaveBeenCalledWith(
        env.DB,
        XIVAUTH_UUID,
        expect.any(String),
      );
      const confirmButton = json.data.components[0].components[0];
      expect(confirmButton.custom_id).toBe(`ban_confirm_${XIVAUTH_UUID}`);
      // A4 (2026-09-16 PR review): the id field must be labeled "XIVAuth ID",
      // not "Discord ID", when the target has no real Discord snowflake.
      expect(json.data.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'XIVAuth ID', value: XIVAUTH_UUID }),
        ]),
      );
    });

    it('unban_user accepts a UUID target and reaches unbanUser', async () => {
      vi.mocked(banService.getActiveBan).mockResolvedValueOnce({
        id: 'ban-2',
        discordId: XIVAUTH_UUID,
        xivAuthId: null,
        username: 'XivauthOnlyAuthor',
        moderatorDiscordId: MOD,
        reason: 'r',
        bannedAt: '2026-08-21T00:00:00Z',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      vi.mocked(banService.unbanUser).mockResolvedValueOnce({ success: true, presetsRestored: 0 });

      await handlePresetCommand(subcommand('unban_user', XIVAUTH_UUID), env, ctx, t);
      await flushWaitUntil();

      expect(banService.unbanUser).toHaveBeenCalledWith(env.DB, XIVAUTH_UUID, MOD);
    });
  });

  describe('FINDING-023 — moderator-facing links use the canonical domain', () => {
    it('builds preset links from https://xivdyetools.app', async () => {
      vi.mocked(banService.getUserForBanConfirmation).mockResolvedValueOnce(null);

      await handlePresetCommand(subcommand('ban_user', TARGET), env, ctx, t);

      expect(banService.getUserForBanConfirmation).toHaveBeenCalledWith(
        env.DB,
        TARGET,
        'https://xivdyetools.app',
      );
    });
  });

  describe('FINDING-034 — MOD-4: approval refuses a banned author', () => {
    it('does not call presets-api and tells the moderator why', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetCommand(
        moderate([
          { name: 'action', type: 3, value: 'approve' },
          { name: 'preset_id', type: 3, value: PRESET_ID },
        ]),
        env,
        ctx,
        t,
      );
      await flushWaitUntil();

      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(banService.isPresetAuthorBanned).toHaveBeenCalledWith(env.DB, PRESET_ID);
      expect(lastEdit().embeds[0].title).toContain('Error');
      expect(lastEdit().embeds[0].description).toMatch(/banned/i);
    });

    it('offers the confirm button when the author is not banned', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(false);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValueOnce({
        preset: presetFixture({ status: 'pending' }),
        revision: 9,
      } as never);

      await handlePresetCommand(
        moderate([
          { name: 'action', type: 3, value: 'approve' },
          { name: 'preset_id', type: 3, value: PRESET_ID },
        ]),
        env,
        ctx,
        t,
      );
      await flushWaitUntil();

      // the command itself never approves; the confirm button is bound to revision 9
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(lastEdit().components[0].components[0].custom_id).toBe(
        `preset_approve_${PRESET_ID}:9:pending`,
      );
    });
  });

  describe('FINDING-034 — MOD-8: channel-facing error text never echoes internals', () => {
    it('hides a 5xx presets-api body behind the generic message', async () => {
      vi.mocked(presetApi.getPendingPresets).mockRejectedValueOnce(
        new PresetAPIError(502, '<html>Bad Gateway from origin 10.0.0.7</html>'),
      );

      await handlePresetCommand(moderate([{ name: 'action', type: 3, value: 'pending' }]), env, ctx, t);
      await flushWaitUntil();

      const description: string = lastEdit().embeds[0].description;
      expect(description).toBe('Moderation action failed.');
    });

    it('still shows a 4xx presets-api message (actionable for the moderator)', async () => {
      vi.mocked(presetApi.getModerationPreset).mockRejectedValueOnce(
        new PresetAPIError(403, 'Preset not found'),
      );

      await handlePresetCommand(
        moderate([
          { name: 'action', type: 3, value: 'approve' },
          { name: 'preset_id', type: 3, value: PRESET_ID },
        ]),
        env,
        ctx,
        t,
      );
      await flushWaitUntil();

      expect(lastEdit().embeds[0].description).toBe('Preset not found');
    });

    it('hides a raw D1 message thrown on the pending path', async () => {
      vi.mocked(presetApi.getPendingPresets).mockRejectedValueOnce(
        new Error('D1_ERROR: no such table: presets: SQLITE_ERROR'),
      );

      await handlePresetCommand(moderate([{ name: 'action', type: 3, value: 'pending' }]), env, ctx, t);
      await flushWaitUntil();

      expect(lastEdit().embeds[0].description).toBe('Moderation action failed.');
    });

    it('unban failure shows the service message and logs the cause', async () => {
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
      vi.mocked(banService.getActiveBan).mockResolvedValueOnce({
        id: 'ban-1',
        discordId: TARGET,
        xivAuthId: null,
        username: 'U',
        moderatorDiscordId: MOD,
        reason: 'r',
        bannedAt: '2026-08-21T00:00:00Z',
        unbannedAt: null,
        unbanModeratorDiscordId: null,
      });
      const cause = new Error('D1_ERROR: database is locked: SQLITE_BUSY');
      vi.mocked(banService.unbanUser).mockResolvedValueOnce({
        success: false,
        presetsRestored: 0,
        error: 'Failed to unban user.',
        cause,
      });

      await handlePresetCommand(subcommand('unban_user', TARGET), env, ctx, t, logger);
      await flushWaitUntil();

      expect(lastEdit().embeds[0].description).toBe('Failed to unban user.');
      expect((logger as any).error).toHaveBeenCalledWith(expect.stringContaining('Unban failed'), cause);
    });
  });
});

// ============================================================================
// 2026-10-04 deep-dive, Sprint 17 follow-ups — the /preset moderate confirmation
// ============================================================================
describe('/preset moderate approve|reject — the confirmation (Sprint 17)', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let t: Translator;

  const PRESET_ID = 'a0000000-0000-4000-8000-000000000001';
  const MOD = '111111111111111111';

  const moderate = (action: 'approve' | 'reject'): DiscordInteraction => ({
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    type: 2,
    channel_id: 'channel-moderation',
    member: { user: { id: MOD, username: 'Moderator' } },
    data: {
      name: 'preset',
      options: [
        {
          name: 'moderate',
          type: 1,
          options: [
            { name: 'action', type: 3, value: action },
            { name: 'preset_id', type: 3, value: PRESET_ID },
          ],
        },
      ],
    },
  });

  const run = async (action: 'approve' | 'reject'): Promise<any> => {
    vi.mocked(discordApi.editOriginalResponse).mockClear();
    await handlePresetCommand(moderate(action), env, ctx, t);
    const calls = vi.mocked(ctx.waitUntil).mock.calls;
    await calls[calls.length - 1]?.[0];
    return vi.mocked(discordApi.editOriginalResponse).mock.calls.at(-1)?.[2];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.isPresetAuthorBanned).mockResolvedValue(false);
    env = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: MOD,
      MODERATION_CHANNEL_ID: 'channel-moderation',
      BOT_API_SECRET: 'test-api-secret',
      BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
      DB: createMockD1Database() as unknown as D1Database,
      KV: createMockKV() as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = {
      waitUntil: vi.fn((promise: Promise<any>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    t = new Translator('en');
  });

  // BUG-054: the REAL getModerationPreset against a presets-api that answers
  // the catch-all route 404 (one older than 2.4.0: a rollback or a misordered
  // deploy). That 404 is not "the preset is gone".
  it.each(['approve', 'reject'] as const)(
    '%s: a presets-api route 404 is an error, not "Preset not found."',
    async (action) => {
      const actual = await vi.importActual<typeof presetApi>('../../services/preset-api.js');
      vi.mocked(presetApi.getModerationPreset).mockImplementationOnce(actual.getModerationPreset);
      const fetcher = createMockFetcher();
      fetcher._setupHandler(() =>
        Response.json(
          {
            success: false,
            error: 'NOT_FOUND',
            message: `Route GET /api/v1/moderation/${PRESET_ID} not found`,
          },
          { status: 404 },
        ),
      );
      env.PRESETS_API = fetcher as unknown as Fetcher;

      const edit = await run(action);

      // the request really reached the fake presets-api (not a config 503)
      expect(fetcher._calls).toHaveLength(1);
      expect(fetcher._calls[0].url).toBe(`https://internal/api/v1/moderation/${PRESET_ID}`);
      expect(edit.embeds[0].title).toContain('Error');
      expect(edit.embeds[0].description).not.toBe('Preset not found.');
      expect(edit.embeds[0].description).toBe(
        `Route GET /api/v1/moderation/${PRESET_ID} not found`,
      );
      expect(edit).not.toHaveProperty('components');
    },
  );

  // Sprint 17 review: the confirmation offers one Approve or Reject button and
  // no Revert, so it does not describe Revert. It still says the text is an
  // edit with a saved earlier version, which the moderation message can revert to.
  it.each(['approve', 'reject'] as const)(
    '%s: notes a saved earlier version without describing a Revert it does not offer',
    async (action) => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: {
          ...CURRENT_PRESET,
          category_id: 'jobs',
          tags: [],
          previous_values: { name: 'Before', description: 'x', tags: [], dyes: [1] },
        },
        revision: 3,
      } as never);

      const edit = await run(action);
      const description: string = edit.embeds[0].description;

      expect(description).toContain(
        '**Edit:** a saved earlier version exists (Revert is on the moderation message)',
      );
      expect(description).not.toContain('**Revert:**');
      expect(edit.components[0].components).toHaveLength(1);
    },
  );

  it('says nothing about a saved version when there is none', async () => {
    vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
      preset: { ...CURRENT_PRESET, category_id: 'jobs', tags: [], previous_values: null },
      revision: 3,
    } as never);

    const edit = await run('approve');

    expect(edit.embeds[0].description).not.toContain('**Edit:**');
    expect(edit.embeds[0].description).not.toContain('Revert');
  });
});
