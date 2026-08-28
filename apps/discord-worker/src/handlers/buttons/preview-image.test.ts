/**
 * Tests for preview-image moderation button handlers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePreviewImageButton, isPreviewImageButton } from './preview-image.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as discordApi from '../../utils/discord-api.js';

const PRESET_ID = '12345678-1234-4123-8123-123456789abc';

vi.mock('../../utils/discord-api.js', () => ({
  editMessage: vi.fn(),
  sendFollowUp: vi.fn(),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    setPreviewImageStatus: vi.fn(),
  };
});

describe('preview-image button handlers', () => {
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
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };

    // Immediately await whatever's passed to waitUntil, mirroring the
    // moderation-worker test convention for this exact deferred-update shape.
    ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('isPreviewImageButton', () => {
    it('recognizes previewimg_approve_ and previewimg_reject_', () => {
      expect(isPreviewImageButton(`previewimg_approve_${PRESET_ID}`)).toBe(true);
      expect(isPreviewImageButton(`previewimg_reject_${PRESET_ID}`)).toBe(true);
    });

    it('does not collide with moderation-worker prefixes', () => {
      expect(isPreviewImageButton(`preset_approve_${PRESET_ID}`)).toBe(false);
      expect(isPreviewImageButton(`preset_reject_${PRESET_ID}`)).toBe(false);
    });

    it('returns false for unrelated ids', () => {
      expect(isPreviewImageButton('copy_hex_FF0000')).toBe(false);
      expect(isPreviewImageButton('')).toBe(false);
    });
  });

  describe('handlePreviewImageButton', () => {
    it('returns an ephemeral error for a malformed custom_id', async () => {
      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        data: { custom_id: 'previewimg_approve_' },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
      };

      const response = await handlePreviewImageButton(interaction, env, ctx);
      const json = (await response.json()) as any;

      expect(json.data.content).toBe('Invalid button interaction.');
      expect(json.data.flags).toBe(64);
      expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
    });

    // FINDING-020 (2026-08-21 security audit): the preset id travels in the
    // custom_id and ends up in a presets-api URL path — anything that is not
    // a UUID is refused before any API call, even for a moderator.
    it('refuses a custom_id whose preset id is not a UUID (path-steering guard)', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        data: { custom_id: 'previewimg_approve_../../presets/mine' },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
      };

      const response = await handlePreviewImageButton(interaction, env, ctx);
      const json = (await response.json()) as any;

      expect(json.data.content).toBe('Invalid button interaction.');
      expect(json.data.flags).toBe(64);
      expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
    });

    it('a moderator clicking approve calls presets-api with action approve and the correct preset id', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockResolvedValue({
        success: true,
        preview_image_status: 'approved',
      });

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_approve_${PRESET_ID}` },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: 'Preview image awaiting review',
              description: '**Test Preset**',
              color: 0xfee75c,
              image: { url: 'https://shots.xivdyetools.app/p1/abc.webp' },
              footer: { text: `ID: ${PRESET_ID}` },
            },
          ],
        },
      };

      const response = await handlePreviewImageButton(interaction, env, ctx);
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);
      expect(ctx.waitUntil).toHaveBeenCalled();

      expect(presetApi.setPreviewImageStatus).toHaveBeenCalledWith(
        env,
        PRESET_ID,
        'approve',
        'mod-1',
        'Moderator',
      );
    });

    it('a moderator clicking reject calls presets-api with action reject', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockResolvedValue({
        success: true,
        preview_image_status: 'none',
      });

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_reject_${PRESET_ID}` },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        message: {
          id: 'msg-1',
          embeds: [{ title: 'Preview image awaiting review' }],
        },
      };

      await handlePreviewImageButton(interaction, env, ctx);

      expect(presetApi.setPreviewImageStatus).toHaveBeenCalledWith(
        env,
        PRESET_ID,
        'reject',
        'mod-1',
        'Moderator',
      );
    });

    it('edits the message with the outcome and removes the buttons on success', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockResolvedValue({
        success: true,
        preview_image_status: 'approved',
      });
      vi.mocked(discordApi.editMessage).mockResolvedValue(new Response(null, { status: 200 }));

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_approve_${PRESET_ID}` },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: 'Preview image awaiting review',
              image: { url: 'https://shots.xivdyetools.app/p1/abc.webp' },
              footer: { text: `ID: ${PRESET_ID}` },
            },
          ],
        },
      };

      await handlePreviewImageButton(interaction, env, ctx);

      expect(discordApi.editMessage).toHaveBeenCalledWith(
        'test-bot-token',
        'channel-mod',
        'msg-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: 'Preview image awaiting review',
              image: { url: 'https://shots.xivdyetools.app/p1/abc.webp' },
              footer: expect.objectContaining({ text: expect.stringContaining('<@mod-1>') }),
            }),
          ]),
          components: [],
        }),
      );
    });

    it('non-moderator gets a refusal and presets-api is NEVER called', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_approve_${PRESET_ID}` },
        member: { user: { id: 'user-123', username: 'NotAMod' } },
        message: { id: 'msg-1', embeds: [{ title: 'Preview image awaiting review' }] },
      };

      const response = await handlePreviewImageButton(interaction, env, ctx);
      const json = (await response.json()) as any;

      expect(json.data.content).toBe('You do not have permission to moderate preview images.');
      expect(json.data.flags).toBe(64);

      // The refusal must be a hard stop: assert the API path was never
      // invoked at all, not merely that the response happened to be a
      // refusal (a handler that calls the API and discards the result would
      // still pass a weaker assertion).
      expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
      expect(discordApi.editMessage).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('presets-api failure produces an ephemeral error and does not touch the message (buttons stay retryable)', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockRejectedValue(
        new Error('presets-api unreachable'),
      );
      vi.mocked(discordApi.sendFollowUp).mockResolvedValue(new Response(null, { status: 200 }));

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_approve_${PRESET_ID}` },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
        message: {
          id: 'msg-1',
          embeds: [{ title: 'Preview image awaiting review' }],
        },
      };

      await handlePreviewImageButton(interaction, env, ctx);

      expect(discordApi.sendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          content: 'Failed to update the preview image. Please try again.',
          ephemeral: true,
        }),
      );
      // Buttons must remain clickable for a retry: no message edit at all.
      expect(discordApi.editMessage).not.toHaveBeenCalled();
    });

    it('falls back to the raw user id in the outcome footer when username is missing', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockResolvedValue({
        success: true,
        preview_image_status: 'none',
      });
      vi.mocked(discordApi.editMessage).mockResolvedValue(new Response(null, { status: 200 }));

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        channel_id: 'channel-mod',
        data: { custom_id: `previewimg_reject_${PRESET_ID}` },
        user: { id: 'mod-1', username: '' },
        message: { id: 'msg-1', embeds: [{ title: 'Preview image awaiting review' }] },
      };

      await handlePreviewImageButton(interaction, env, ctx);

      expect(discordApi.editMessage).toHaveBeenCalledWith(
        'test-bot-token',
        'channel-mod',
        'msg-1',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              footer: expect.objectContaining({ text: expect.stringContaining('mod-1') }),
            }),
          ]),
        }),
      );
    });

    it('skips the message edit when channel_id/message are missing', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(true);
      vi.mocked(presetApi.setPreviewImageStatus).mockResolvedValue({
        success: true,
        preview_image_status: 'approved',
      });

      const interaction = {
        id: 'int-1',
        token: 'token-1',
        application_id: 'app-123',
        data: { custom_id: `previewimg_approve_${PRESET_ID}` },
        member: { user: { id: 'mod-1', username: 'Moderator' } },
      };

      await handlePreviewImageButton(interaction, env, ctx);

      expect(discordApi.editMessage).not.toHaveBeenCalled();
    });
  });
});
