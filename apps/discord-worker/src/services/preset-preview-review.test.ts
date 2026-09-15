/** Regression coverage for retrieving the current pending preview revision. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as presetApi from './preset-api.js';
import type { Env } from '../types/env.js';
import { PresetAPIError } from '../types/preset.js';

const PRESET_ID = '12345678-1234-4123-8123-123456789abc';
const IMAGE_ID = 'abcdefab-cdef-4def-8abc-defabcdefabc';
const IMAGE_KEY = `${PRESET_ID}/${IMAGE_ID}.webp`;
const IMAGE_URL = `https://shots.xivdyetools.app/${IMAGE_KEY}`;
const mockFetch = vi.fn();
const getPendingPreviewImage = (
  presetApi as typeof presetApi & {
    getPendingPreviewImage: (
      env: Env,
      presetId: string,
      moderatorId: string,
      moderatorName?: string,
    ) => Promise<string | null>;
  }
).getPendingPreviewImage;

describe('getPendingPreviewImage', () => {
  const env = {
    PRESETS_API_URL: 'https://api.example.com',
    BOT_API_SECRET: 'secret-token',
    BOT_SIGNING_SECRET: 'test-signing-secret-padding-1234',
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('uses the signed pending endpoint and returns the matching current revision key', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          presets: [
            {
              id: 'other',
              pending_preview_image_url: 'https://shots.xivdyetools.app/other/image.webp',
            },
            { id: PRESET_ID, pending_preview_image_url: IMAGE_URL },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(getPendingPreviewImage(env, PRESET_ID, 'mod-1', 'Moderator')).resolves.toBe(
      IMAGE_KEY,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/moderation/pending',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'X-User-Discord-ID': 'mod-1',
          'X-User-Discord-Name': 'Moderator',
          'X-Request-Signature-V2': expect.any(String),
        }),
      }),
    );
  });

  it('returns null when the requested preset has no pending preview image', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ presets: [{ id: PRESET_ID, pending_preview_image_url: null }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getPendingPreviewImage(env, PRESET_ID, 'mod-1')).resolves.toBeNull();
  });

  it.each([
    `${IMAGE_URL}?cache=bypass`,
    `https://shots.xivdyetools.app/${IMAGE_ID}/${IMAGE_ID}.webp`,
    `https://example.com/${IMAGE_KEY}`,
  ])('rejects an unsafe pending image URL: %s', async (pendingPreviewImageUrl) => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          presets: [{ id: PRESET_ID, pending_preview_image_url: pendingPreviewImageUrl }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getPendingPreviewImage(env, PRESET_ID, 'mod-1')).resolves.toBeNull();
  });

  it('surfaces an upstream failure so the caller can leave the controls retryable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(getPendingPreviewImage(env, PRESET_ID, 'mod-1')).rejects.toBeInstanceOf(
      PresetAPIError,
    );
  });
});
