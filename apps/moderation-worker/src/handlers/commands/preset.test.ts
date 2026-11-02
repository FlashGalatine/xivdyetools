import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockD1Database, createMockFetcher, createMockKV } from '@xivdyetools/test-utils';
import { handlePresetCommand } from './preset.js';
import { Translator } from '../../services/bot-i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as confirmations from '../../services/ban-confirmation-service.js';
import * as banService from '../../services/ban-service.js';
import * as discordApi from '../../utils/discord-api.js';
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
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  // MOD-4 (FINDING-034): approve paths consult the author's ban status
  isPresetAuthorBanned: vi.fn(),
}));

vi.mock('../../services/ban-confirmation-service.js', async () => ({...await vi.importActual('../../services/ban-confirmation-service.js'), createBanReview:vi.fn()}));

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
    it.each([
      ['https://private.example/a%20b?secret=hidden', true, '`/a b`'],
      [`https://private.example/${'x'.repeat(1200)}`, false, 'Link details do not fit safely in this review. Ask the author to shorten the link before approval.'],
    ])('typed approval shows complete link review and withholds unsafe confirmation (%s)', async (link, allowed, value) => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({ preset: { ...CURRENT_PRESET, example_link: link }, revision: 7 } as any);
      const request: DiscordInteraction = { id: 'int-1', token: 'token-1', application_id: 'app-123', type: 2, channel_id: 'channel-moderation', member: { user: { id: 'mod-1', username: 'Moderator' } }, data: { name: 'preset', options: [{ name: 'moderate', type: 1, options: [{ name: 'action', type: 3, value: 'approve' }, { name: 'preset_id', type: 3, value: CURRENT_PRESET.id }] }] } };
      await handlePresetCommand(request, env, ctx, t);
      await vi.mocked(ctx.waitUntil).mock.calls.at(-1)?.[0];
      const sent = vi.mocked(discordApi.safeEditOriginalResponse).mock.calls.at(-1)?.[2] as any;
      expect(sent.embeds[0].fields).toContainEqual({ name: 'Links', value, inline: false });
      const ids = sent.components.flatMap((row: any) => row.components.map((item: any) => item.custom_id));
      expect(ids).toEqual(allowed ? [`preset_approve_${CURRENT_PRESET.id}:7:pending`] : [`preset_reject_${CURRENT_PRESET.id}:7:pending`]);
      expect(JSON.stringify(sent)).not.toContain('secret=hidden');
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
    });
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

  // An unreviewable link withholds Approve, so the Review notice must not ask for it.
  it.each([
    ['approve', 'Approval is unavailable', 'click Approve'],
    ['reject', 'click Reject to confirm', 'Approval is unavailable'],
  ] as const)(
    '%s with an unsafe link offers only Reject and says so',
    async (action, says, never) => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: {
          ...CURRENT_PRESET,
          category_id: 'jobs',
          tags: [],
          example_link: 'ftp://example.com/x',
        },
        revision: 3,
      } as never);

      const edit = await run(action);
      const buttons = edit.components[0].components;
      const review = edit.embeds[0].fields.find((f: { name: string }) => f.name === 'Review');

      expect(buttons).toHaveLength(1);
      expect(buttons[0].custom_id).toMatch(/^preset_reject_/);
      expect(review.value).toContain(says);
      expect(review.value).not.toContain(never);
    },
  );
});

