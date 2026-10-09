/**
 * FINDING-017 (2026-10-03 audit): the reject / revert modals carry the reviewed
 * revision and status in their custom_id. A modal opened from a pre-change
 * button and submitted after the deploy refreshes the message instead of acting.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handlePresetRejectionModal,
  handlePresetRevertModal,
} from './preset-rejection.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { PresetAPIError, PresetReviewConflictError } from '../../types/preset.js';
import * as presetApi from '../../services/preset-api.js';
import * as discordApi from '../../utils/discord-api.js';
import * as banService from '../../services/ban-service.js';

const ID = 'a0000000-0000-4000-8000-000000000001';
const BOUND = ':8:pending';
const REASON = 'This text is not acceptable here';

vi.mock('../../utils/discord-api.js', () => ({
  safeEditMessage: vi.fn(),
  safeSendMessage: vi.fn(),
  safeEditOriginalResponse: vi.fn(),
  safeSendFollowUp: vi.fn(),
}));

vi.mock('../../services/ban-service.js', () => ({
  isPresetAuthorBanned: vi.fn(async () => false),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    rejectPreset: vi.fn(),
    revertPreset: vi.fn(),
    getModerationPreset: vi.fn(),
  };
});

const submit = (customId: string, field: 'rejection_reason' | 'revert_reason', value: string, over = {}) => ({
  id: 'int-1',
  token: 'token-1',
  application_id: 'app-123',
  channel_id: 'channel-mod',
  data: {
    custom_id: customId,
    components: [{ type: 1, components: [{ type: 4, custom_id: field, value }] }],
  },
  member: { user: { id: 'mod-1', username: 'Moderator' } },
  message: {
    id: 'msg-1',
    embeds: [{ title: 'Old', description: '**Name:** Old name', footer: { text: `ID: ${ID}` } }],
  },
  ...over,
});

const preset = (over: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Fresh Name',
  description: 'Fresh description',
  author_name: 'Author',
  author_discord_id: '12345678901234567',
  status: 'pending',
  dyes: [1, 2],
  previous_values: { name: 'Before', description: 'x', tags: [], dyes: [1] },
  moderation_status: 'unknown',
  ...over,
});

describe('FINDING-017 — rejection / revert modals', () => {
  let env: Env;
  let ctx: ExecutionContext;

  const flush = async () => {
    const calls = vi.mocked(ctx.waitUntil).mock.calls;
    const p = calls[calls.length - 1]?.[0];
    if (p) await p;
  };
  const lastEdit = () => {
    const calls = vi.mocked(discordApi.safeEditMessage).mock.calls;
    return calls[calls.length - 1][3] as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(presetApi.isModerator).mockReturnValue(true);
    vi.mocked(banService.isPresetAuthorBanned).mockResolvedValue(false);
    vi.mocked(discordApi.safeEditMessage).mockResolvedValue(true);
    vi.mocked(discordApi.safeEditOriginalResponse).mockResolvedValue(true);
    vi.mocked(discordApi.safeSendFollowUp).mockResolvedValue(true);
    env = {
      DISCORD_TOKEN: 'test-bot-token',
      DISCORD_CLIENT_ID: 'app-123',
      MODERATOR_IDS: 'mod-1',
      SUBMISSION_LOG_CHANNEL_ID: 'channel-log',
    } as Env;
    ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('revision-bound submit', () => {
    it('reject: sends the revision and status carried in the modal custom_id', async () => {
      vi.mocked(presetApi.rejectPreset).mockResolvedValue({ id: ID, name: 'N' } as any);

      const response = await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', REASON),
        env,
        ctx,
      );
      await flush();

      expect(((await response.json()) as any).type).toBe(
        InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      );
      expect(presetApi.rejectPreset).toHaveBeenCalledWith(env, ID, 'mod-1', REASON, {
        revision: 8,
        status: 'pending',
      });
      expect(lastEdit().components).toEqual([]);
    });

    it('revert: sends the revision and status carried in the modal custom_id', async () => {
      vi.mocked(presetApi.revertPreset).mockResolvedValue({ id: ID, name: 'N' } as any);

      await handlePresetRevertModal(
        submit(`preset_revert_modal_${ID}:3:flagged`, 'revert_reason', REASON),
        env,
        ctx,
      );
      await flush();

      expect(presetApi.revertPreset).toHaveBeenCalledWith(env, ID, REASON, 'mod-1', {
        revision: 3,
        status: 'flagged',
      });
      expect(lastEdit().components).toEqual([]);
    });

    it.each([
      ['reject', handlePresetRejectionModal, 'rejection_reason'],
      ['revert', handlePresetRevertModal, 'revert_reason'],
    ] as const)('%s: refuses a malformed revision or status', async (name, handler, field) => {
      for (const suffix of [':-1:pending', ':01:pending', ':3:bogus', ':3', ':3:pending:x']) {
        const response = await handler(
          submit(`preset_${name}_modal_${ID}${suffix}`, field, REASON),
          env,
          ctx,
        );
        expect(((await response.json()) as any).data.embeds[0].description).toContain(
          'Invalid preset ID format',
        );
      }
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
      expect(presetApi.revertPreset).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('refuses a modal id of the other kind', async () => {
      const response = await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', REASON, {
          data: {
            custom_id: `preset_revert_modal_${ID}${BOUND}`,
            components: [],
          },
        }),
        env,
        ctx,
      );
      // not a reject-modal prefix at all -> nothing to parse
      expect(((await response.json()) as any).data.embeds[0].description).toContain('Invalid');
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    it('still enforces the ten-character reason floor', async () => {
      const response = await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', 'too short'),
        env,
        ctx,
      );
      expect(((await response.json()) as any).data.embeds[0].description).toContain(
        'at least 10 characters',
      );
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });
  });

  describe('a banned author', () => {
    it('revert: never publishes a banned author\'s pending edit', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetRevertModal(
        submit(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason', REASON),
        env,
        ctx,
      );
      await flush();

      expect(presetApi.revertPreset).not.toHaveBeenCalled();
      const edit = lastEdit();
      expect(JSON.stringify(edit)).toContain('Not reverted');
      expect(edit).not.toHaveProperty('components');
      expect(discordApi.safeSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('a LEGACY modal submitted after the deploy never acts', () => {
    it.each([
      ['reject', handlePresetRejectionModal, 'rejection_reason'],
      ['revert', handlePresetRevertModal, 'revert_reason'],
    ] as const)('%s: refreshes the message with new revision-bound buttons', async (name, handler, field) => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 11,
      } as any);

      const response = await handler(
        submit(`preset_${name}_modal_${ID}`, field, REASON),
        env,
        ctx,
      );
      await flush();

      expect(((await response.json()) as any).type).toBe(
        InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      );
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
      expect(presetApi.revertPreset).not.toHaveBeenCalled();
      expect(discordApi.safeSendMessage).not.toHaveBeenCalled();

      const edit = lastEdit();
      expect(edit.embeds[0].description).toContain('Fresh Name');
      expect(edit.embeds[0].footer.text).toContain('Revision 11');
      // components replaced: approve / reject / revert (the preset has a previous version)
      expect(edit.components[0].components.map((c: { custom_id: string }) => c.custom_id)).toEqual([
        `preset_approve_${ID}:11:pending`,
        `preset_reject_${ID}:11:pending`,
        `preset_revert_${ID}:11:pending`,
      ]);
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          ephemeral: true,
          content: expect.stringContaining('click again'),
        }),
      );
    });

    it('refreshes even when the typed reason was too short (the reason is discarded)', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 1,
      } as any);

      await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}`, 'rejection_reason', 'x'),
        env,
        ctx,
      );
      await flush();

      expect(discordApi.safeEditMessage).toHaveBeenCalledTimes(1);
      expect(presetApi.rejectPreset).not.toHaveBeenCalled();
    });

    it('refuses a non-moderator without fetching', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const response = await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}`, 'rejection_reason', REASON),
        env,
        ctx,
      );

      expect(((await response.json()) as any).data.embeds[0].description).toContain(
        'do not have permission',
      );
      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
    });
  });

  describe('a stale review refreshes instead of acting', () => {
    it('reject: STALE_REVIEW -> current text and new buttons, no log post', async () => {
      vi.mocked(presetApi.rejectPreset).mockRejectedValue(
        new PresetReviewConflictError('STALE_REVIEW', 'changed', {
          status: 'pending',
          content_revision: 9,
        }),
      );
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ previous_values: null }),
        revision: 9,
      } as any);

      await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', REASON),
        env,
        ctx,
      );
      await flush();

      const edit = lastEdit();
      expect(edit.embeds[0].footer.text).toContain('Revision 9');
      expect(edit.components[0].components[0].custom_id).toBe(`preset_approve_${ID}:9:pending`);
      expect(JSON.stringify(edit)).not.toContain('Failed to reject');
      expect(discordApi.safeSendMessage).not.toHaveBeenCalled();
    });

    it('revert: REVISION_REQUIRED -> current text and new buttons, no log post', async () => {
      vi.mocked(presetApi.revertPreset).mockRejectedValue(
        new PresetReviewConflictError('REVISION_REQUIRED', 'required', null),
      );
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'approved' }),
        revision: 4,
      } as any);

      await handlePresetRevertModal(
        submit(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason', REASON),
        env,
        ctx,
      );
      await flush();

      // approved now: nothing left to review, the old buttons are gone, and
      // (BUG-052) the embed is left alone while the content states the status
      expect(lastEdit()).toEqual({ content: 'This preset is now approved.', components: [] });
      expect(discordApi.safeSendMessage).not.toHaveBeenCalled();
    });

    it('reject: keeps the dye-signature 409 as an ordinary error', async () => {
      vi.mocked(presetApi.rejectPreset).mockRejectedValue(
        new PresetAPIError(409, 'Another visible preset already uses this dye combination'),
      );

      await handlePresetRejectionModal(
        submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', REASON),
        env,
        ctx,
      );
      await flush();

      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
      const errorField = lastEdit().embeds[0].fields.find((f: { name: string }) => f.name === 'Error');
      expect(errorField.value).toBe(
        'Failed to reject: Another visible preset already uses this dye combination',
      );
    });
  });

  describe('a submit from an ephemeral confirmation (/preset moderate)', () => {
    it('edits through the interaction webhook', async () => {
      vi.mocked(presetApi.rejectPreset).mockResolvedValue({ id: ID, name: 'N' } as any);
      const base = submit(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason', REASON);

      await handlePresetRejectionModal(
        { ...base, message: { ...base.message, flags: 64 } },
        env,
        ctx,
      );
      await flush();

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ components: [] }),
      );
    });
  });

  // BUG-050 (2026-10-04 deep-dive): a failed reject / revert leaves an 'Error'
  // field and the buttons live. The next attempt must not carry it forward.
  describe('a message that already shows an earlier Error', () => {
    const afterFailure = (customId: string, field: 'rejection_reason' | 'revert_reason') =>
      submit(customId, field, REASON, {
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: 'Old',
              description: '**Name:** Old name',
              fields: [
                { name: 'Old field', value: 'old' },
                { name: 'Error', value: 'Failed to reject: earlier outage', inline: false },
              ],
              footer: { text: `ID: ${ID}` },
            },
          ],
        },
      });
    const fieldsOf = () => lastEdit().embeds[0].fields as Array<{ name: string; value: string }>;
    const errorsOf = () => fieldsOf().filter((f) => f.name === 'Error');
    const dyeClash = () =>
      new PresetAPIError(409, 'Another visible preset already uses this dye combination');

    it('reject: a successful submit drops the stale Error field and keeps the rest', async () => {
      vi.mocked(presetApi.rejectPreset).mockResolvedValue({ id: ID, name: 'N' } as any);

      await handlePresetRejectionModal(
        afterFailure(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason'),
        env,
        ctx,
      );
      await flush();

      expect(lastEdit().embeds[0].title).toContain('Preset Rejected');
      expect(errorsOf()).toEqual([]);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Action', 'Reason']);
    });

    it('revert: a successful submit shows no Error field', async () => {
      vi.mocked(presetApi.revertPreset).mockResolvedValue({ id: ID, name: 'N' } as any);

      await handlePresetRevertModal(
        afterFailure(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason'),
        env,
        ctx,
      );
      await flush();

      expect(lastEdit().embeds[0].title).toContain('Reverted');
      expect(errorsOf()).toEqual([]);
    });

    it('reject: a second failure replaces the Error field instead of adding another', async () => {
      vi.mocked(presetApi.rejectPreset).mockRejectedValue(dyeClash());

      await handlePresetRejectionModal(
        afterFailure(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason'),
        env,
        ctx,
      );
      await flush();

      expect(errorsOf()).toEqual([
        {
          name: 'Error',
          value: 'Failed to reject: Another visible preset already uses this dye combination',
          inline: false,
        },
      ]);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Error']);
    });

    it('revert: a second failure replaces the Error field instead of adding another', async () => {
      vi.mocked(presetApi.revertPreset).mockRejectedValue(dyeClash());

      await handlePresetRevertModal(
        afterFailure(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason'),
        env,
        ctx,
      );
      await flush();

      expect(errorsOf()).toHaveLength(1);
      expect(errorsOf()[0].value).toMatch(/^Failed to revert: /);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Error']);
    });

    it('revert: the banned-author refusal also replaces the Error field', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetRevertModal(
        afterFailure(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason'),
        env,
        ctx,
      );
      await flush();

      expect(presetApi.revertPreset).not.toHaveBeenCalled();
      expect(errorsOf()).toHaveLength(1);
      expect(errorsOf()[0].value).toMatch(/^Not reverted: /);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Error']);
    });
  });

  // BUG-050's class (Sprint 17 review): the 'Review' instruction a confirmation
  // or a refreshed message carries ("…click Reject to confirm") is wrong once
  // the preset is decided, and still the next step after a failure.
  describe("a message that carries the confirmation's Review instruction", () => {
    const withReview = (customId: string, field: 'rejection_reason' | 'revert_reason') =>
      submit(customId, field, REASON, {
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: 'Old',
              description: '**Name:** Old name',
              fields: [
                { name: 'Review', value: 'Review this text, then click Reject to confirm.' },
                { name: 'Error', value: 'Failed to reject: earlier outage', inline: false },
              ],
              footer: { text: `ID: ${ID}` },
            },
          ],
        },
      });
    const fieldNames = () =>
      (lastEdit().embeds[0].fields as Array<{ name: string }>).map((f) => f.name);

    it('reject: a successful submit drops both the Review instruction and the stale Error', async () => {
      vi.mocked(presetApi.rejectPreset).mockResolvedValue({ id: ID, name: 'N' } as any);

      await handlePresetRejectionModal(
        withReview(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason'),
        env,
        ctx,
      );
      await flush();

      expect(fieldNames()).toEqual(['Action', 'Reason']);
    });

    it('reject: a failed submit keeps the Review instruction for the retry', async () => {
      vi.mocked(presetApi.rejectPreset).mockRejectedValue(new PresetAPIError(503, 'Service down'));

      await handlePresetRejectionModal(
        withReview(`preset_reject_modal_${ID}${BOUND}`, 'rejection_reason'),
        env,
        ctx,
      );
      await flush();

      expect(fieldNames()).toEqual(['Review', 'Error']);
    });

    it('revert: a failed submit and the banned-author refusal keep it too', async () => {
      vi.mocked(presetApi.revertPreset).mockRejectedValue(new PresetAPIError(503, 'Service down'));

      await handlePresetRevertModal(
        withReview(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason'),
        env,
        ctx,
      );
      await flush();
      expect(fieldNames()).toEqual(['Review', 'Error']);

      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);
      await handlePresetRevertModal(
        withReview(`preset_revert_modal_${ID}${BOUND}`, 'revert_reason'),
        env,
        ctx,
      );
      await flush();
      expect(fieldNames()).toEqual(['Review', 'Error']);
    });
  });
});
