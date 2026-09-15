/**
 * Regression coverage for legacy, preset-id-only preview review controls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePreviewImageButton } from './preview-image.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import * as presetApi from '../../services/preset-api.js';
import * as discordApi from '../../utils/discord-api.js';

const PRESET_ID = '12345678-1234-4123-8123-123456789abc';
const FRESH_KEY = `${PRESET_ID}/abcdefab-cdef-4def-8abc-defabcdefabc.webp`;
const STALE_REVIEW_MESSAGE =
  'This preview image changed or was already moderated. Review the latest image notification.';
const REFRESH_NOTICE = 'Review the refreshed image before choosing Approve or Reject.';

vi.mock('../../utils/discord-api.js', () => ({
  editMessage: vi.fn(),
  safeSendFollowUp: vi.fn(),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    setPreviewImageStatus: vi.fn(),
    getPendingPreviewImage: vi.fn(),
  };
});

function legacyInteraction() {
  return {
    id: 'int-1',
    token: 'token-1',
    application_id: 'app-123',
    channel_id: 'channel-mod',
    data: { custom_id: `previewimg_approve_${PRESET_ID}` },
    member: { user: { id: 'mod-1', username: 'Moderator' } },
    message: {
      id: 'message-1',
      embeds: [
        {
          title: 'Preview image awaiting review',
          image: { url: 'https://shots.xivdyetools.app/old/image.webp' },
        },
      ],
    },
  };
}

describe('legacy preview review refresh', () => {
  let env: Env;
  let background: Promise<unknown> | undefined;
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    background = undefined;
    env = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1',
      MODERATION_CHANNEL_ID: 'channel-mod',
      KV: undefined as unknown as KVNamespace,
      PRESETS_API: undefined,
      PRESETS_API_URL: 'https://presets-api.example.com',
    };
    ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        background = promise;
      }),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
  });

  it('refreshes a legacy approval control to the current pending image before any moderation action', async () => {
    vi.mocked(presetApi.getPendingPreviewImage).mockResolvedValue(FRESH_KEY);
    vi.mocked(discordApi.editMessage).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await handlePreviewImageButton(legacyInteraction(), env, ctx);

    expect(await response.json()).toEqual({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
    expect(presetApi.getPendingPreviewImage).toHaveBeenCalledWith(
      env,
      PRESET_ID,
      'mod-1',
      'Moderator',
    );
    expect(background).toBeDefined();
    await background;

    expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'message-1',
      expect.objectContaining({
        embeds: [
          expect.objectContaining({ image: { url: `https://shots.xivdyetools.app/${FRESH_KEY}` } }),
        ],
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: `previewimg_approve_${FRESH_KEY}` }),
              expect.objectContaining({ custom_id: `previewimg_reject_${FRESH_KEY}` }),
            ]),
          }),
        ],
      }),
    );
    expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
      'app-123',
      'token-1',
      { content: REFRESH_NOTICE, ephemeral: true },
      undefined,
    );
  });

  it('retires a legacy control when the preset no longer has a pending image', async () => {
    vi.mocked(presetApi.getPendingPreviewImage).mockResolvedValue(null);
    vi.mocked(discordApi.editMessage).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await handlePreviewImageButton(legacyInteraction(), env, ctx);

    expect(await response.json()).toEqual({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
    expect(background).toBeDefined();
    await background;

    expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
    expect(discordApi.editMessage).toHaveBeenCalledWith(
      'test-bot-token',
      'channel-mod',
      'message-1',
      expect.objectContaining({
        embeds: [expect.objectContaining({ footer: { text: STALE_REVIEW_MESSAGE } })],
        components: [],
      }),
    );
  });

  it('keeps legacy controls retryable and reports a lookup failure safely', async () => {
    vi.mocked(presetApi.getPendingPreviewImage).mockRejectedValue(
      new Error('presets-api unreachable'),
    );
    vi.mocked(discordApi.safeSendFollowUp).mockResolvedValue(true);

    const response = await handlePreviewImageButton(legacyInteraction(), env, ctx);

    expect(await response.json()).toEqual({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
    expect(background).toBeDefined();
    await background;

    expect(presetApi.setPreviewImageStatus).not.toHaveBeenCalled();
    expect(discordApi.editMessage).not.toHaveBeenCalled();
    expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
      'app-123',
      'token-1',
      expect.objectContaining({
        content: 'Failed to update the preview image. Please try again.',
        ephemeral: true,
      }),
      undefined,
    );
  });
});