describe('explicit private account reviews',()=>{
 const MOD='987654321098765432',D='123456789012345678',U='a0000000-0000-4000-8000-000000000001',N='b0000000-0000-4000-8000-000000000001';
 const ctx={} as ExecutionContext;
 let env:Env;
 const command=(action='ban_user',target=D,additional?:unknown):DiscordInteraction=>({id:'i',token:'t',application_id:'a',channel_id:'moderation',user:{id:MOD},data:{name:'preset',options:[{name:action,options:[{name:'user',value:target},...(additional===undefined?[]:[{name:'additional_user',value:additional as string}])]}]}});
 const run=async(i:DiscordInteraction)=> (await(await handlePresetCommand(i,env,ctx,new Translator('en'))).json()) as any;
 beforeEach(()=>{
  vi.clearAllMocks();env={LINKED_BAN_CONFIRMATION_ENABLED:'true',MODERATOR_IDS:MOD,MODERATION_CHANNEL_ID:'moderation',DB:{prepare:vi.fn()}} as unknown as Env;
  vi.mocked(confirmations.createBanReview).mockResolvedValue({nonce:N,actorId:MOD,phase:'review',hash:'a'.repeat(64),createdAt:1,expiresAt:2,proposal:{v:1,action:'ban',mode:'new',banId:N,ids:[D,U],inputs:[D],snapshots:[{input:D,result:{version:1,status:'found',internalId:U,discordId:D,identityRevision:8}}],scope:[],candidates:[],parentIds:[],presetPreview:{hide:0,restore:0,stillHidden:0}}});
 });
 it.each(['ban_user','unban_user'])('inactive %s refuses before storage or scope display',async action=>{
  env.LINKED_BAN_CONFIRMATION_ENABLED='false';const body=await run(command(action));expect(body.data.flags).toBe(64);expect(JSON.stringify(body)).not.toContain(D);expect(confirmations.createBanReview).not.toHaveBeenCalled();expect(env.DB.prepare).not.toHaveBeenCalled();
 });
 it('valid additional_user independently enters exact new review, whose customID carries only nonce',async()=>{
  const body=await run(command('ban_user',D,U));expect(confirmations.createBanReview).toHaveBeenCalledWith(env,MOD,'ban',[D,U]);expect(body.type).toBe(4);expect(body.data.flags).toBe(64);expect(body.data.embeds[0].description).toContain('stored revision 8');expect(body.data.components[0].components[0].custom_id).toBe(`ban_confirm_${N}`);
 });
 it('unban command only starts recorded-scope review, never immediately executes',async()=>{
  await run(command('unban_user'));expect(confirmations.createBanReview).toHaveBeenCalledWith(env,MOD,'unban',[D]);expect(banService.unbanUser).not.toHaveBeenCalled();
 });
 it.each(['garbage',U.toUpperCase(),' 123456789012345678',"' OR 1=1"] )('invalid target %s refuses before review',async id=>{expect((await run(command('ban_user',id))).data.flags).toBe(64);expect(confirmations.createBanReview).not.toHaveBeenCalled();});
 it.each(['invalid',42])('invalid additional input %# refuses before review',async additional=>{await run(command('ban_user',D,additional));expect(confirmations.createBanReview).not.toHaveBeenCalled();});
 it('XIVAuth-only author ID remains valid',async()=>{await run(command('ban_user',U));expect(confirmations.createBanReview).toHaveBeenCalledWith(env,MOD,'ban',[U]);});
 it('channel and current moderator guards precede storage',async()=>{const i=command();i.channel_id='other';await run(i);env.MODERATOR_IDS='899999999999999999';await run(command());expect(confirmations.createBanReview).not.toHaveBeenCalled();});
 it('missing target and unavailable identity never fall back to target-only controls',async()=>{const i=command();i.data!.options![0]!.options=[];await run(i);expect(confirmations.createBanReview).not.toHaveBeenCalled();vi.mocked(confirmations.createBanReview).mockRejectedValue(new Error('provider private'));const text=JSON.stringify(await run(command()));expect(text).not.toContain('provider private');expect(text).not.toContain(`ban_confirm_${D}`);});

  it('an unexpected review failure is logged with a fixed message and no identifiers', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    const failure = 'D1_ERROR: no such table: ban_identity_memberships';
    vi.mocked(confirmations.createBanReview).mockRejectedValue(new Error(failure));
    const response = await handlePresetCommand(
      command(),
      env,
      ctx,
      new Translator('en'),
      logger as never,
    );
    const body = (await response.json()) as any;

    expect(body.data.content).toBe(confirmations.REVIEW_UNAVAILABLE);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [message, logged] = logger.error.mock.calls[0];
    expect(message).toBe('Account ban review could not be created');
    expect(logged).toBeInstanceOf(Error);
    expect((logged as Error).message).toBe(failure);
    const logText = `${message} ${(logged as Error).message}`;
    for (const id of [MOD, D, U]) expect(logText).not.toContain(id);
  });
  it.each([confirmations.REVIEW_UNAVAILABLE, confirmations.BAN_SCOPE_OVERFLOW])(
    'an expected refusal (%s) is not logged as an error',
    async (refusal) => {
      const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      vi.mocked(confirmations.createBanReview).mockRejectedValue(new Error(refusal));
      await handlePresetCommand(command(), env, ctx, new Translator('en'), logger as never);
      expect(logger.error).not.toHaveBeenCalled();
    },
  );
});

it('overflow remains an explicit private manual-review refusal',async()=>{
 const actor='987654321098765432';const env={LINKED_BAN_CONFIRMATION_ENABLED:'true',MODERATOR_IDS:actor,MODERATION_CHANNEL_ID:'moderation'} as Env;
 vi.mocked(confirmations.createBanReview).mockRejectedValue(
  new Error(confirmations.BAN_SCOPE_OVERFLOW),
 );
 const response=await handlePresetCommand({id:'i',token:'t',application_id:'a',channel_id:'moderation',user:{id:actor},data:{options:[{name:'ban_user',options:[{name:'user',value:'123456789012345678'}]}]}},env,{} as ExecutionContext,new Translator('en'));
 const body=await response.json() as any;expect(body.data.flags).toBe(64);expect(body.data.content).toContain('Manual review is required');
});
