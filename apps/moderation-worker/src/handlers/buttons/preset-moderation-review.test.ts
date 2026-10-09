/**
 * FINDING-017 (2026-10-03 audit): moderator buttons carry the reviewed
 * content_revision and status. A legacy button never acts; a stale one
 * refreshes the message instead of approving text edited after it was posted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handlePresetApproveButton,
  handlePresetRejectButton,
  handlePresetRevertButton,
} from './preset-moderation.js';
import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { PresetAPIError, PresetReviewConflictError } from '../../types/preset.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import * as discordApi from '../../utils/discord-api.js';

const ID = '12345678-1234-4123-8123-123456789abc';

vi.mock('../../utils/discord-api.js', () => ({
  safeEditMessage: vi.fn(),
  safeSendMessage: vi.fn(),
  safeEditOriginalResponse: vi.fn(),
  safeSendFollowUp: vi.fn(),
}));

vi.mock('../../services/preset-api.js', async () => {
  const actual = await vi.importActual('../../services/preset-api.js');
  return {
    ...actual,
    isModerator: vi.fn(),
    approvePreset: vi.fn(),
    getModerationPreset: vi.fn(),
  };
});

vi.mock('../../services/ban-service.js', () => ({
  isPresetAuthorBanned: vi.fn(async () => false),
}));

const preset = (over: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Fresh Name',
  description: 'Fresh description',
  author_name: 'Author',
  author_discord_id: '12345678901234567',
  status: 'pending',
  dyes: [1, 2, 3],
  previous_values: null,
  moderation_status: 'unknown',
  ...over,
});

const click = (customId: string, over: Record<string, unknown> = {}) => ({
  id: 'int-1',
  token: 'token-1',
  application_id: 'app-123',
  channel_id: 'channel-mod',
  data: { custom_id: customId },
  member: { user: { id: 'mod-1', username: 'Moderator' } },
  message: {
    id: 'msg-1',
    embeds: [
      {
        title: 'Old title',
        description: '**Name:** Old name',
        color: 0xfee75c,
        fields: [{ name: 'Old field', value: 'old' }],
        footer: { text: `ID: ${ID}` },
        timestamp: '2025-01-15T10:00:00Z',
      },
    ],
  },
  ...over,
});

describe('FINDING-017 — moderation buttons are bound to a reviewed revision', () => {
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
      DB: undefined as unknown as D1Database,
    } as Env;
    ctx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
  });

  describe('a LEGACY button never acts', () => {
    it.each([
      ['approve', `preset_approve_${ID}`, handlePresetApproveButton],
      ['reject', `preset_reject_${ID}`, handlePresetRejectButton],
      ['revert', `preset_revert_${ID}`, handlePresetRevertButton],
    ] as const)(
      '%s: refreshes to the current text with new buttons, no API action and no modal',
      async (_name, customId, handler) => {
        vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
          preset: preset(),
          revision: 9,
        } as any);

        const response = await handler(click(customId), env, ctx);
        const json = (await response.json()) as any;
        await flush();

        // acknowledged as a deferred update — never a modal, never an approval
        expect(json.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);
        expect(presetApi.approvePreset).not.toHaveBeenCalled();
        expect(banService.isPresetAuthorBanned).not.toHaveBeenCalled();
        expect(discordApi.safeSendMessage).not.toHaveBeenCalled();

        expect(presetApi.getModerationPreset).toHaveBeenCalledWith(env, ID, 'mod-1');

        const edit = lastEdit();
        expect(discordApi.safeEditMessage).toHaveBeenCalledWith(
          'test-bot-token',
          'channel-mod',
          'msg-1',
          expect.anything(),
        );
        // the CURRENT text, not the stale embed's
        expect(edit.embeds[0].description).toContain('Fresh Name');
        expect(edit.embeds[0].description).toContain('Fresh description');
        expect(edit.embeds[0].description).not.toContain('Old name');
        expect(edit.embeds[0].footer.text).toBe(`ID: ${ID} • Revision 9`);
        // components are REPLACED with revision-bound buttons
        expect(edit.components).toHaveLength(1);
        const ids = edit.components[0].components.map((c: { custom_id: string }) => c.custom_id);
        expect(ids).toEqual([
          `preset_approve_${ID}:9:pending`,
          `preset_reject_${ID}:9:pending`,
        ]);

        // the moderator is told to review and click again
        expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
          'app-123',
          'token-1',
          expect.objectContaining({
            ephemeral: true,
            content: expect.stringContaining('click again'),
          }),
        );
      },
    );

    it('offers Revert in the refreshed message only for an edit that has a previous version', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ previous_values: { name: 'Before', description: 'x', tags: [], dyes: [1] } }),
        revision: 2,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      const ids = lastEdit().components[0].components.map((c: { custom_id: string }) => c.custom_id);
      expect(ids).toEqual([
        `preset_approve_${ID}:2:pending`,
        `preset_reject_${ID}:2:pending`,
        `preset_revert_${ID}:2:pending`,
      ]);
    });

    it('shows category, sanitized tags and what Revert restores in the refreshed embed', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({
          category_id: 'jobs',
          tags: ['red', '@everyone'],
          previous_values: { name: 'Before', description: 'x', tags: [], dyes: [1] },
        }),
        revision: 2,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      const description: string = lastEdit().embeds[0].description;
      expect(description).toContain('**Category:** jobs');
      expect(description).toContain('**Tags:** red,');
      expect(description).not.toContain('@everyone');
      expect(description).toContain('**Revert:** restores the saved version "Before"');
    });

    it('strips every button (components: []) when the preset is no longer pending', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'approved' }),
        revision: 3,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      // an edit WITHOUT components would leave the old live buttons in place;
      // BUG-052: one WITH embeds would overwrite a concurrent winner's
      // "Approved by", so the embed is left as Discord now holds it and the
      // status goes in the content, where every viewer sees it
      expect(lastEdit()).toEqual({ content: 'This preset is now approved.', components: [] });
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('now approved') }),
      );
    });

    it('retires the buttons when the preset no longer exists', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue(null);

      await handlePresetRejectButton(click(`preset_reject_${ID}`), env, ctx);
      await flush();

      const edit = lastEdit();
      expect(edit.components).toEqual([]);
      expect(edit.embeds[0].footer.text).toBe('That preset no longer exists.');
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
    });

    it('keeps the old message and says so when the preset cannot be fetched', async () => {
      vi.mocked(presetApi.getModerationPreset).mockRejectedValue(new Error('boom'));

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          ephemeral: true,
          content: expect.stringContaining('Nothing was changed'),
        }),
      );
    });

    it('tells the moderator when the refreshed message could not be edited', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 1,
      } as any);
      vi.mocked(discordApi.safeEditMessage).mockResolvedValue(false);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      expect(discordApi.safeSendFollowUp).toHaveBeenCalledTimes(1);
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('Could not update') }),
      );
    });

    it('answers ephemerally, without fetching, when the click carries no message', async () => {
      const response = await handlePresetApproveButton(
        click(`preset_approve_${ID}`, { message: undefined }),
        env,
        ctx,
      );
      const json = (await response.json()) as any;

      expect(json.data.flags).toBe(64);
      expect(json.data.content).toContain('/preset moderate');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
    });

    it('refuses a non-moderator without fetching anything', async () => {
      vi.mocked(presetApi.isModerator).mockReturnValue(false);

      const response = await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      const json = (await response.json()) as any;

      expect(json.data.content).toContain('do not have permission');
      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });
  });

  describe('a revision-bound button acts on exactly the reviewed revision', () => {
    it('approve sends the expected revision and status', async () => {
      vi.mocked(presetApi.approvePreset).mockResolvedValue({ id: ID, name: 'Approved name' } as any);

      const response = await handlePresetApproveButton(
        click(`preset_approve_${ID}:12:flagged`),
        env,
        ctx,
      );
      await flush();

      expect(((await response.json()) as any).type).toBe(
        InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      );
      expect(presetApi.approvePreset).toHaveBeenCalledWith(env, ID, 'mod-1', {
        revision: 12,
        status: 'flagged',
      });
      expect(lastEdit().components).toEqual([]);
    });

    it.each([
      ['approve', handlePresetApproveButton],
      ['reject', handlePresetRejectButton],
      ['revert', handlePresetRevertButton],
    ] as const)('%s refuses a malformed revision or status', async (name, handler) => {
      for (const suffix of [':-1:pending', ':01:pending', ':3:bogus', ':3', ':3:pending:x']) {
        const response = await handler(click(`preset_${name}_${ID}${suffix}`), env, ctx);
        const json = (await response.json()) as any;
        expect(json.data.content).toContain('Invalid preset ID format');
      }
      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('opens the modal bound to the same revision and status as the reject click', async () => {
      const response = await handlePresetRejectButton(
        click(`preset_reject_${ID}:21:flagged`),
        env,
        ctx,
      );
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.MODAL);
      expect(json.data.custom_id).toBe(`preset_reject_modal_${ID}:21:flagged`);
      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
    });

    it('opens the modal bound to the same revision and status as the revert click', async () => {
      const response = await handlePresetRevertButton(
        click(`preset_revert_${ID}:21:pending`),
        env,
        ctx,
      );
      const json = (await response.json()) as any;

      expect(json.type).toBe(InteractionResponseType.MODAL);
      expect(json.data.custom_id).toBe(`preset_revert_modal_${ID}:21:pending`);
    });

    it('still refuses a banned author before calling presets-api', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetApproveButton(click(`preset_approve_${ID}:4:pending`), env, ctx);
      await flush();

      expect(presetApi.approvePreset).not.toHaveBeenCalled();
      const errorField = lastEdit().embeds[0].fields.find((f: { name: string }) => f.name === 'Error');
      expect(errorField.value).toMatch(/banned/i);
    });
  });

  describe('a stale review refreshes instead of approving', () => {
    it.each(['STALE_REVIEW', 'REVISION_REQUIRED'] as const)(
      '%s from presets-api -> current text, new buttons, no approval log',
      async (code) => {
        vi.mocked(presetApi.approvePreset).mockRejectedValue(
          new PresetReviewConflictError(code, 'The preset changed', {
            status: 'pending',
            content_revision: 6,
          }),
        );
        vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
          preset: preset({ name: 'Edited since' }),
          revision: 6,
        } as any);

        await handlePresetApproveButton(click(`preset_approve_${ID}:5:pending`), env, ctx);
        await flush();

        expect(presetApi.approvePreset).toHaveBeenCalledWith(env, ID, 'mod-1', {
          revision: 5,
          status: 'pending',
        });
        expect(presetApi.getModerationPreset).toHaveBeenCalledWith(env, ID, 'mod-1');

        const edit = lastEdit();
        expect(edit.embeds[0].description).toContain('Edited since');
        expect(edit.embeds[0].footer.text).toContain('Revision 6');
        expect(edit.components[0].components[0].custom_id).toBe(`preset_approve_${ID}:6:pending`);
        // nothing was approved, so nothing is logged and no error is shown
        expect(discordApi.safeSendMessage).not.toHaveBeenCalled();
        expect(JSON.stringify(edit)).not.toContain('Failed to approve');
        expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
          'app-123',
          'token-1',
          expect.objectContaining({ ephemeral: true }),
        );
      },
    );

    it('replaces the components even when the preset has left pending (no stale live buttons)', async () => {
      vi.mocked(presetApi.approvePreset).mockRejectedValue(
        new PresetReviewConflictError('STALE_REVIEW', 'changed', null),
      );
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'rejected' }),
        revision: 8,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}:5:pending`), env, ctx);
      await flush();

      expect(lastEdit()).toHaveProperty('components', []);
    });

    it('keeps the dye-signature 409 as an ordinary error (no refresh)', async () => {
      vi.mocked(presetApi.approvePreset).mockRejectedValue(
        new PresetAPIError(409, 'Another visible preset already uses this dye combination'),
      );

      await handlePresetApproveButton(click(`preset_approve_${ID}:4:pending`), env, ctx);
      await flush();

      expect(presetApi.getModerationPreset).not.toHaveBeenCalled();
      const errorField = lastEdit().embeds[0].fields.find((f: { name: string }) => f.name === 'Error');
      expect(errorField.value).toBe(
        'Failed to approve: Another visible preset already uses this dye combination',
      );
      expect(discordApi.safeSendFollowUp).not.toHaveBeenCalled();
    });
  });

  describe('the refreshed embed is sanitised', () => {
    it('escapes markdown, links and mentions in name, description and author', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({
          name: '[Click](https://evil.example) **now**',
          description: '@everyone [x](https://evil.example)',
          author_name: '@here _Author_',
          author_discord_id: 'not-a-snowflake',
        }),
        revision: 1,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      const description: string = lastEdit().embeds[0].description;
      expect(description).not.toMatch(/\[Click\]\(https:\/\/evil\.example\)/);
      expect(description).toContain('\\*\\*now\\*\\*');
      expect(description).not.toContain('@everyone');
      expect(description).not.toContain('@here');
      // a non-snowflake author id (an XIVAuth UUID) is never rendered as a mention
      expect(description).not.toContain('<@');
    });

    // 2026-10-03 FINDING-008: the bot privacy policy promises moderation posts
    // show no Discord User ID — not even for a real snowflake author.
    it('never mentions the author, even when the author id is a Discord snowflake', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ author_name: 'Author', author_discord_id: '12345678901234567' }),
        revision: 1,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      const description: string = lastEdit().embeds[0].description;
      expect(description).toContain('**Author:** Author');
      expect(description).not.toContain('<@');
      expect(description).not.toContain('12345678901234567');
    });

    it('never presents moderation_status as a content-filter verdict', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ moderation_status: 'flagged' }),
        revision: 1,
      } as any);

      await handlePresetApproveButton(click(`preset_approve_${ID}`), env, ctx);
      await flush();

      const rendered = JSON.stringify(lastEdit().embeds[0]);
      expect(rendered).not.toContain('moderation_status');
      expect(rendered).not.toMatch(/clean|passed|filter/i);
    });
  });

  describe('a confirm click on an ephemeral message (/preset moderate)', () => {
    it('edits through the interaction webhook, not the channel endpoint', async () => {
      vi.mocked(presetApi.approvePreset).mockResolvedValue({ id: ID, name: 'Approved name' } as any);
      const base = click(`preset_approve_${ID}:4:pending`);

      await handlePresetApproveButton(
        { ...base, message: { ...base.message, flags: 64 } },
        env,
        ctx,
      );
      await flush();

      expect(presetApi.approvePreset).toHaveBeenCalledWith(env, ID, 'mod-1', {
        revision: 4,
        status: 'pending',
      });
      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({
          components: [],
          embeds: [expect.objectContaining({ title: expect.stringContaining('Approved') })],
        }),
      );
    });

    // The confirmation is private to this moderator, so no other moderator's
    // "Approved by" can be on it: it is rebuilt from the current preset (the
    // BUG-052 embed-preserving edit is for channel messages only).
    it('rebuilds the confirmation when the preset was decided elsewhere first', async () => {
      vi.mocked(presetApi.approvePreset).mockRejectedValue(
        new PresetReviewConflictError('STALE_REVIEW', 'stale', {
          status: 'approved',
          content_revision: 5,
        }),
      );
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'approved' }),
        revision: 5,
      } as any);
      const base = click(`preset_approve_${ID}:4:pending`);

      await handlePresetApproveButton(
        { ...base, message: { ...base.message, flags: 64 } },
        env,
        ctx,
      );
      await flush();

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      const edit = vi.mocked(discordApi.safeEditOriginalResponse).mock.calls[0][2] as any;
      expect(edit.components).toEqual([]);
      expect(edit).not.toHaveProperty('content');
      expect(edit.embeds[0].title).toBe('🟢 Preset Review');
      expect(edit.embeds[0].description).toContain('**Status:** approved');
      expect(edit.embeds[0].footer.text).toBe(`ID: ${ID} • Revision 5`);
    });

    it('refreshes through the interaction webhook too', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 2,
      } as any);
      const base = click(`preset_approve_${ID}`);

      await handlePresetApproveButton(
        { ...base, message: { ...base.message, flags: 64 } },
        env,
        ctx,
      );
      await flush();

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ components: expect.any(Array) }),
      );
    });
  });

  // BUG-050 (2026-10-04 deep-dive): a failed approve leaves an 'Error' field and
  // the buttons live. The retry must not carry that field into its own edit.
  describe('a message that already shows an earlier Error', () => {
    const afterFailure = (customId: string) =>
      click(customId, {
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: 'Old title',
              description: '**Name:** Old name',
              color: 0xfee75c,
              fields: [
                { name: 'Old field', value: 'old' },
                { name: 'Error', value: 'Failed to approve: earlier outage', inline: false },
              ],
              footer: { text: `ID: ${ID}` },
              timestamp: '2025-01-15T10:00:00Z',
            },
          ],
        },
      });
    const fieldsOf = () => lastEdit().embeds[0].fields as Array<{ name: string; value: string }>;
    const errorsOf = () => fieldsOf().filter((f) => f.name === 'Error');

    it('a successful approve drops the stale Error field and keeps the rest', async () => {
      vi.mocked(presetApi.approvePreset).mockResolvedValue({ id: ID, name: 'Approved name' } as any);

      await handlePresetApproveButton(afterFailure(`preset_approve_${ID}:4:pending`), env, ctx);
      await flush();

      expect(lastEdit().embeds[0].title).toContain('Preset Approved');
      expect(errorsOf()).toEqual([]);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Action']);
    });

    it('a second failure replaces the Error field instead of adding another', async () => {
      vi.mocked(presetApi.approvePreset).mockRejectedValue(
        new PresetAPIError(409, 'Another visible preset already uses this dye combination'),
      );

      await handlePresetApproveButton(afterFailure(`preset_approve_${ID}:4:pending`), env, ctx);
      await flush();

      expect(errorsOf()).toEqual([
        {
          name: 'Error',
          value: 'Failed to approve: Another visible preset already uses this dye combination',
          inline: false,
        },
      ]);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Error']);
    });

    it('the banned-author refusal also replaces the Error field', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetApproveButton(afterFailure(`preset_approve_${ID}:4:pending`), env, ctx);
      await flush();

      expect(errorsOf()).toHaveLength(1);
      expect(errorsOf()[0].value).toMatch(/^Not approved: .*banned/);
      expect(fieldsOf().map((f) => f.name)).toEqual(['Old field', 'Error']);
    });
  });

  // BUG-050's class (Sprint 17 review): the /preset moderate confirmation (and
  // any refreshed message) carries a 'Review' field telling the moderator to
  // click Approve. Once the preset is approved that instruction is wrong; while
  // it is still undecided (a failure) it is still the next step.
  describe("a message that carries the confirmation's Review instruction", () => {
    const REVIEW = {
      name: 'Review',
      value:
        'Review this text, then click Approve to confirm. The decision applies to this exact version.',
      inline: false,
    };
    const confirmation = () => {
      const base = click(`preset_approve_${ID}:4:pending`);
      return {
        ...base,
        message: {
          id: 'msg-eph',
          flags: 64,
          embeds: [
            {
              title: '🟡 Preset Review',
              description: '**Name:** Fresh Name',
              color: 0xfee75c,
              fields: [REVIEW, { name: 'Error', value: 'Failed to approve: earlier outage' }],
              footer: { text: `ID: ${ID} • Revision 4` },
            },
          ],
        },
      };
    };
    const fieldNames = (): string[] => {
      const calls = vi.mocked(discordApi.safeEditOriginalResponse).mock.calls;
      const edit = calls[calls.length - 1][2] as any;
      return edit.embeds[0].fields.map((f: { name: string }) => f.name);
    };

    it('a successful approve drops both the Review instruction and the stale Error', async () => {
      vi.mocked(presetApi.approvePreset).mockResolvedValue({ id: ID, name: 'Approved name' } as any);

      await handlePresetApproveButton(confirmation(), env, ctx);
      await flush();

      expect(fieldNames()).toEqual(['Action']);
    });

    it('a failed approve keeps the Review instruction for the retry', async () => {
      vi.mocked(presetApi.approvePreset).mockRejectedValue(new PresetAPIError(503, 'Service down'));

      await handlePresetApproveButton(confirmation(), env, ctx);
      await flush();

      expect(fieldNames()).toEqual(['Review', 'Error']);
    });

    it('the banned-author refusal keeps the Review instruction too', async () => {
      vi.mocked(banService.isPresetAuthorBanned).mockResolvedValueOnce(true);

      await handlePresetApproveButton(confirmation(), env, ctx);
      await flush();

      expect(fieldNames()).toEqual(['Review', 'Error']);
    });
  });
});
